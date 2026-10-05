import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { db, analyses, packs, messages, positions, kv, users, briefings, cancellations, resets, UPLOAD_DIR } from './lib/db.js';
import { mailEnabled, sendMail } from './lib/mail.js';
import { berlinParts, startScheduler } from './lib/scheduler.js';
import { computeStats } from './lib/depot.js';
import { createTicker } from './lib/ticker.js';
import { accessFor, redactAnalysis, redactPosition } from './lib/access.js';
import { hashPassword, verifyPassword } from './lib/passwords.js';
import { paymentsEnabled, createCheckout, createPortal, verifyWebhook, applyEvent, cancelAtPeriodEnd } from './lib/billing.js';
import {
  ADMIN_PASSWORD, PASSWORD_GENERATED, checkPassword, makeToken, verifyToken,
  parseCookies, sessionCookie, clearCookie, loginAllowed, recordLogin, makeUserToken, userIdFromToken, tokenIssuedAt, userCookie, clearUserCookie,
} from './lib/auth.js';
import { HttpError, parseAnalysis, parseContact, parsePosition, parseSettings, parseProfile, parseCredentials, parseNewPassword, parseLegal, parseCancellation, saveImage, deleteImage } from './lib/validate.js';
import { generatePack, generatePromoPack, generateBriefingRecord, finalize, testAgent, providerName } from './lib/agent/index.js';

const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = Number(process.env.PORT || 3000);
// Scripts and styles are served under /v/<build>/ so every release gets fresh URLs: browsers can cache them for good
// and still never mix an old script with a new page. ES module imports resolve relative to that path, so they follow.
const BUILD = process.env.BUILD_ID || Date.now().toString(36);
const MAX_BODY = 12 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
};
// Only the markets page may load the TradingView chart embed (after the visitor agrees on the page).
const MARKETS_CSP = "default-src 'self'; img-src 'self' blob: data: https://*.tradingview.com; style-src 'self' 'unsafe-inline'; "
  + "script-src 'self' https://s3.tradingview.com; frame-src https://*.tradingview.com https://*.tradingview-widget.com; frame-ancestors 'none'";

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}
const json = (res, status, data, headers = {}) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

async function readJson(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Expected application/json');
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request too large');
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw new HttpError(400, 'Invalid JSON'); }
}

