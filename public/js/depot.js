import { h, api } from './dom.js';
import { depotTable } from './depot-ui.js';

const $ = (id) => document.getElementById(id);
let all = [], status = '';

function render() {
  const list = all.filter((p) => !status || p.status === status);
  $('depot-table').replaceChildren(list.length ? depotTable(list) : h('div', { class: 'empty' }, all.length ? 'No positions with this status.' : 'The first positions will appear here.'));
}

document.getElementById('filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-status]');
  if (!b) return;
  status = b.dataset.status;
  document.querySelectorAll('[data-status]').forEach((x) => x.classList.toggle('on', x === b));
  render();
});

api('/api/depot').then(({ positions, stats }) => {
  all = positions;
  $('t-rate').textContent = stats.closed ? `${stats.hit_rate}%` : '–';
  $('t-rate-sub').textContent = stats.closed ? `${stats.hits} of ${stats.closed} closed calls` : 'no closed calls yet';
  $('t-avg').textContent = stats.avg_result == null ? '–' : `${stats.avg_result > 0 ? '+' : ''}${stats.avg_result}%`;
  $('t-open').textContent = String(stats.open);
  $('t-watch').textContent = String(stats.watching);
  render();
}).catch(() => $('depot-table').replaceChildren(h('div', { class: 'empty' }, 'Could not load the depot.')));
