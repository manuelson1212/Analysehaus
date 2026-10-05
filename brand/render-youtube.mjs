// Renders the YouTube banner and profile picture to PNG and writes a preview sheet that shows
// how YouTube crops the banner on TV, desktop, tablet and phone, and the profile picture as a circle.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { banner, profile, W, H, SAFE } from './make-youtube.mjs';

const dir = new URL('.', import.meta.url);
writeFileSync(new URL('youtube-banner.svg', dir), banner);
writeFileSync(new URL('youtube-profile.svg', dir), profile);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
async function shoot(svg, w, h, out) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:#000">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: new URL(out, dir).pathname });
}
await shoot(banner, W, H, 'youtube-banner-2560x1440.png');
await shoot(profile, 800, 800, 'youtube-profile-800.png');

// Preview sheet. Each crop is the centred part of the banner YouTube shows on that device.
const b64 = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;
const crop = (label, cw, ch, scale) => `<figure style="margin:0">
  <div style="width:${cw * scale}px;height:${ch * scale}px;border-radius:10px;overflow:hidden;background:url('${b64(banner)}') ${-(W - cw) / 2 * scale}px ${-(H - ch) / 2 * scale}px / ${W * scale}px ${H * scale}px no-repeat"></div>
  <figcaption style="margin-top:8px;color:#aab">${label} · ${cw}×${ch}</figcaption></figure>`;
const s = 0.42;
await page.setViewportSize({ width: 1180, height: 1500 });
await page.setContent(`<html><body style="margin:0;background:#0f0f0f;font:500 18px 'DejaVu Sans',sans-serif;color:#fff;padding:40px;box-sizing:border-box">
  <div style="display:grid;gap:28px;justify-items:start">
    ${crop('TV (ganzes Bild)', W, H, s)}
    ${crop('Desktop', W, 423, s)}
    ${crop('Tablet', 1855, 423, s)}
    ${crop('Handy (Safe Area)', SAFE.w, SAFE.h, s)}
    <div style="display:flex;align-items:center;gap:40px">
      <img src="${b64(profile)}" style="width:160px;height:160px;border-radius:50%">
      <img src="${b64(profile)}" style="width:72px;height:72px;border-radius:50%">
      <div style="display:flex;align-items:center;gap:12px;color:#aaa"><img src="${b64(profile)}" style="width:36px;height:36px;border-radius:50%">Apex Wave Capital · Profilbild in Kommentargröße</div>
    </div>
  </div></body></html>`);
await page.waitForTimeout(300);
await page.screenshot({ path: new URL('youtube-preview.png', dir).pathname, fullPage: true });
await browser.close();
console.log('youtube PNGs + preview written');
