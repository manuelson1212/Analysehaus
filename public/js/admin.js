import { h, api } from './dom.js';
import { fileToWebp, loadImage, renderCarouselSlide, renderTikTokCover, canvasToBlob } from './imaging.js';
import { makeZip } from './zip.js';

const app = document.getElementById('app');
const logoutLink = document.getElementById('logout');
let current = { tab: 'new', editId: null, studioId: null };

const today = () => new Date().toISOString().slice(0, 10);
const notice = (kind, text) => h('div', { class: `msg ${kind}`, role: 'status' }, text);

/* ---------- Login ---------- */
function showLogin(error) {
  logoutLink.classList.add('hidden');
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

logoutLink.addEventListener('click', async (e) => {
  e.preventDefault();
  await api('/api/admin/logout', { method: 'POST', body: {} });
  showLogin();
});

/* ---------- Shell ---------- */
function shell(content) {
  const tab = (id, label) => h('button', { class: `tab ${current.tab === id ? 'on' : ''}`, onclick: () => { current = { tab: id, editId: null, studioId: id === 'studio' ? current.studioId : null }; render(); } }, label);
  app.replaceChildren(
    h('div', { class: 'tabs', role: 'tablist' }, tab('new', current.editId ? 'Edit analysis' : 'New analysis'), tab('list', 'Analyses'), tab('studio', 'Content studio')),
    content);
}

function render() {
  if (current.tab === 'new') return renderForm();
  if (current.tab === 'list') return renderList();
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

  const preview = h('img', { class: `preview ${a ? '' : 'hidden'}`, alt: 'Chart preview', src: a ? `/uploads/${a.image}` : '' });
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
  const status = h('select', { id: 'status' }, [['draft', 'Draft'], ['published', 'Published']].map(([v, l]) => h('option', { value: v, selected: a?.status === v }, l)));
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
      await renderList(`Saved ${saved.asset} ${saved.timeframe}.`);
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
async function renderList(flash) {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const items = await api('/api/admin/analyses');
  const rows = items.map((a) => h('tr', {},
    h('td', {}, h('b', { class: 'mono' }, a.asset), ' ', h('span', { class: 'muted' }, a.timeframe)),
    h('td', {}, a.analysis_date),
    h('td', {}, h('span', { class: `badge ${a.status === 'published' ? 'pub' : ''}` }, a.status)),
    h('td', {}, h('div', { class: 'actions' },
      h('button', { class: 'btn sm', onclick: () => { current = { tab: 'studio', studioId: a.id }; render(); } }, 'Studio'),
      h('button', { class: 'btn sm ghost', onclick: () => { current = { tab: 'new', editId: a.id }; render(); } }, 'Edit'),
      h('a', { class: 'btn sm ghost', href: `/analysis?id=${a.id}` }, 'View'),
      h('button', { class: 'btn sm danger', onclick: async () => {
        if (!confirm(`Delete ${a.asset} ${a.timeframe}? This cannot be undone.`)) return;
        await api(`/api/admin/analyses/${a.id}`, { method: 'DELETE' }); renderList('Deleted.');
      } }, 'Delete')))));
  shell(h('div', {}, flash && notice('ok', flash),
    items.length ? h('div', { class: 'scroll-x' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Analysis', 'Date', 'Status', ''].map((t) => h('th', {}, t)))), h('tbody', {}, rows)))
      : h('div', { class: 'empty' }, 'No analyses yet. Create your first one.')));
}

/* ---------- Content studio ---------- */
async function renderStudio() {
  shell(h('p', { class: 'muted' }, 'Loading…'));
  const items = await api('/api/admin/analyses');
  if (!items.length) return shell(h('div', { class: 'empty' }, 'Create an analysis first.'));
  const sel = h('select', { id: 'pick', 'aria-label': 'Analysis' }, items.map((a) =>
    h('option', { value: a.id, selected: a.id === current.studioId }, `${a.asset} · ${a.timeframe} · ${a.analysis_date}`)));
  const stage = h('div', { class: 'studio' });
  const load = async () => {
    current.studioId = Number(sel.value);
    const analysis = items.find((a) => a.id === current.studioId);
    const pack = await api(`/api/admin/analyses/${analysis.id}/pack`);
    stage.replaceChildren(await studioView(analysis, pack, load));
  };
  sel.addEventListener('change', load);
  shell(h('div', {}, h('div', { class: 'field' }, h('label', { class: 'label', for: 'pick' }, 'Analysis'), sel), h('br'), stage));
  load();
}

async function studioView(analysis, pack, reload) {
  const msg = h('div');
  const generate = h('button', { class: 'btn', onclick: async () => {
    generate.disabled = true; generate.textContent = 'Generating…';
    try { await api(`/api/admin/analyses/${analysis.id}/pack`, { method: 'POST', body: {} }); await reload(); }
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
      const saved = await api(`/api/admin/analyses/${analysis.id}/pack`, { method: 'PUT', body: { content: collect(), status } });
      msg.replaceChildren(notice('ok', status === 'approved' ? 'Approved. You can export now.' : 'Draft saved.'));
      return saved;
    } catch (e) { msg.replaceChildren(notice('err', e.message)); }
  };

  let chartImg = null;
  const renderAll = async (saved) => {
    chartImg ||= await loadImage(`/uploads/${analysis.image}`);
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
  logoutLink.classList.remove('hidden');
  render().catch((e) => (e.status === 401 ? showLogin('Session expired.') : app.replaceChildren(notice('err', e.message))));
}
boot();
