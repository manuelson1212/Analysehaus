// "Verträge hier kündigen" (§ 312k BGB): form, confirmation page with "Jetzt kündigen", receipt. Works without login.
import { h, api } from './dom.js';

const root = document.getElementById('cancel');
const head = (title, lede) => h('div', { class: 'page-head' }, h('p', { class: 'eyebrow' }, 'Kündigung'), h('h1', {}, title), lede && h('p', { class: 'lede' }, lede));
let data = { name: '', email: '', kind: 'ordinary', reason: '', effective_date: '' };
const KIND = { ordinary: 'Ordentliche Kündigung zum nächstmöglichen Zeitpunkt', extraordinary: 'Außerordentliche (fristlose) Kündigung' };

function step1(error) {
  const name = h('input', { type: 'text', id: 'c-name', maxlength: 120, autocomplete: 'name', value: data.name });
  const email = h('input', { type: 'text', id: 'c-email', maxlength: 120, inputmode: 'email', autocomplete: 'email', value: data.email });
  const radio = (v) => h('label', { class: 'check', for: `k-${v}` }, h('input', { type: 'radio', name: 'kind', id: `k-${v}`, value: v, checked: data.kind === v }), h('span', {}, KIND[v]));
  const reason = h('textarea', { id: 'c-reason', maxlength: 2000, rows: 4 }, data.reason);
  const reasonField = h('div', { class: 'field', hidden: data.kind !== 'extraordinary' }, h('label', { class: 'label', for: 'c-reason' }, 'Kündigungsgrund (bei außerordentlicher Kündigung)'), reason);
  const date = h('input', { type: 'date', id: 'c-date', value: data.effective_date });
  const form = h('form', { class: 'panel form', novalidate: true, onsubmit: (e) => {
    e.preventDefault();
    data = { name: name.value.trim(), email: email.value.trim(), kind: form.querySelector('input[name=kind]:checked').value, reason: reason.value.trim(), effective_date: date.value };
    if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return step1('Bitte gib deinen Namen und die E-Mail-Adresse deines Kontos an.');
    if (data.kind === 'extraordinary' && !data.reason) return step1('Bitte gib bei einer außerordentlichen Kündigung den Grund an.');
    step2();
  } },
  h('h2', {}, 'Welcher Vertrag?'),
  h('p', { class: 'muted' }, 'Mitgliedschaft bei Apex Wave Capital. Gib die E-Mail-Adresse an, mit der du registriert bist, damit wir dein Konto eindeutig zuordnen können.'),
  h('div', { class: 'two' }, h('div', { class: 'field' }, h('label', { class: 'label', for: 'c-name' }, 'Vor- und Nachname'), name),
    h('div', { class: 'field' }, h('label', { class: 'label', for: 'c-email' }, 'E-Mail-Adresse deines Kontos'), email)),
  h('fieldset', { class: 'field plain-set' }, h('legend', { class: 'label' }, 'Art der Kündigung'), radio('ordinary'), radio('extraordinary')),
  reasonField,
  h('div', { class: 'field' }, h('label', { class: 'label', for: 'c-date' }, 'Gewünschter Zeitpunkt (optional, sonst nächstmöglicher)'), date),
  error && h('div', { class: 'msg err', role: 'alert' }, error),
  h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, 'Weiter zur Bestätigung')));
  form.addEventListener('change', (e) => { if (e.target.name === 'kind') reasonField.hidden = e.target.value !== 'extraordinary'; });
  root.replaceChildren(head('Verträge hier kündigen', 'Kündige deine Mitgliedschaft hier ohne Login. Im nächsten Schritt prüfst du deine Angaben und bestätigst mit „Jetzt kündigen“.'), form);
}

function step2(error) {
  const btn = h('button', { class: 'btn lg', type: 'button', onclick: async () => {
    btn.disabled = true;
    try { step3(await api('/api/cancel', { method: 'POST', body: data })); }
    catch (err) { step2(err.message); }
  } }, 'Jetzt kündigen');
  const row = (k, v) => h('div', { class: 'kv-line' }, h('span', { class: 'label' }, k), h('span', {}, v));
  root.replaceChildren(head('Bitte prüfe deine Kündigung'),
    h('div', { class: 'panel acc-card' },
      row('Vertrag', 'Mitgliedschaft Apex Wave Capital'), row('Name', data.name), row('E-Mail', data.email), row('Art', KIND[data.kind]),
      data.kind === 'extraordinary' && row('Grund', data.reason), row('Zeitpunkt', data.effective_date ? `zum ${data.effective_date}` : 'zum nächstmöglichen Zeitpunkt'),
      error && h('div', { class: 'msg err', role: 'alert' }, error),
      h('div', { class: 'row' }, btn, h('button', { class: 'btn ghost', type: 'button', onclick: () => step1() }, 'Zurück und ändern'))));
}

function step3(r) {
  const when = new Date(`${r.created_at.replace(' ', 'T')}Z`).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' });
  const status = r.result === 'scheduled'
    ? `Dein Abo wurde zum Ende des bezahlten Zeitraums gekündigt${r.ends ? ` (${new Date(r.ends).toLocaleDateString('de-DE')})` : ''}. Bis dahin behältst du vollen Zugang.`
    : 'Wir bearbeiten deine Kündigung und bestätigen sie dir per E-Mail.';
  const row = (k, v) => h('div', { class: 'kv-line' }, h('span', { class: 'label' }, k), h('span', {}, v));
  root.replaceChildren(head('Deine Kündigung ist eingegangen'),
    h('div', { class: 'panel acc-card' },
      h('div', { class: 'msg ok', role: 'status' }, status),
      row('Kündigungsnummer', String(r.id)), row('Eingegangen am', when), row('Name', r.name), row('E-Mail', r.email),
      row('Art', KIND[r.kind]), r.reason && row('Grund', r.reason), row('Zeitpunkt', r.effective),
      h('p', { class: 'muted' }, 'Bitte speichere diese Bestätigung, zum Beispiel als Screenshot. Zusätzlich erhältst du eine Bestätigung per E-Mail.'),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => window.print() }, 'Bestätigung drucken'))));
}

api('/api/account/me').then((m) => { if (m.user && !data.email) { data.email = m.user.email; step1(); } }).catch(() => {});
step1();
