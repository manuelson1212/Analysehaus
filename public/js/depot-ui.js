// Depot table and proof viewer, shared by the home preview and the depot page.
import { h, imgUrl, routeUrl } from './dom.js';

const nf = (n) => (n == null ? '–' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 }));
const pct = (n) => (n == null ? '–' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`);
export const STATUS = { watching: 'Watching', open: 'Open', hit: 'Target hit', stopped: 'Stopped out' };

export function resultOf(p) {
  if (p.result_pct != null) return p.result_pct;
  if (p.entry_price == null || p.exit_price == null || !p.entry_price) return null;
  const raw = ((p.exit_price - p.entry_price) / p.entry_price) * 100;
  return Math.round((p.direction === 'short' ? -raw : raw) * 100) / 100;
}

export function openProof(p) {
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); trigger?.focus?.(); };
  const onKey = (e) => e.key === 'Escape' && close();
  const trigger = document.activeElement;
  const overlay = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Proof for ${p.asset}`, onclick: (e) => e.target === overlay && close() },
    h('div', { class: 'modal-box' },
      h('button', { class: 'modal-x', type: 'button', 'aria-label': 'Close', onclick: close }, '×'),
      h('h3', {}, `${p.asset} · ${p.direction} · ${STATUS[p.status]}`),
      p.evidence && h('img', { class: 'chart', src: imgUrl(p.evidence), alt: `Proof screenshot for ${p.asset}` }),
      p.note && h('p', { class: 'body-text' }, p.note),
      p.evidence_url && h('p', {}, h('a', { href: p.evidence_url, target: '_blank', rel: 'noopener noreferrer' }, 'Open external proof ↗')),
      !p.evidence && !p.note && !p.evidence_url && h('p', { class: 'muted' }, 'No proof attached yet.')));
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.modal-x').focus();
}

export function depotTable(list, { compact = false } = {}) {
  if (!list.length) return h('div', { class: 'empty' }, 'No positions yet.');
  const head = ['Asset', 'Buy zone', 'Stop', 'Target', 'Status', 'Result', ...(compact ? [] : ['Opened']), 'Proof'];
  const rows = list.map((p) => {
    const r = resultOf(p);
    const hasProof = p.evidence || p.evidence_url || p.note;
    const lock = (cls) => h('td', { class: `num ${cls}` }, h('a', { class: 'lock-chip', href: routeUrl('account'), title: 'Members only' }, 'Members'));
    return h('tr', {},
      h('td', {}, h('b', { class: 'mono' }, p.asset), ' ', h('span', { class: `dir ${p.direction}` }, p.direction)),
      p.locked ? lock('') : h('td', { class: 'num' }, p.buy_low != null || p.buy_high != null ? `${nf(p.buy_low)} – ${nf(p.buy_high)}` : '–'),
      p.locked ? lock('') : h('td', { class: 'num down' }, nf(p.stop)),
      p.locked ? lock('') : h('td', { class: 'num up' }, nf(p.target)),
      h('td', {}, h('span', { class: `st ${p.status}` }, STATUS[p.status])),
      h('td', { class: `num ${r == null ? '' : r >= 0 ? 'up' : 'down'}` }, pct(r)),
      !compact && h('td', { class: 'muted' }, p.opened_at || '–'),
      h('td', {}, p.locked ? h('span', { class: 'muted' }, '–') : hasProof ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => openProof(p) }, 'View') : h('span', { class: 'muted' }, '–')));
  });
  return h('div', { class: 'scroll-x' }, h('table', { class: 'table depot' }, h('thead', {}, h('tr', {}, head.map((t) => h('th', {}, t)))), h('tbody', {}, rows)));
}

export function statTiles(stats, ids) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set(ids.rate, stats.closed ? `${stats.hit_rate}%` : '–');
  set(ids.rateSub, stats.closed ? `${stats.hits} of ${stats.closed} closed calls hit the target` : 'No closed calls yet');
}
