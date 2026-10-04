import { h, api } from './dom.js';
import { card } from './cards.js';

const grid = document.getElementById('grid');
const search = document.getElementById('search');
let all = [];
let market = '';

function render() {
  const q = search.value.trim().toLowerCase();
  const items = all.filter((a) => (!market || a.market === market)
    && (!q || a.asset.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q))));
  grid.replaceChildren(...(items.length ? items.map(card) : [h('div', { class: 'empty' }, all.length ? 'No analyses match your filter.' : 'No analyses published yet.')]));
  window.__layout?.initReveal(grid);
}

document.getElementById('filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-market]');
  if (!b) return;
  market = b.dataset.market;
  document.querySelectorAll('[data-market]').forEach((x) => x.classList.toggle('on', x === b));
  render();
});
search.addEventListener('input', render);

api('/api/analyses')
  .then((d) => { all = d; render(); })
  .catch(() => grid.replaceChildren(h('div', { class: 'empty' }, 'Could not load analyses.')));
