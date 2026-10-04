import { h, api, imgUrl, detailUrl } from './dom.js';
import { STATUS } from './depot-ui.js';
import { fileToWebp, loadImage, renderCarouselSlide, renderTikTokCover, canvasToBlob } from './imaging.js';
import { makeZip } from './zip.js';

const app = document.getElementById('app');
let current = { tab: 'new', editId: null, studioId: null };

const today = () => new Date().toISOString().slice(0, 10);
const notice = (kind, text) => h('div', { class: `msg ${kind}`, role: 'status' }, text);

/* ---------- Login ---------- */
function showLogin(error) {
  const input = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
  const msg = h('div');
  const form = h('form', { class: 'login form', onsubmit: async (e) => {
    e.preventDefault();
    try { await api('/api/admin/login', { method: 'POST', body: { password: input.value } }); boot(); }
    catch (err) { msg.replaceChildren(notice('err', err.message)); }
  } },
  h('h1', {}, 'Admin login'),
  h('div', { class: 'field' }, h('label', { class: 'label', for: 'pw' }, 'Password'), input),
  msg, h('button', { class: 'btn', type: 'submit' }, 'Sign in'));
  if (error) msg.append(notice('err', error));
  app.replaceChildren(form);
  input.focus();
}

async function logout() {
  await api('/api/admin/logout', { method: 'POST', body: {} });
  showLogin();
}

/* ---------- Shell ---------- */
function shell(content) {
  const tab = (id, label) => h('button', { class: `tab ${current.tab === id ? 'on' : ''}`, onclick: () => { current = { tab: id, editId: null, positionId: null, studioId: id === 'studio' ? current.studioId : null }; render(); } }, label);
  app.replaceChildren(
    h('div', { class: 'tabs', role: 'tablist' }, tab('new', current.editId ? 'Edit analysis' : 'New analysis'), tab('list', 'Analyses'), tab('depot', 'Depot'), tab('studio', 'Content studio'), tab('agent', 'AI agent'), tab('inbox', 'Inbox'), tab('settings', 'Settings'),
      h('span', { class: 'tabs-spacer' }), h('button', { class: 'tab', onclick: logout }, 'Log out')),
    content);
}

function render() {
  if (current.tab === 'new') return renderForm();
  if (current.tab === 'list') return renderList();
  if (current.tab === 'inbox') return renderInbox();
  if (current.tab === 'depot') return renderDepot();
  if (current.tab === 'agent') return renderAgent();
  if (current.tab === 'settings') return renderSettings();
  return renderStudio();
}

