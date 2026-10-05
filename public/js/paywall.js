// "Members only" box used by analyses, the live portfolio and the live charts. Wording follows the free launch period.
import { h, api, routeUrl } from './dom.js';
import { eur, loc, lang } from './i18n.js';

let configP = null;
export const config = () => (configP ||= api('/api/config').catch(() => ({})));

const FEATURES = ['Alle schriftlichen Analysen mit Wellenzählung und Szenarien', 'Alle Zielzonen, Fibonacci-Level und Invalidierungen', 'Live-Charts zu BTC, ETH, SOL, Nasdaq und S&P 500', 'Das Live-Depot mit Kaufzonen, Stops und Zielen'];

export function paywall(title, { compact = false } = {}) {
  const priceLine = h('p', { class: 'muted' }, 'Mitgliedschaft wird geladen…');
  const cta = h('a', { class: 'btn', href: routeUrl('account') }, 'Kostenlos starten');
  config().then((c) => {
    if (c.price == null) return;
    const until = c.free_until ? new Date(c.free_until).toLocaleDateString(loc()) : '';
    const en = lang() === 'en';
    priceLine.textContent = c.days_left > 0
      ? (en ? `Free until ${until}, then ${eur(c.price)} per month. Cancel monthly.` : `Bis ${until} kostenlos, danach ${eur(c.price)} pro Monat. Monatlich kündbar.`)
      : (en ? `${eur(c.price)} per month. Cancel monthly.` : `${eur(c.price)} pro Monat. Monatlich kündbar.`);
    cta.textContent = c.days_left > 0 ? 'Jetzt kostenlos freischalten' : 'Mitglied werden';
  });
  return h('div', { class: `paywall${compact ? ' compact' : ''}` },
    h('span', { class: 'lock-ico', 'aria-hidden': 'true' }, '🔒'),
    h('b', {}, title),
    priceLine,
    compact ? null : h('ul', { class: 'ticks' }, FEATURES.map((f) => h('li', {}, f))),
    h('div', { class: 'row' }, cta, h('a', { class: 'btn ghost', href: routeUrl('account') }, 'Einloggen')));
}
