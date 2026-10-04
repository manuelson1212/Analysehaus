import { h, api } from './dom.js';

const form = document.getElementById('contact-form');
const out = document.getElementById('contact-msg');
const send = document.getElementById('contact-send');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  send.disabled = true;
  const data = Object.fromEntries(new FormData(form));
  try {
    await api('/api/contact', { method: 'POST', body: data });
    form.reset();
    out.replaceChildren(h('div', { class: 'msg ok', role: 'status' }, 'Danke! Deine Nachricht ist angekommen. Wir antworten dir per E-Mail.'));
  } catch (err) {
    out.replaceChildren(h('div', { class: 'msg err', role: 'alert' }, err.message));
  }
  send.disabled = false;
});