/* ---------- Upload / edit form ---------- */
async function renderForm() {
  let a = null;
  if (current.editId) a = await api(`/api/analyses/${current.editId}`).catch(() => null);
  let imageData = null;
  const msg = h('div');
  const f = {};
  const input = (name, label, props = {}) => {
    f[name] = h('input', { type: 'text', id: name, value: a?.[name] ?? '', ...props });
    return h('div', { class: 'field' }, h('label', { class: 'label', for: name }, label), f[name]);
  };
  const area = (name, label, ph) => {
    f[name] = h('textarea', { id: name, placeholder: ph }, a?.[name] ?? '');
    return h('div', { class: 'field' }, h('label', { class: 'label', for: name }, label), f[name]);
  };

  const preview = h('img', { class: `preview ${a ? '' : 'hidden'}`, alt: 'Chart preview', src: a ? imgUrl(a.image) : '' });
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden', id: 'file' });
  const drop = h('label', { class: 'drop', for: 'file' }, 'Drop TradingView screenshot here or click to choose');
  const setFile = async (fl) => {
    if (!fl || !fl.type.startsWith('image/')) return;
    try {
      imageData = await fileToWebp(fl);
      preview.src = imageData; preview.classList.remove('hidden');
      drop.textContent = `${fl.name} ready (optimised)`;
    } catch { msg.replaceChildren(notice('err', 'Could not read that image.')); }
  };
  file.addEventListener('change', () => setFile(file.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); setFile(e.dataTransfer.files[0]); });
  document.onpaste = (e) => { const it = [...(e.clipboardData?.files || [])][0]; if (it && current.tab === 'new') setFile(it); };

  const market = h('select', { id: 'market' }, ['Crypto', 'Stocks'].map((m) => h('option', { value: m, selected: a?.market === m }, m)));
  const status = h('select', { id: 'status' }, [['draft', 'Draft'], ['published', 'Published']].map(([v, l]) => h('option', { value: v, selected: (a?.status ?? 'published') === v }, l)));
  const date = h('input', { type: 'date', id: 'date', value: a?.analysis_date ?? today(), required: true });
  const submit = h('button', { class: 'btn', type: 'submit' }, a ? 'Save changes' : 'Create analysis');

  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    if (!a && !imageData) return msg.replaceChildren(notice('err', 'Please add a chart screenshot.'));
    submit.disabled = true;
    const body = {
      asset: f.asset.value, market: market.value, timeframe: f.timeframe.value, analysis_date: date.value,
      wave_count: f.wave_count.value, scenario_primary: f.scenario_primary.value, scenario_alt: f.scenario_alt.value,
      invalidation: f.invalidation.value, targets: f.targets.value, fib_levels: f.fib_levels.value, body: f.body.value,
      tags: f.tags.value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
      status: status.value, image: imageData || undefined,
    };
    try {
      const saved = a ? await api(`/api/admin/analyses/${a.id}`, { method: 'PUT', body })
        : await api('/api/admin/analyses', { method: 'POST', body });
      current = { tab: 'list', editId: null, studioId: saved.id };
      await renderList(`Saved ${saved.asset} ${saved.timeframe} (${saved.status}).`, saved);
    } catch (err) { msg.replaceChildren(notice('err', err.message)); submit.disabled = false; }
  } },
  h('div', { class: 'two three' }, input('asset', 'Asset', { placeholder: 'BTC/USD', required: true, maxlength: 40 }),
    h('div', { class: 'field' }, h('label', { class: 'label', for: 'market' }, 'Market'), market),
    input('timeframe', 'Timeframe', { placeholder: '4H', required: true, maxlength: 10 })),
  h('div', { class: 'two' }, h('div', { class: 'field' }, h('label', { class: 'label', for: 'date' }, 'Analysis date'), date),
    h('div', { class: 'field' }, h('label', { class: 'label', for: 'status' }, 'Status'), status)),
  h('div', { class: 'field' }, h('span', { class: 'label' }, 'Chart screenshot (paste, drop or choose)'), drop, file, preview),
  input('wave_count', 'Wave count', { placeholder: 'Wave (3) of 3 within a larger impulse' }),
  area('scenario_primary', 'Primary scenario', 'What you expect to happen next'),
  area('scenario_alt', 'Alternate scenario', 'What happens if the primary count fails'),
  input('invalidation', 'Invalidation level', { placeholder: 'Close below 61,200' }),
  h('div', { class: 'two' }, area('targets', 'Target zones', '68,400 – 70,100'), area('fib_levels', 'Fibonacci levels', '0.618 at 64,250; 1.618 ext at 70,100')),
  area('body', 'Written analysis', 'Full commentary'),
  input('tags', 'Tags (comma separated)', { placeholder: 'impulse, btc, wave3', value: a?.tags.join(', ') ?? '' }),
  msg, h('div', { class: 'row' }, submit,
    a && h('button', { class: 'btn ghost', type: 'button', onclick: () => { current = { tab: 'list', editId: null }; render(); } }, 'Cancel')));
  shell(form);
}

