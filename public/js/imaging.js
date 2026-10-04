// Client-side image handling: downscale uploads to WebP, render branded slides on canvas.
export async function fileToWebp(file, maxW = 1800) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return blobToDataUrl(blob);
}

export function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

export function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

const C = { bg: '#0a0b0d', panel: '#111317', line: '#242831', text: '#e6e8ec', muted: '#7f8794', accent: '#ffb000' };
const MONO = 'ui-monospace, Menlo, Consolas, monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

function drawText(ctx, text, x, y, maxW, size, lh, maxLines = 99) {
  const lines = wrap(ctx, text, maxW).slice(0, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

function drawChart(ctx, img, x, y, w, h) {
  ctx.fillStyle = C.panel;
  ctx.fillRect(x, y, w, h);
  const s = Math.min(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}

function frame(ctx, W, H, meta, idx, total) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.accent; ctx.fillRect(0, 0, W, 8);
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 34px ${MONO}`; ctx.fillStyle = C.text;
  ctx.fillText('ANALYSE', 60, 92);
  const w = ctx.measureText('ANALYSE').width;
  ctx.fillStyle = C.accent; ctx.fillText('HAUS', 60 + w, 92);
  ctx.font = `26px ${MONO}`; ctx.fillStyle = C.muted; ctx.textAlign = 'right';
  ctx.fillText(meta, W - 60, 92);
  if (total) ctx.fillText(`${idx + 1}/${total}`, W - 60, H - 50);
  ctx.textAlign = 'left';
}

// Instagram carousel slide, 1080x1350 (4:5).
export function renderCarouselSlide(slide, idx, total, analysis, img) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const ctx = c.getContext('2d');
  frame(ctx, 1080, 1350, `${analysis.asset} · ${analysis.timeframe}`, idx, total);
  const showChart = img && (idx === 0 || idx === 1);
  let y = 200;
  ctx.fillStyle = C.accent; ctx.font = `700 64px ${MONO}`;
  y = drawText(ctx, slide.title, 60, y + 40, 960, 64, 78, 3);
  if (showChart) drawChart(ctx, img, 60, y + 20, 960, 600);
  ctx.fillStyle = slide.disclaimer ? C.muted : C.text;
  ctx.font = `${slide.disclaimer ? 36 : 44}px ${SANS}`;
  const ty = showChart ? y + 20 + 600 + 60 : y + 40;
  drawText(ctx, slide.text, 60, ty, 960, 44, slide.disclaimer ? 52 : 60, showChart ? 4 : 12);
  if (!slide.disclaimer) {
    ctx.fillStyle = C.muted; ctx.font = `24px ${MONO}`;
    ctx.fillText('Not financial advice.', 60, 1300);
  }
  return c;
}

// TikTok cover, 1080x1920 (9:16).
export function renderTikTokCover(hook, analysis, img) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const ctx = c.getContext('2d');
  frame(ctx, 1080, 1920, `${analysis.market} · ${analysis.analysis_date}`, 0, 0);
  ctx.fillStyle = C.accent; ctx.font = `700 96px ${MONO}`;
  const y = drawText(ctx, analysis.asset, 60, 300, 960, 96, 110, 1);
  ctx.fillStyle = C.text; ctx.font = `700 60px ${SANS}`;
  const y2 = drawText(ctx, hook, 60, y + 40, 960, 60, 76, 5);
  if (img) drawChart(ctx, img, 60, Math.max(y2 + 40, 760), 960, 700);
  ctx.fillStyle = C.muted; ctx.font = `28px ${MONO}`;
  ctx.fillText('Educational only. Not financial advice.', 60, 1840);
  return c;
}

export const canvasToBlob = (c) => new Promise((r) => c.toBlob(r, 'image/png'));
