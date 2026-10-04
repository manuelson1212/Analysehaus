// Browser-only stand-in for server.js, used by the static demo build (npm run demo:build).
// Data lives in localStorage (memory fallback). The agent is the same mock provider as on the server.
import { generate as mock, generatePromo as mockPromo, generateBriefing as mockBriefing } from '../lib/agent/mock.js';
import { computeStats } from '../lib/depot.js';
import { accessFor, redactAnalysis, redactPosition } from '../lib/access.js';
import { finalize } from '../lib/agent/index.js';

window.__DEMO__ = true;
window.__DEMO_ROUTER__ = true;
const KEY = 'apex-wave-demo-v3';
const DEMO_PASSWORD = 'demo';
let memory = null;

const store = {
  read() {
    try { const v = localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch { /* blocked */ }
    return memory;
  },
  write(state) {
    memory = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { throw Object.assign(new Error('Der Browser-Speicher ist voll. Lösche eine Analyse oder nutze kleinere Screenshots.'), { status: 507 }); }
  },
};
let adminFlag = false; // kept in memory so login works even when sessionStorage is blocked
const session = {
  get: () => { try { if (sessionStorage.getItem('ah-admin') === '1') return true; } catch { /* blocked */ } return adminFlag; },
  set: (v) => { adminFlag = v; try { sessionStorage.setItem('ah-admin', v ? '1' : '0'); } catch { /* blocked */ } },
};

let userId = null; // logged-in member (memory plus sessionStorage)
try { userId = Number(sessionStorage.getItem('ah-user')) || null; } catch { /* blocked */ }
const setUser = (id) => { userId = id; try { id ? sessionStorage.setItem('ah-user', String(id)) : sessionStorage.removeItem('ah-user'); } catch { /* blocked */ } };
const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`apex-demo:${t}`)))].map((b) => b.toString(16).padStart(2, '0')).join('');

/* ---------- Seed data: charts are drawn on canvas so the demo needs no image files ---------- */
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function drawChart(points, labels, lines, seed, title) {
  const W = 1200, H = 700, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), rand = rng(seed);
  g.fillStyle = '#131722'; g.fillRect(0, 0, W, H);
  const lo = Math.min(...points.map((p) => p[1]), ...lines.map((l) => l.v)) - 4;
  const hi = Math.max(...points.map((p) => p[1]), ...lines.map((l) => l.v)) + 6;
  const X = (t) => 70 + t * (W - 220), Y = (v) => 60 + (1 - (v - lo) / (hi - lo)) * (H - 130);
  g.strokeStyle = '#1e2433'; g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) { const y = 60 + i * ((H - 130) / 8); g.beginPath(); g.moveTo(70, y); g.lineTo(W - 150, y); g.stroke(); }
  const at = (t) => { for (let i = 1; i < points.length; i++) if (t <= points[i][0]) { const [t0, v0] = points[i - 1], [t1, v1] = points[i]; return v0 + (v1 - v0) * ((t - t0) / (t1 - t0)); } return points.at(-1)[1]; };
  const n = 120; let prev = at(0);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * points.at(-1)[0], close = at(t) + (rand() - 0.5) * 3;
    const hiV = Math.max(prev, close) + rand() * 2, loV = Math.min(prev, close) - rand() * 2, x = X(t);
    g.strokeStyle = g.fillStyle = close >= prev ? '#26a69a' : '#ef5350';
    g.beginPath(); g.moveTo(x, Y(hiV)); g.lineTo(x, Y(loV)); g.stroke();
    g.fillRect(x - 3, Math.min(Y(prev), Y(close)), 6, Math.max(2, Math.abs(Y(prev) - Y(close)))); prev = close;
  }
  g.font = '600 26px ui-monospace, Menlo, monospace'; g.textAlign = 'center';
  for (const [t, v, text, up] of labels) { g.fillStyle = '#ffb000'; g.fillText(text, X(t), Y(v) + (up ? -16 : 34)); }
  g.font = '18px ui-monospace, Menlo, monospace'; g.textAlign = 'left';
  for (const l of lines) {
    g.strokeStyle = g.fillStyle = l.color; g.setLineDash(l.dash ? [10, 8] : []); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(70, Y(l.v)); g.lineTo(W - 150, Y(l.v)); g.stroke(); g.setLineDash([]); g.fillText(l.text, W - 142, Y(l.v) + 6);
  }
  g.fillStyle = '#d1d4dc'; g.font = '600 24px ui-monospace, Menlo, monospace'; g.fillText(title, 76, 38);
  return c.toDataURL('image/webp', 0.82).startsWith('data:image/webp') ? c.toDataURL('image/webp', 0.82) : c.toDataURL('image/png');
}

