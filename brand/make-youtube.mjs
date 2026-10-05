// YouTube channel art in the website's style: banner (2560x1440) and profile picture (800x800).
// Writes the SVG sources; render-youtube.mjs turns them into PNGs plus a device preview.
//
// YouTube shows one banner image and crops it per device:
//   TV       2560x1440  whole image
//   Desktop  2560x423   centred band
//   Tablet   1855x423   centred
//   Phone    1546x423   centred = "safe area", everything readable lives here
import { writeFileSync } from 'node:fs';

const ORANGE = '#f7931a', ORANGE_HI = '#ffc46b', ORANGE_LO = '#c96a00', INK = '#05070a', NAVY = '#0c1422', BLUE = '#4f8cff', TEXT = '#eef1f5', MUTED = '#8b95a5';
const MONO = "'DejaVu Sans Mono', ui-monospace, Menlo, monospace";
const SERIF = "'DejaVu Serif', Georgia, serif";

export const W = 2560, H = 1440;
export const SAFE = { x: (W - 1546) / 2, y: (H - 423) / 2, w: 1546, h: 423 };

// Same Elliott impulse as the favicon and profile pictures: 0 → 1 → 2 → 3 → 4 → 5 (apex), 1000-unit box.
const IMPULSE = [[180, 690], [330, 500], [410, 590], [610, 300], [690, 390], [830, 190]];
const path = (pts, dx, dy, s) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * s + dx).toFixed(1)},${(y * s + dy).toFixed(1)}`).join(' ');

const defs = `<defs>
  <radialGradient id="bg" cx="62%" cy="38%" r="75%"><stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="${INK}"/></radialGradient>
  <radialGradient id="glowBg" cx="68%" cy="30%" r="45%"><stop offset="0" stop-color="${ORANGE}" stop-opacity=".28"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient>
  <linearGradient id="or" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${ORANGE_LO}"/><stop offset=".55" stop-color="${ORANGE}"/><stop offset="1" stop-color="${ORANGE_HI}"/></linearGradient>
  <linearGradient id="fadeX" x1="0" x2="1"><stop offset="0" stop-color="${INK}" stop-opacity=".9"/><stop offset=".22" stop-color="${INK}" stop-opacity="0"/><stop offset=".78" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".9"/></linearGradient>
  <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="${TEXT}" stroke-width="1" opacity=".045"/></pattern>
  <radialGradient id="veil" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${INK}" stop-opacity=".85"/><stop offset=".6" stop-color="${INK}" stop-opacity=".55"/><stop offset="1" stop-color="${INK}" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowL" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${ORANGE}" stop-opacity=".16"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient>
  <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>
</defs>`;

function mark(dx, dy, s, w, glow = true) {
  const d = path(IMPULSE, dx, dy, s);
  const [ax, ay] = IMPULSE.at(-1).map((v, i) => v * s + (i ? dy : dx));
  return `${glow ? `<path d="${d}" fill="none" stroke="${ORANGE}" stroke-width="${w * 2.3}" stroke-linecap="round" stroke-linejoin="round" opacity=".24" filter="url(#blur)"/>` : ''}
  <path d="${d}" fill="none" stroke="url(#or)" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${ax}" cy="${ay}" r="${w * 0.62}" fill="${INK}" stroke="url(#or)" stroke-width="${w * 0.42}"/>`;
}

// Soft sine waves rising left to right, like the profile pictures' background.
function waves(w, h, n, opacity, top, rise) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), base = h * (top + (1 - top) * 0.85 * k), amp = 14 + 50 * k;
    let d = '';
    for (let x = 0; x <= w; x += 16) {
      const u = x / w, th = u * Math.PI * 2 * 2.2 + i * 0.7;
      const y = base - u * rise * (0.4 + k) + amp * (Math.sin(th * (1.1 + k * 0.4)) * 0.7 + Math.sin(th * 2.4) * 0.3);
      d += `${x ? 'L' : 'M'}${x},${y.toFixed(1)} `;
    }
    const c = i % 4 === 2 ? BLUE : ORANGE;
    out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${(1.5 + k * 2.5).toFixed(1)}" opacity="${(opacity * (0.35 + k)).toFixed(3)}"/>`;
  }
  return out;
}

