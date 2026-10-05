import { h, api, routeUrl } from './dom.js';
import { loc, eur, lang } from './i18n.js';

const root = document.getElementById('account');
const changed = () => window.dispatchEvent(new Event('account-changed'));
const notice = (kind, text) => h('div', { class: `msg ${kind}`, role: kind === 'err' ? 'alert' : 'status' }, text);
const fmt = (iso) => (iso ? iso.slice(0, 10) : '');

function authForm(mode, onDone) {
  const isReg = mode === 'register';
  const out = h('div');
  const email = h('input', { type: 'text', id: `${mode}-email`, inputmode: 'email', autocomplete: 'email', maxlength: 120, required: true });
  const pw = h('input', { type: 'password', id: `${mode}-pw`, autocomplete: isReg ? 'new-password' : 'current-password', required: true });
  const terms = h('input', { type: 'checkbox', id: 'accept-terms' });
  const btn = h('button', { class: 'btn', type: 'submit' }, isReg ? 'Konto erstellen' : 'Einloggen');
  return h('form', { class: 'panel form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); btn.disabled = true;
    try { await api(`/api/account/${mode}`, { method: 'POST', body: { email: email.value, password: pw.value, accept_terms: isReg ? terms.checked : undefined } }); changed(); onDone(); }
    catch (err) { out.replaceChildren(notice('err', err.message)); btn.disabled = false; }
  } },
  h('h2', {}, isReg ? 'Konto erstellen' : 'Einloggen'),
  h('div', { class: 'field' }, h('label', { class: 'label', for: `${mode}-email` }, 'E-Mail'), email),
  h('div', { class: 'field' }, h('label', { class: 'label', for: `${mode}-pw` }, isReg ? 'Passwort (mindestens 10 Zeichen)' : 'Passwort'), pw),
  isReg && h('label', { class: 'check', for: 'accept-terms' }, terms, h('span', {}, 'Ich akzeptiere die ', h('a', { href: routeUrl('terms') }, 'AGB'), ' und habe die ', h('a', { href: routeUrl('privacy') }, 'Datenschutzerklärung'), ' gelesen.')),
  out, btn);
}

function statusText(d) {
  const { access, user, config } = d;
  if (access.reason === 'free_period') return { title: 'Kostenloser Zugang', text: `Bis ${new Date(config.free_until).toLocaleDateString(loc())} ist alles frei (noch ${config.days_left} Tage). Danach brauchen die Details eine Mitgliedschaft.` };
  if (access.reason === 'comped') return { title: 'Kostenloser Zugang freigeschaltet', text: 'Dein Konto hat kostenlosen Zugang zu allen Details.' };
  if (access.reason === 'member') return { title: 'Aktive Mitgliedschaft', text: user.sub_period_end ? `Der aktuelle Zeitraum endet am ${new Date(user.sub_period_end).toLocaleDateString(loc())}.` : 'Danke für deine Unterstützung.' };
  return { title: 'Keine aktive Mitgliedschaft', text: lang() === 'en'
    ? `A membership (${eur(config.price)} per month) unlocks all analyses, target zones, live charts and the live portfolio.`
    : `Eine Mitgliedschaft (${eur(config.price)} pro Monat) schaltet alle Analysen, Zielzonen, Live-Charts und das Live-Depot frei.` };
}

async function loggedIn(d) {
  const { user, access, payments_enabled } = d;
  const st = statusText(d);
  const out = h('div');
  const go = async (path, label, btn, body = {}) => {
    btn.disabled = true;
    try { const r = await api(path, { method: 'POST', body }); location.href = r.url; }
    catch (err) { out.replaceChildren(notice('err', err.message)); btn.disabled = false; btn.textContent = label; }
  };
  // Consumer law (DE): explicit consent to start before the withdrawal period ends, and an unambiguous order button.
  const waiver = h('input', { type: 'checkbox', id: 'waiver' });
  const waiverBox = h('label', { class: 'check', for: 'waiver' }, waiver, h('span', {}, 'Ich verlange ausdrücklich, dass Apex Wave Capital vor Ablauf der Widerrufsfrist mit der Bereitstellung der Inhalte beginnt. Mir ist bekannt, dass ich dadurch mein Widerrufsrecht verliere.'));
  const subLabel = lang() === 'en' ? `Subscribe with obligation to pay · ${eur(d.config.price)} / month` : `Zahlungspflichtig abonnieren · ${eur(d.config.price)} / Monat`;
  const subscribe = h('button', { class: 'btn lg', onclick: () => {
    if (!waiver.checked) return out.replaceChildren(notice('err', 'Bitte bestätige zuerst den Hinweis zum Widerrufsrecht.'));
    go('/api/account/checkout', subLabel, subscribe, { waiver: true });
  } }, subLabel);
  const portal = h('button', { class: 'btn ghost', onclick: () => go('/api/account/portal', 'Abo verwalten', portal) }, 'Abo verwalten');
  const del = h('details', { class: 'faq' }, h('summary', {}, 'Konto löschen'),
    h('p', {}, 'Damit werden dein Konto und dein Login entfernt. Hast du ein Abo, kündige es bitte vorher unter „Abo verwalten“.'),
    (() => {
      const pw = h('input', { type: 'password', id: 'del-pw', placeholder: 'Dein Passwort', autocomplete: 'current-password' });
      const b = h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        try { await api('/api/account/me', { method: 'DELETE', body: { password: pw.value } }); changed(); render(); } catch (err) { out.replaceChildren(notice('err', err.message)); }
      } }, 'Endgültig löschen');
      return h('div', { class: 'row' }, pw, b);
    })());
  const success = new URLSearchParams(location.search).get('checkout') === 'success';
  root.replaceChildren(...[
    h('div', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Konto'), h('h1', {}, user.email)),
    success && notice('ok', 'Danke! Deine Mitgliedschaft wird in etwa einer Minute aktiv. Diese Seite aktualisiert sich automatisch.'),
    h('div', { class: 'panel acc-card' },
      h('div', { class: 'row' }, h('h2', {}, st.title), h('span', { class: `badge ${access.active ? 'pub' : ''}` }, access.active ? 'Zugang: voll' : 'Zugang: gesperrt')),
      h('p', { class: 'muted' }, st.text),
      h('div', { class: 'row' },
        !['member', 'comped'].includes(access.reason) && (payments_enabled ? h('div', { class: 'sub-box' }, waiverBox, subscribe, h('p', { class: 'fine' }, 'Monatlich kündbar zum Ende des Abrechnungszeitraums, auch über „Verträge hier kündigen“ im Footer.', d.config.small_business ? ' Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' : '')) : h('p', { class: 'muted' }, 'Mitgliedschaften starten bald. Zahlungen sind noch nicht freigeschaltet.')),
        user.has_customer && portal,
        h('button', { class: 'btn ghost', onclick: async () => { await api('/api/account/logout', { method: 'POST', body: {} }); changed(); render(); } }, 'Abmelden')),
      out),
    del].filter(Boolean)); // replaceChildren would print "false" for skipped items
  if (success && !['member', 'comped'].includes(access.reason)) setTimeout(render, 2500); // webhook may take a moment
}

async function render() {
  let d;
  try { d = await api('/api/account/me'); } catch (e) { return root.replaceChildren(notice('err', e.message)); }
  if (d.user) return loggedIn(d);
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Konto'), h('h1', {}, 'Dein Konto')),
    h('div', { class: 'two-col' }, authForm('register', render), authForm('login', render)));
}
render();
