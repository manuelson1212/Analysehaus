import { h, api } from './dom.js';
import { depotTable } from './depot-ui.js';

const $ = (id) => document.getElementById(id);
let all = [], status = '';

function render() {
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

api('/api/depot').then(({ positions, stats, locked }) => {
  all = positions;
  document.getElementById('lock-note').hidden = !locked;
  $('t-rate').textContent = stats.closed ? `${stats.hit_rate}%` : '–';
  $('t-rate-sub').textContent = stats.closed ? `${stats.hits} von ${stats.closed} abgeschlossenen Calls` : 'noch keine abgeschlossenen Calls';
  $('t-avg').textContent = stats.avg_result == null ? '–' : `${stats.avg_result > 0 ? '+' : ''}${stats.avg_result.toLocaleString('de-DE')} %`;
  $('t-open').textContent = String(stats.open);
  $('t-watch').textContent = String(stats.watching);
  render();
}).catch(() => $('depot-table').replaceChildren(h('div', { class: 'empty' }, 'Das Depot konnte nicht geladen werden.')));
