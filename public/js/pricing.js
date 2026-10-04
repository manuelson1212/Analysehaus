import { api } from './dom.js';

api('/api/config').then((c) => {
  document.getElementById('price').textContent = String(c.price);
  document.getElementById('vat-note').hidden = !c.small_business;   // Kleinunternehmer: no VAT charged (§ 19 UStG)
  document.getElementById('pay-note').hidden = !!c.payments_enabled;
}).catch(() => {});
