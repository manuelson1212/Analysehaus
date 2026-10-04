// Website icons and the link preview image, in the style of profile variant A.
// Writes SVG sources to public/; render-web-assets.mjs turns them into PNGs.
import { writeFileSync } from 'node:fs';

const IMPULSE = [[180, 690], [330, 500], [410, 590], [610, 300], [690, 390], [830, 190]];
const path = (dx, dy, s) => IMPULSE.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * s + dx).toFixed(1)},${(y * s + dy).toFixed(1)}`).join(' ');
const apex = (dx, dy, s) => IMPULSE.at(-1).map((v, i) => v * s + (i ? dy : dx));
const defs = `<defs>
  <radialGradient id="bg" cx="62%" cy="38%" r="75%"><stop offset="0" stop-color="#0c1422"/><stop offset="1" stop-color="#05070a"/></radialGradient>
  <linearGradient id="or" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#c96a00"/><stop offset=".55" stop-color="#f7931a"/><stop offset="1" stop-color="#ffc46b"/></linearGradient>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
</defs>`;
function mark(dx, dy, s, w, glow = true) {
  const d = path(dx, dy, s), [ax, ay] = apex(dx, dy, s);
  return `${glow ? `<path d="${d}" fill="none" stroke="#f7931a" stroke-width="${w * 2.2}" stroke-linecap="round" stroke-linejoin="round" opacity=".25" filter="url(#glow)"/>` : ''}
  <path d="${d}" fill="none" stroke="url(#or)" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${ax}" cy="${ay}" r="${w * 0.62}" fill="#05070a" stroke="url(#or)" stroke-width="${w * 0.42}"/>`;
}

// Square icon (favicon, home screen). No blur so it stays crisp at 16-32 px.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${defs}
  <rect width="1000" height="1000" rx="200" fill="url(#bg)"/>${mark(40, 110, 0.9, 92, false)}</svg>\n`;

// Link preview 1200x630 (WhatsApp, X, LinkedIn, Facebook).
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${defs}
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="930" cy="250" r="320" fill="#f7931a" opacity=".07"/>
  ${mark(722, 100, 0.5, 40)}
  <text x="70" y="250" font-family="DejaVu Sans Mono, Menlo, monospace" font-weight="700" font-size="58" letter-spacing="4" fill="#eef1f5">APEX WAVE</text>
  <text x="72" y="310" font-family="DejaVu Sans Mono, Menlo, monospace" font-weight="700" font-size="40" letter-spacing="14" fill="#f7931a">CAPITAL</text>
  <text x="70" y="400" font-family="DejaVu Serif, Georgia, serif" font-weight="700" font-size="35" fill="#eef1f5">Elliott Wave analysis you can check.</text>
  <rect x="70" y="448" width="360" height="62" rx="31" fill="#f7931a"/>
  <text x="250" y="489" text-anchor="middle" font-family="DejaVu Sans Mono, Menlo, monospace" font-weight="700" font-size="26" fill="#111">FIRST 30 DAYS FREE</text>
</svg>\n`;

writeFileSync(new URL('../public/favicon.svg', import.meta.url), icon);
writeFileSync(new URL('../brand/og-image.svg', import.meta.url), og);
console.log('icon + og svg written');
