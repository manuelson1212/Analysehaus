// Motion video studio: renders a 9:16 animated video from a social pack, entirely in the browser.
// The canvas is recorded with MediaRecorder in real time, so a 30 second video takes 30 seconds to render.
const W = 1080, H = 1920, FPS = 30, TAU = Math.PI * 2;
const C = { bg: '#05070a', text: '#e6e9ee', muted: '#8892a1', accent: '#f7931a', blue: '#4f8cff' };
const MONO = 'ui-monospace, Menlo, Consolas, monospace', SERIF = '"Iowan Old Style", Palatino, Georgia, serif', SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOut = (u) => 1 - (1 - clamp(u, 0, 1)) ** 3;
const MAX_SECONDS = 75;

// Timeline: intro, one segment per scene (length follows the voice-over at ~2.5 words per second), outro.
export function planTimeline(pack) {
  const t = pack.tiktok;
  const segs = [{ kind: 'intro', dur: 3.2, text: t.hook }];
  for (const s of t.scenes) {
    const words = s.voiceover.trim().split(/\s+/).filter(Boolean).length;
    segs.push({ kind: 'scene', dur: clamp(words / 2.5 + 0.8, 3, 9), headline: s.onscreen || '', voiceover: s.voiceover });
  }
  segs.push({ kind: 'outro', dur: 3.6, text: t.cta });
  // Shrink scenes proportionally if the video would be too long for short-form platforms.
  const total = segs.reduce((a, s) => a + s.dur, 0);
  const k = total > MAX_SECONDS ? (MAX_SECONDS - 6.8) / (total - 6.8) : 1;
  let at = 0;
  for (const s of segs) { if (s.kind === 'scene') s.dur *= k; s.start = at; at += s.dur; }
  return { segs, total: at };
}

