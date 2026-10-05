import { h, api, bindLinks } from './dom.js';
import { mountAtmosphere } from './atmosphere.js';
import { mountWaveHero } from './wave-hero.js';
import { socialLinks } from './social.js';
import { card } from './cards.js';
import { depotTable } from './depot-ui.js';

const $ = (id) => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

mountAtmosphere($('atmo'));
mountWaveHero($('wave-card'));

// Rotating asset name under the headline.
const ASSETS = ['Bitcoin', 'Ethereum', 'Solana', 'Nasdaq', 'S&P 500'];
if (!reduce) {
  let i = 0;
  const timer = setInterval(() => {
    const rot = $('rot');
    if (!rot) return clearInterval(timer); // the demo build swaps pages without a reload
    rot.classList.add('out');
    setTimeout(() => { i = (i + 1) % ASSETS.length; rot.textContent = ASSETS[i]; rot.classList.remove('out'); }, 320);
  }, 2400);
}

// Numbers count up once the strip scrolls into view.
function countTo(el, value, suffix = '') {
  if (reduce || !Number.isFinite(value) || value <= 0) { el.textContent = Number.isFinite(value) ? `${value}${suffix}` : '–'; return; }
  const start = performance.now(), dur = 1100;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur), eased = 1 - (1 - k) ** 3;
    el.textContent = `${Math.round(value * eased)}${suffix}`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const pending = new Map();
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  const [v, s] = pending.get(e.target) || [];
  countTo(e.target, v, s); io.unobserve(e.target);
}), { threshold: 0.4 }) : null;
const setCount = (el, value, suffix = '') => { if (io && value > 0 && !reduce) { pending.set(el, [value, suffix]); io.observe(el); } else countTo(el, value, suffix); };

// Ticker band: live prices when the server could fetch them, plus the site's key facts. Content is doubled for a seamless loop.
function fmtPrice(p) { return p.toLocaleString('de-DE', { maximumFractionDigits: p >= 1000 ? 0 : 2, minimumFractionDigits: p >= 1000 ? 0 : 2 }); }
function renderTicker(coins) {
  const facts = ['Klassische Elliott-Wellen nach Prechter/Frost', 'Kaufzone, Stop und Ziel vorab', 'Jeder Call im Live-Depot', 'Die ersten 30 Tage kostenlos'];
  const items = () => [
    ...coins.map((c) => h('span', { class: 'tk' }, h('b', {}, c.sym), ` $${fmtPrice(c.price)} `, h('span', { class: c.change >= 0 ? 'up' : 'down' }, `${c.change >= 0 ? '▲' : '▼'} ${Math.abs(c.change).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`))),
    ...facts.map((f) => h('span', { class: 'tk fact' }, f)),
  ];
  const track = $('ticker-track');
  track.replaceChildren(h('div', { class: 'tk-set' }, items()), h('div', { class: 'tk-set', 'aria-hidden': 'true' }, items()));
  if (coins.length) track.parentElement.dataset.live = 'Kurse 24 h, ohne Gewähr';
}
renderTicker([]);
api('/api/ticker').then((d) => { if (d.coins?.length) renderTicker(d.coins); }).catch(() => {});

function emptyState(title, text, profile) {
  return h('div', { class: 'empty-card' }, h('span', { class: 'live-dot', 'aria-hidden': 'true' }), h('b', {}, title), h('p', {}, text), socialLinks(profile));
}

const config = api('/api/config').catch(() => ({}));
config.then((c) => {
  if (c.days_left != null) {
    setCount($('days'), c.days_left);
    $('free-pill').textContent = c.days_left > 0 ? `Die ersten 30 Tage kostenlos · noch ${c.days_left} Tage` : 'Die Mitgliedschaft ist jetzt kostenpflichtig';
  }
  if (c.price != null) {
    $('price-after').textContent = `${c.price} €`;
    $('faq-price').textContent = `Die ersten 30 Tage sind kostenlos und ohne Zahlungsdaten. Danach kostet die Mitgliedschaft ${c.price} € im Monat${c.small_business ? ' (gemäß § 19 UStG ohne Umsatzsteuer)' : ''}. Chart, Wellenzählung und die komplette Erfolgsbilanz bleiben immer öffentlich.`;
  }
  const p = c.profile || {};
  $('about-text').textContent = p.about || 'Ich analysiere Bitcoin, Ethereum und Solana sowie Nasdaq und S&P 500 nach der klassischen Elliott-Wellen-Methode von Prechter und Frost. Mein Grundsatz: Jede Analyse nennt vorher die Kaufzone, das Ziel und das Level, an dem ich falsch liege. Und jeder Call landet öffentlich im Depot, auch die, die nicht aufgehen.';
  const links = socialLinks(p);
  $('about-social').replaceChildren(...(links ? [h('p', { class: 'label' }, 'Folge mir für neue Analysen'), links] : []));
  if (window.__AVATAR__) $('about-avatar').src = window.__AVATAR__;
});

Promise.all([api('/api/analyses'), config]).then(([all, c]) => {
  setCount($('count'), all.length);
  const latest = $('latest');
  latest.replaceChildren(...(all.length ? all.slice(0, 3).map(card)
    : [emptyState('Die erste Analyse erscheint in Kürze.', 'Folge mir, damit du sie nicht verpasst, oder leg jetzt dein kostenloses Konto an.', c.profile)]));
  window.__layout?.initReveal(latest);
}).catch(() => $('latest').replaceChildren(h('div', { class: 'empty' }, 'Analysen konnten nicht geladen werden.')));

api('/api/depot').then(({ positions, stats }) => {
  if (stats.closed) setCount($('rate'), stats.hit_rate, '%'); else $('rate').textContent = '–';
  $('rate-sub').textContent = stats.closed ? `Trefferquote · ${stats.hits} von ${stats.closed} abgeschlossenen Calls` : 'Trefferquote · erscheint nach den ersten abgeschlossenen Calls';
  setCount($('n-open'), stats.open);
  $('depot-preview').replaceChildren(positions.length ? depotTable(positions.slice(0, 5), { compact: true })
    : emptyState('Die ersten Positionen werden gerade eingetragen.', 'Hier siehst du gleich jede Kaufzone mit Stop und Ziel, bevor der Kurs dort ist.'));
}).catch(() => $('depot-preview').replaceChildren(h('div', { class: 'empty' }, 'Das Depot konnte nicht geladen werden.')));

// Mobile: a slim "start free" bar once the hero is out of view, hidden again near the final call to action and for members.
const sticky = $('sticky-cta');
if (sticky) bindLinks(sticky);
api('/api/account/me').then((m) => {
  if (m.user || !sticky) return;
  const hero = document.querySelector('.hero'), end = document.querySelector('.free-card');
  let pastHero = false, atEnd = false;
  const update = () => { sticky.hidden = !(pastHero && !atEnd); document.body.classList.toggle('has-sticky', !sticky.hidden); };
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; update(); }).observe(hero);
  new IntersectionObserver(([e]) => { atEnd = e.isIntersecting; update(); }).observe(end);
}).catch(() => {});
