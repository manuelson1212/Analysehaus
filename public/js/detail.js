import { h, api, imgUrl, routeUrl } from './dom.js';

const root = document.getElementById('root');
const id = Number(new URLSearchParams(location.search).get('id') || /(\d+)$/.exec(location.hash)?.[1]);

const field = (label, value, cls) => value
  ? h('div', { class: cls }, h('div', { class: 'label' }, label), h('p', {}, value)) : null;

api(`/api/analyses/${id}`).then((a) => {
  document.title = `${a.asset} ${a.timeframe} · Apex Wave Capital`;
  root.replaceChildren(
    h('div', { class: 'page-head' },
      h('a', { class: 'link-arrow back', href: routeUrl('analyses') }, '← All research'),
      h('div', { class: 'row' },
        h('span', { class: 'label' }, `${a.market} · ${a.analysis_date}`),
        a.status !== 'published' && h('span', { class: 'badge' }, 'draft')),
      h('h1', {}, `${a.asset} · ${a.timeframe}`)),
    h('div', { class: 'detail' },
      h('div', {},
        h('img', { class: 'chart', src: imgUrl(a.image), alt: `${a.asset} Elliott Wave chart`, decoding: 'async' }),
        a.body && h('div', { class: 'panel body-text' }, a.body)),
      h('aside', { class: 'panel kv' },
        field('Wave count', a.wave_count),
        field('Primary scenario', a.scenario_primary),
        field('Alternate scenario', a.scenario_alt),
        field('Targets', a.targets),
        field('Fibonacci levels', a.fib_levels),
        field('Invalidation', a.invalidation, 'inval'),
        a.tags.length ? h('div', { class: 'row' }, a.tags.map((t) => h('span', { class: 'tag' }, `#${t}`))) : null)));
}).catch(() => root.replaceChildren(h('div', { class: 'empty' }, 'Analysis not found. ', h('a', { href: '/' }, 'Back to analyses'))));
