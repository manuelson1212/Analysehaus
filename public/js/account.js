import { h, api, routeUrl } from './dom.js';

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
  const btn = h('button', { class: 'btn', type: 'submit' }, isReg ? 'Create account' : 'Log in');
  return h('form', { class: 'panel form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault(); btn.disabled = true;
    try { await api(`/api/account/${mode}`, { method: 'POST', body: { email: email.value, password: pw.value, accept_terms: isReg ? terms.checked : undefined } }); changed(); onDone(); }
    catch (err) { out.replaceChildren(notice('err', err.message)); btn.disabled = false; }
  } },
  h('h2', {}, isReg ? 'Create your account' : 'Log in'),
  h('div', { class: 'field' }, h('label', { class: 'label', for: `${mode}-email` }, 'Email'), email),
  h('div', { class: 'field' }, h('label', { class: 'label', for: `${mode}-pw` }, isReg ? 'Password (at least 10 characters)' : 'Password'), pw),
  isReg && h('label', { class: 'check', for: 'accept-terms' }, terms, h('span', {}, 'I accept the ', h('a', { href: routeUrl('terms') }, 'Terms'), ' and have read the ', h('a', { href: routeUrl('privacy') }, 'Privacy Policy'), '.')),
  out, btn);
}

function statusText(d) {
  const { access, user, config } = d;
  if (access.reason === 'free_period') return { title: 'Free access', text: `Everything is open until ${config.free_until} (${config.days_left} days left). After that, the member details need a membership.` };
  if (access.reason === 'comped') return { title: 'Free access granted', text: 'Your account has free access to all details.' };
  if (access.reason === 'member') return { title: 'Active membership', text: user.sub_period_end ? `Current period ends on ${fmt(user.sub_period_end)}.` : 'Thank you for your support.' };
  return { title: 'No active membership', text: `Chart, wave count and the track record are public. A membership (€${config.price} per month) unlocks all details.` };
}

async function loggedIn(d) {
  const { user, access, payments_enabled } = d;
  const st = statusText(d);
  const out = h('div');
  const go = async (path, label, btn) => {
    btn.disabled = true;
    try { const r = await api(path, { method: 'POST', body: {} }); location.href = r.url; }
    catch (err) { out.replaceChildren(notice('err', err.message)); btn.disabled = false; btn.textContent = label; }
  };
  const subscribe = h('button', { class: 'btn lg', onclick: () => go('/api/account/checkout', 'Subscribe', subscribe) }, `Subscribe for €${d.config.price} per month`);
  const portal = h('button', { class: 'btn ghost', onclick: () => go('/api/account/portal', 'Manage billing', portal) }, 'Manage billing');
  const del = h('details', { class: 'faq' }, h('summary', {}, 'Delete my account'),
    h('p', {}, 'This removes your account and your login. If you have a subscription, cancel it in the billing portal first.'),
    (() => {
      const pw = h('input', { type: 'password', id: 'del-pw', placeholder: 'Your password', autocomplete: 'current-password' });
      const b = h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        try { await api('/api/account/me', { method: 'DELETE', body: { password: pw.value } }); changed(); render(); } catch (err) { out.replaceChildren(notice('err', err.message)); }
      } }, 'Delete permanently');
      return h('div', { class: 'row' }, pw, b);
    })());
  const success = new URLSearchParams(location.search).get('checkout') === 'success';
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Account'), h('h1', {}, user.email)),
    success && notice('ok', 'Thank you! Your membership activates within a minute. This page updates automatically.'),
    h('div', { class: 'panel acc-card' },
      h('div', { class: 'row' }, h('h2', {}, st.title), h('span', { class: `badge ${access.active ? 'pub' : ''}` }, access.active ? 'access: on' : 'access: public only')),
      h('p', { class: 'muted' }, st.text),
      h('div', { class: 'row' },
        !['member', 'comped'].includes(access.reason) && (payments_enabled ? subscribe : h('p', { class: 'muted' }, 'Memberships open soon. Payments are not connected yet.')),
        user.has_customer && portal,
        h('button', { class: 'btn ghost', onclick: async () => { await api('/api/account/logout', { method: 'POST', body: {} }); changed(); render(); } }, 'Log out')),
      out),
    del);
  if (success && !['member', 'comped'].includes(access.reason)) setTimeout(render, 2500); // webhook may take a moment
}

async function render() {
  let d;
  try { d = await api('/api/account/me'); } catch (e) { return root.replaceChildren(notice('err', e.message)); }
  if (d.user) return loggedIn(d);
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Account'), h('h1', {}, 'Your account')),
    h('div', { class: 'two-col' }, authForm('register', render), authForm('login', render)));
}
render();
