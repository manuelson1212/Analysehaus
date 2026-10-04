// Renders scene.html frame by frame (30 fps) to JPEGs in ./frames. Usage: node render.mjs <timeline.json> <outDir>
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [timelinePath, outDir = 'frames', only] = process.argv.slice(2);
const TL = JSON.parse(readFileSync(timelinePath, 'utf8'));
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript((tl) => { window.TIMELINE = tl; }, TL);
await page.goto('file://' + new URL('scene.html', import.meta.url).pathname);
await page.waitForFunction(() => window.ready);
const FPS = 30, frames = Math.round(TL.total * FPS);
const list = only ? only.split(',').map(Number) : [...Array(frames).keys()];
const canvas = page.locator('#c');
for (const f of list) {
  await page.evaluate((t) => window.render(t), f / FPS);
  await canvas.screenshot({ path: join(outDir, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 });
}
await browser.close();
console.log(`rendered ${list.length} frames`);
