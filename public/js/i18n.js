// German is the source language of the site. For English, every German UI text that appears in the page
// (static HTML, text built by scripts, server messages) is swapped for its translation as it is inserted.
// User content (analysis texts, legal texts) is left as written.
import { EN, RULES } from './i18n-en.js';

const KEY = 'awc-lang';
export const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'de');
export const loc = () => (lang() === 'en' ? 'en-US' : 'de-DE');

// An analysis in the visitor's language: English fields where they exist, otherwise the German original.
export function localized(a) {
  if (lang() !== 'en' || !a?.en) return a;
  const en = Object.fromEntries(Object.entries(a.en).filter(([, v]) => v));
  return { ...a, ...en };
}

export function setLang(next) {
  try { localStorage.setItem(KEY, next); } catch { /* private mode: choice lasts for this page only */ }
  location.reload();
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);
const KEEP = '.legal-p, .body-text, .kv p, .card .summary, .msg-body, [data-no-i18n]';
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

export function translate(text) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  const key = m[2].replace(/\s+/g, ' ');
  if (!key) return text;
  let out = EN[key];
  if (out == null) for (const [re, rep] of RULES) { if (re.test(key)) { out = key.replace(re, rep); break; } }
  return out == null ? text : m[1] + out + m[3];
}

function fixNode(node) {
  if (node.nodeType === 3) {
    const p = node.parentElement;
    if (!p || SKIP.has(p.tagName) || p.closest(KEEP)) return;
    const t = translate(node.nodeValue);
    if (t !== node.nodeValue) node.nodeValue = t;
    return;
  }
  if (node.nodeType !== 1 || SKIP.has(node.tagName)) return;
  for (const a of ATTRS) {
    const v = node.getAttribute(a);
    if (v) { const t = translate(v); if (t !== v) node.setAttribute(a, t); }
  }
  if (node.closest(KEEP)) return;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 1) {
      if (SKIP.has(n.tagName) || n.matches(KEEP)) continue;
      for (const a of ATTRS) { const v = n.getAttribute(a); if (v) { const t = translate(v); if (t !== v) n.setAttribute(a, t); } }
    } else fixNode(n);
  }
}

export function startTranslation() {
  if (lang() !== 'en') return;
  document.title = translate(document.title);
  const desc = document.querySelector('meta[name=description]');
  if (desc) desc.content = translate(desc.content);
  fixNode(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') fixNode(m.target);
      else if (m.type === 'attributes') fixNode(m.target);
      else m.addedNodes.forEach(fixNode);
    }
    const t = translate(document.title); if (t !== document.title) document.title = t;
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.documentElement.classList.remove('lang-pending');
}
