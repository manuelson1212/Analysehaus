import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalize, DISCLAIMER } from '../lib/agent/index.js';
import { generate } from '../lib/agent/mock.js';

const analysis = { asset: 'BTC/USD', market: 'Crypto', timeframe: '4H', analysis_date: '2026-10-01',
  wave_count: 'Wave 3', scenario_primary: 'Up', scenario_alt: '', invalidation: 'Below 61k', targets: '70k', fib_levels: '', tags: ['btc'] };

test('mock output always ends up with disclaimers everywhere', async () => {
  const pack = finalize(await generate({ analysis }));
  assert.ok(pack.tiktok.caption.endsWith(DISCLAIMER));
  assert.ok(pack.instagram.caption.endsWith(DISCLAIMER));
  assert.equal(pack.instagram.slides.at(-1).disclaimer, true);
});

test('finalize cannot be used to strip the disclaimer', () => {
  const pack = finalize({ tiktok: { caption: 'hi' }, instagram: { caption: 'x', slides: [{ title: 'a', text: 'b', disclaimer: true }] } });
  assert.equal(pack.instagram.slides.filter((s) => s.disclaimer).length, 1);
  assert.equal(pack.instagram.slides.length, 1);
  assert.equal(finalize(pack).tiktok.caption.split(DISCLAIMER).length, 2);
});
