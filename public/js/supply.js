// "Scarcity vs elasticity": Bitcoin's issuance schedule against a schematic elastic money supply.
// The Bitcoin curve is computed from the protocol rules (21M cap, reward halves every 210,000 blocks).
// Halving dates up to 2024 are historical; later ones are estimates. The blue line is schematic, not data.
import { h, s } from './dom.js';

const W = 1000, H = 420, PAD = { l: 58, r: 28, t: 28, b: 46 };
const Y0 = 2009, Y1 = 2036.5;
// Era starts as decimal years. Index 0 is the genesis block, 5 and 6 are estimates.
const ERAS = [
  { y: 2009.01, reward: 50, label: 'Genesis', est: false }, { y: 2012.91, reward: 25, label: '1st halving', est: false },
  { y: 2016.52, reward: 12.5, label: '2nd halving', est: false }, { y: 2020.36, reward: 6.25, label: '3rd halving', est: false },
  { y: 2024.30, reward: 3.125, label: '4th halving', est: false }, { y: 2028.3, reward: 1.5625, label: '5th halving', est: true },
  { y: 2032.3, reward: 0.78125, label: '6th halving', est: true }, { y: 2036.3, reward: 0.390625, label: '7th halving', est: true },
];
const mined = ERAS.reduce((acc, e, i) => (acc.push(i === 0 ? 0 : acc[i - 1] + 0.5 / 2 ** (i - 1)), acc), []); // share of 21M at each era start

const X = (y) => PAD.l + ((y - Y0) / (Y1 - Y0)) * (W - PAD.l - PAD.r);
const Y = (v) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
function share(year) {
  const i = Math.min(Math.max(ERAS.findIndex((e, k) => year < (ERAS[k + 1]?.y ?? Infinity)), 0), ERAS.length - 2);
  const a = ERAS[i], b = ERAS[i + 1], f = Math.min(Math.max((year - a.y) / (b.y - a.y), 0), 1);
  return { v: mined[i] + (mined[i + 1] - mined[i]) * f, era: i };
}
// Schematic elastic supply: convex growth, deliberately unitless.
const elastic = (year) => 0.06 + 0.9 * (Math.exp(2.1 * ((year - Y0) / (Y1 - Y0))) - 1) / (Math.exp(2.1) - 1);
const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (y) => `${monthName[Math.min(11, Math.floor((y % 1) * 12))]} ${Math.floor(y)}`;
const now = (() => { const d = new Date(); return d.getFullYear() + d.getMonth() / 12 + d.getDate() / 372; })();

export function mountSupply(root) {
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sup-svg', role: 'img', 'aria-label': 'Bitcoin supply schedule against a schematic elastic money supply' });
  const grid = s('g', { class: 'w-grid' });
  [0, 0.25, 0.5, 0.75, 1].forEach((v) => grid.append(s('line', { x1: PAD.l, x2: W - PAD.r, y1: Y(v), y2: Y(v) }), s('text', { x: PAD.l - 10, y: Y(v) + 4, 'text-anchor': 'end', class: 'ax' }, `${v * 100}%`)));
  for (let y = 2010; y <= 2035; y += 5) grid.append(s('text', { x: X(y), y: H - 18, 'text-anchor': 'middle', class: 'ax' }, y));

  const pts = [];
  for (let y = Y0; y <= Y1; y += 0.1) pts.push([X(y), Y(share(y).v)]);
  const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const splitAt = pts.findIndex(([x]) => x >= X(ERAS[5].y));
  const btcSolid = s('path', { d: path(pts.slice(0, splitAt + 1)), class: 'btc-line' });
  const btcEst = s('path', { d: path(pts.slice(splitAt)), class: 'btc-line est' });
  const elasticLine = s('path', { d: path(Array.from({ length: 276 }, (_, i) => { const y = Y0 + i * 0.1; return [X(y), Y(elastic(y))]; })), class: 'el-line' });
  const area = s('path', { d: `${path(pts.slice(0, splitAt + 1))}L${X(ERAS[5].y)},${Y(0)}L${X(Y0)},${Y(0)}Z`, class: 'btc-area' });

  const halv = s('g', { class: 'halvings' });
  ERAS.slice(1, 7).forEach((e, i) => {
    halv.append(s('line', { x1: X(e.y), x2: X(e.y), y1: PAD.t, y2: H - PAD.b, class: `hv${e.est ? ' est' : ''}` }),
      s('circle', { cx: X(e.y), cy: Y(mined[i + 1]), r: 4.5, class: `hd${e.est ? ' est' : ''}` }));
  });
  const nowX = X(Math.min(now, Y1)), nowShare = share(now).v;
  const nowMark = s('g', { class: 'now' }, s('line', { x1: nowX, x2: nowX, y1: PAD.t, y2: H - PAD.b }), s('circle', { cx: nowX, cy: Y(nowShare), r: 6 }),
    s('text', { x: nowX - 10, y: PAD.t + 14, 'text-anchor': 'end' }, 'today'));
  const cross = s('g', { class: 'cross', 'aria-hidden': 'true' }, s('line', { class: 'cv', y1: PAD.t, y2: H - PAD.b }), s('circle', { class: 'cd', r: 5 }));
  svg.append(grid, area, elasticLine, btcSolid, btcEst, halv, nowMark, cross);

  const toggles = [['btc', 'Bitcoin supply schedule'], ['el', 'Elastic money supply (schematic)'], ['hv', 'Halvings']].map(([k, label]) =>
    h('button', { class: 'chip on', type: 'button', 'aria-pressed': 'true', 'data-k': k }, h('i', { class: `sw ${k}` }), label));
  const layers = { btc: [btcSolid, btcEst, area], el: [elasticLine], hv: [halv] };
  toggles.forEach((b) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on);
    layers[b.dataset.k].forEach((el) => el.classList.toggle('off', !on));
  }));

  const readout = h('div', { class: 'sup-read' });
  const setRead = (year) => {
    const { v, era } = share(year), e = ERAS[era];
    readout.replaceChildren(h('b', {}, fmtDate(year)), h('span', {}, `${(v * 100).toFixed(1)}% of the 21M cap issued (${(v * 21).toFixed(2)}M BTC)`), h('span', { class: 'muted' }, `Block reward ${e.reward} BTC${year > now ? ' · projection' : ''}${e.est ? ' · estimated halving' : ''}`));
  };
  setRead(now);
  svg.addEventListener('pointermove', (ev) => {
    const r = svg.getBoundingClientRect();
    const x = Math.min(Math.max(((ev.clientX - r.left) / r.width) * W, X(Y0)), X(Y1));
    const year = Y0 + ((x - PAD.l) / (W - PAD.l - PAD.r)) * (Y1 - Y0), v = share(year).v;
    cross.querySelector('.cv').setAttribute('x1', x); cross.querySelector('.cv').setAttribute('x2', x);
    cross.querySelector('.cd').setAttribute('cx', x); cross.querySelector('.cd').setAttribute('cy', Y(v));
    cross.classList.add('on'); setRead(year);
  });
  svg.addEventListener('pointerleave', () => { cross.classList.remove('on'); setRead(now); });

  root.replaceChildren(h('div', { class: 'wave-stage' }, svg), h('div', { class: 'sup-foot' }, readout, h('div', { class: 'sup-toggles' }, toggles)),
    h('p', { class: 'fine' }, 'Bitcoin curve: computed from the protocol rules (reward halves every 210,000 blocks, about four years). Halvings after 2024 are estimates. The blue line is a schematic of discretionary money creation, not measured data.'));
}
