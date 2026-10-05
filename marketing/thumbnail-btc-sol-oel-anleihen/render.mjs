// Renders the thumbnail variants to PNG (1280×720). Usage: node render.mjs [a,b,c]
import { chromium } from 'playwright';

const variants = (process.argv[2] || 'a,b,c').split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const v of variants) {
  await page.goto('file://' + new URL('thumbnail.html', import.meta.url).pathname + '?v=' + v);
  await page.waitForFunction(() => window.ready);
  await page.locator('#t').screenshot({ path: new URL(`thumbnail-${v}.png`, import.meta.url).pathname });
}
await browser.close();
console.log(`rendered ${variants.join(', ')}`);
