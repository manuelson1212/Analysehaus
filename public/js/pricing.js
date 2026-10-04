import { api } from './dom.js';
import { bindSignup } from './signup.js';

bindSignup();
api('/api/config').then((c) => { document.getElementById('price').textContent = String(c.price); }).catch(() => {});
