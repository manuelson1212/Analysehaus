// Markets page: live TradingView chart per market plus the latest matching analysis.
// The chart is a third-party embed, so it loads only after the visitor agrees (two-click solution, GDPR / TDDDG).
import { h, api, routeUrl } from './dom.js';
import { lang, loc } from './i18n.js';
import { card } from './cards.js';
import { socialLinks } from './social.js';

const MARKETS = [
  { id: 'btc', name: 'Bitcoin', sym: 'BTC', group: 'Krypto', tv: 'BINANCE:BTCUSDT', match: /\bBTC|BITCOIN/i },
  { id: 'eth', name: 'Ethereum', sym: 'ETH', group: 'Krypto', tv: 'BINANCE:ETHUSDT', match: /\bETH|ETHEREUM/i },
  { id: 'sol', name: 'Solana', sym: 'SOL', group: 'Krypto', tv: 'BINANCE:SOLUSDT', match: /\bSOL\b|SOLANA/i },
  { id: 'ndx', name: 'Nasdaq 100', sym: 'NDX', group: 'Aktienindex', tv: 'FOREXCOM:NSXUSD', match: /NASDAQ|\bNDX|\bNQ\b|US100|NAS100/i },
  { id: 'spx', name: 'S&P 500', sym: 'SPX', group: 'Aktienindex', tv: 'FOREXCOM:SPXUSD', match: /S&P|\bSPX|SP500|US500|\bES\b/i },
];
const CONSENT = 'awc-tv-consent';
const $ = (id) => document.getElementById(id);
const hasConsent = () => { try { return localStorage.getItem(CONSENT) === '1'; } catch { return false; } };
let sessionConsent = hasConsent(), analyses = [], prices = {}, profile = {};

const pick = () => MARKETS.find((m) => m.id === new URLSearchParams(location.search).get('m')) || MARKETS[0];

function mountChart(box, m) {
  const holder = h('div', { class: 'tradingview-widget-container' }, h('div', { class: 'tradingview-widget-container__widget' }));
  const s = document.createElement('script');
  s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  s.async = true;
  // The embed script reads its settings from its own text.
  s.textContent = JSON.stringify({ autosize: true, symbol: m.tv, interval: '240', timezone: 'Europe/Berlin', theme: 'dark', style: '1',
    locale: lang() === 'en' ? 'en' : 'de_DE', backgroundColor: '#0d1219', gridColor: 'rgba(42, 53, 68, 0.35)', hide_side_toolbar: true,
    allow_symbol_change: false, withdateranges: true, save_image: false, calendar: false, support_host: 'https://www.tradingview.com' });
  holder.append(s);
  box.replaceChildren(holder);
}

function consentBox(box, m) {
  const remember = h('input', { type: 'checkbox', id: 'tv-remember' });
  box.replaceChildren(h('div', { class: 'tv-consent' },
    h('b', {}, `${m.name} Live-Chart`),
    h('p', {}, 'Der Chart wird von TradingView geladen. Dabei werden Daten wie deine IP-Adresse an TradingView (USA) übertragen und TradingView kann Cookies setzen.'),
    h('button', { class: 'btn', type: 'button', onclick: () => {
      sessionConsent = true;
      if (remember.checked) { try { localStorage.setItem(CONSENT, '1'); } catch { /* not stored */ } }
      mountChart(box, m);
    } }, 'Live-Chart laden'),
    h('label', { class: 'check', for: 'tv-remember' }, remember, h('span', {}, 'Charts künftig automatisch laden')),
    h('a', { class: 'fine', href: routeUrl('privacy') }, 'Mehr in der Datenschutzerklärung')));
}

// The chart box is only rebuilt when the market changes, so late data (prices, analyses) does not reload the chart.
const head = h('div', { class: 'market-head' }), box = h('div', { class: 'tv-box' }), info = h('div', { class: 'market-analysis' });
$('market-view').replaceChildren(head, box, info);
let shown = null;

function render() {
  const m = pick();
  document.querySelectorAll('.market-tab').forEach((b) => { const on = b.dataset.id === m.id; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  const p = prices[m.sym];
  head.replaceChildren(...[
    h('div', {}, h('p', { class: 'label' }, m.group), h('h2', {}, m.name)),
    p && h('div', { class: 'market-price' }, h('b', {}, `$${p.price.toLocaleString(loc(), { maximumFractionDigits: p.price >= 1000 ? 0 : 2, minimumFractionDigits: p.price >= 1000 ? 0 : 2 })}`),
      h('span', { class: p.change >= 0 ? 'up' : 'down' }, `${p.change >= 0 ? '▲' : '▼'} ${Math.abs(p.change).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} % (24 h)`)),
    h('a', { class: 'link-arrow', href: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(m.tv)}`, target: '_blank', rel: 'noopener noreferrer' }, 'Auf TradingView öffnen ↗')].filter(Boolean));
  const match = analyses.filter((a) => m.match.test(a.asset));
  info.replaceChildren(h('p', { class: 'eyebrow' }, 'Elliott-Wellen-Analyse'),
    match.length ? h('div', { class: 'grid' }, match.slice(0, 3).map(card))
      : h('div', { class: 'empty-card' }, h('span', { class: 'live-dot', 'aria-hidden': 'true' }), h('b', {}, 'Analyse folgt in Kürze.'),
        h('p', {}, `Die Elliott-Wellen-Zählung zu ${m.name} ist in Arbeit. Folge mir, damit du sie nicht verpasst.`), socialLinks(profile)));
  window.__layout?.initReveal(info);
  if (shown === m.id) return;
  shown = m.id;
  if (sessionConsent) mountChart(box, m); else consentBox(box, m);
}

$('market-tabs').replaceChildren(...MARKETS.map((m) => h('button', { class: 'market-tab', type: 'button', role: 'tab', 'data-id': m.id, onclick: () => {
  const url = new URL(location.href); url.searchParams.set('m', m.id); history.replaceState(null, '', url); render();
} }, h('b', {}, m.sym), h('span', {}, m.name))));
render();

api('/api/analyses').then((all) => { analyses = all; render(); }).catch(() => {});
api('/api/ticker').then((d) => { for (const c of d.coins || []) prices[c.sym] = c; render(); }).catch(() => {});
api('/api/config').then((c) => { profile = c.profile || {}; render(); }).catch(() => {});
