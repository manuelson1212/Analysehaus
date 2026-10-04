import { h, api } from './dom.js';
import { mountAtmosphere } from './atmosphere.js';
import { card } from './cards.js';
import { depotTable } from './depot-ui.js';

mountAtmosphere(document.getElementById('atmo'));
const $ = (id) => document.getElementById(id);

api('/api/config').then((c) => {
  $('days').textContent = String(c.days_left);
  $('price-after').textContent = `${c.price} €`;
  $('free-pill').textContent = c.days_left > 0 ? `Die ersten 30 Tage kostenlos · noch ${c.days_left} Tage` : 'Die Mitgliedschaft ist jetzt kostenpflichtig';
}).catch(() => {});

api('/api/analyses').then((all) => {
  $('count').textContent = String(all.length);
  const latest = $('latest');
  latest.replaceChildren(...(all.length ? all.slice(0, 3).map(card) : [h('div', { class: 'empty' }, 'Die ersten Analysen erscheinen in Kürze.')]));
  window.__layout?.initReveal(latest);
}).catch(() => $('latest').replaceChildren(h('div', { class: 'empty' }, 'Analysen konnten nicht geladen werden.')));

api('/api/depot').then(({ positions, stats }) => {
  $('rate').textContent = stats.closed ? `${stats.hit_rate}%` : '–';
  $('rate-sub').textContent = stats.closed ? `Trefferquote · ${stats.hits} von ${stats.closed} abgeschlossenen Calls` : 'Trefferquote · noch keine abgeschlossenen Calls';
  $('n-open').textContent = String(stats.open);
  $('depot-preview').replaceChildren(depotTable(positions.slice(0, 5), { compact: true }));
}).catch(() => $('depot-preview').replaceChildren(h('div', { class: 'empty' }, 'Das Depot konnte nicht geladen werden.')));
