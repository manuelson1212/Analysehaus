// Shared site chrome: header with always-visible navigation, free-access bar, footer, scroll reveal.
import { h, api, bindLinks, routeUrl } from './dom.js';

const NAV = [['home', 'Home'], ['analyses', 'Research'], ['depot', 'Live Depot'], ['pricing', 'Pricing'], ['support', 'Contact']];

function header() {
  return h('div', { class: 'wrap bar' },
    h('a', { class: 'brand', 'data-route': 'home', href: routeUrl('home') }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), h('span', {}, 'Apex Wave ', h('b', {}, 'Capital'))),
    h('nav', { class: 'nav', id: 'main-nav', 'aria-label': 'Main' },
      NAV.map(([key, label]) => h('a', { class: 'nav-link', 'data-route': key, href: routeUrl(key) }, label))),
    h('div', { class: 'bar-right' },
      h('a', { class: 'nav-login', id: 'nav-login', 'data-route': 'account', href: routeUrl('account') }, 'Login'),
      h('a', { class: 'btn sm nav-cta', 'data-route': 'pricing', href: routeUrl('pricing') }, 'Membership')));
}

function footer() {
  return h('div', { class: 'wrap' },
    h('div', { class: 'foot-row' },
      h('a', { class: 'brand', 'data-route': 'home', href: routeUrl('home') }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), h('span', {}, 'Apex Wave ', h('b', {}, 'Capital'))),
      h('nav', { class: 'foot-nav', 'aria-label': 'Footer' }, NAV.map(([key, label]) => h('a', { 'data-route': key, href: routeUrl(key) }, label)), h('a', { 'data-route': 'admin', href: routeUrl('admin') }, 'Admin'))),
    h('nav', { class: 'legal-nav', 'aria-label': 'Rechtliches' }, ['imprint', 'privacy', 'terms', 'cancel'].map((k) => h('a', { 'data-route': k, href: routeUrl(k), class: k === 'cancel' ? 'cancel-link' : null }, { imprint: 'Impressum', privacy: 'Datenschutz', terms: 'AGB', cancel: 'Verträge hier kündigen' }[k]))),
    h('p', { class: 'fineprint' }, 'Educational market analysis only. Not financial advice, not an offer or a solicitation. The live depot is a simulation without real money. Trading involves substantial risk of loss; past results do not guarantee future results.'));
}

export function setActive(page) {
  const key = { detail: 'analyses' }[page] || page;
  document.querySelectorAll('.nav-link').forEach((a) => {
    a.classList.toggle('on', a.dataset.route === key);
    if (a.dataset.route === key) a.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  });
  document.body.dataset.page = page;
}

// Fade-in on scroll. Content stays visible without IntersectionObserver or when motion is reduced.
export function initReveal(root = document) {
  const items = [...root.querySelectorAll('.reveal:not(.in)')];
  if (!items.length) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return items.forEach((el) => el.classList.add('in'));
  document.documentElement.classList.add('js');
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el, i) => { el.style.setProperty('--d', `${(i % 4) * 70}ms`); io.observe(el); });
  setTimeout(() => items.forEach((el) => el.classList.add('in')), 2500); // failsafe
}

// Slim bar on every page: how long the free access lasts.
function refreshLogin() {
  api('/api/account/me').then((m) => { const l = document.getElementById('nav-login'); if (l) l.textContent = m.user ? 'Account' : 'Login'; }).catch(() => {});
}
window.addEventListener('account-changed', refreshLogin);

async function freeBar() {
  refreshLogin();
  const host = document.getElementById('free-bar');
  if (!host) return;
  try {
    const c = await api('/api/config');
    window.__config = c;
    host.replaceChildren(c.days_left > 0
      ? h('div', { class: 'wrap free-inner' }, h('span', { class: 'live-dot', 'aria-hidden': 'true' }), h('b', {}, `${c.days_left} days of free access left`), h('span', { class: 'muted' }, `ends ${c.free_until}. Tell us what to improve.`), h('a', { 'data-route': 'account', href: routeUrl('account') }, 'Create account →'))
      : h('div', { class: 'wrap free-inner' }, h('b', {}, 'Membership is now paid'), h('a', { 'data-route': 'pricing', href: routeUrl('pricing') }, 'See membership →')));
    bindLinks(host);
  } catch { host.replaceChildren(); }
}

export function mountLayout(page) {
  document.getElementById('site-header')?.replaceChildren(header());
  document.getElementById('site-footer')?.replaceChildren(footer());
  setActive(page);
  bindLinks(document);
  initReveal(document);
  freeBar();
}

window.__layout = { mountLayout, setActive, initReveal, bindLinks };
if (document.body.dataset.page && !window.__DEMO_ROUTER__) mountLayout(document.body.dataset.page);
