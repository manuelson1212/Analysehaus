// Browser-only stand-in for server.js, used by the static demo build (npm run demo:build).
// Data lives in localStorage (memory fallback). The agent is the same mock provider as on the server.
import { generate as mock } from '../lib/agent/mock.js';
import { finalize } from '../lib/agent/index.js';

window.__DEMO__ = true;
window.__DEMO_ROUTER__ = true;
const KEY = 'analysehaus-demo-v1';
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
    catch { throw Object.assign(new Error('Browser storage is full. Delete an analysis or use smaller screenshots.'), { status: 507 }); }
  },
};
let adminFlag = false; // kept in memory so login works even when sessionStorage is blocked
const session = {
  get: () => { try { if (sessionStorage.getItem('ah-admin') === '1') return true; } catch { /* blocked */ } return adminFlag; },
  set: (v) => { adminFlag = v; try { sessionStorage.setItem('ah-admin', v ? '1' : '0'); } catch { /* blocked */ } },
};

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

function seedState() {
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const base = { scenario_alt: '', body: '', fib_levels: '', targets: '', invalidation: '', wave_count: '', scenario_primary: '' };
  const analyses = [
    { ...base, id: 1, asset: 'BTC/USD', market: 'Crypto', timeframe: '4H', analysis_date: day(1), status: 'published', tags: ['impulse', 'btc', 'wave3'],
      wave_count: 'Wave (3) of 3 in progress, wave (2) ended at the 0.618 retracement',
      scenario_primary: 'Wave (3) extends toward the 1.618 extension of wave (1), then a wave (4) pullback shallower than wave (2).',
      scenario_alt: 'Wave (2) was a flat and wave (3) is only wave a of a larger structure. A close back inside wave (1) territory would favor this.',
      invalidation: 'Close below 61,200, the start of wave (1).', targets: '68,400 - 70,100', fib_levels: '0.618 retracement at 64,250; 1.618 extension at 70,100',
      body: 'Example analysis for the demo. Wave (1) was a clean five-wave advance. Wave (2) retraced to the 0.618 level on declining volume. The current advance shows alternation and strong momentum, typical of a third wave.',
      image: drawChart([[0, 60], [0.18, 66], [0.32, 62.5], [0.78, 76], [1, 74]], [[0.18, 66, '(1)', 1], [0.32, 62.5, '(2)', 0], [0.78, 76, '(3)', 1]],
        [{ v: 61.2, color: '#ef5350', dash: true, text: 'invalid' }, { v: 70.1, color: '#ffb000', dash: true, text: '1.618' }], 11, 'BTC/USD · 4H · DEMO CHART') },
    { ...base, id: 2, asset: 'S&P 500', market: 'Stocks', timeframe: '1D', analysis_date: day(3), status: 'published', tags: ['correction', 'index', 'abc'],
      wave_count: 'Wave B of an expanded flat, wave C pending',
      scenario_primary: 'Wave C unfolds in five waves toward the 1.0 to 1.618 projection of wave A.',
      scenario_alt: 'The decline was already a complete zigzag and a new impulse has started.',
      invalidation: 'Daily close above the wave B high.', targets: '5,310 - 5,180', fib_levels: 'C = 1.0 x A at 5,310; C = 1.618 x A at 5,180',
      body: 'Example analysis for the demo. Wave B retraced more than 100 percent of wave A, which points to an expanded flat.',
      image: drawChart([[0, 80], [0.25, 62], [0.55, 84], [1, 66]], [[0.25, 62, 'A', 0], [0.55, 84, 'B', 1], [1, 66, 'C?', 0]],
        [{ v: 84, color: '#ef5350', dash: true, text: 'invalid' }, { v: 56, color: '#ffb000', dash: true, text: '1.618' }], 23, 'S&P 500 · 1D · DEMO CHART') },
    { ...base, id: 3, asset: 'SOL/USD', market: 'Crypto', timeframe: '1H', analysis_date: day(0), status: 'draft', tags: ['draft'],
      wave_count: 'Possible wave 4 triangle', scenario_primary: 'Breakout from the triangle into wave 5.', invalidation: 'Break below wave 2 low.',
      image: drawChart([[0, 50], [0.3, 70], [0.45, 58], [0.6, 66], [0.75, 60], [1, 63]], [[0.3, 70, '(3)', 1], [0.45, 58, 'a', 0], [0.6, 66, 'b', 1], [0.75, 60, 'c', 0]],
        [{ v: 50, color: '#ef5350', dash: true, text: 'invalid' }], 37, 'SOL/USD · 1H · DEMO CHART') },
  ];
  return { analyses, packs: {}, nextId: 4, messages: [], nextMsg: 1 };
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

const byDate = (a, b) => (b.analysis_date.localeCompare(a.analysis_date)) || b.id - a.id;

async function route(method, path, body) {
  await ready;
  const st = store.read();
  const now = () => new Date().toISOString();
  if (method === 'GET' && path === '/api/analyses') return st.analyses.filter((a) => a.status === 'published').sort(byDate);
  let m = /^\/api\/analyses\/(\d+)$/.exec(path);
  if (m && method === 'GET') {
    const a = st.analyses.find((x) => x.id === +m[1]);
    if (!a || (a.status !== 'published' && !session.get())) throw new Err(404, 'Not found');
    return a;
  }
  if (method === 'POST' && path === '/api/contact') {
    const t = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const m = { name: t(body.name, 80), email: t(body.email, 120), topic: t(body.topic, 60) || 'General question', message: t(body.message, 4000) };
    if (!m.name) throw new Err(400, 'Name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email)) throw new Err(400, 'Please enter a valid email address');
    if (!m.message) throw new Err(400, 'Message is required');
    st.messages ||= []; st.nextMsg ||= 1;
    st.messages.unshift({ ...m, id: st.nextMsg++, created_at: now().slice(0, 16).replace('T', ' ') });
    store.write(st); return { ok: true };
  }
  if (method === 'POST' && path === '/api/admin/login') {
    if (body.password !== DEMO_PASSWORD) throw new Err(401, 'Wrong password. In this demo the password is "demo".');
    session.set(true); return { ok: true };
  }
  if (method === 'POST' && path === '/api/admin/logout') { session.set(false); return { ok: true }; }
  if (method === 'GET' && path === '/api/admin/me') return { admin: session.get() };
  if (!path.startsWith('/api/admin/')) throw new Err(404, 'Not found');
  if (!session.get()) throw new Err(401, 'Not logged in');

  if (method === 'GET' && path === '/api/admin/analyses') return [...st.analyses].sort(byDate);
  if (method === 'GET' && path === '/api/admin/messages') return st.messages || [];
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
