import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Stripe from 'stripe';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const procs = [];

async function startServer(port, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ah-pw-'));
  const p = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, ADMIN_PASSWORD: 'adminpw', SESSION_SECRET: 'test-secret', TRUST_PROXY: '1', ...env }, stdio: 'ignore' });
  procs.push(p);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${base}/healthz`)).ok) return base; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('server did not start');
}

const call = async (base, path, { method = 'GET', body, cookie, headers = {} } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, cookie: (res.headers.getSetCookie?.()[0] || '').split(';')[0] };
};

let A, B, adminA;
before(async () => {
  A = await startServer(3961);
  B = await startServer(3962, { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRICE_ID: 'price_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', PUBLIC_URL: 'https://example.com' });
  adminA = (await call(A, '/api/admin/login', { method: 'POST', body: { password: 'adminpw' } })).cookie;
});
after(() => procs.forEach((p) => p.kill()));

async function seed(base, adminCookie) {
  const a = await call(base, '/api/admin/analyses', { method: 'POST', cookie: adminCookie, body: { asset: 'BTC/USD', market: 'Crypto', timeframe: '4H', analysis_date: '2026-10-01', status: 'published', image: PNG,
    wave_count: 'Wave 3', scenario_primary: 'Up', scenario_alt: 'ALT-SECRET', invalidation: 'INVAL-SECRET', targets: 'TARGET-SECRET', fib_levels: 'FIB-SECRET', body: 'BODY-SECRET' } });
  const pos = (status, extra = {}) => call(base, '/api/admin/positions', { method: 'POST', cookie: adminCookie, body: { asset: 'ETH/USD', market: 'Crypto', status, buy_low: 100, buy_high: 105, stop: 95, target: 120, entry_price: 102, exit_price: status === 'hit' ? 120 : null, ...extra } });
  await pos('open'); await pos('hit');
  return a.data.id;
}

test('guests only get a teaser; an account unlocks everything during the free period; afterwards members only', async () => {
  const id = await seed(A, adminA);
  // guest: no chart, no wave count, no text
  let r = await call(A, `/api/analyses/${id}`);
  assert.equal(r.data.locked, true); assert.equal(r.data.asset, 'BTC/USD'); assert.equal(r.data.image, null);
  for (const k of ['wave_count', 'scenario_primary', 'scenario_alt', 'invalidation', 'targets', 'fib_levels', 'body']) assert.equal(r.data[k], '', k);
  assert.doesNotMatch(JSON.stringify((await call(A, '/api/analyses')).data), /SECRET|Wave 3|\.png|\.webp/);

  // free period + account: full access
  const reg = await call(A, '/api/account/register', { method: 'POST', body: { email: 'early@example.com', password: 'correct-horse-1', accept_terms: true } });
  r = await call(A, `/api/analyses/${id}`, { cookie: reg.cookie });
  assert.equal(r.data.locked, false); assert.equal(r.data.targets, 'TARGET-SECRET'); assert.ok(r.data.image);

  // after the free period the same account is locked again
  await call(A, '/api/admin/config', { method: 'PUT', cookie: adminA, body: { free_until: '2020-01-01', price: 5.99 } });
  assert.equal((await call(A, `/api/analyses/${id}`, { cookie: reg.cookie })).data.locked, true);
  // admin still sees everything
  assert.equal((await call(A, `/api/analyses/${id}`, { cookie: adminA })).data.targets, 'TARGET-SECRET');
  assert.equal((await call(A, '/api/config')).data.price, 5.99);
});

test('depot: positions are members-only, the statistics stay public', async () => {
  const d = (await call(A, '/api/depot')).data;
  assert.equal(d.locked, true); assert.deepEqual(d.positions, []); assert.equal(d.count, 2);
  assert.equal(d.stats.hit_rate, 100);
  assert.equal((await call(A, '/api/depot', { cookie: adminA })).data.positions.length, 2);
});

test('accounts: validation, register, login, wrong password, duplicate', async () => {
  const bad = (body) => call(A, '/api/account/register', { method: 'POST', body });
  assert.equal((await bad({ email: 'x', password: 'longenough1', accept_terms: true })).status, 400);
  assert.equal((await bad({ email: 'a@b.co', password: 'short', accept_terms: true })).status, 400);
  assert.match((await bad({ email: 'a@b.co', password: 'longenough1' })).data.error, /akzeptiere/i);

  const reg = await call(A, '/api/account/register', { method: 'POST', body: { email: 'Member@Example.com', password: 'correct-horse-1', accept_terms: true } });
  assert.equal(reg.status, 201); assert.equal(reg.data.user.email, 'member@example.com'); assert.equal(reg.data.access.active, false);
  assert.equal((await bad({ email: 'member@example.com', password: 'correct-horse-1', accept_terms: true })).status, 409);

  assert.equal((await call(A, '/api/account/login', { method: 'POST', body: { email: 'member@example.com', password: 'nope-nope-nope' } })).status, 401);
  const login = await call(A, '/api/account/login', { method: 'POST', body: { email: 'member@example.com', password: 'correct-horse-1' } });
  assert.equal(login.status, 200);
  assert.equal((await call(A, '/api/account/me', { cookie: login.cookie })).data.user.email, 'member@example.com');
  assert.equal((await call(A, '/api/account/me')).data.user, null);
  assert.equal((await call(A, '/api/account/me', { cookie: 'ah_user=u1.9999999999999.forged' })).data.user, null);
});

test('admin can grant free access; member then sees details', async () => {
  const id = (await call(A, '/api/analyses')).data[0].id;
  const login = await call(A, '/api/account/login', { method: 'POST', body: { email: 'member@example.com', password: 'correct-horse-1' } });
  assert.equal((await call(A, `/api/analyses/${id}`, { cookie: login.cookie })).data.locked, true);
  const list = (await call(A, '/api/admin/users', { cookie: adminA })).data;
  const member = list.find((u) => u.email === 'member@example.com');
  assert.ok(member); assert.ok(list.every((u) => !('pw_hash' in u)));
  await call(A, `/api/admin/users/${member.id}`, { method: 'PUT', cookie: adminA, body: { comped: true } });
  const r = await call(A, `/api/analyses/${id}`, { cookie: login.cookie });
  assert.equal(r.data.locked, false); assert.equal(r.data.targets, 'TARGET-SECRET');
  assert.equal((await call(A, '/api/depot', { cookie: login.cookie })).data.positions.find((p) => p.status === 'open').buy_low, 100);
});

test('without Stripe keys checkout says payments are not set up and webhook is off', async () => {
  const login = await call(A, '/api/account/login', { method: 'POST', body: { email: 'member@example.com', password: 'correct-horse-1' } });
  assert.equal((await call(A, '/api/account/checkout', { method: 'POST', cookie: login.cookie, body: {} })).status, 503);
  assert.equal((await call(A, '/api/account/checkout', { method: 'POST', body: {} })).status, 401);
  assert.equal((await call(A, '/api/stripe/webhook', { method: 'POST', body: {} })).status, 503);
});

test('Stripe webhook: signature is verified and subscription state unlocks content', async () => {
  const id = await seed(B, (await call(B, '/api/admin/login', { method: 'POST', body: { password: 'adminpw' } })).cookie);
  const adminB = (await call(B, '/api/admin/login', { method: 'POST', body: { password: 'adminpw' } })).cookie;
  await call(B, '/api/admin/config', { method: 'PUT', cookie: adminB, body: { free_until: '2020-01-01', price: 29 } });
  const reg = await call(B, '/api/account/register', { method: 'POST', body: { email: 'pay@example.com', password: 'correct-horse-1', accept_terms: true } });
  assert.equal(reg.data.payments_enabled, true);
  const userId = (await call(B, '/api/admin/users', { cookie: adminB })).data[0].id;
  assert.equal((await call(B, `/api/analyses/${id}`, { cookie: reg.cookie })).data.locked, true);

  const send = async (event, secret = 'whsec_test') => {
    const payload = JSON.stringify(event);
    const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    const res = await fetch(`${B}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig }, body: payload });
    return { status: res.status, data: await res.json() };
  };
  const sub = (status, extra = {}) => ({ id: 'evt_1', object: 'event', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', object: 'subscription', customer: 'cus_1', status, metadata: { user_id: String(userId) }, items: { data: [{ current_period_end: 1893456000 }] }, ...extra } } });

  assert.equal((await send(sub('active'), 'whsec_wrong')).status, 400); // forged signature
  assert.equal((await call(B, `/api/analyses/${id}`, { cookie: reg.cookie })).data.locked, true);

  const ok = await send(sub('active'));
  assert.equal(ok.status, 200); assert.equal(ok.data.handled, true);
  const after = await call(B, `/api/analyses/${id}`, { cookie: reg.cookie });
  assert.equal(after.data.locked, false);
  const u = (await call(B, '/api/admin/users', { cookie: adminB })).data[0];
  assert.deepEqual([u.sub_status, u.access, u.sub_period_end], ['active', 'member', '2030-01-01T00:00:00.000Z']);

  await send({ ...sub('canceled'), type: 'customer.subscription.deleted' });
  assert.equal((await call(B, `/api/analyses/${id}`, { cookie: reg.cookie })).data.locked, true);
  assert.equal((await send({ id: 'evt_2', object: 'event', type: 'invoice.paid', data: { object: {} } })).data.handled, false);
});