function wrap(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function paragraph(ctx, text, x, y, maxW, lh, maxLines = 99) {
  const lines = wrap(ctx, text, maxW).slice(0, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

function waves(ctx, t) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), base = H * (0.2 + 0.7 * k), amp = 18 + 70 * k, blue = i % 5 === 3;
    ctx.beginPath();
    for (let x = 0; x <= W + 12; x += 12) {
      const u = x / W, th = u * TAU * 1.3 + t * (0.25 + k * 0.1) + i * 0.6;
      const saw = (((u * 3 + i * 0.07 + t * 0.03) % 1) - 0.5) * 0.9;
      const y = base - u * 0.14 * H * (0.4 + k) + amp * (Math.sin(th * (1.1 + k * 0.5)) * 0.7 + Math.sin(th * 2.3 + t * 0.4) * 0.3 + saw * 0.5);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const g = ctx.createLinearGradient(0, 0, W, 0), a = 0.08 + 0.4 * k, c = blue ? '79,140,255' : '247,147,26';
    g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.4, `rgba(${c},${a * 0.7})`); g.addColorStop(1, `rgba(${c},${a})`);
    ctx.strokeStyle = g; ctx.lineWidth = 1.5 + k * 2.5; ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

export function drawFrame(ctx, t, plan, { img, meta = '' } = {}) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.3, 0, W * 0.8, H * 0.3, H * 0.6);
  glow.addColorStop(0, 'rgba(247,147,26,0.16)'); glow.addColorStop(1, 'rgba(247,147,26,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  waves(ctx, t);

  // brand, progress, disclaimer: always on screen
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `700 34px ${MONO}`; ctx.fillStyle = C.text; ctx.fillText('APEX WAVE ', 60, 120);
  ctx.fillStyle = C.accent; ctx.fillText('CAPITAL', 60 + ctx.measureText('APEX WAVE ').width, 120);
  ctx.font = `24px ${MONO}`; ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText(meta, W - 60, 120); ctx.textAlign = 'left';
  ctx.fillStyle = C.accent; ctx.fillRect(0, 0, W * clamp(t / plan.total, 0, 1), 8);
  ctx.font = `24px ${MONO}`; ctx.fillStyle = C.muted; ctx.fillText('Educational only. Not financial advice.', 60, H - 70);

  const seg = plan.segs.find((s) => t >= s.start && t < s.start + s.dur) || plan.segs.at(-1);
  const u = (t - seg.start) / seg.dur, e = easeOut(u / 0.2), fadeOut = clamp((1 - u) / 0.08, 0, 1);
  ctx.globalAlpha = e * fadeOut;
  const rise = (1 - e) * 60;

  if (seg.kind === 'intro') {
    ctx.fillStyle = C.accent; ctx.font = `600 28px ${MONO}`; ctx.fillText('ELLIOTT WAVE · BITCOIN · MACRO', 60, 640 + rise);
    ctx.fillStyle = C.text; ctx.font = `700 84px ${SERIF}`; paragraph(ctx, seg.text, 60, 760 + rise, W - 120, 100, 6);
  } else if (seg.kind === 'outro') {
    ctx.fillStyle = C.text; ctx.font = `700 72px ${SERIF}`; const y = paragraph(ctx, seg.text, 60, 760 + rise, W - 120, 88, 4);
    ctx.fillStyle = C.accent; ctx.font = `700 44px ${MONO}`; ctx.fillText('Link in bio', 60, y + 70);
    ctx.fillStyle = C.muted; ctx.font = `28px ${SANS}`; paragraph(ctx, 'Educational market analysis. Not financial advice. Trading involves substantial risk of loss.', 60, y + 140, W - 120, 40, 3);
  } else {
    ctx.fillStyle = C.accent; ctx.font = `700 74px ${MONO}`;
    const headEnd = paragraph(ctx, seg.headline, 60, (img ? 330 : 700) + rise, W - 120, 88, 2);
    if (img) {
      const bx = 60, by = headEnd + 30, bw = W - 120, bh = 560, zoom = 1 + 0.06 * u;
      ctx.save(); roundRect(ctx, bx, by, bw, bh, 18); ctx.clip();
      ctx.fillStyle = '#0d1219'; ctx.fillRect(bx, by, bw, bh);
      const s = Math.min(bw / img.width, bh / img.height) * zoom, iw = img.width * s, ih = img.height * s;
      ctx.drawImage(img, bx + (bw - iw) / 2, by + (bh - ih) / 2, iw, ih);
      ctx.restore(); ctx.strokeStyle = '#2a3544'; ctx.lineWidth = 2; roundRect(ctx, bx, by, bw, bh, 18); ctx.stroke();
      subtitle(ctx, seg, u, by + bh + 80);
    } else subtitle(ctx, seg, u, headEnd + 70);
  }
  ctx.globalAlpha = 1;
}

// Voice-over as subtitles, revealed word by word across most of the scene.
function subtitle(ctx, seg, u, y) {
  const words = seg.voiceover.trim().split(/\s+/).filter(Boolean);
  const shown = words.slice(0, Math.ceil(clamp(u / 0.85, 0, 1) * words.length)).join(' ');
  ctx.fillStyle = C.text; ctx.font = `500 46px ${SANS}`;
  paragraph(ctx, shown, 60, y, W - 120, 62, 6);
}

// H.264 MP4 is what TikTok and Instagram import. Chrome and Safari record it; other builds fall back to WebM.
const MIME_CANDIDATES = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4D401E', 'video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
export const supportedMime = () => (typeof MediaRecorder === 'undefined' ? null : MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || null);

// speed > 1 plays the timeline faster than real time (used by tests only).
export async function renderMotionVideo({ pack, img = null, meta = '', onProgress = () => {}, speed = 1 }) {
  const mime = supportedMime();
  if (!mime) throw new Error('This browser cannot record video. Use a current version of Chrome, Edge or Safari.');
  const plan = planTimeline(pack);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rec = new MediaRecorder(canvas.captureStream(FPS), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res, rej) => { rec.onstop = res; rec.onerror = (e) => rej(e.error || new Error('Recording failed')); });
  drawFrame(ctx, 0, plan, { img, meta });
  rec.start(250);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const loop = (now) => {
      const t = ((now - t0) / 1000) * speed;
      if (t >= plan.total) { drawFrame(ctx, plan.total - 0.001, plan, { img, meta }); onProgress(1); return resolve(); }
      drawFrame(ctx, t, plan, { img, meta }); onProgress(t / plan.total);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await new Promise((r) => setTimeout(r, 300)); // let the last frame reach the recorder
  rec.stop(); await done;
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), mime: mime.split(';')[0], mp4: mime.startsWith('video/mp4'), duration: plan.total };
}
