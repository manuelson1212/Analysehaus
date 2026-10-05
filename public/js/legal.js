import { h, api } from './dom.js';
import { lang } from './i18n.js';

const TITLES = { imprint: 'Impressum', privacy: 'Datenschutzerklärung', terms: 'Allgemeine Geschäftsbedingungen' };
const which = Object.keys(TITLES).find((k) => location.pathname.endsWith(`/${k}`) || location.hash === `#${k}`) || 'imprint';
const root = document.getElementById('legal');
document.title = `${TITLES[which]} · Apex Wave Capital`;

api('/api/legal').then((d) => {
  const text = (d[which] || '').trim();
  root.replaceChildren(...[h('div', { class: 'page-head' }, h('h1', {}, TITLES[which])),
    lang() === 'en' && text && h('p', { class: 'notice small' }, 'Die rechtlichen Texte sind nur auf Deutsch verbindlich.'),
    // Plain text only: paragraphs are split on blank lines and everything is escaped by the DOM builder.
    ...(text ? text.split(/\n{2,}/).map((p) => h('p', { class: 'legal-p' }, p)) : [h('p', { class: 'muted' }, 'Diese Seite wird gerade erstellt.')])].filter(Boolean));
}).catch(() => root.replaceChildren(h('p', { class: 'muted' }, 'Die Seite konnte nicht geladen werden.')));
