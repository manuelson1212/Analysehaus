// Builds the static, backend-free demo as ONE page (gallery, detail and admin switch via the URL hash).
// Usage: node demo/build.mjs <outDir>
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'demo-dist';
mkdirSync(out, { recursive: true });
const css = readFileSync('public/css/style.css', 'utf8') + `
.demo-banner { background: var(--accent-dim); color: var(--accent); font: 12px var(--mono); padding: 8px 16px; text-align: center; }
.demo-banner b { color: var(--text); }`;

const bundle = async (contents) => (await build({
  stdin: { contents, resolveDir: join(process.cwd(), 'public'), sourcefile: 'entry.js' },
  bundle: true, format: 'iife', write: false, minify: true, target: 'es2022',
  external: ['./claude.js', '@anthropic-ai/sdk'],
})).outputFiles[0].text.replaceAll('</script', '<\\/script');

const pages = { gallery: ['public/index.html', 'public/js/gallery.js'], detail: ['public/analysis.html', 'public/js/detail.js'], admin: ['public/admin.html', 'public/js/admin.js'] };
const templates = {}, code = {};
for (const [name, [html, entry]] of Object.entries(pages)) {
  templates[name] = /<main[^>]*>([\s\S]*?)<\/main>/.exec(readFileSync(html, 'utf8'))[0];
  code[name] = await bundle(`import '../${entry}';`);
}
const api = await bundle(`import '../demo/demo-api.js';`);

const router = `
const T = ${JSON.stringify(templates).replaceAll('</', '<\\/')};
const PAGES = {${Object.entries(code).map(([k, v]) => `${k}: () => {${v}}`).join(',')}};
const view = document.getElementById('view');
function route() {
  const hash = location.hash.slice(1);
  const name = hash.startsWith('analysis') ? 'detail' : hash === 'admin' ? 'admin' : 'gallery';
  document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('on', a.dataset.route === (name === 'admin' ? 'admin' : 'gallery')));
  const logout = document.getElementById('logout');
  logout.replaceWith(logout.cloneNode(true)); // drop old click listeners
  document.getElementById('logout').classList.add('hidden');
  view.innerHTML = T[name];
  window.scrollTo(0, 0);
  PAGES[name]();
}
addEventListener('hashchange', route);
route();`;

const html = `<title>Analysehaus</title>
<style>${css}</style>
<header class="topbar"><div class="wrap">
  <a class="brand" href="#gallery">Analyse<b>haus</b></a>
  <nav class="nav"><a data-route="gallery" href="#gallery">Analyses</a><a data-route="admin" href="#admin">Admin</a><a href="#admin" id="logout" class="hidden">Logout</a></nav>
</div></header>
<div class="demo-banner">Online preview · your data stays in this browser · admin password: <b>demo</b></div>
<div id="view"></div>
<footer class="wrap disclaimer">Educational market analysis only. Not financial advice. Trading involves substantial risk of loss.</footer>
<script>${api}</script>
<script>${router}</script>
`;
writeFileSync(join(out, 'index.html'), html);
console.log('Demo written to', join(out, 'index.html'), `(${(html.length / 1024).toFixed(0)} KB)`);