function proofImg(asset, status, seed) {
  const win = status === 'hit';
  const pts = win ? [[0, 40], [0.3, 46], [0.45, 41], [1, 80]] : [[0, 60], [0.35, 52], [0.5, 56], [1, 30]];
  return drawChart(pts, [[0.45, win ? 41 : 56, 'entry', 0], [1, win ? 80 : 30, win ? 'target' : 'stop', win ? 1 : 0]],
    [{ v: win ? 80 : 56, color: win ? '#26a69a' : '#ef5350', dash: true, text: win ? 'target' : 'stop' }], seed, `${asset} · ${win ? 'target reached' : 'stopped out'} · SAMPLE PROOF`);
}

function seedState() {
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const base = { scenario_alt: '', body: '', fib_levels: '', targets: '', invalidation: '', wave_count: '', scenario_primary: '' };
  const analyses = [
    { ...base, id: 1, asset: 'BTC/USD', market: 'Crypto', timeframe: '4H', analysis_date: day(1), status: 'published', tags: ['impulse', 'btc', 'wave3'],
      wave_count: 'Welle (3) von 3 läuft, Welle (2) endete am 0,618-Retracement',
      scenario_primary: 'Welle (3) dehnt sich bis zur 1,618-Extension von Welle (1) aus, danach folgt ein Rücksetzer in Welle (4), flacher als Welle (2).',
      scenario_alt: 'Welle (2) war ein Flat und Welle (3) ist nur Welle a einer größeren Struktur. Ein Schlusskurs zurück im Bereich von Welle (1) würde dafür sprechen.',
      invalidation: 'Schlusskurs unter 61.200, dem Start von Welle (1).', targets: '68.400 - 70.100', fib_levels: '0,618-Retracement bei 64.250; 1,618-Extension bei 70.100',
      body: 'Beispielanalyse für die Vorschau. Welle (1) war ein sauberer Fünf-Wellen-Anstieg. Welle (2) korrigierte bei fallendem Volumen bis zum 0,618-Level. Der aktuelle Anstieg zeigt Alternation und starkes Momentum, typisch für eine dritte Welle.',
      image: drawChart([[0, 60], [0.18, 66], [0.32, 62.5], [0.78, 76], [1, 74]], [[0.18, 66, '(1)', 1], [0.32, 62.5, '(2)', 0], [0.78, 76, '(3)', 1]],
        [{ v: 61.2, color: '#ef5350', dash: true, text: 'ungültig' }, { v: 70.1, color: '#ffb000', dash: true, text: '1.618' }], 11, 'BTC/USD · 4H · DEMO CHART') },
    { ...base, id: 2, asset: 'S&P 500', market: 'Stocks', timeframe: '1D', analysis_date: day(3), status: 'published', tags: ['correction', 'index', 'abc'],
      wave_count: 'Welle B eines Expanded Flat, Welle C steht aus',
      scenario_primary: 'Welle C läuft in fünf Wellen in Richtung der 1,0- bis 1,618-Projektion von Welle A.',
      scenario_alt: 'Der Rückgang war bereits ein vollständiger Zickzack und ein neuer Impuls hat begonnen.',
      invalidation: 'Tagesschluss über dem Hoch von Welle B.', targets: '5.310 - 5.180', fib_levels: 'C = 1,0 x A bei 5.310; C = 1,618 x A bei 5.180',
      body: 'Beispielanalyse für die Vorschau. Welle B hat mehr als 100 Prozent von Welle A korrigiert, das spricht für ein Expanded Flat.',
      image: drawChart([[0, 80], [0.25, 62], [0.55, 84], [1, 66]], [[0.25, 62, 'A', 0], [0.55, 84, 'B', 1], [1, 66, 'C?', 0]],
        [{ v: 84, color: '#ef5350', dash: true, text: 'ungültig' }, { v: 56, color: '#ffb000', dash: true, text: '1.618' }], 23, 'S&P 500 · 1D · DEMO CHART') },
    { ...base, id: 3, asset: 'SOL/USD', market: 'Crypto', timeframe: '1H', analysis_date: day(0), status: 'draft', tags: ['draft'],
      wave_count: 'Mögliches Dreieck in Welle 4', scenario_primary: 'Ausbruch aus dem Dreieck in Welle 5.', invalidation: 'Bruch unter das Tief von Welle 2.',
      image: drawChart([[0, 50], [0.3, 70], [0.45, 58], [0.6, 66], [0.75, 60], [1, 63]], [[0.3, 70, '(3)', 1], [0.45, 58, 'a', 0], [0.6, 66, 'b', 1], [0.75, 60, 'c', 0]],
        [{ v: 50, color: '#ef5350', dash: true, text: 'ungültig' }], 37, 'SOL/USD · 1H · DEMO CHART') },
  ];
  const P = (asset, market, direction, bl, bh, stop, target, entry, exit, status, opened, closed, proof) => ({
    asset, market, direction, buy_low: bl, buy_high: bh, stop, target, entry_price: entry, exit_price: exit, result_pct: null, status,
    opened_at: opened == null ? null : day(opened), closed_at: closed == null ? null : day(closed), analysis_id: null, evidence_url: null,
    note: 'Beispielposition für die Vorschau. Ersetze sie im Admin-Bereich (Depot) durch deine eigenen Trades.', evidence: proof ? proofImg(asset, status, proof) : null });
  const positions = [
    P('BTC/USD', 'Crypto', 'long', 61000, 62400, 59800, 68400, 61800, null, 'open', 4, null),
    P('ETH/USD', 'Crypto', 'long', 2900, 3000, 2790, 3260, null, null, 'watching', null, null),
    P('SOL/USD', 'Crypto', 'long', 138, 144, 131, 165, 141, 165, 'hit', 40, 21, 11),
    P('ETH/USD', 'Crypto', 'long', 2380, 2450, 2290, 2700, 2410, 2700, 'hit', 52, 33),
    P('BTC/USD', 'Crypto', 'long', 58200, 59400, 56800, 64500, 58900, 64500, 'hit', 66, 47, 23),
    P('ETH/USD', 'Crypto', 'long', 2650, 2720, 2580, 2950, 2690, 2580, 'stopped', 30, 26, 37),
    P('S&P 500', 'Stocks', 'long', 5640, 5690, 5560, 5860, 5665, 5860, 'hit', 71, 55),
    P('NASDAQ 100', 'Stocks', 'long', 19900, 20150, 19600, 21000, 20020, 21000, 'hit', 78, 60),
    P('BTC/USD', 'Crypto', 'short', 71500, 72800, 74000, 66500, 72100, 66500, 'hit', 84, 68),
    P('DAX', 'Stocks', 'long', 18400, 18550, 18150, 19200, 18480, 19200, 'hit', 88, 70),
    P('XRP/USD', 'Crypto', 'long', 0.48, 0.5, 0.455, 0.58, 0.49, 0.58, 'hit', 92, 74),
    P('SOL/USD', 'Crypto', 'long', 165, 170, 158, 190, 168, 158, 'stopped', 20, 16),
  ].map((p, i) => ({ ...p, id: i + 1, created_at: new Date().toISOString() }));
  const free_until = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  return { analyses, packs: {}, nextId: 4, messages: [], nextMsg: 1, positions, nextPos: positions.length + 1, config: { free_until, price: 29 }, promo: null, briefings: [], nextBr: 1, users: [], nextUser: 1, legal: { imprint: '', privacy: '', terms: '' } };
}

