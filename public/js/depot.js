import { h, api } from './dom.js';
import { loc } from './i18n.js';
import { depotTable } from './depot-ui.js';
import { paywall } from './paywall.js';

const $ = (id) => document.getElementById(id);
let all = [], status = '', locked = false, count = 0;

function render() {
  if (locked) return $('depot-table').replaceChildren(paywall(count ? `${count} Positionen im Live-Depot – nur für Mitglieder` : 'Das Live-Depot ist nur für Mitglieder'));
  const list = all.filter((p) => !status || p.status === status);
  $('depot-table').replaceChildren(list.length ? depotTable(list) : h('div', { class: 'empty' }, all.length ? 'Keine Positionen mit diesem Status.' : 'Hier erscheinen bald die ersten Positionen.'));
}

document.getElementById('filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-status]');
  if (!b) return;
  status = b.dataset.status;
  document.querySelectorAll('[data-status]').forEach((x) => x.classList.toggle('on', x === b));
  render();
});

api('/api/depot').then((d) => {
  const { positions, stats } = d;
  all = positions; locked = d.locked; count = d.count || 0;
  document.getElementById('filters').hidden = locked;
  $('t-rate').textContent = stats.closed ? `${stats.hit_rate}%` : '–';
  $('t-rate-sub').textContent = stats.closed ? `${stats.hits} von ${stats.closed} abgeschlossenen Calls` : 'noch keine abgeschlossenen Calls';
  $('t-avg').textContent = stats.avg_result == null ? '–' : `${stats.avg_result > 0 ? '+' : ''}${stats.avg_result.toLocaleString(loc())} %`;
  $('t-open').textContent = String(stats.open);
  $('t-watch').textContent = String(stats.watching);
  render();
}).catch(() => $('depot-table').replaceChildren(h('div', { class: 'empty' }, 'Das Depot konnte nicht geladen werden.')));
