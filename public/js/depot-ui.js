// Depot table and proof viewer, shared by the home preview and the depot page.
import { h, imgUrl, routeUrl } from './dom.js';

const nf = (n) => (n == null ? '–' : Number(n).toLocaleString('de-DE', { maximumFractionDigits: 4 }));
const pct = (n) => (n == null ? '–' : `${n > 0 ? '+' : ''}${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`);
export const STATUS = { watching: 'Beobachtet', open: 'Offen', hit: 'Ziel erreicht', stopped: 'Ausgestoppt' };

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
  const overlay = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Nachweis für ${p.asset}`, onclick: (e) => e.target === overlay && close() },
    h('div', { class: 'modal-box' },
      h('button', { class: 'modal-x', type: 'button', 'aria-label': 'Schließen', onclick: close }, '×'),
      h('h3', {}, `${p.asset} · ${p.direction} · ${STATUS[p.status]}`),
      p.evidence && h('img', { class: 'chart', src: imgUrl(p.evidence), alt: `Nachweis-Screenshot für ${p.asset}` }),
      p.note && h('p', { class: 'body-text' }, p.note),
      p.evidence_url && h('p', {}, h('a', { href: p.evidence_url, target: '_blank', rel: 'noopener noreferrer' }, 'Externen Nachweis öffnen ↗')),
      !p.evidence && !p.note && !p.evidence_url && h('p', { class: 'muted' }, 'Noch kein Nachweis hinterlegt.')));
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.modal-x').focus();
}

export function depotTable(list, { compact = false } = {}) {
  if (!list.length) return h('div', { class: 'empty' }, 'Noch keine Positionen.');
  const head = ['Asset', 'Kaufzone', 'Stop', 'Ziel', 'Status', 'Ergebnis', ...(compact ? [] : ['Eröffnet']), 'Nachweis'];
  const rows = list.map((p) => {
    const r = resultOf(p);
    const hasProof = p.evidence || p.evidence_url || p.note;
    const lock = (cls) => h('td', { class: `num ${cls}` }, h('a', { class: 'lock-chip', href: routeUrl('account'), title: 'Nur für Mitglieder' }, 'Mitglieder'));
    return h('tr', {},
      h('td', {}, h('b', { class: 'mono' }, p.asset), ' ', h('span', { class: `dir ${p.direction}` }, p.direction)),
      p.locked ? lock('') : h('td', { class: 'num' }, p.buy_low != null || p.buy_high != null ? `${nf(p.buy_low)} – ${nf(p.buy_high)}` : '–'),
      p.locked ? lock('') : h('td', { class: 'num down' }, nf(p.stop)),
      p.locked ? lock('') : h('td', { class: 'num up' }, nf(p.target)),
      h('td', {}, h('span', { class: `st ${p.status}` }, STATUS[p.status])),
      h('td', { class: `num ${r == null ? '' : r >= 0 ? 'up' : 'down'}` }, pct(r)),
      !compact && h('td', { class: 'muted' }, p.opened_at ? new Date(p.opened_at).toLocaleDateString('de-DE') : '–'),
      h('td', {}, p.locked ? h('span', { class: 'muted' }, '–') : hasProof ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => openProof(p) }, 'Ansehen') : h('span', { class: 'muted' }, '–')));
  });
  return h('div', { class: 'scroll-x' }, h('table', { class: 'table depot' }, h('thead', {}, h('tr', {}, head.map((t) => h('th', {}, t)))), h('tbody', {}, rows)));
}

export function statTiles(stats, ids) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set(ids.rate, stats.closed ? `${stats.hit_rate}%` : '–');
  set(ids.rateSub, stats.closed ? `${stats.hits} von ${stats.closed} abgeschlossenen Calls haben ihr Ziel erreicht` : 'Noch keine abgeschlossenen Calls');
}
