// Generates the TikTok / social profile pictures (1080x1080, safe for a circular crop) as SVG.
// Render to PNG with: node brand/render-profile.mjs  (uses Playwright's Chromium)
import { writeFileSync } from 'node:fs';

const ORANGE = '#f7931a', ORANGE_HI = '#ffc46b', ORANGE_LO = '#c96a00', INK = '#05070a', NAVY = '#0c1422', BLUE = '#4f8cff';
const MONO = "'DejaVu Sans Mono', ui-monospace, Menlo, monospace";

// Elliott impulse: 0 → 1 → 2 → 3 → 4 → 5 (apex). Coordinates in a 1000-unit box.
const IMPULSE = [[180, 690], [330, 500], [410, 590], [610, 300], [690, 390], [830, 190]];
const path = (pts, dx = 0, dy = 0, s = 1) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * s + dx).toFixed(1)},${(y * s + dy).toFixed(1)}`).join(' ');

function backgroundWaves(color, n = 9, opacity = 0.12) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), base = 1080 * (0.3 + 0.62 * k), amp = 14 + 46 * k;
    let d = '';
    for (let x = 0; x <= 1080; x += 12) {
      const u = x / 1080, th = u * Math.PI * 2 * 1.3 + i * 0.7;
      const y = base - u * 170 * (0.4 + k) + amp * (Math.sin(th * (1.1 + k * 0.4)) * 0.7 + Math.sin(th * 2.4) * 0.3);
      d += `${x ? 'L' : 'M'}${x},${y.toFixed(1)} `;
    }
    const c = i % 4 === 2 ? BLUE : color;
    out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${(1.5 + k * 2.5).toFixed(1)}" opacity="${(opacity * (0.35 + k)).toFixed(3)}"/>`;
  }
  return out;
}

function mark({ dx, dy, s, stroke = 'url(#gOrange)', node = INK, glow = true, width = 64 }) {
  const d = path(IMPULSE, dx, dy, s);
  const [ax, ay] = IMPULSE.at(-1).map((v, i) => v * s + (i ? dy : dx));
  return `${glow ? `<path d="${d}" fill="none" stroke="${ORANGE}" stroke-width="${width * 2.4}" stroke-linecap="round" stroke-linejoin="round" opacity="0.22" filter="url(#blur)"/>` : ''}
    <path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${ax}" cy="${ay}" r="${width * 0.62}" fill="${node}" stroke="${stroke}" stroke-width="${width * 0.42}"/>`;
}

const defs = `<defs>
  <radialGradient id="gBg" cx="62%" cy="38%" r="75%"><stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="${INK}"/></radialGradient>
  <radialGradient id="gGlow" cx="68%" cy="30%" r="45%"><stop offset="0" stop-color="${ORANGE}" stop-opacity="0.28"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient>
  <linearGradient id="gOrange" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${ORANGE_LO}"/><stop offset="0.55" stop-color="${ORANGE}"/><stop offset="1" stop-color="${ORANGE_HI}"/></linearGradient>
  <radialGradient id="gOrangeBg" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="${ORANGE_HI}"/><stop offset="0.55" stop-color="${ORANGE}"/><stop offset="1" stop-color="${ORANGE_LO}"/></radialGradient>
  <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="28"/></filter>
</defs>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">${defs}${body}</svg>\n`;

// A: symbol only (best at small sizes)
const A = svg(`<rect width="1080" height="1080" fill="url(#gBg)"/><rect width="1080" height="1080" fill="url(#gGlow)"/>
  ${backgroundWaves(ORANGE)}
  ${mark({ dx: 85, dy: 150, s: 0.9, width: 62 })}`);

// B: symbol + wordmark (text stays inside the circle's safe area)
const B = svg(`<rect width="1080" height="1080" fill="url(#gBg)"/><rect width="1080" height="1080" fill="url(#gGlow)"/>
  ${backgroundWaves(ORANGE, 9, 0.1)}
  ${mark({ dx: 170, dy: 40, s: 0.72, width: 52 })}
  <text x="540" y="728" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="92" letter-spacing="10" fill="#eef1f5">APEX WAVE</text>
  <text x="540" y="822" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="58" letter-spacing="22" fill="${ORANGE}">CAPITAL</text>`);

// C: inverted on Bitcoin orange (stands out most in the feed)
const C = svg(`<rect width="1080" height="1080" fill="url(#gOrangeBg)"/>
  ${backgroundWaves(INK, 8, 0.1)}
  ${mark({ dx: 85, dy: 150, s: 0.9, width: 62, stroke: INK, node: ORANGE, glow: false })}`);

for (const [name, s] of Object.entries({ a: A, b: B, c: C })) writeFileSync(new URL(`profile-${name}.svg`, import.meta.url), s);
console.log('SVGs written');
