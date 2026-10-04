import { h, api } from './dom.js';

const TITLES = { imprint: 'Impressum', privacy: 'Datenschutzerklärung', terms: 'Allgemeine Geschäftsbedingungen' };
const which = Object.keys(TITLES).find((k) => location.pathname.endsWith(`/${k}`) || location.hash === `#${k}`) || 'imprint';
const root = document.getElementById('legal');
document.title = `${TITLES[which]} · Apex Wave Capital`;

api('/api/legal').then((d) => {
  const text = (d[which] || '').trim();
  root.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, TITLES[which])),
    // Plain text only: paragraphs are split on blank lines and everything is escaped by the DOM builder.
    ...(text ? text.split(/\n{2,}/).map((p) => h('p', { class: 'legal-p' }, p)) : [h('p', { class: 'muted' }, 'Diese Seite wird gerade erstellt.')]));
}).catch(() => root.replaceChildren(h('p', { class: 'muted' }, 'Could not load this page.')));
