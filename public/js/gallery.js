import { h, api, imgUrl, detailUrl } from './dom.js';

const grid = document.getElementById('grid');
const search = document.getElementById('search');
let all = [];
let market = '';

const summary = (a) => a.scenario_primary || a.wave_count || a.body.slice(0, 160);

function card(a) {
  return h('a', { class: 'card', href: detailUrl(a.id) },
    h('img', { class: 'thumb', src: imgUrl(a.image), alt: `${a.asset} ${a.timeframe} chart`, loading: 'lazy', decoding: 'async' }),
    h('div', { class: 'meta' },
      h('div', { class: 'row' },
        h('span', { class: 'asset' }, a.asset),
        h('span', { class: 'badge' }, a.timeframe),
        h('span', { class: 'badge' }, a.market)),
      h('div', { class: 'summary' }, summary(a)),
      h('div', { class: 'row' },
        h('span', { class: 'label' }, a.analysis_date),
        a.tags.slice(0, 3).map((t) => h('span', { class: 'tag' }, `#${t}`)))));
}

function render() {
  const q = search.value.trim().toLowerCase();
  const items = all.filter((a) => (!market || a.market === market)
    && (!q || a.asset.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q))));
  grid.replaceChildren(...(items.length ? items.map(card) : [h('div', { class: 'empty' }, 'No analyses found.')]));
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