const ready = (async () => { if (!store.read()) store.write(seedState()); })();

/* ---------- Routes (mirror server.js) ---------- */
const MARKETS = ['Crypto', 'Stocks'];
class Err extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function parse(b) {
  const s = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  if (!s(b.asset, 40) || !s(b.timeframe, 10)) throw new Err(400, 'asset and timeframe are required');
  if (!MARKETS.includes(b.market)) throw new Err(400, 'market must be Crypto or Stocks');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.analysis_date || '')) throw new Err(400, 'analysis_date must be YYYY-MM-DD');
  return {
    asset: s(b.asset, 40), market: b.market, timeframe: s(b.timeframe, 10), analysis_date: b.analysis_date,
    wave_count: s(b.wave_count, 500), scenario_primary: s(b.scenario_primary, 1500), scenario_alt: s(b.scenario_alt, 1500),
    invalidation: s(b.invalidation, 500), targets: s(b.targets, 800), fib_levels: s(b.fib_levels, 800), body: s(b.body, 20000),
    tags: [...new Set((b.tags || []).map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 12),
    status: b.status === 'published' ? 'published' : 'draft',
  };
}

const sortPos = (list) => [...list].sort((a, b) => (b.closed_at || b.opened_at || b.created_at || '').localeCompare(a.closed_at || a.opened_at || a.created_at || '') || b.id - a.id);
function cfg(st) {
  const c = st.config || { free_until: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), price: 29 };
  return { small_business: true, ...c, days_left: Math.max(0, Math.ceil((Date.parse(`${c.free_until}T00:00:00Z`) - Date.now()) / 864e5)) };
}
const numOrNull = (v, name) => { if (v === '' || v == null) return null; const n = Number(v); if (!Number.isFinite(n)) throw new Err(400, `${name} must be a number`); return n; };
function parsePos(b) {
  const t = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  if (!t(b.asset, 40)) throw new Err(400, 'asset is required');
  if (!MARKETS.includes(b.market)) throw new Err(400, 'market must be Crypto or Stocks');
  const buy_low = numOrNull(b.buy_low, 'Buy zone low'), buy_high = numOrNull(b.buy_high, 'Buy zone high');
  if (buy_low != null && buy_high != null && buy_low > buy_high) throw new Err(400, 'Buy zone low must not exceed buy zone high');
  const url = t(b.evidence_url, 300);
  if (url && !/^https?:\/\/\S+$/.test(url)) throw new Err(400, 'Evidence link must start with http:// or https://');
  const status = ['watching', 'open', 'hit', 'stopped'].includes(b.status) ? b.status : 'watching';
  return { asset: t(b.asset, 40), market: b.market, direction: b.direction === 'short' ? 'short' : 'long', buy_low, buy_high,
    stop: numOrNull(b.stop, 'Stop'), target: numOrNull(b.target, 'Target'), entry_price: numOrNull(b.entry_price, 'Entry price'), exit_price: numOrNull(b.exit_price, 'Exit price'),
    result_pct: numOrNull(b.result_pct, 'Result'), status, opened_at: t(b.opened_at, 10) || null, closed_at: t(b.closed_at, 10) || null,
    note: t(b.note, 1000), evidence_url: url || null, analysis_id: b.analysis_id === '' || b.analysis_id == null ? null : Number(b.analysis_id) };
}
const curUser = (st) => (userId ? (st.users || []).find((u) => u.id === userId) || null : null);
const accessNow = (st) => accessFor({ user: curUser(st), admin: session.get(), config: cfg(st) });
const userView = (u) => u && { email: u.email, comped: !!u.comped, sub_status: u.sub_status || null, sub_period_end: null, has_customer: false, created_at: u.created_at };
const meOf = (st) => ({ user: userView(curUser(st)), access: accessNow(st), config: cfg(st), payments_enabled: false });
const byDate = (a, b) => (b.analysis_date.localeCompare(a.analysis_date)) || b.id - a.id;

