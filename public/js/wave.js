// Interactive Elliott Wave diagram for the landing page. Geometry is illustrative; the ratios shown
// in the tooltips are computed from the drawn points, so they always match what the viewer sees.
import { h, s } from './dom.js';

const W = 1000, H = 440, PAD = { l: 36, r: 36, t: 44, b: 52 };
const PTS = [
  { k: '0', t: 0.0, v: 18 }, { k: '1', t: 0.14, v: 44 }, { k: '2', t: 0.23, v: 30 }, { k: '3', t: 0.52, v: 84 },
  { k: '4', t: 0.63, v: 62 }, { k: '5', t: 0.76, v: 100 }, { k: 'A', t: 0.85, v: 70 }, { k: 'B', t: 0.91, v: 86 }, { k: 'C', t: 1.0, v: 46 },
];
const X = (t) => PAD.l + t * (W - PAD.l - PAD.r);
const Y = (v) => PAD.t + (1 - v / 110) * (H - PAD.t - PAD.b);
const P = Object.fromEntries(PTS.map((p) => [p.k, { ...p, x: X(p.t), y: Y(p.v) }]));
const pct = (n) => `${Math.round(n * 100)}%`;
const r2 = (n) => n.toFixed(2);

const w1 = P['1'].v - P['0'].v;
const INFO = {
  1: { title: 'Wave 1', text: 'The first impulse of the new trend. Usually only recognised in hindsight.' },
  2: { title: 'Wave 2', text: `Corrects wave 1 but never beyond its start. Here it retraces ${pct((P['1'].v - P['2'].v) / w1)} of wave 1; 50% to 61.8% is typical.` },
  3: { title: 'Wave 3', text: `Never the shortest impulse wave and often the strongest. Here it measures ${r2((P['3'].v - P['2'].v) / w1)} × wave 1; 1.618 is a common extension.` },
  4: { title: 'Wave 4', text: `Must not overlap the price territory of wave 1. It holds ${Math.round(P['4'].v - P['1'].v)} points above the wave 1 high and retraces ${pct((P['3'].v - P['4'].v) / (P['3'].v - P['2'].v))} of wave 3.` },
  5: { title: 'Wave 5', text: `The final thrust of the impulse. Here ${r2((P['5'].v - P['4'].v) / w1)} × wave 1. Momentum often diverges.` },
  A: { title: 'Wave A', text: 'First leg of the correction. Often mistaken for a pullback inside the trend.' },
  B: { title: 'Wave B', text: 'A counter-move that traps late participants. It can retrace most of wave A.' },
  C: { title: 'Wave C', text: 'The closing leg of the correction. Often similar in size to wave A (1.0 ×) or 1.618 ×.' },
};
const IMPULSE = ['1', '2', '3', '4', '5'];
const PEAKS = new Set(['1', '3', '5', 'B']);

