// Shared site chrome: header, footer and scroll reveal. Page markup stays static HTML.
import { h, bindLinks, routeUrl } from './dom.js';

const NAV = [['home', 'Home'], ['analyses', 'Analyses'], ['about', 'About'], ['pricing', 'Pricing'], ['support', 'Support']];

function header() {
  const links = NAV.map(([key, label]) => h('a', { class: 'nav-link', 'data-route': key, href: routeUrl(key) }, label));
  const toggle = h('button', { class: 'burger', type: 'button', 'aria-label': 'Menu', 'aria-expanded': 'false', 'aria-controls': 'main-nav' },
    h('span'), h('span'), h('span'));
  const nav = h('nav', { class: 'nav', id: 'main-nav', 'aria-label': 'Main' }, links,
    h('a', { class: 'btn sm nav-cta', 'data-route': 'pricing', href: routeUrl('pricing') }, 'Get access'));
  toggle.addEventListener('click', () => {
    const open = !document.documentElement.classList.contains('nav-open');
    document.documentElement.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) document.documentElement.classList.remove('nav-open'); });
  return h('div', { class: 'wrap bar' },
    h('a', { class: 'brand', 'data-route': 'home', href: routeUrl('home') }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), h('span', {}, 'Analyse', h('b', {}, 'haus'))),
    nav, toggle);
}

function footer() {
  const col = (title, items) => h('div', {}, h('div', { class: 'label' }, title),
    items.map(([key, label]) => h('a', { 'data-route': key, href: routeUrl(key) }, label)));
  return h('div', { class: 'wrap' },
    h('div', { class: 'foot-grid' },
      h('div', { class: 'foot-brand' },
        h('a', { class: 'brand', 'data-route': 'home', href: routeUrl('home') }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), h('span', {}, 'Analyse', h('b', {}, 'haus'))),
        h('p', { class: 'muted' }, 'Classical Elliott Wave analysis for crypto and equities. Every analysis names its invalidation level.')),
      col('Explore', [['home', 'Home'], ['analyses', 'Analyses'], ['pricing', 'Pricing']]),
      col('Company', [['about', 'About'], ['support', 'Support'], ['admin', 'Admin']])),
    h('p', { class: 'fineprint' }, 'Educational market analysis only. Not financial advice, not an offer or a solicitation. Trading involves substantial risk of loss; past patterns do not guarantee future results.'));
}

export function setActive(page) {
  const key = { detail: 'analyses' }[page] || page;
  document.querySelectorAll('.nav-link').forEach((a) => a.classList.toggle('on', a.dataset.route === key));
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

export function mountLayout(page) {
  document.getElementById('site-header')?.replaceChildren(header());
  document.getElementById('site-footer')?.replaceChildren(footer());
  setActive(page);
  bindLinks(document);
  initReveal(document);
}

window.__layout = { mountLayout, setActive, initReveal, bindLinks };
if (document.body.dataset.page && !window.__DEMO_ROUTER__) mountLayout(document.body.dataset.page);
