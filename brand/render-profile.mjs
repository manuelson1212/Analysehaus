// Renders brand/profile-*.svg to 1080x1080 PNGs and a preview sheet showing the circular crop.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
for (const n of ['a', 'b', 'c']) {
  await page.setContent(`<html><body style="margin:0;background:#000">${readFileSync(new URL(`profile-${n}.svg`, dir), 'utf8')}</body></html>`);
  await page.locator('svg').screenshot({ path: new URL(`profile-${n}-1080.png`, dir).pathname });
}
// Preview: how TikTok shows it (large circle on the profile, tiny circle next to comments).
const img = (n) => `data:image/svg+xml;base64,${Buffer.from(readFileSync(new URL(`profile-${n}.svg`, dir))).toString('base64')}`;
await page.setViewportSize({ width: 1500, height: 620 });
await page.setContent(`<html><body style="margin:0;background:#121212;font:600 22px 'DejaVu Sans',sans-serif;color:#fff;display:flex;gap:60px;padding:50px 70px;box-sizing:border-box">
  ${['a', 'b', 'c'].map((n) => `<div style="display:grid;justify-items:center;gap:18px">
    <img src="${img(n)}" style="width:300px;height:300px;border-radius:50%">
    <div>@apexwavecapital</div>
    <div style="display:flex;align-items:center;gap:12px;font-weight:400;font-size:18px;color:#aaa"><img src="${img(n)}" style="width:44px;height:44px;border-radius:50%">comment size</div>
    <div style="font-size:18px;color:#f7931a">Variant ${n.toUpperCase()}</div></div>`).join('')}
</body></html>`);
await page.waitForTimeout(300);
await page.screenshot({ path: new URL('profile-preview.png', dir).pathname });
await browser.close();
console.log('PNGs written');