// Faint candles behind the band: falling into the left edge, rising out of the right edge,
// so the desktop strip (wider than the phone's safe area) is not empty beside the logo.
function candles() {
  let out = '', seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cy = (x) => 720 - 170 * Math.tanh((x - W / 2) / 650) - 50 * Math.sin(x / 210);
  for (let x = 40; x < W; x += 46) {
    const mid = cy(x), body = 26 + rnd() * 70, up = rnd() > 0.38, wick = body + 24 + rnd() * 50;
    const c = up ? ORANGE : BLUE;
    out += `<line x1="${x}" x2="${x}" y1="${(mid - wick / 2).toFixed(1)}" y2="${(mid + wick / 2).toFixed(1)}" stroke="${c}" stroke-width="3"/>`
      + `<rect x="${x - 11}" y="${(mid - body / 2).toFixed(1)}" width="22" height="${body.toFixed(1)}" rx="3" fill="${c}"/>`;
  }
  return `<g opacity=".13">${out}</g>`;
}

const assets = ['BITCOIN', 'ETHEREUM', 'SOLANA', 'NASDAQ', 'S&amp;P 500'];

// Text block inside the safe area: mark on the left, wordmark and claim on the right.
const MS = 0.5, MX = SAFE.x + 115 - 180 * MS, MY = SAFE.y + 212 - 440 * MS; // mark ~ 325x250 px
const TX = SAFE.x + 550;
export const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  ${waves(W, H, 11, 0.11, 0.42, 420)}
  ${candles()}
  <ellipse cx="${SAFE.x + SAFE.w / 2}" cy="${H / 2}" rx="${SAFE.w * 0.62}" ry="380" fill="url(#veil)"/>
  <ellipse cx="${SAFE.x + 310}" cy="${H / 2 - 20}" rx="520" ry="360" fill="url(#glowL)"/>
  <rect width="${W}" height="${H}" fill="url(#fadeX)"/>
  ${mark(MX, MY, MS, 56)}
  <text x="${TX}" y="${SAFE.y + 130}" font-family="${MONO}" font-weight="700" font-size="128" letter-spacing="6" fill="${TEXT}">APEX WAVE</text>
  <text x="${TX + 5}" y="${SAFE.y + 205}" font-family="${MONO}" font-weight="700" font-size="58" letter-spacing="34" fill="${ORANGE}">CAPITAL</text>
  <rect x="${TX + 5}" y="${SAFE.y + 236}" width="130" height="6" rx="3" fill="${ORANGE}"/>
  <text x="${TX}" y="${SAFE.y + 314}" font-family="${SERIF}" font-weight="700" font-size="54" fill="${TEXT}">Elliott-Wellen-Analysen,</text>
  <text x="${TX}" y="${SAFE.y + 380}" font-family="${SERIF}" font-weight="700" font-style="italic" font-size="54" fill="${ORANGE_HI}">die du nachprüfen kannst.</text>
  <text x="${SAFE.x + SAFE.w / 2}" y="${SAFE.y + SAFE.h + 96}" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="32" letter-spacing="8" fill="${MUTED}">${assets.join('  ·  ')}</text>
</svg>\n`;

// Profile picture 800x800. YouTube crops to a circle and shows it as small as 24-98 px,
// so it is the symbol only (same as the website icon), centred with room for the circle.
export const profile = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">${defs}
  <rect width="800" height="800" fill="url(#bg)"/><rect width="800" height="800" fill="url(#glowBg)"/>
  ${waves(800, 800, 9, 0.12, 0.3, 130).replaceAll('stroke-width="1.5"', 'stroke-width="1.2"')}
  ${mark(400 - 505 * 0.7, 400 - 440 * 0.7, 0.7, 60)}
</svg>\n`;

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL('youtube-banner.svg', import.meta.url), banner);
  writeFileSync(new URL('youtube-profile.svg', import.meta.url), profile);
  console.log('youtube svgs written');
}
