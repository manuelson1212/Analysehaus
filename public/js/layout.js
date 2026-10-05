// Shared site chrome: header with always-visible navigation, free-access bar, footer, scroll reveal.
import { h, api, bindLinks, routeUrl } from './dom.js';
import { loc, lang, setLang, startTranslation } from './i18n.js';
import { socialLinks } from './social.js';

const NAV = [['home', 'Start'], ['analyses', 'Analysen'], ['markets', 'Märkte'], ['depot', 'Live-Depot'], ['pricing', 'Preise'], ['support', 'Kontakt']];

// DE | EN switch. The labels are language names, so they stay the same in both languages.
function langSwitch() {
  const cur = lang();
  return h('div', { class: 'lang-switch', role: 'group', 'aria-label': 'Sprache / Language' },
    ['de', 'en'].map((l) => h('button', { type: 'button', class: l === cur ? 'on' : null, lang: l, 'aria-pressed': String(l === cur), 'data-no-i18n': '', onclick: () => l !== cur && setLang(l) }, l.toUpperCase())));
}

function header() {
  return h('div', { class: 'wrap bar' },
    h('a', { class: 'brand', 'data-route': 'home', href: routeUrl('home') }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), h('span', {}, 'Apex Wave ', h('b', {}, 'Capital'))),
    h('nav', { class: 'nav', id: 'main-nav', 'aria-label': 'Hauptnavigation' },
      NAV.map(([key, label]) => h('a', { class: 'nav-link', 'data-route': key, href: routeUrl(key) }, label))),
    h('div', { class: 'bar-right' },
      langSwitch(),
      h('a', { class: 'nav-login', id: 'nav-login', 'data-route': 'account', href: routeUrl('account') }, 'Login'),
      h('a', { class: 'btn sm nav-cta', 'data-route': 'pricing', href: routeUrl('pricing') }, 'Mitgliedschaft')));
}

// Footer: legal links on the left, social icons on the right, risk notice below. The main menu lives in the header only.
function footer() {
  return h('div', { class: 'wrap' },
    h('div', { class: 'foot-row' },
      h('nav', { class: 'legal-nav', 'aria-label': 'Rechtliches' }, ['imprint', 'privacy', 'terms', 'cancel'].map((k) => h('a', { 'data-route': k, href: routeUrl(k), class: k === 'cancel' ? 'cancel-link' : null }, { imprint: 'Impressum', privacy: 'Datenschutz', terms: 'AGB', cancel: 'Verträge hier kündigen' }[k]))),
      h('div', { id: 'foot-social' })),
    h('p', { class: 'fineprint' }, 'Marktanalysen zu Bildungszwecken. Keine Anlageberatung, kein Angebot und keine Aufforderung zum Kauf oder Verkauf. Das Live-Depot ist eine Simulation ohne echtes Geld. Trading ist mit erheblichen Verlustrisiken verbunden; vergangene Ergebnisse sind keine Garantie für die Zukunft.'));
}

// Scroll feedback on every page: a thin progress line under the header and a slimmer header once the page moves.
function scrollEffects() {
  const root = document.documentElement, header = document.getElementById('site-header');
  if (!header) return;
  header.append(h('div', { class: 'scroll-progress', 'aria-hidden': 'true' }));
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = root.scrollHeight - innerHeight;
    root.style.setProperty('--scroll', String(max > 0 ? Math.min(1, scrollY / max) : 0));
    header.classList.toggle('scrolled', scrollY > 12);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
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
  api('/api/account/me').then((m) => { const l = document.getElementById('nav-login'); if (l) l.textContent = m.user ? 'Konto' : 'Login'; }).catch(() => {});
}
window.addEventListener('account-changed', refreshLogin);

async function freeBar() {
  refreshLogin();
  const host = document.getElementById('free-bar');
  if (!host) return;
  try {
    const c = await api('/api/config');
    window.__config = c;
    const social = socialLinks(c.profile, { compact: true });
    document.getElementById('foot-social')?.replaceChildren(...(social ? [social] : []));
    host.replaceChildren(c.days_left > 0
      ? h('div', { class: 'wrap free-inner' }, h('span', { class: 'live-dot', 'aria-hidden': 'true' }), h('b', {}, `Noch ${c.days_left} Tage kostenlos`), h('span', { class: 'muted' }, `endet am ${new Date(c.free_until).toLocaleDateString(loc())}. Sag uns, was wir verbessern können.`), h('a', { 'data-route': 'account', href: routeUrl('account') }, 'Konto erstellen →'))
      : h('div', { class: 'wrap free-inner' }, h('b', {}, 'Die Mitgliedschaft ist jetzt kostenpflichtig'), h('a', { 'data-route': 'pricing', href: routeUrl('pricing') }, 'Zur Mitgliedschaft →')));
    bindLinks(host);
  } catch { host.replaceChildren(); }
}

export function mountLayout(page) {
  document.getElementById('site-header')?.replaceChildren(header());
  document.getElementById('site-footer')?.replaceChildren(footer());
  scrollEffects();
  setActive(page);
  bindLinks(document);
  initReveal(document);
  freeBar();
}

startTranslation();
window.__layout = { mountLayout, setActive, initReveal, bindLinks };
if (document.body.dataset.page && !window.__DEMO_ROUTER__) mountLayout(document.body.dataset.page);
