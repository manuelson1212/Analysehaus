// Builds the static, backend-free demo as ONE page. All site pages switch via the URL hash.
// Usage: node demo/build.mjs <outDir>
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'demo-dist';
mkdirSync(out, { recursive: true });
const css = readFileSync('public/css/style.css', 'utf8');

const bundle = async (contents) => (await build({
  stdin: { contents, resolveDir: join(process.cwd(), 'public'), sourcefile: 'entry.js' },
  bundle: true, format: 'iife', write: false, minify: true, target: 'es2022',
  external: ['./claude.js', '@anthropic-ai/sdk'],
})).outputFiles[0].text.replaceAll('</script', '<\\/script');

// route name -> [html file, page script or null]
const pages = {
  home: ['public/index.html', 'home'], approach: ['public/approach.html', null], analyses: ['public/analyses.html', 'gallery'], detail: ['public/analysis.html', 'detail'],
  about: ['public/about.html', null], pricing: ['public/pricing.html', 'pricing'], support: ['public/support.html', 'support'], admin: ['public/admin.html', 'admin'],
};
const templates = {}, code = {};
for (const [name, [html, script]] of Object.entries(pages)) {
  templates[name] = /<main[^>]*>[\s\S]*?<\/main>/.exec(readFileSync(html, 'utf8'))[0];
  code[name] = script ? await bundle(`import '../public/js/${script}.js';`) : '';
}
const api = await bundle(`import '../demo/demo-api.js';\nimport '../public/js/layout.js';`);

const router = `
const T = ${JSON.stringify(templates).replaceAll('</', '<\\/')};
const PAGES = {${Object.entries(code).map(([k, v]) => `${k}: () => {${v}}`).join(',')}};
const view = document.getElementById('view');
function route() {
  const hash = location.hash.slice(1);
  const name = hash.startsWith('analysis') ? 'detail' : (T[hash] ? hash : 'home');
  view.innerHTML = T[name];
  const L = window.__layout;
  L.setActive(name); L.bindLinks(view); window.scrollTo(0, 0);
  document.documentElement.classList.remove('nav-open');
  PAGES[name]();
  L.initReveal(view);
}
addEventListener('hashchange', route);
window.__layout.mountLayout('home');
route();`;

const html = `<title>Apex Wave Capital</title>
<style>${css}</style>
<header class="site-header" id="site-header"></header>
<div class="demo-banner">Online preview · your data stays in this browser · <a data-route="admin" href="#admin">Open admin</a> (password <b>demo</b>)</div>
<div id="view"></div>
<footer class="site-footer" id="site-footer"></footer>
<script>${api}</script>
<script>${router}</script>
`;
writeFileSync(join(out, 'index.html'), html);
console.log('Demo written to', join(out, 'index.html'), `(${(html.length / 1024).toFixed(0)} KB)`);
