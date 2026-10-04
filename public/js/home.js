import { h, api } from './dom.js';
import { mountAtmosphere } from './atmosphere.js';
import { card } from './cards.js';
import { depotTable } from './depot-ui.js';
import { bindSignup } from './signup.js';

mountAtmosphere(document.getElementById('atmo'));
bindSignup();
const $ = (id) => document.getElementById(id);

api('/api/config').then((c) => {
  $('days').textContent = String(c.days_left);
  $('price-after').textContent = `€${c.price}`;
  $('free-pill').textContent = c.days_left > 0 ? `First 30 days free · ${c.days_left} days left` : 'Membership is now paid';
}).catch(() => {});

api('/api/analyses').then((all) => {
  $('count').textContent = String(all.length);
  const latest = $('latest');
  latest.replaceChildren(...(all.length ? all.slice(0, 3).map(card) : [h('div', { class: 'empty' }, 'The first analyses are coming soon.')]));
  window.__layout?.initReveal(latest);
}).catch(() => $('latest').replaceChildren(h('div', { class: 'empty' }, 'Could not load analyses.')));

api('/api/depot').then(({ positions, stats }) => {
  $('rate').textContent = stats.closed ? `${stats.hit_rate}%` : '–';
  $('rate-sub').textContent = stats.closed ? `hit rate · ${stats.hits} of ${stats.closed} closed calls` : 'hit rate · no closed calls yet';
  $('n-open').textContent = String(stats.open);
  $('depot-preview').replaceChildren(depotTable(positions.slice(0, 5), { compact: true }));
}).catch(() => $('depot-preview').replaceChildren(h('div', { class: 'empty' }, 'Could not load the depot.')));