// Behind a hosting proxy the socket address is the proxy, so the real client IP comes from X-Forwarded-For.
// Only trusted when TRUST_PROXY is set (the hosting config sets it); otherwise clients could spoof it.
const clientIp = (req) => (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
const isHttps = (req) => req.headers['x-forwarded-proto'] === 'https';
const publicUrl = (req) => (process.env.PUBLIC_URL || `${isHttps(req) ? 'https' : 'http'}://${req.headers.host}`).replace(/\/$/, '');

const contactHits = new Map();
function rateLimit(ip, bucket = 'msg', max = 5) {
  const key = `${bucket}:${ip}`, now = Date.now();
  const hits = (contactHits.get(key) || []).filter((t) => now - t < 3600_000);
  if (hits.length >= max) throw new HttpError(429, 'Zu viele Versuche. Bitte versuche es später erneut.');
  contactHits.set(key, [...hits, now]);
}

// Free access window: set once on first start (today + 30 days) and editable in the admin settings.
function getConfig() {
  let free_until = kv.get('free_until');
  if (!free_until) {
    free_until = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    kv.set('free_until', free_until);
  }
  const days_left = Math.max(0, Math.ceil((Date.parse(`${free_until}T00:00:00Z`) - Date.now()) / 864e5));
  return { free_until, days_left, price: kv.get('price', 5.99), small_business: kv.get('small_business', true), payments_enabled: paymentsEnabled(), profile: kv.get('profile', {}) };
}

const ticker = createTicker();

// One-time switch to the 5.99 € membership (Oct 2026). The admin can still change the price in Settings afterwards.
if (!kv.get('pricing_v2')) { kv.set('price', 5.99); kv.set('pricing_v2', true); }

const depotView = () => { const list = positions.list(); return { positions: list, stats: computeStats(list) }; };

function promoFacts() {
  const { stats } = depotView(), cfg = getConfig();
  return {
    free_days_left: cfg.days_left, price_after_eur_per_month: cfg.price, published_analyses: analyses.list(true).length,
    hit_rate: stats.closed ? stats.hit_rate : null, hits: stats.closed ? stats.hits : null, closed: stats.closed || null,
    depot_is_simulated: 'yes, no real money',
  };
}

// Facts for the daily briefing: public fields only, so social posts never leak member-only details.
function briefingFacts(day) {
  const since = new Date(Date.parse(`${day}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10);
  const { stats } = depotView(), cfg = getConfig();
  return {
    date: day, free_days_left: cfg.days_left,
    analyses: analyses.list(true).filter((a) => a.analysis_date >= since).slice(0, 6).map((a) => ({ asset: a.asset, timeframe: a.timeframe, analysis_date: a.analysis_date, wave_count: a.wave_count, scenario_primary: a.scenario_primary })),
    depot: { hit_rate: stats.closed ? stats.hit_rate : null, hits: stats.hits, closed: stats.closed, open: stats.open, watching: stats.watching, simulated: true },
  };
}

async function runBriefing(day) {
  const rec = await generateBriefingRecord(briefingFacts(day));
  return briefings.save(day, rec, 'draft');
}

const promoGet = () => kv.get('promo_pack');
function promoSave(content, status) {
  const row = { content, status, updated_at: new Date().toISOString() };
  kv.set('promo_pack', row);
  return row;
}
const isAdmin = (req) => verifyToken(parseCookies(req.headers.cookie).ah_session);
const publicView = ({ updated_at, ...a }) => a;

async function readRaw(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new HttpError(413, 'Request too large'); chunks.push(c); }
  return Buffer.concat(chunks);
}

function currentUser(req) {
  const token = parseCookies(req.headers.cookie).ah_user, id = userIdFromToken(token);
  const user = id ? users.get(id) : null;
  // A password change or reset signs out every other device.
  if (user?.pw_changed_at && tokenIssuedAt(token) < user.pw_changed_at) return null;
  return user;
}
const signIn = (req, user) => ({ 'Set-Cookie': userCookie(makeUserToken(user.id), isHttps(req)) });
const RESET_TTL_MS = 60 * 60 * 1000;
const accessOf = (req) => accessFor({ user: currentUser(req), admin: isAdmin(req), config: getConfig() });
const userView = (u) => u && { email: u.email, comped: !!u.comped, sub_status: u.sub_status, sub_period_end: u.sub_period_end, has_customer: !!u.stripe_customer_id, created_at: u.created_at };
const me = (req, user = currentUser(req)) => ({ user: userView(user), access: accessFor({ user, admin: isAdmin(req), config: getConfig() }), config: getConfig(), payments_enabled: paymentsEnabled() });
const LEGAL_KEYS = ['imprint', 'privacy', 'terms'];
const DUMMY_HASH = await hashPassword('dummy-password-for-timing');

// Text assets are gzip-compressed once and kept in memory until the file changes.
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.svg', '.json']);
const gzCache = new Map();

async function serveFile(req, res, path, cache, status = 200, extra = {}) {
  try {
    const st = await stat(path);
    if (!st.isFile()) throw new Error('not a file');
    const ext = extname(path);
    // ETag lets browsers revalidate cheaply, so a new release shows up on the next page load (304 when unchanged).
    const etag = `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache, Vary: 'Accept-Encoding', ETag: etag, ...extra };
    if (status === 200 && req.headers['if-none-match'] === etag && ext !== '.html') return send(res, 304, '', { ETag: etag, 'Cache-Control': cache });
    let body = await readFile(path);
    // HTML may reference absolute URLs (link previews need them): fill in this site's address.
    const base = ext === '.html' ? publicUrl(req) : '';
    if (base) body = Buffer.from(body.toString('utf8').replaceAll('%PUBLIC_URL%', base).replace(/(src|href)="\/(js|css)\//g, `$1="/v/${BUILD}/$2/`));
    if (COMPRESSIBLE.has(ext) && body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const key = `${path}|${base}`, hit = gzCache.get(key);
      if (hit?.mtime === st.mtimeMs) body = hit.data;
      else { body = gzipSync(body, { level: 9 }); gzCache.set(key, { mtime: st.mtimeMs, data: body }); }
      headers['Content-Encoding'] = 'gzip';
    }
    send(res, status, body, headers);
  } catch {
    if (status === 404) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    return serveFile(req, res, join(PUBLIC_DIR, '404.html'), 'no-cache', 404);
  }
}

async function api(req, res, url) {
  const path = url.pathname;
  const method = req.method;
  const ip = clientIp(req);

  // Public API
  if (method === 'GET' && path === '/api/analyses') {
    const access = accessOf(req);
    return json(res, 200, analyses.list(true).map((a) => redactAnalysis(publicView(a), access)));
  }
  let m = /^\/api\/analyses\/(\d+)$/.exec(path);
  if (m && method === 'GET') {
    const a = analyses.get(Number(m[1]));
    if (!a || (a.status !== 'published' && !isAdmin(req))) throw new HttpError(404, 'Not found');
    return json(res, 200, redactAnalysis(publicView(a), accessOf(req)));
  }

  // Contact form (public, rate limited per IP: 5 messages per hour)
  if (method === 'POST' && path === '/api/contact') {
    const data = parseContact(await readJson(req));
    rateLimit(ip);
    messages.create(data);
    return json(res, 201, { ok: true });
  }
  if (method === 'GET' && path === '/api/config') return json(res, 200, getConfig());
  if (method === 'GET' && path === '/api/ticker') return json(res, 200, { coins: await ticker() });
  if (method === 'GET' && path === '/api/depot') {
    const access = accessOf(req), { positions: list, stats } = depotView();
    return json(res, 200, { positions: list.map((p) => redactPosition(p, access)).filter(Boolean), count: list.length, stats, locked: !access.active });
  }
  if (method === 'GET' && path === '/api/legal') { const out = {}; for (const k of LEGAL_KEYS) out[k] = kv.get(`legal_${k}`, ''); return json(res, 200, out); }

  // "Verträge hier kündigen" (§ 312k BGB): works without login.
  if (method === 'POST' && path === '/api/cancel') {
    const c = parseCancellation(await readJson(req));
    rateLimit(ip, 'cancel');
    const user = users.byEmail(c.email);
    let result = 'received';
    let ends = null;
    if (user && c.kind === 'ordinary' && paymentsEnabled() && user.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(user.sub_status)) {
      try { ends = await cancelAtPeriodEnd({ user }); result = 'scheduled'; }
      catch (e) { console.error('Stripe cancellation failed:', e.message); result = 'manual'; }
    } else if (c.kind === 'extraordinary') result = 'manual';
    const row = cancellations.create({ ...c, user_id: user?.id, result });
    const when = c.effective_date ? `zum ${c.effective_date}` : 'zum nächstmöglichen Zeitpunkt';
    messages.create({ name: c.name, email: c.email, topic: 'Kündigung',
      message: `Kündigung Nr. ${row.id} (${c.kind === 'ordinary' ? 'ordentlich' : 'außerordentlich'}) ${when}.${c.reason ? ` Grund: ${c.reason}` : ''}\n` +
        (result === 'scheduled' ? `Stripe-Abo automatisch zum Periodenende gekündigt${ends ? ` (${ends.slice(0, 10)})` : ''}.` : user ? 'Bitte manuell prüfen und bearbeiten.' : 'Kein Konto mit dieser E-Mail gefunden: bitte manuell prüfen.') +
        '\nPflicht: Bestätigung der Kündigung unverzüglich per E-Mail an den Kunden senden (Antworten-Knopf).' });
    return json(res, 201, { id: row.id, created_at: row.created_at, name: c.name, email: c.email, kind: c.kind, reason: c.reason, effective: when, result, ends });
  }

  // Member accounts
  if (method === 'GET' && path === '/api/account/me') return json(res, 200, me(req));
  if (method === 'POST' && path === '/api/account/register') {
    const { email, password } = parseCredentials(await readJson(req), { register: true });
    rateLimit(ip, 'register');
    if (users.byEmail(email)) throw new HttpError(409, 'Zu dieser E-Mail-Adresse gibt es bereits ein Konto. Bitte logge dich ein.');
    const user = users.create(email, await hashPassword(password));
    return json(res, 201, me(req, user), { 'Set-Cookie': userCookie(makeUserToken(user.id), isHttps(req)) });
  }
  if (method === 'POST' && path === '/api/account/login') {
    if (!loginAllowed(`u:${ip}`)) throw new HttpError(429, 'Zu viele Versuche. Bitte versuche es später erneut.');
    const { email, password } = parseCredentials(await readJson(req));
    const user = users.byEmail(email);
    // Verify against a dummy hash for unknown emails so response time does not reveal which emails exist.
    const ok = await verifyPassword(password, user?.pw_hash ?? DUMMY_HASH) && !!user;
    recordLogin(`u:${ip}`, ok);
    if (!ok) throw new HttpError(401, 'E-Mail oder Passwort ist falsch.');
    return json(res, 200, me(req, user), { 'Set-Cookie': userCookie(makeUserToken(user.id), isHttps(req)) });
  }
  if (method === 'POST' && path === '/api/account/logout') return json(res, 200, { ok: true }, { 'Set-Cookie': clearUserCookie() });
  // Forgotten password: always the same answer, so nobody can find out which emails have an account.
  if (method === 'POST' && path === '/api/account/forgot') {
    if (!mailEnabled()) throw new HttpError(503, 'Der E-Mail-Versand ist noch nicht eingerichtet. Bitte schreib uns über das Kontaktformular, wir helfen dir sofort.');
    const body = await readJson(req);
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Bitte gib eine gültige E-Mail-Adresse an');
    rateLimit(ip, 'forgot', 5);
    const user = users.byEmail(email);
    if (user) {
      try { rateLimit(email, 'forgot-mail', 3); } catch { return json(res, 200, { ok: true }); }
      const link = `${publicUrl(req)}/account?reset=${resets.create(user.id, RESET_TTL_MS)}`;
      try {
        await sendMail({ to: user.email, subject: 'Neues Passwort für Apex Wave Capital / New password',
          text: `Hallo,\n\nüber diesen Link legst du ein neues Passwort fest (gültig für 1 Stunde):\n${link}\n\nDu hast das nicht angefordert? Dann ignoriere diese E-Mail einfach, dein Passwort bleibt unverändert.\n\n---\n\nHi,\n\nuse this link to set a new password (valid for 1 hour):\n${link}\n\nDidn't request this? Just ignore this email, your password stays the same.\n\nApex Wave Capital\n${publicUrl(req)}` });
      } catch (e) { console.error('Password reset mail failed:', e.message); throw new HttpError(502, 'Die E-Mail konnte gerade nicht gesendet werden. Bitte versuche es in ein paar Minuten erneut.'); }
    }
    return json(res, 200, { ok: true });
  }
  if (method === 'POST' && path === '/api/account/reset') {
    rateLimit(ip, 'reset', 10);
    const body = await readJson(req);
    const password = parseNewPassword(body.password);
    const userId = resets.consume(String(body.token ?? ''));
    const user = userId && users.get(userId);
    if (!user) throw new HttpError(400, 'Dieser Link ist abgelaufen oder wurde schon benutzt. Bitte fordere einen neuen an.');
    const updated = users.update(user.id, { pw_hash: await hashPassword(password), pw_changed_at: Date.now() });
    return json(res, 200, me(req, updated), signIn(req, updated));
  }
  if (path.startsWith('/api/account/') && path !== '/api/account/') {
    const user = currentUser(req);
    if (!user) throw new HttpError(401, 'Bitte logge dich ein.');
    if (method === 'POST' && path === '/api/account/checkout') {
      if (!paymentsEnabled()) throw new HttpError(503, 'Zahlungen sind noch nicht freigeschaltet. Bitte schau bald wieder vorbei.');
      if (accessFor({ user, admin: false, config: { days_left: 0 } }).active) throw new HttpError(400, 'Du hast bereits eine aktive Mitgliedschaft.');
      const body = await readJson(req);
      if (body.waiver !== true) throw new HttpError(400, 'Bitte bestätige den Hinweis zum Widerrufsrecht, um fortzufahren.');
      users.update(user.id, { withdrawal_waiver_at: new Date().toISOString() });
      try { return json(res, 200, { url: await createCheckout({ user, baseUrl: publicUrl(req), price: getConfig().price, smallBusiness: getConfig().small_business }) }); }
      catch (e) { console.error('Stripe checkout failed:', e.message); throw new HttpError(502, 'Die Zahlungsseite konnte gerade nicht geöffnet werden. Bitte versuche es in ein paar Minuten erneut.'); }
    }
    if (method === 'POST' && path === '/api/account/password') {
      const body = await readJson(req);
      if (!loginAllowed(`u:${ip}`)) throw new HttpError(429, 'Zu viele Versuche. Bitte versuche es später erneut.');
      const ok = await verifyPassword(String(body.current ?? ''), user.pw_hash);
      recordLogin(`u:${ip}`, ok);
      if (!ok) throw new HttpError(401, 'Das aktuelle Passwort ist falsch.');
      const password = parseNewPassword(body.password);
      const updated = users.update(user.id, { pw_hash: await hashPassword(password), pw_changed_at: Date.now() });
      return json(res, 200, { ok: true }, signIn(req, updated));
    }
    if (method === 'POST' && path === '/api/account/portal') {
      if (!paymentsEnabled() || !user.stripe_customer_id) throw new HttpError(400, 'Für dieses Konto gibt es noch kein Abo.');
      try { return json(res, 200, { url: await createPortal({ user, baseUrl: publicUrl(req) }) }); }
      catch (e) { console.error('Stripe portal failed:', e.message); throw new HttpError(502, 'Die Abo-Verwaltung konnte gerade nicht geöffnet werden. Bitte versuche es in ein paar Minuten erneut.'); }
    }
    if (method === 'DELETE' && path === '/api/account/me') {
      const body = await readJson(req);
      if (!(await verifyPassword(String(body.password ?? ''), user.pw_hash))) throw new HttpError(401, 'Falsches Passwort.');
      if (['active', 'trialing', 'past_due'].includes(user.sub_status)) throw new HttpError(409, 'Bitte kündige zuerst dein Abo (Abo verwalten) und lösche dann das Konto.');
      users.remove(user.id);
      return json(res, 200, { ok: true }, { 'Set-Cookie': clearUserCookie() });
    }
  }
  if (method === 'POST' && path === '/api/stripe/webhook') {
    if (!paymentsEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) throw new HttpError(503, 'Payments are not set up');
    let event;
    try { event = await verifyWebhook(await readRaw(req), req.headers['stripe-signature'] || '', undefined); }
    catch { throw new HttpError(400, 'Invalid signature'); }
    return json(res, 200, { received: true, ...applyEvent(event) });
  }

  // Auth
  if (method === 'POST' && path === '/api/admin/login') {
    if (!loginAllowed(ip)) throw new HttpError(429, 'Zu viele Versuche. Bitte versuche es später erneut.');
    const body = await readJson(req);
    const ok = checkPassword(body.password ?? '');
    recordLogin(ip, ok);
    if (!ok) throw new HttpError(401, 'Wrong password');
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(makeToken(), isHttps(req)) });
  }
  if (method === 'POST' && path === '/api/admin/logout') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  }
  if (method === 'GET' && path === '/api/admin/me') {
    return json(res, 200, { admin: isAdmin(req) });
  }

  // Everything below requires admin
  if (!path.startsWith('/api/admin/')) throw new HttpError(404, 'Not found');
  if (!isAdmin(req)) throw new HttpError(401, 'Not logged in');

  if (method === 'GET' && path === '/api/admin/analyses') return json(res, 200, analyses.list(false));
  if (method === 'GET' && path === '/api/admin/messages') return json(res, 200, messages.list());
  if (method === 'GET' && path === '/api/admin/cancellations') return json(res, 200, cancellations.list());

  // Members and legal texts
  if (method === 'GET' && path === '/api/admin/users') {
    return json(res, 200, users.list().map((u) => ({ id: u.id, email: u.email, comped: !!u.comped, sub_status: u.sub_status, sub_period_end: u.sub_period_end, created_at: u.created_at,
      access: accessFor({ user: u, admin: false, config: { days_left: 0 } }).reason })));
  }
  let um = /^\/api\/admin\/users\/(\d+)$/.exec(path);
  if (um && method === 'PUT') {
    const u = users.get(Number(um[1])); if (!u) throw new HttpError(404, 'Not found');
    users.update(u.id, { comped: (await readJson(req)).comped ? 1 : 0 });
    return json(res, 200, { ok: true });
  }
  // Manual help: the admin creates a reset link (valid 24 h) and sends it to the member, e.g. when email is not set up.
  um = /^\/api\/admin\/users\/(\d+)\/reset-link$/.exec(path);
  if (um && method === 'POST') {
    const u = users.get(Number(um[1])); if (!u) throw new HttpError(404, 'Not found');
    return json(res, 200, { link: `${publicUrl(req)}/account?reset=${resets.create(u.id, 24 * RESET_TTL_MS)}`, email: u.email });
  }
  if (method === 'GET' && path === '/api/admin/legal') { const out = {}; for (const k of LEGAL_KEYS) out[k] = kv.get(`legal_${k}`, ''); return json(res, 200, out); }
  if (method === 'PUT' && path === '/api/admin/legal') { const d = parseLegal(await readJson(req)); for (const k of LEGAL_KEYS) kv.set(`legal_${k}`, d[k]); return json(res, 200, d); }

  // Settings, agent status and test
  if (method === 'PUT' && path === '/api/admin/config') {
    const d = parseSettings(await readJson(req));
    kv.set('free_until', d.free_until); kv.set('price', d.price); kv.set('small_business', d.small_business);
    return json(res, 200, getConfig());
  }
  if (method === 'PUT' && path === '/api/admin/profile') {
    kv.set('profile', parseProfile(await readJson(req)));
    return json(res, 200, getConfig());
  }
  if (method === 'GET' && path === '/api/admin/agent-status') {
    return json(res, 200, { provider: providerName(), model: providerName() === 'claude' ? (process.env.CLAUDE_MODEL || 'claude-opus-5-5') : null,
      key_configured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN), fallback: process.env.CLAUDE_FALLBACK !== 'off',
      briefing_auto: process.env.BRIEFING_AUTO === '1', briefing_news: process.env.BRIEFING_NEWS || 'none' });
  }
  if (method === 'POST' && path === '/api/admin/agent-test') {
    try { return json(res, 200, await testAgent()); }
    catch (e) { throw new HttpError(502, e.message); }
  }

  // Daily briefing (also created at 09:00 Berlin time when BRIEFING_AUTO=1)
  if (method === 'GET' && path === '/api/admin/briefings') return json(res, 200, briefings.list(14).map(({ pack, ...b }) => b));
  if (method === 'POST' && path === '/api/admin/briefings') {
    try { const b = await runBriefing(berlinParts(new Date()).day); return json(res, 200, { id: b.id, day: b.day }); }
    catch (e) { throw new HttpError(502, `Briefing failed: ${e.message}`); }
  }
  let bm = /^\/api\/admin\/briefings\/(\d+)(\/pack)?$/.exec(path);
  if (bm) {
    const b = briefings.get(Number(bm[1]));
    if (!b) throw new HttpError(404, 'Not found');
    if (!bm[2]) {
      if (method === 'GET') return json(res, 200, b);
      if (method === 'DELETE') { briefings.remove(b.id); return json(res, 200, { ok: true }); }
    } else {
      if (method === 'GET') return json(res, 200, { content: b.pack, status: b.status });
      if (method === 'POST') {
        try { const nb = await runBriefing(b.day); return json(res, 200, { content: nb.pack, status: nb.status }); }
        catch (e) { throw new HttpError(502, `Briefing failed: ${e.message}`); }
      }
      if (method === 'PUT') {
        const body = await readJson(req);
        const pack = finalize({ ...body.content, provider: b.pack.provider, chart_notes: b.pack.chart_notes });
        const nb = briefings.update(b.id, { briefing: b.briefing, sources: b.sources, pack }, body.status === 'approved' ? 'approved' : 'draft');
        return json(res, 200, { content: nb.pack, status: nb.status });
      }
    }
  }

  // Website promo pack (ad for the site itself)
  if (path === '/api/admin/promo') {
    if (method === 'GET') return json(res, 200, promoGet());
    if (method === 'POST') {
      try { return json(res, 200, promoSave(await generatePromoPack(promoFacts()), 'draft')); }
      catch (e) { throw new HttpError(502, `Agent failed: ${e.message}`); }
    }
    if (method === 'PUT') {
      const body = await readJson(req), prev = promoGet()?.content;
      return json(res, 200, promoSave(finalize({ ...body.content, provider: prev?.provider, chart_notes: prev?.chart_notes }), body.status === 'approved' ? 'approved' : 'draft'));
    }
  }

  // Live demo depot
  if (method === 'GET' && path === '/api/admin/positions') return json(res, 200, depotView());
  if (method === 'POST' && path === '/api/admin/positions') {
    const body = await readJson(req), data = parsePosition(body);
    if (data.analysis_id != null && !analyses.get(data.analysis_id)) throw new HttpError(400, 'Linked analysis does not exist');
    data.evidence = body.evidence ? saveImage(body.evidence) : null;
    return json(res, 201, positions.create(data));
  }
  let pm = /^\/api\/admin\/positions\/(\d+)$/.exec(path);
  if (pm) {
    const id = Number(pm[1]), existing = positions.get(id);
    if (!existing) throw new HttpError(404, 'Not found');
    if (method === 'PUT') {
      const body = await readJson(req), data = parsePosition(body);
      if (data.analysis_id != null && !analyses.get(data.analysis_id)) throw new HttpError(400, 'Linked analysis does not exist');
      data.evidence = body.evidence ? saveImage(body.evidence) : existing.evidence;
      const updated = positions.update(id, data);
      if (data.evidence !== existing.evidence) deleteImage(existing.evidence);
      return json(res, 200, updated);
    }
    if (method === 'DELETE') { positions.remove(id); deleteImage(existing.evidence); return json(res, 200, { ok: true }); }
  }
  m = /^\/api\/admin\/messages\/(\d+)$/.exec(path);
  if (m && method === 'DELETE') { messages.remove(Number(m[1])); return json(res, 200, { ok: true }); }

  if (method === 'POST' && path === '/api/admin/analyses') {
    const body = await readJson(req);
    const data = parseAnalysis(body);
    if (!body.image) throw new HttpError(400, 'A chart screenshot is required');
    data.image = saveImage(body.image);
    return json(res, 201, analyses.create(data));
  }

  m = /^\/api\/admin\/analyses\/(\d+)$/.exec(path);
  if (m) {
    const id = Number(m[1]);
    const existing = analyses.get(id);
    if (!existing) throw new HttpError(404, 'Not found');
    if (method === 'PUT') {
      const body = await readJson(req);
      const data = parseAnalysis(body);
      data.image = existing.image;
      if (body.image) data.image = saveImage(body.image);
      const updated = analyses.update(id, data);
      if (data.image !== existing.image) deleteImage(existing.image);
      return json(res, 200, updated);
    }
    if (method === 'DELETE') {
      analyses.remove(id);
      deleteImage(existing.image);
      return json(res, 200, { ok: true });
    }
  }

  m = /^\/api\/admin\/analyses\/(\d+)\/pack$/.exec(path);
  if (m) {
    const id = Number(m[1]);
    const a = analyses.get(id);
    if (!a) throw new HttpError(404, 'Not found');
    if (method === 'GET') return json(res, 200, packs.get(id));
    if (method === 'POST') {
      try {
        return json(res, 200, packs.save(id, await generatePack(a, join(UPLOAD_DIR, a.image)), 'draft'));
      } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(502, `Agent failed: ${e.message}`);
      }
    }
    if (method === 'PUT') {
      const body = await readJson(req);
      const status = body.status === 'approved' ? 'approved' : 'draft';
      const prev = packs.get(id)?.content;
      const content = finalize({ ...body.content, provider: prev?.provider, chart_notes: prev?.chart_notes });
      return json(res, 200, packs.save(id, content, status));
    }
  }

  throw new HttpError(404, 'Not found');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    if (url.pathname === '/healthz') { db.prepare('SELECT 1').get(); return send(res, 200, 'ok', { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); }
    if (url.pathname === '/robots.txt') {
      return send(res, 200, `User-agent: *\nDisallow: /api/\nSitemap: ${publicUrl(req)}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    }
    if (url.pathname === '/sitemap.xml') {
      const base = publicUrl(req);
      const urls = ['/', '/analyses', '/markets', '/depot', '/pricing', '/support', ...analyses.list(true).map((a) => `/analysis?id=${a.id}`)];
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${base}${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`;
      return send(res, 200, xml, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);

    const versioned = /^\/v\/[a-z0-9]{1,20}(\/(?:js|css)\/[\w.-]+)$/.exec(url.pathname);
    if (versioned) return await serveFile(req, res, join(PUBLIC_DIR, versioned[1]), 'public, max-age=31536000, immutable');

    if (url.pathname.startsWith('/uploads/')) {
      const name = url.pathname.slice('/uploads/'.length);
      if (!/^[a-f0-9]{24}\.(png|jpg|webp)$/.test(name)) return send(res, 404, 'Not found');
      return await serveFile(req, res, join(UPLOAD_DIR, name), 'public, max-age=31536000, immutable');
    }

    const pages = { '/': '/index.html', '/analyses': '/analyses.html', '/analysis': '/analysis.html',
      '/pricing': '/pricing.html', '/support': '/support.html', '/depot': '/depot.html', '/markets': '/markets.html', '/admin': '/admin.html',
      '/account': '/account.html', '/kuendigen': '/cancel.html', '/imprint': '/legal.html', '/privacy': '/legal.html', '/terms': '/legal.html' };
    const clean = pages[url.pathname] || url.pathname;
    const file = normalize(join(PUBLIC_DIR, clean));
    if (!file.startsWith(PUBLIC_DIR + sep)) return send(res, 403, 'Forbidden');
    const extra = clean === '/markets.html' ? { 'Content-Security-Policy': MARKETS_CSP } : {};
    return await serveFile(req, res, file, extname(file) === '.html' || ['.js', '.css'].includes(extname(file)) ? 'no-cache' : 'public, max-age=3600', 200, extra);
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.message });
    console.error(e);
    return json(res, 500, { error: 'Internal server error' });
  }
});

if (process.env.BRIEFING_AUTO === '1') {
  startScheduler({
    run: async (day) => { const b = await runBriefing(day); messages.create({ name: '(daily briefing)', email: 'noreply@localhost', topic: 'Daily briefing', message: `The briefing for ${day} is ready in the admin Briefing tab. Review it before you post anything.` }); console.log(`Daily briefing for ${day} created (id ${b.id}).`); },
    getLastDay: () => briefings.latestDay(),
    onFail: (day, e) => messages.create({ name: '(daily briefing)', email: 'noreply@localhost', topic: 'Daily briefing', message: `The briefing for ${day} failed 3 times: ${e.message}` }),
  });
  console.log('Daily briefing scheduler on (09:00 Europe/Berlin).');
}

server.listen(PORT, () => {
  console.log(`Apex Wave Capital running on http://localhost:${PORT}`);
  if (PASSWORD_GENERATED) console.log(`No ADMIN_PASSWORD set. Temporary admin password: ${ADMIN_PASSWORD}`);
});