async function route(method, path, body) {
  await ready;
  const st = store.read();
  const now = () => new Date().toISOString();
  if (method === 'GET' && path === '/api/analyses') { const ac = accessNow(st); return st.analyses.filter((a) => a.status === 'published').sort(byDate).map((a) => redactAnalysis(a, ac)); }
  let m = /^\/api\/analyses\/(\d+)$/.exec(path);
  if (m && method === 'GET') {
    const a = st.analyses.find((x) => x.id === +m[1]);
    if (!a || (a.status !== 'published' && !session.get())) throw new Err(404, 'Not found');
    return redactAnalysis(a, accessNow(st));
  }
  if (method === 'POST' && path === '/api/contact') {
    const t = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const m = { name: t(body.name, 80), email: t(body.email, 120), topic: t(body.topic, 60) || 'Allgemeine Frage', message: t(body.message, 4000) };
    if (!m.name) throw new Err(400, 'Bitte gib deinen Namen an');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email)) throw new Err(400, 'Bitte gib eine gültige E-Mail-Adresse an');
    if (!m.message) throw new Err(400, 'Bitte schreib eine Nachricht');
    st.messages ||= []; st.nextMsg ||= 1;
    st.messages.unshift({ ...m, id: st.nextMsg++, created_at: now().slice(0, 16).replace('T', ' ') });
    store.write(st); return { ok: true };
  }
  if (method === 'GET' && path === '/api/config') return cfg(st);
  if (method === 'GET' && path === '/api/depot') { const ac = accessNow(st); return { positions: sortPos(st.positions).map((p) => redactPosition(p, ac)), stats: computeStats(st.positions), locked: !ac.active }; }
  if (method === 'GET' && path === '/api/legal') return st.legal || { imprint: '', privacy: '', terms: '' };
  if (method === 'POST' && path === '/api/cancel') {
    const t = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const c = { name: t(body.name, 120), email: t(body.email, 120).toLowerCase(), kind: body.kind === 'extraordinary' ? 'extraordinary' : 'ordinary', reason: t(body.reason, 2000), effective_date: t(body.effective_date, 10) };
    if (!c.name) throw new Err(400, 'Bitte gib deinen Namen an');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) throw new Err(400, 'Bitte gib eine gültige E-Mail-Adresse an');
    if (c.kind === 'extraordinary' && !c.reason) throw new Err(400, 'Kündigungsgrund ist erforderlich');
    st.messages ||= []; st.nextMsg ||= 1;
    const id = st.nextMsg++, created = now().slice(0, 19).replace('T', ' ');
    const when = c.effective_date ? `zum ${c.effective_date}` : 'zum nächstmöglichen Zeitpunkt';
    st.messages.unshift({ id, name: c.name, email: c.email, topic: 'Kündigung', message: `Kündigung (${c.kind === 'ordinary' ? 'ordentlich' : 'außerordentlich'}) ${when}. Vorschau: keine Zahlung verbunden.`, created_at: created.slice(0, 16) });
    store.write(st);
    return { id, created_at: created, name: c.name, email: c.email, kind: c.kind, reason: c.reason, effective: when, result: 'received', ends: null };
  }
  if (method === 'GET' && path === '/api/account/me') return meOf(st);
  if (method === 'POST' && path === '/api/account/register') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Err(400, 'Bitte gib eine gültige E-Mail-Adresse an');
    if (String(body.password || '').length < 10) throw new Err(400, 'Das Passwort braucht mindestens 10 Zeichen');
    if (body.accept_terms !== true) throw new Err(400, 'Bitte akzeptiere die AGB und bestätige die Datenschutzerklärung');
    st.users ||= []; st.nextUser ||= 1;
    if (st.users.some((u) => u.email === email)) throw new Err(409, 'Zu dieser E-Mail-Adresse gibt es bereits ein Konto. Bitte logge dich ein.');
    const u = { id: st.nextUser++, email, pw: await sha(body.password), comped: false, created_at: now() };
    st.users.push(u); store.write(st); setUser(u.id); return meOf(st);
  }
  if (method === 'POST' && path === '/api/account/login') {
    const u = (st.users || []).find((x) => x.email === String(body.email || '').trim().toLowerCase());
    if (!u || u.pw !== await sha(body.password || '')) throw new Err(401, 'E-Mail oder Passwort ist falsch.');
    setUser(u.id); return meOf(st);
  }
  if (method === 'POST' && path === '/api/account/logout') { setUser(null); return { ok: true }; }
  if (path.startsWith('/api/account/')) {
    if (!curUser(st)) throw new Err(401, 'Bitte logge dich ein.');
    if (method === 'POST') throw new Err(503, 'In der Online-Vorschau sind Zahlungen nicht aktiv.');
    if (method === 'DELETE') { st.users = st.users.filter((u) => u.id !== userId); store.write(st); setUser(null); return { ok: true }; }
  }
  if (method === 'POST' && path === '/api/signup') {
    const email = typeof body.email === 'string' ? body.email.trim().slice(0, 120) : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Err(400, 'Bitte gib eine gültige E-Mail-Adresse an');
    st.messages ||= []; st.nextMsg ||= 1;
    st.messages.unshift({ id: st.nextMsg++, name: '(free access signup)', email, topic: 'Free access signup', message: 'Requested free access.', created_at: now().slice(0, 16).replace('T', ' ') });
    store.write(st); return { ok: true };
  }
  if (method === 'POST' && path === '/api/admin/login') {
    if (body.password !== DEMO_PASSWORD) throw new Err(401, 'Falsches Passwort. In dieser Vorschau lautet das Passwort "demo".');
    session.set(true); return { ok: true };
  }
  if (method === 'POST' && path === '/api/admin/logout') { session.set(false); return { ok: true }; }
  if (method === 'GET' && path === '/api/admin/me') return { admin: session.get() };
  if (!path.startsWith('/api/admin/')) throw new Err(404, 'Not found');
  if (!session.get()) throw new Err(401, 'Not logged in');

  if (method === 'GET' && path === '/api/admin/analyses') return [...st.analyses].sort(byDate);
  if (method === 'GET' && path === '/api/admin/messages') return st.messages || [];
  if (method === 'GET' && path === '/api/admin/users') return (st.users || []).map((u) => ({ id: u.id, email: u.email, comped: !!u.comped, sub_status: null, sub_period_end: null, created_at: u.created_at, access: u.comped ? 'comped' : 'none' }));
  let um = /^\/api\/admin\/users\/(\d+)$/.exec(path);
  if (um && method === 'PUT') { const u = (st.users || []).find((x) => x.id === +um[1]); if (!u) throw new Err(404, 'Not found'); u.comped = !!body.comped; store.write(st); return { ok: true }; }
  if (method === 'GET' && path === '/api/admin/legal') return st.legal || { imprint: '', privacy: '', terms: '' };
  if (method === 'PUT' && path === '/api/admin/legal') { st.legal = { imprint: String(body.imprint || ''), privacy: String(body.privacy || ''), terms: String(body.terms || '') }; store.write(st); return st.legal; }
  if (method === 'PUT' && path === '/api/admin/config') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.free_until || '')) throw new Err(400, 'Free access end date is required');
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) throw new Err(400, 'Price must be 0 or more');
    st.config = { free_until: body.free_until, price, small_business: body.small_business !== false }; store.write(st); return cfg(st);
  }
  if (method === 'GET' && path === '/api/admin/agent-status') return { provider: 'mock', model: null, key_configured: false, fallback: true, briefing_auto: false, briefing_news: 'none' };
  st.briefings ||= []; st.nextBr ||= 1;
  const runBriefing = async () => {
    const day = new Date().toISOString().slice(0, 10), since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), stats = computeStats(st.positions), c = cfg(st);
    const facts = { date: day, free_days_left: c.days_left, analyses: st.analyses.filter((a) => a.status === 'published' && a.analysis_date >= since).slice(0, 6).map((a) => ({ asset: a.asset, timeframe: a.timeframe, analysis_date: a.analysis_date, wave_count: a.wave_count, scenario_primary: a.scenario_primary })),
      depot: { hit_rate: stats.closed ? stats.hit_rate : null, hits: stats.hits, closed: stats.closed, open: stats.open, watching: stats.watching, simulated: true } };
    const raw = await mockBriefing({ facts });
    const rec = { day, briefing: raw.briefing, sources: [], pack: finalize({ ...raw, provider: 'mock' }), status: 'draft', created_at: now() };
    const i = st.briefings.findIndex((b) => b.day === day);
    if (i >= 0) { rec.id = st.briefings[i].id; st.briefings[i] = rec; } else { rec.id = st.nextBr++; st.briefings.unshift(rec); }
    store.write(st); return rec;
  };
  if (method === 'GET' && path === '/api/admin/briefings') return st.briefings.map(({ pack, ...b }) => b);
  if (method === 'POST' && path === '/api/admin/briefings') { const r = await runBriefing(); return { id: r.id, day: r.day }; }
  let bm = /^\/api\/admin\/briefings\/(\d+)(\/pack)?$/.exec(path);
  if (bm) {
    const b = st.briefings.find((x) => x.id === +bm[1]);
    if (!b) throw new Err(404, 'Not found');
    if (!bm[2]) { if (method === 'GET') return b; if (method === 'DELETE') { st.briefings = st.briefings.filter((x) => x.id !== b.id); store.write(st); return { ok: true }; } }
    else {
      if (method === 'GET') return { content: b.pack, status: b.status };
      if (method === 'POST') { const r = await runBriefing(); return { content: r.pack, status: r.status }; }
      if (method === 'PUT') { b.pack = finalize({ ...body.content, provider: b.pack.provider, chart_notes: b.pack.chart_notes }); b.status = body.status === 'approved' ? 'approved' : 'draft'; store.write(st); return { content: b.pack, status: b.status }; }
    }
  }
  if (method === 'POST' && path === '/api/admin/agent-test') return { ok: true, provider: 'mock', message: 'Preview mode: the mock agent is active. No AI call was made. On your own server, set AGENT_PROVIDER=claude to use the real agent.' };
  if (path === '/api/admin/promo') {
    if (method === 'GET') return st.promo ?? null;
    if (method === 'POST') {
      const stats = computeStats(st.positions), c = cfg(st);
      const facts = { free_days_left: c.days_left, hit_rate: stats.closed ? stats.hit_rate : null, hits: stats.hits, closed: stats.closed };
      st.promo = { content: finalize({ ...(await mockPromo({ facts })), provider: 'mock' }), status: 'draft', updated_at: now() }; store.write(st); return st.promo;
    }
    if (method === 'PUT') {
      const prev = st.promo?.content;
      st.promo = { content: finalize({ ...body.content, provider: prev?.provider, chart_notes: prev?.chart_notes }), status: body.status === 'approved' ? 'approved' : 'draft', updated_at: now() }; store.write(st); return st.promo;
    }
  }
  if (method === 'GET' && path === '/api/admin/positions') return { positions: sortPos(st.positions), stats: computeStats(st.positions) };
  if (method === 'POST' && path === '/api/admin/positions') {
    const d = parsePos(body);
    const p = { ...d, id: st.nextPos++, evidence: /^data:image\//.test(body.evidence || '') ? body.evidence : null, created_at: now() };
    st.positions.push(p); store.write(st); return p;
  }
  let pm = /^\/api\/admin\/positions\/(\d+)$/.exec(path);
  if (pm) {
    const i = st.positions.findIndex((x) => x.id === +pm[1]);
    if (i < 0) throw new Err(404, 'Not found');
    if (method === 'PUT') {
      const d = parsePos(body);
      st.positions[i] = { ...st.positions[i], ...d, evidence: /^data:image\//.test(body.evidence || '') ? body.evidence : st.positions[i].evidence }; store.write(st); return st.positions[i];
    }
    if (method === 'DELETE') { st.positions.splice(i, 1); store.write(st); return { ok: true }; }
  }
  m = /^\/api\/admin\/messages\/(\d+)$/.exec(path);
  if (m && method === 'DELETE') { st.messages = (st.messages || []).filter((x) => x.id !== +m[1]); store.write(st); return { ok: true }; }
  if (method === 'POST' && path === '/api/admin/analyses') {
    const data = parse(body);
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(body.image || '')) throw new Err(400, 'A chart screenshot is required');
    const a = { ...data, id: st.nextId++, image: body.image, created_at: now() };
    st.analyses.push(a); store.write(st); return a;
  }
  m = /^\/api\/admin\/analyses\/(\d+)$/.exec(path);
  if (m) {
    const i = st.analyses.findIndex((x) => x.id === +m[1]);
    if (i < 0) throw new Err(404, 'Not found');
    if (method === 'PUT') {
      const a = { ...st.analyses[i], ...parse(body) };
      if (body.image) a.image = body.image;
      st.analyses[i] = a; store.write(st); return a;
    }
    if (method === 'DELETE') { delete st.packs[m[1]]; st.analyses.splice(i, 1); store.write(st); return { ok: true }; }
  }
  m = /^\/api\/admin\/analyses\/(\d+)\/pack$/.exec(path);
  if (m) {
    const a = st.analyses.find((x) => x.id === +m[1]);
    if (!a) throw new Err(404, 'Not found');
    if (method === 'GET') return st.packs[a.id] ?? null;
    if (method === 'POST') {
      st.packs[a.id] = { content: finalize({ ...(await mock({ analysis: a })), provider: 'mock' }), status: 'draft', updated_at: now() };
      store.write(st); return st.packs[a.id];
    }
    if (method === 'PUT') {
      const prev = st.packs[a.id]?.content;
      st.packs[a.id] = { content: finalize({ ...body.content, provider: prev?.provider, chart_notes: prev?.chart_notes }),
        status: body.status === 'approved' ? 'approved' : 'draft', updated_at: now() };
      store.write(st); return st.packs[a.id];
    }
  }
  throw new Err(404, 'Not found');
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('/api/')) return realFetch(input, init);
  try {
    const data = await route((init.method || 'GET').toUpperCase(), url.split('?')[0], init.body ? JSON.parse(init.body) : {});
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: e.status || 500, headers: { 'Content-Type': 'application/json' } });
  }
};
