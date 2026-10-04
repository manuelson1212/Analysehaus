import { h, api } from './dom.js';
import { mountWave } from './wave.js';
import { mountAtmosphere } from './atmosphere.js';
import { mountSupply } from './supply.js';
import { card } from './cards.js';

mountAtmosphere(document.getElementById('atmo'));
const wave = mountWave(document.getElementById('wave'));
mountSupply(document.getElementById('supply'));

// Rules list drives the diagram: hovering a rule highlights its wave.
document.querySelectorAll('[data-wave]').forEach((el) => {
  const on = () => window.dispatchEvent(new CustomEvent('wave-focus', { detail: el.dataset.wave }));
  const off = () => window.dispatchEvent(new CustomEvent('wave-focus', { detail: null }));
  el.addEventListener('pointerenter', on); el.addEventListener('pointerleave', off);
  el.addEventListener('focus', on); el.addEventListener('blur', off);
});

// Pointer glow on the chart cards.
document.querySelectorAll('.wave-card').forEach((stage) => stage.addEventListener('pointermove', (e) => {
  const r = stage.getBoundingClientRect();
  stage.style.setProperty('--mx', `${e.clientX - r.left}px`);
  stage.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

const latest = document.getElementById('latest');
api('/api/analyses').then((all) => {
  document.getElementById('count').textContent = String(all.length);
  latest.replaceChildren(...(all.length ? all.slice(0, 3).map(card) : [h('div', { class: 'empty' }, 'The first analyses are coming soon.')]));
  window.__layout?.initReveal(latest);
}).catch(() => latest.replaceChildren(h('div', { class: 'empty' }, 'Could not load analyses.')));
void wave;
