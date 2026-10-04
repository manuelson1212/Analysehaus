// Tiny safe DOM builder: text is always set via textContent, never innerHTML.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

// URL helpers. In the static demo build images are data URLs and pages are separate .html files.
export const imgUrl = (image) => (String(image).startsWith('data:') ? image : `/uploads/${image}`);
export const detailUrl = (id) => (window.__DEMO__ ? `#analysis-${id}` : `/analysis?id=${id}`);

// Site routes. In the static demo, pages are hash routes inside one document.
const ROUTES = { home: '/', analyses: '/analyses', about: '/about', pricing: '/pricing', support: '/support', admin: '/admin' };
export const routeUrl = (name) => (window.__DEMO__ ? `#${name}` : ROUTES[name]);

// Points every <a data-route="..."> at the right URL for the current build.
export function bindLinks(root = document) {
  root.querySelectorAll('a[data-route]').forEach((a) => a.setAttribute('href', routeUrl(a.dataset.route)));
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, props = {}, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(props)) if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
