import { h, imgUrl, detailUrl } from './dom.js';
import { loc, localized } from './i18n.js';

export const MARKET = { Crypto: 'Krypto', Stocks: 'Aktien' };

const summary = (a) => a.scenario_primary || a.wave_count || a.body.slice(0, 160);

export function card(original) {
  const a = localized(original);
  return h('a', { class: 'card reveal', href: detailUrl(a.id) },
    h('div', { class: 'thumb-wrap' },
      h('img', { class: 'thumb', src: imgUrl(a.image), alt: `${a.asset} ${a.timeframe} Chart`, loading: 'lazy', decoding: 'async' })),
    h('div', { class: 'meta' },
      h('div', { class: 'row' },
        h('span', { class: 'asset' }, a.asset),
        h('span', { class: 'badge' }, a.timeframe),
        h('span', { class: 'badge' }, MARKET[a.market] || a.market)),
      h('div', { class: 'summary' }, summary(a)),
      h('div', { class: 'row' },
        h('span', { class: 'label' }, new Date(a.analysis_date).toLocaleDateString(loc())),
        a.tags.slice(0, 3).map((t) => h('span', { class: 'tag' }, `#${t}`)))));
}
