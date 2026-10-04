// Free-access signup forms (home and pricing). Posts the email to the inbox.
import { h, api } from './dom.js';

export function bindSignup(root = document) {
  root.querySelectorAll('.signup-form').forEach((form) => {
    const out = form.querySelector('.signup-msg'), btn = form.querySelector('button');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      try {
        await api('/api/signup', { method: 'POST', body: { email: form.elements.email.value } });
        form.reset();
        out.replaceChildren(h('div', { class: 'msg ok', role: 'status' }, 'You are on the list. We will email you before the free period ends.'));
      } catch (err) { out.replaceChildren(h('div', { class: 'msg err', role: 'alert' }, err.message)); }
      btn.disabled = false;
    });
  });
}