test('legal pages are stored by the admin and served publicly', async () => {
  assert.equal((await call(A, '/api/admin/legal', { method: 'PUT', body: { imprint: 'x' } })).status, 401);
  await call(A, '/api/admin/legal', { method: 'PUT', cookie: adminA, body: { imprint: 'Imprint text', privacy: 'Privacy text', terms: '' } });
  assert.deepEqual((await call(A, '/api/legal')).data, { imprint: 'Imprint text', privacy: 'Privacy text', terms: '' });
  for (const p of ['/imprint', '/privacy', '/terms', '/account']) assert.equal((await fetch(A + p)).status, 200, p);
});

test('Verträge hier kündigen: works without login, validates, lands in the inbox', async () => {
  assert.equal((await fetch(A + '/kuendigen')).status, 200);
  const bad = await call(A, '/api/cancel', { method: 'POST', body: { name: 'A', email: 'nope' } });
  assert.equal(bad.status, 400);
  assert.match((await call(A, '/api/cancel', { method: 'POST', body: { name: 'A B', email: 'member@example.com', kind: 'extraordinary' } })).data.error, /Kündigungsgrund/);
  const ok = await call(A, '/api/cancel', { method: 'POST', body: { name: 'Max Muster', email: 'Member@Example.com', kind: 'ordinary' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.effective, 'zum nächstmöglichen Zeitpunkt');
  assert.equal(ok.data.result, 'received');                       // no Stripe subscription on this account
  const inbox = (await call(A, '/api/admin/messages', { cookie: adminA })).data;
  assert.ok(inbox.some((m) => m.topic === 'Kündigung' && m.email === 'member@example.com' && /Bestätigung/.test(m.message)));
  assert.equal((await call(A, '/api/admin/cancellations', { cookie: adminA })).data.length, 1);
});

test('checkout needs the withdrawal waiver before Stripe is called', async () => {
  const login = await call(B, '/api/account/login', { method: 'POST', body: { email: 'pay@example.com', password: 'correct-horse-1' } });
  const r = await call(B, '/api/account/checkout', { method: 'POST', cookie: login.cookie, body: {} });
  assert.equal(r.status, 400); assert.match(r.data.error, /Widerrufsrecht/);
});

test('HTML gets the public address for link previews', async () => {
  const html = await (await fetch(B + '/')).text();
  assert.match(html, /<meta property="og:image" content="https:\/\/example\.com\/og-image\.png">/);
  assert.doesNotMatch(html, /%PUBLIC_URL%/);
  for (const f of ['/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/og-image.png']) assert.equal((await fetch(B + f)).status, 200, f);
});

test('only the markets page may load the TradingView embed', async () => {
  const markets = await fetch(B + '/markets'), home = await fetch(B + '/');
  assert.equal(markets.status, 200);
  assert.match(markets.headers.get('content-security-policy'), /script-src 'self' https:\/\/s3\.tradingview\.com/);
  assert.doesNotMatch(home.headers.get('content-security-policy'), /tradingview/);
  const js = await fetch(B + '/js/home.js');
  assert.equal((await fetch(B + '/js/home.js', { headers: { 'If-None-Match': js.headers.get('etag') } })).status, 304);
});

test('scripts and styles get versioned URLs so releases are never mixed with cached files', async () => {
  const html = await (await fetch(B + '/')).text();
  const path = /src="(\/v\/[a-z0-9]+\/js\/layout\.js)"/.exec(html)?.[1];
  assert.ok(path, 'layout.js is versioned');
  assert.doesNotMatch(html, /(src|href)="\/(js|css)\//);
  const r = await fetch(B + path);
  assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /immutable/);
  assert.equal((await fetch(B + '/v/abc/../server.js')).status, 404);
});

test('analyses keep an optional English version, which is locked like the German text', async () => {
  const r = await call(A, '/api/admin/analyses', { method: 'POST', cookie: adminA, body: { asset: 'SOL/USD', market: 'Crypto', timeframe: '1D', analysis_date: '2026-10-05', status: 'published', image: PNG,
    wave_count: 'Welle 1 fertig', scenario_primary: 'Korrektur', invalidation: 'INVAL-DE', en: { wave_count: 'Wave 1 complete', invalidation: 'INVAL-EN', body: '', junk: 'x' } } });
  assert.equal(r.status, 201);
  assert.deepEqual(r.data.en, { wave_count: 'Wave 1 complete', invalidation: 'INVAL-EN' });
  const { redactAnalysis } = await import('../lib/access.js');
  const locked = redactAnalysis(r.data, { active: false });
  assert.deepEqual(locked.en, {});
  assert.doesNotMatch(JSON.stringify(locked), /INVAL-/);
});
