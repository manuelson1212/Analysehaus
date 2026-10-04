import { api } from './dom.js';

api('/api/config').then((c) => { document.getElementById('price').textContent = String(c.price); }).catch(() => {});
