// Hero illustration: a textbook Elliott count (impulse 1-5, correction A-B-C) that draws itself,
// with the invalidation level and a 1.618 target. Replays every few seconds; static when motion is reduced.
const NS = 'http://www.w3.org/2000/svg';
const PTS = [[24, 262], [92, 192], [128, 226], [246, 84], [288, 134], [354, 46], [398, 112], [424, 88], [466, 168]];
const LABELS = ['', '1', '2', '3', '4', '5', 'A', 'B', 'C'];

const el = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

export function mountWaveHero(host) {
  if (!host) return;
  const svg = el('svg', { viewBox: '0 0 490 300', class: 'wave-svg', role: 'img', 'aria-label': 'Beispiel einer Elliott-Wellen-Zählung: Impuls 1 bis 5, danach Korrektur A, B, C' });
  const grid = el('g', { class: 'grid-lines' });
  for (let y = 40; y <= 280; y += 40) grid.append(el('line', { x1: 0, x2: 490, y1: y, y2: y }));
  svg.append(grid);
  svg.append(el('line', { class: 'lvl lvl-stop', x1: 0, x2: 490, y1: 262, y2: 262 }), el('text', { class: 'lvl-t stop', x: 486, y: 256, 'text-anchor': 'end' }, 'INVALIDIERUNG'));
  svg.append(el('line', { class: 'lvl lvl-target', x1: 0, x2: 490, y1: 46, y2: 46 }), el('text', { class: 'lvl-t target', x: 486, y: 40, 'text-anchor': 'end' }, 'ZIEL 1,618'));
  svg.append(el('rect', { class: 'zone', x: 110, y: 214, width: 40, height: 24, rx: 3 }), el('text', { class: 'lvl-t zone-t', x: 156, y: 242 }, 'KAUFZONE'));
  PTS.slice(1).forEach(([x, y], i) => {
    const [px, py] = PTS[i];
    const seg = el('line', { class: `seg${i >= 5 ? ' corr' : ''}`, x1: px, y1: py, x2: x, y2: y, pathLength: 1 });
    seg.style.setProperty('--i', i);
    svg.append(seg);
  });
  PTS.slice(1).forEach(([x, y], i) => {
    const up = i % 2 === 0; // 1, 3, 5, B are highs; 2, 4, A, C are lows
    const g = el('g', { class: `lbl${i >= 5 ? ' corr' : ''}` });
    g.style.setProperty('--i', i);
    g.append(el('circle', { cx: x, cy: y, r: 3.5 }), el('text', { x, y: up ? y - 12 : y + 22, 'text-anchor': 'middle' }, LABELS[i + 1]));
    svg.append(g);
  });
  const [ex, ey] = PTS[PTS.length - 1];
  svg.append(el('circle', { class: 'pulse', cx: ex, cy: ey, r: 5 }));
  host.append(svg);

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return host.classList.add('done');
  const play = () => { host.classList.remove('play'); void host.getBoundingClientRect(); host.classList.add('play'); };
  let timer = 0;
  const loop = () => {
    clearInterval(timer);
    if (!host.isConnected) return document.removeEventListener('visibilitychange', loop); // page swapped in the demo build
    if (!document.hidden) { play(); timer = setInterval(() => (host.isConnected ? play() : loop()), 11000); }
  };
  document.addEventListener('visibilitychange', loop);
  loop();
}