export function mountWave(root) {
  const segs = PTS.slice(1).map((p, i) => ({ from: PTS[i], to: p, key: p.k, len: Math.hypot(P[p.k].x - P[PTS[i].k].x, P[p.k].y - P[PTS[i].k].y) }));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wave-svg', role: 'img', 'aria-label': 'Illustration of a five-wave impulse followed by an A-B-C correction' });

  // grid
  const grid = s('g', { class: 'w-grid' });
  for (let i = 0; i <= 5; i++) { const y = PAD.t + i * ((H - PAD.t - PAD.b) / 5); grid.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: y, y2: y })); }
  for (let i = 0; i <= 10; i++) { const x = PAD.l + i * ((W - PAD.l - PAD.r) / 10); grid.append(s('line', { x1: x, x2: x, y1: PAD.t, y2: H - PAD.b })); }

  // helper overlays, revealed per wave
  const retr = (v) => P['1'].v - (P['1'].v - P['0'].v) * v;
  const guides = {
    2: s('g', { class: 'w-guide' },
      s('rect', { x: P['2'].x - 60, width: W - PAD.r - P['2'].x + 60, y: Y(retr(0.382)), height: Y(retr(0.618)) - Y(retr(0.382)), class: 'band' }),
      s('text', { x: W - PAD.r, y: Y(retr(0.5)) + 4, 'text-anchor': 'end', class: 'g-label' }, 'retracement zone 38.2% – 61.8%')),
    3: s('g', { class: 'w-guide' },
      s('line', { x1: P['2'].x, x2: W - PAD.r, y1: Y(P['2'].v + 1.618 * w1), y2: Y(P['2'].v + 1.618 * w1), class: 'dash' }),
      s('text', { x: W - PAD.r, y: Y(P['2'].v + 1.618 * w1) - 8, 'text-anchor': 'end', class: 'g-label' }, '1.618 × wave 1')),
    4: s('g', { class: 'w-guide' },
      s('line', { x1: P['1'].x, x2: W - PAD.r, y1: P['1'].y, y2: P['1'].y, class: 'dash danger' }),
      s('text', { x: W - PAD.r, y: P['1'].y + 20, 'text-anchor': 'end', class: 'g-label danger' }, 'wave 1 high: wave 4 must stay above')),
  };

  // wave segments (glow + line) and nodes
  const glow = s('g', { class: 'w-glow' }), line = s('g', { class: 'w-line' });
  segs.forEach((sg, i) => {
    const d = `M${P[sg.from.k].x},${P[sg.from.k].y}L${P[sg.to.k].x},${P[sg.to.k].y}`;
    const corr = !IMPULSE.includes(sg.key);
    for (const layer of [glow, line]) {
      const path = s('path', { d, class: `seg${corr ? ' corr' : ''}`, 'data-k': sg.key });
      path.style.setProperty('--len', sg.len.toFixed(1)); // CSSOM, not a style attribute (CSP)
      path.style.setProperty('--i', i);
      layer.append(path);
    }
  });
  const nodes = s('g', { class: 'w-nodes' });
  PTS.slice(1).forEach((p, i) => {
    const up = PEAKS.has(p.k), corr = !IMPULSE.includes(p.k);
    const node = s('g', { class: `node${corr ? ' corr' : ''}`, transform: `translate(${P[p.k].x} ${P[p.k].y})`, tabindex: 0, role: 'button', 'data-k': p.k,
      'aria-label': `${INFO[p.k].title}: ${INFO[p.k].text}` },
    s('circle', { r: 20, class: 'hit' }), s('circle', { r: 9, class: 'dot' }),
    s('text', { y: up ? -20 : 32, 'text-anchor': 'middle', class: 'lbl' }, corr ? p.k : `(${p.k})`));
    node.style.setProperty('--i', i);
    nodes.append(node);
  });
  const origin = s('circle', { cx: P['0'].x, cy: P['0'].y, r: 4, class: 'origin' });

  // crosshair
  const cross = s('g', { class: 'cross', 'aria-hidden': 'true' },
    s('line', { class: 'cv', y1: PAD.t, y2: H - PAD.b }), s('circle', { class: 'cd', r: 5 }),
    s('g', { class: 'cl' }, s('rect', { width: 92, height: 26, rx: 3 }), s('text', { x: 46, y: 18, 'text-anchor': 'middle' }, '')));
  const bg = s('rect', { class: 'catch', x: 0, y: 0, width: W, height: H, fill: 'transparent' });

  svg.append(bg, grid, ...Object.values(guides), glow, line, origin, nodes, cross); // bg first so nodes stay hoverable

  const tip = h('div', { class: 'wave-tip', role: 'status', 'aria-live': 'polite', hidden: true });
  const replay = h('button', { class: 'chip', type: 'button' }, '↻ Replay');
  const legend = h('div', { class: 'wave-legend' },
    h('span', {}, h('i', { class: 'sw imp' }), 'Impulse 1-2-3-4-5'), h('span', {}, h('i', { class: 'sw cor' }), 'Correction A-B-C'),
    h('span', { class: 'muted hint' }, 'Hover the waves'), replay);
  root.replaceChildren(h('div', { class: 'wave-stage' }, svg, tip), legend);

  /* ----- interaction ----- */
  let active = null;
  const focus = (k) => {
    active = k;
    svg.classList.toggle('has-focus', !!k);
    svg.querySelectorAll('[data-k]').forEach((el) => el.classList.toggle('hot', el.dataset.k === k));
    Object.entries(guides).forEach(([gk, g]) => g.classList.toggle('on', gk === k));
    if (!k) { tip.hidden = true; return; }
    const nx = (P[k].x / W) * 100, ny = (P[k].y / H) * 100;
    tip.replaceChildren(h('b', {}, INFO[k].title), h('span', {}, INFO[k].text));
    tip.className = `wave-tip ${nx > 62 ? 'left' : 'right'} ${ny < 35 ? 'below' : 'above'}`;
    tip.style.left = `${nx}%`; tip.style.top = `${ny}%`;
    tip.hidden = false;
  };
  nodes.querySelectorAll('.node').forEach((n) => {
    n.addEventListener('pointerenter', () => focus(n.dataset.k));
    n.addEventListener('focus', () => focus(n.dataset.k));
    n.addEventListener('blur', () => focus(null));
    n.addEventListener('click', () => focus(n.dataset.k));
  });
  svg.addEventListener('pointerleave', () => { focus(null); cross.classList.remove('on'); });

  const cl = cross.querySelector('.cl'), clt = cl.querySelector('text');
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const x = Math.min(Math.max(((e.clientX - r.left) / r.width) * W, PAD.l), W - PAD.r);
    const t = (x - PAD.l) / (W - PAD.l - PAD.r);
    const i = Math.max(1, PTS.findIndex((p) => p.t >= t));
    const a = PTS[i - 1], b = PTS[i], f = (t - a.t) / (b.t - a.t || 1);
    const v = a.v + (b.v - a.v) * Math.min(Math.max(f, 0), 1), y = Y(v);
    cross.querySelector('.cv').setAttribute('x1', x); cross.querySelector('.cv').setAttribute('x2', x);
    cross.querySelector('.cd').setAttribute('cx', x); cross.querySelector('.cd').setAttribute('cy', y);
    const lx = x > W - 150 ? x - 104 : x + 12;
    cl.setAttribute('transform', `translate(${lx} ${Math.max(y - 36, 6)})`);
    clt.textContent = `Index ${v.toFixed(1)}`;
    cross.classList.add('on');
  });

  replay.addEventListener('click', () => {
    svg.classList.remove('play'); void svg.getBoundingClientRect(); svg.classList.add('play');
  });
  requestAnimationFrame(() => svg.classList.add('play'));
  window.addEventListener('wave-focus', (e) => focus(e.detail));
  return { focus, get active() { return active; } };
}
