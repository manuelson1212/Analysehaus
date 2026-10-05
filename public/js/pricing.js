import { api } from './dom.js';
import { eur, loc, lang } from './i18n.js';

api('/api/config').then((c) => {
  const en = lang() === 'en', until = new Date(c.free_until).toLocaleDateString(loc());
  document.getElementById('price').textContent = eur(c.price);
  document.getElementById('vat-note').hidden = !c.small_business;
  document.getElementById('pay-note').hidden = !!c.payments_enabled;
  const free = c.days_left > 0;
  document.getElementById('ribbon').hidden = !free;
  document.getElementById('free-note').textContent = free
    ? (en ? `Free until ${until}, no payment details needed.` : `Bis ${until} kostenlos, ohne Zahlungsdaten.`)
    : (en ? 'Billed monthly.' : 'Monatliche Abrechnung.');
  document.getElementById('pricing-lede').textContent = free
    ? (en ? `Free until ${until}. After that ${eur(c.price)} per month, cancel monthly.` : `Bis ${until} kostenlos. Danach ${eur(c.price)} im Monat, monatlich kündbar.`)
    : (en ? `${eur(c.price)} per month, cancel monthly.` : `${eur(c.price)} im Monat, monatlich kündbar.`);
  document.getElementById('plan-cta').textContent = free ? (en ? 'Start for free now' : 'Jetzt kostenlos starten') : (en ? 'Become a member' : 'Mitglied werden');
}).catch(() => {});