/* ---------- List ---------- */
async function renderList(flash, saved) {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const items = await api('/api/admin/analyses');
  const rows = items.map((a) => h('tr', {},
    h('td', {}, h('b', { class: 'mono' }, a.asset), ' ', h('span', { class: 'muted' }, a.timeframe)),
    h('td', {}, a.analysis_date),
    h('td', {}, h('span', { class: `badge ${a.status === 'published' ? 'pub' : ''}` }, a.status)),
    h('td', {}, h('div', { class: 'actions' },
      h('button', { class: 'btn sm', onclick: () => { current = { tab: 'studio', studioId: a.id }; render(); } }, 'Studio'),
      h('button', { class: 'btn sm ghost', onclick: () => { current = { tab: 'new', editId: a.id }; render(); } }, 'Edit'),
      h('a', { class: 'btn sm ghost', href: detailUrl(a.id) }, 'View'),
      h('button', { class: 'btn sm danger', onclick: async () => {
        if (!confirm(`Delete ${a.asset} ${a.timeframe}? This cannot be undone.`)) return;
        await api(`/api/admin/analyses/${a.id}`, { method: 'DELETE' }); renderList('Deleted.');
      } }, 'Delete')))));
  shell(h('div', {}, flash && h('div', { class: 'msg ok', role: 'status' }, flash, ' ', saved?.status === 'published' ? h('a', { href: detailUrl(saved.id) }, 'View on the website →') : '(draft: set it to Published to show it on the website)'),
    items.length ? h('div', { class: 'scroll-x' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Analysis', 'Date', 'Status', ''].map((t) => h('th', {}, t)))), h('tbody', {}, rows)))
      : h('div', { class: 'empty' }, 'No analyses yet. Create your first one.')));
}

/* ---------- Depot ---------- */
// Accepts 61800, 61,800.50 and 61800,5 (decimal comma).
function toNum(v) {
  let t = String(v).trim().replace(/\s/g, '');
  if (!t) return '';
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = t.replace(',', '.');
  return t;
}

async function renderDepot(flash) {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const [{ positions, stats }, analyses] = await Promise.all([api('/api/admin/positions'), api('/api/admin/analyses')]);
  const editing = current.positionId ? positions.find((p) => p.id === current.positionId) : null;
  const e = editing || {};
  let evidence = null;
  const msg = h('div');
  const f = {};
  const num = (name, label, ph) => { f[name] = h('input', { type: 'text', id: `d-${name}`, inputmode: 'decimal', placeholder: ph, value: e[name] ?? '' }); return h('div', { class: 'field' }, h('label', { class: 'label', for: `d-${name}` }, label), f[name]); };
  const sel = (name, label, opts) => { f[name] = h('select', { id: `d-${name}` }, opts.map(([v, l]) => h('option', { value: v, selected: (e[name] ?? opts[0][0]) === v }, l))); return h('div', { class: 'field' }, h('label', { class: 'label', for: `d-${name}` }, label), f[name]); };
  f.asset = h('input', { type: 'text', id: 'd-asset', maxlength: 40, placeholder: 'BTC/USD', value: e.asset ?? '', required: true });
  f.opened_at = h('input', { type: 'date', id: 'd-opened', value: e.opened_at ?? '' });
  f.closed_at = h('input', { type: 'date', id: 'd-closed', value: e.closed_at ?? '' });
  f.note = h('textarea', { id: 'd-note', placeholder: 'Why this zone? What happened?' }, e.note ?? '');
  f.evidence_url = h('input', { type: 'text', id: 'd-evurl', placeholder: 'https://… (TradingView idea, tweet, exchange record)', value: e.evidence_url ?? '' });
  f.analysis_id = h('select', { id: 'd-analysis' }, h('option', { value: '' }, 'None'), analyses.map((a) => h('option', { value: a.id, selected: e.analysis_id === a.id }, `${a.asset} · ${a.timeframe} · ${a.analysis_date}`)));
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', id: 'd-file' });
  file.addEventListener('change', async () => { if (file.files[0]) evidence = await fileToWebp(file.files[0]); });
  const submit = h('button', { class: 'btn', type: 'submit' }, editing ? 'Save position' : 'Add position');

  const form = h('form', { class: 'panel form', onsubmit: async (ev) => {
    ev.preventDefault(); submit.disabled = true;
    const body = {
      asset: f.asset.value, market: f.market.value, direction: f.direction.value, status: f.status.value,
      buy_low: toNum(f.buy_low.value), buy_high: toNum(f.buy_high.value), stop: toNum(f.stop.value), target: toNum(f.target.value),
      entry_price: toNum(f.entry_price.value), exit_price: toNum(f.exit_price.value), result_pct: toNum(f.result_pct.value),
      opened_at: f.opened_at.value, closed_at: f.closed_at.value, note: f.note.value, evidence_url: f.evidence_url.value,
      analysis_id: f.analysis_id.value, evidence: evidence || undefined,
    };
    try {
      if (editing) await api(`/api/admin/positions/${editing.id}`, { method: 'PUT', body });
      else await api('/api/admin/positions', { method: 'POST', body });
      current.positionId = null; await renderDepot(`Saved ${body.asset}. It is visible on the public depot page.`);
    } catch (err) { msg.replaceChildren(notice('err', err.message)); submit.disabled = false; }
  } },
  h('h2', {}, editing ? `Edit ${editing.asset}` : 'Add a position'),
  h('div', { class: 'two three' }, h('div', { class: 'field' }, h('label', { class: 'label', for: 'd-asset' }, 'Asset'), f.asset),
    sel('market', 'Market', [['Crypto', 'Crypto'], ['Stocks', 'Stocks']]), sel('direction', 'Direction', [['long', 'Long'], ['short', 'Short']])),
  h('div', { class: 'two' }, num('buy_low', 'Buy zone from', '61000'), num('buy_high', 'Buy zone to', '62400')),
  h('div', { class: 'two' }, num('stop', 'Stop (invalidation)', '59800'), num('target', 'Target', '68400')),
  h('div', { class: 'two three' }, sel('status', 'Status', [['watching', 'Watching (not entered)'], ['open', 'Open'], ['hit', 'Target hit'], ['stopped', 'Stopped out']]),
    h('div', { class: 'field' }, h('label', { class: 'label', for: 'd-opened' }, 'Opened'), f.opened_at), h('div', { class: 'field' }, h('label', { class: 'label', for: 'd-closed' }, 'Closed'), f.closed_at)),
  h('div', { class: 'two three' }, num('entry_price', 'Entry price', '61800'), num('exit_price', 'Exit price', '68400'), num('result_pct', 'Result % (optional)', 'auto')),
  h('p', { class: 'fine' }, 'Result % is calculated from entry and exit price if you leave it empty.'),
  h('div', { class: 'field' }, h('label', { class: 'label', for: 'd-analysis' }, 'Linked analysis (optional)'), f.analysis_id),
  h('div', { class: 'field' }, h('label', { class: 'label', for: 'd-note' }, 'Note'), f.note),
  h('div', { class: 'two' },
    h('div', { class: 'field' }, h('label', { class: 'label', for: 'd-file' }, 'Proof screenshot'), file, editing?.evidence && h('p', { class: 'fine' }, 'A screenshot is attached. Choose a file to replace it.')),
    h('div', { class: 'field' }, h('label', { class: 'label', for: 'd-evurl' }, 'Proof link'), f.evidence_url)),
  msg, h('div', { class: 'row' }, submit, editing && h('button', { class: 'btn ghost', type: 'button', onclick: () => { current.positionId = null; renderDepot(); } }, 'Cancel')));

  const quick = async (p, status) => {
    const { evidence: _drop, ...rest } = p;
    await api(`/api/admin/positions/${p.id}`, { method: 'PUT', body: { ...rest, status, closed_at: status === 'hit' || status === 'stopped' ? (p.closed_at || today()) : p.closed_at, opened_at: p.opened_at || (status === 'watching' ? null : today()) } });
    renderDepot();
  };
  const rows = positions.map((p) => h('tr', {},
    h('td', {}, h('b', { class: 'mono' }, p.asset), ' ', h('span', { class: `dir ${p.direction}` }, p.direction)),
    h('td', {}, h('span', { class: `st ${p.status}` }, STATUS[p.status])),
    h('td', { class: 'muted' }, p.evidence || p.evidence_url ? 'proof ✓' : 'no proof'),
    h('td', {}, h('div', { class: 'actions' },
      p.status !== 'open' && h('button', { class: 'btn sm ghost', onclick: () => quick(p, 'open') }, 'Open'),
      h('button', { class: 'btn sm ghost', onclick: () => quick(p, 'hit') }, 'Hit'),
      h('button', { class: 'btn sm ghost', onclick: () => quick(p, 'stopped') }, 'Stopped'),
      h('button', { class: 'btn sm ghost', onclick: () => { current.positionId = p.id; renderDepot(); scrollTo(0, 0); } }, 'Edit'),
      h('button', { class: 'btn sm danger', onclick: async () => { if (!confirm(`Delete ${p.asset}?`)) return; await api(`/api/admin/positions/${p.id}`, { method: 'DELETE' }); renderDepot('Deleted.'); } }, 'Delete')))));

  shell(h('div', { class: 'studio' },
    flash && notice('ok', flash),
    h('div', { class: 'tiles' },
      h('div', { class: 'tile' }, h('span', { class: 'label' }, 'Hit rate'), h('b', {}, stats.closed ? `${stats.hit_rate}%` : '–'), h('span', { class: 'muted' }, stats.closed ? `${stats.hits} of ${stats.closed} closed calls` : 'no closed calls yet')),
      h('div', { class: 'tile' }, h('span', { class: 'label' }, 'Open / watching'), h('b', {}, `${stats.open} / ${stats.watching}`), h('span', { class: 'muted' }, 'positions'))),
    h('p', { class: 'muted' }, 'The public hit rate is calculated from these records only. Mark a position Hit or Stopped when it closes and attach proof.'),
    form,
    positions.length ? h('div', { class: 'scroll-x' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Position', 'Status', 'Proof', ''].map((t) => h('th', {}, t)))), h('tbody', {}, rows))) : h('div', { class: 'empty' }, 'No positions yet.')));
}

/* ---------- AI agent ---------- */
async function renderAgent() {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const st = await api('/api/admin/agent-status');
  const out = h('div');
  const test = h('button', { class: 'btn', onclick: async () => {
    test.disabled = true; test.textContent = 'Testing…';
    try { const r = await api('/api/admin/agent-test', { method: 'POST', body: {} }); out.replaceChildren(notice('ok', r.message)); }
    catch (err) { out.replaceChildren(notice('err', err.message)); }
    test.disabled = false; test.textContent = 'Test connection';
  } }, 'Test connection');
  const yes = (v) => h('span', { class: `badge ${v ? 'pub' : ''}` }, v ? 'yes' : 'no');
  shell(h('div', { class: 'studio' },
    h('section', { class: 'block' }, h('h2', {}, 'Agent status'),
      h('div', { class: 'kv-row' }, h('span', {}, 'Provider ', h('span', { class: 'badge pub' }, st.provider)), st.model && h('span', {}, 'Model ', h('span', { class: 'badge' }, st.model)),
        h('span', {}, 'API key set ', yes(st.key_configured)), h('span', {}, 'Refusal fallback ', yes(st.fallback))),
      st.provider === 'mock' && h('p', { class: 'muted' }, window.__DEMO__ ? 'This online preview always runs the mock agent (templates, no AI). Connect the real agent on your own server as shown below.' : 'The mock agent builds content from templates and does not read your charts. Follow the steps below to switch to the real agent.'),
      h('div', { class: 'row' }, test), out),
    h('section', { class: 'block' }, h('h2', {}, 'Connect the real agent'),
      h('ol', { class: 'steps-list' },
        h('li', {}, h('div', {}, h('b', {}, 'Create an API key'), h('p', { class: 'muted' }, 'Sign in at console.anthropic.com, open API keys, create a key and set a monthly spending limit. Keep the key secret and never paste it into the website or into a chat.'))),
        h('li', {}, h('div', {}, h('b', {}, 'Give it to your server'), h('p', { class: 'muted' }, 'On your computer:'), h('code', { class: 'code' }, 'ANTHROPIC_API_KEY=your-key AGENT_PROVIDER=claude ADMIN_PASSWORD=your-password npm start'),
          h('p', { class: 'muted' }, 'On a host such as Render or Railway, add these as secret environment variables and restart.'))),
        h('li', {}, h('div', {}, h('b', {}, 'Test the connection'), h('p', { class: 'muted' }, 'Press “Test connection” above. A green message means the agent is ready.'))),
        h('li', {}, h('div', {}, h('b', {}, 'Create your first ad'), h('p', { class: 'muted' }, 'Open the Content studio, choose “★ Website promo” and generate. The agent writes a TikTok script and an Instagram carousel that promote the free 30 days and the live depot. Edit, approve and export the ZIP.'),
          h('button', { class: 'btn ghost', onclick: () => { current = { tab: 'studio', editId: null, studioId: 'promo' }; render(); } }, 'Open website promo'))),
        h('li', {}, h('div', {}, h('b', {}, 'Record and post'), h('p', { class: 'muted' }, 'Follow the scene list: screen-record the website, add your voice-over and the on-screen text, then upload the video to TikTok and Instagram with the exported caption and hashtags. Put the website address in your bio. Posting directly from here is not built: it needs approval from each platform.'))))),
    h('section', { class: 'block' }, h('h2', {}, 'Good to know'),
      h('ul', { class: 'plain' }, h('li', {}, 'Only the numbers from your depot and settings go into ads. If you mention a hit rate, the ad states how many closed calls it is based on and that the depot is simulated.'),
        h('li', {}, 'Every caption and the last slide carry the disclaimer automatically.'),
        h('li', {}, 'Each generation is one API call. Costs depend on your Anthropic plan and the model.')))));
}

/* ---------- Settings ---------- */
async function renderSettings(flash) {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const c = await api('/api/config');
  const until = h('input', { type: 'date', id: 's-until', value: c.free_until });
  const price = h('input', { type: 'text', id: 's-price', inputmode: 'decimal', value: c.price });
  const msg = h('div', {}, flash && notice('ok', flash));
  shell(h('form', { class: 'panel form', onsubmit: async (e) => {
    e.preventDefault();
    try { await api('/api/admin/config', { method: 'PUT', body: { free_until: until.value, price: toNum(price.value) } }); renderSettings('Saved. The website now shows the new dates and price.'); }
    catch (err) { msg.replaceChildren(notice('err', err.message)); }
  } }, h('h2', {}, 'Free access and price'),
  h('p', { class: 'muted' }, `Free access currently ends on ${c.free_until} (${c.days_left} days left). The countdown on the website follows this date.`),
  h('div', { class: 'two' }, h('div', { class: 'field' }, h('label', { class: 'label', for: 's-until' }, 'Free access ends on'), until),
    h('div', { class: 'field' }, h('label', { class: 'label', for: 's-price' }, 'Price per month after the free period (€)'), price)),
  h('p', { class: 'fine' }, 'This controls the texts and the countdown. It does not block content or take payments yet.'),
  msg, h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, 'Save'))));
}

/* ---------- Inbox ---------- */
async function renderInbox() {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const items = await api('/api/admin/messages');
  shell(items.length ? h('div', { class: 'inbox' }, items.map((m) => h('article', { class: 'block' },
    h('div', { class: 'row' }, h('b', {}, m.name), h('span', { class: 'muted' }, m.email), h('span', { class: 'badge' }, m.topic), h('span', { class: 'label' }, m.created_at)),
    h('p', { class: 'msg-body' }, m.message),
    h('div', { class: 'row' }, h('a', { class: 'btn sm ghost', href: `mailto:${m.email}?subject=${encodeURIComponent('Re: ' + m.topic)}` }, 'Reply by email'),
      h('button', { class: 'btn sm danger', onclick: async () => { await api(`/api/admin/messages/${m.id}`, { method: 'DELETE' }); renderInbox(); } }, 'Delete')))))
    : h('div', { class: 'empty' }, 'No messages yet. Messages from the support form appear here.'));
}

/* ---------- Content studio ---------- */
const PROMO = { id: 'promo', asset: 'Apex Wave Capital', market: 'Free access', timeframe: 'Research', analysis_date: 'Live depot' };

async function renderStudio() {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const items = await api('/api/admin/analyses');
  const sel = h('select', { id: 'pick', 'aria-label': 'Content source' },
    h('option', { value: 'promo', selected: current.studioId === 'promo' }, '★ Website promo (ad for the whole site)'),
    items.map((a) => h('option', { value: a.id, selected: a.id === current.studioId }, `${a.asset} · ${a.timeframe} · ${a.analysis_date}`)));
  const stage = h('div', { class: 'studio' });
  const load = async () => {
    const isPromo = sel.value === 'promo';
    current.studioId = isPromo ? 'promo' : Number(sel.value);
    const analysis = isPromo ? PROMO : items.find((a) => a.id === current.studioId);
    const packUrl = isPromo ? '/api/admin/promo' : `/api/admin/analyses/${analysis.id}/pack`;
    const pack = await api(packUrl);
    stage.replaceChildren(await studioView(analysis, pack, load, packUrl));
  };
  sel.addEventListener('change', load);
  shell(h('div', {}, h('div', { class: 'field' }, h('label', { class: 'label', for: 'pick' }, 'Create content for'), sel), h('br'), stage));
  load();
}

async function studioView(analysis, pack, reload, packUrl) {
  const msg = h('div');
  const generate = h('button', { class: 'btn', onclick: async () => {
    generate.disabled = true; generate.textContent = 'Generating…';
    try { await api(packUrl, { method: 'POST', body: {} }); await reload(); }
    catch (e) { msg.replaceChildren(notice('err', e.message)); generate.disabled = false; generate.textContent = 'Generate content'; }
  } }, pack ? 'Regenerate (overwrites draft)' : 'Generate content');

  if (!pack) return h('div', { class: 'block' }, h('p', { class: 'muted' }, 'No content yet. The marketing agent drafts a TikTok script and an Instagram carousel from this analysis.'), msg, generate);

  const c = pack.content;
  const ta = (value, rows = 2) => h('textarea', { rows, value });
  const hook = ta(c.tiktok.hook);
  const cta = ta(c.tiktok.cta);
  const ttCaption = ta(c.tiktok.caption, 4);
  const ttTags = h('input', { type: 'text', value: c.tiktok.hashtags.join(' ') });
  const scenes = c.tiktok.scenes.map((s) => ({ visual: ta(s.visual), voiceover: ta(s.voiceover), onscreen: h('input', { type: 'text', value: s.onscreen }) }));
  const slides = c.instagram.slides.filter((s) => !s.disclaimer).map((s) => ({ title: h('input', { type: 'text', value: s.title }), text: ta(s.text, 3) }));
  const igCaption = ta(c.instagram.caption, 4);
  const igTags = h('input', { type: 'text', value: c.instagram.hashtags.join(' ') });
  const previews = h('div', { class: 'slides' });

  const collect = () => ({
    tiktok: {
      hook: hook.value, cta: cta.value, caption: ttCaption.value,
      hashtags: ttTags.value.split(/\s+/).map((t) => t.replace(/^#/, '')).filter(Boolean),
      scenes: scenes.map((s) => ({ visual: s.visual.value, voiceover: s.voiceover.value, onscreen: s.onscreen.value })),
    },
    instagram: {
      caption: igCaption.value,
      hashtags: igTags.value.split(/\s+/).map((t) => t.replace(/^#/, '')).filter(Boolean),
      slides: slides.map((s) => ({ title: s.title.value, text: s.text.value })),
    },
  });

  const save = async (status) => {
    try {
      const saved = await api(packUrl, { method: 'PUT', body: { content: collect(), status } });
      msg.replaceChildren(notice('ok', status === 'approved' ? 'Approved. You can export now.' : 'Draft saved.'));
      return saved;
    } catch (e) { msg.replaceChildren(notice('err', e.message)); }
  };

  let chartImg = null; // stays null for the website promo (no screenshot)
  const renderAll = async (saved) => {
    if (chartImg === null && analysis.image) chartImg = await loadImage(imgUrl(analysis.image));
    const sl = saved.content.instagram.slides;
    const canvases = [renderTikTokCover(saved.content.tiktok.hook, analysis, chartImg),
      ...sl.map((s, i) => renderCarouselSlide(s, i, sl.length, analysis, chartImg))];
    return { canvases, saved };
  };

  const preview = h('button', { class: 'btn ghost', onclick: async () => {
    const saved = await save('draft'); if (!saved) return;
    const { canvases } = await renderAll(saved);
    previews.replaceChildren(...canvases);
  } }, 'Save & preview visuals');

  const exportBtn = h('button', { class: 'btn', disabled: pack.status !== 'approved', onclick: async () => {
    const saved = await save('approved'); if (!saved) return;
    if (window.__DEMO__) { msg.replaceChildren(notice('ok', 'Approved. ZIP download is turned off in this online preview. Use "Save & preview visuals" to see every slide. The full app exports the ZIP.')); return; }
    exportBtn.disabled = true;
    try {
      const { canvases } = await renderAll(saved);
      const enc = new TextEncoder();
      const t = saved.content.tiktok;
      const ig = saved.content.instagram;
      const files = [
        { name: 'tiktok/script.txt', data: enc.encode([`HOOK: ${t.hook}`, '', ...t.scenes.map((s, i) => `SCENE ${i + 1}\nVisual: ${s.visual}\nVoiceover: ${s.voiceover}\nOn-screen: ${s.onscreen}\n`), `CTA: ${t.cta}`].join('\n')) },
        { name: 'tiktok/caption.txt', data: enc.encode(`${t.caption}\n\n${t.hashtags.map((x) => `#${x}`).join(' ')}`) },
        { name: 'instagram/caption.txt', data: enc.encode(`${ig.caption}\n\n${ig.hashtags.map((x) => `#${x}`).join(' ')}`) },
      ];
      for (let i = 0; i < canvases.length; i++) {
        const buf = new Uint8Array(await (await canvasToBlob(canvases[i])).arrayBuffer());
        files.push({ name: i === 0 ? 'tiktok/cover.png' : `instagram/slide_${String(i).padStart(2, '0')}.png`, data: buf });
      }
      const url = URL.createObjectURL(makeZip(files));
      const a = h('a', { href: url, download: `${analysis.asset.replace(/\W+/g, '_')}_${analysis.timeframe}_${analysis.analysis_date}.zip` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { msg.replaceChildren(notice('err', `Export failed: ${e.message}`)); }
    exportBtn.disabled = false;
  } }, 'Export ZIP');

  return h('div', { class: 'studio' },
    h('div', { class: 'row' }, generate, h('span', { class: `badge ${pack.status === 'approved' ? 'pub' : ''}` }, `${pack.status} · ${c.provider}`)),
    c.chart_notes && h('section', { class: 'block' }, h('h2', {}, 'Chart reading (internal, not published)'), h('p', { class: 'muted' }, c.chart_notes)),
    h('section', { class: 'block' }, h('h2', {}, 'TikTok script'),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Hook'), hook),
      scenes.map((s, i) => h('div', { class: 'scene' }, h('span', { class: 'label' }, `Scene ${i + 1}`), s.visual, s.voiceover, s.onscreen)),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Call to action'), cta),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Caption (disclaimer is added automatically)'), ttCaption),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Hashtags'), ttTags)),
    h('section', { class: 'block' }, h('h2', {}, 'Instagram carousel'),
      slides.map((s, i) => h('div', { class: 'scene' }, h('span', { class: 'label' }, `Slide ${i + 1}`), s.title, s.text)),
      h('p', { class: 'muted' }, 'A disclaimer slide is always appended.'),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Caption (disclaimer is added automatically)'), igCaption),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Hashtags'), igTags)),
    h('section', { class: 'block' }, h('h2', {}, 'Visuals'), previews),
    msg,
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => save('draft') }, 'Save draft'), preview,
      h('button', { class: 'btn', onclick: async () => { const s = await save('approved'); if (s) exportBtn.disabled = false; } }, 'Approve'), exportBtn));
}

/* ---------- Boot ---------- */
async function boot() {
  const me = await api('/api/admin/me').catch(() => ({ admin: false }));
  if (!me.admin) return showLogin();
  render().catch((e) => (e.status === 401 ? showLogin('Session expired.') : app.replaceChildren(notice('err', e.message))));
}
boot();
