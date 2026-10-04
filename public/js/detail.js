import { h, api, imgUrl, routeUrl } from './dom.js';
import { MARKET } from './cards.js';

const root = document.getElementById('root');
const id = Number(new URLSearchParams(location.search).get('id') || /(\d+)$/.exec(location.hash)?.[1]);

const field = (label, value, cls) => value
  ? h('div', { class: cls }, h('div', { class: 'label' }, label), h('p', {}, value)) : null;

api(`/api/analyses/${id}`).then((a) => {
  document.title = `${a.asset} ${a.timeframe} · Apex Wave Capital`;
  root.replaceChildren(
    h('div', { class: 'page-head' },
      h('a', { class: 'link-arrow back', href: routeUrl('analyses') }, '← Alle Analysen'),
      h('div', { class: 'row' },
        h('span', { class: 'label' }, `${MARKET[a.market] || a.market} · ${new Date(a.analysis_date).toLocaleDateString('de-DE')}`),
        a.status !== 'published' && h('span', { class: 'badge' }, 'Entwurf')),
      h('h1', {}, `${a.asset} · ${a.timeframe}`)),
    h('div', { class: 'detail' },
      h('div', {},
        h('img', { class: 'chart', src: imgUrl(a.image), alt: `${a.asset} Elliott-Wellen-Chart`, decoding: 'async' }),
        a.body && h('div', { class: 'panel body-text' }, a.body)),
      h('aside', { class: 'panel kv' },
        field('Wellenzählung', a.wave_count),
        field('Hauptszenario', a.scenario_primary),
        field('Alternativszenario', a.scenario_alt),
        field('Ziele', a.targets),
        field('Fibonacci-Level', a.fib_levels),
        field('Invalidierung', a.invalidation, 'inval'),
        a.locked && h('div', { class: 'lock-box' }, h('b', {}, 'Nur für Mitglieder'), h('p', { class: 'muted' }, 'Alternativszenario, Ziele, Fibonacci-Level, Invalidierung und die vollständige schriftliche Analyse.'), h('a', { class: 'btn sm', href: routeUrl('account') }, 'Mit Mitgliedschaft freischalten')),
        a.tags.length ? h('div', { class: 'row' }, a.tags.map((t) => h('span', { class: 'tag' }, `#${t}`))) : null)));
}).catch(() => root.replaceChildren(h('div', { class: 'empty' }, 'Analyse nicht gefunden. ', h('a', { href: routeUrl('analyses') }, 'Zurück zu den Analysen'))));
