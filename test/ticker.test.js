import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTicker } from '../lib/ticker.js';
import { parseProfile } from '../lib/validate.js';

const ok = (body) => ({ ok: true, json: async () => body });
const binance = [
  { symbol: 'BTCUSDT', lastPrice: '86492.80', priceChangePercent: '2.071' },
  { symbol: 'ETHUSDT', lastPrice: '3120.5', priceChangePercent: '-1.2' },
  { symbol: 'SOLUSDT', lastPrice: '182.33', priceChangePercent: '0.456' },
];

test('ticker reads Binance and caches for a minute', async () => {
  let calls = 0, t = 0;
  const tick = createTicker({ fetchImpl: async () => { calls++; return ok(binance); }, now: () => t });
  const a = await tick();
  assert.deepEqual(a.map((c) => c.sym), ['BTC', 'ETH', 'SOL']);
  assert.equal(a[0].price, 86492.8); assert.equal(a[0].change, 2.07);
  await tick(); assert.equal(calls, 1);
  t = 61_000; await tick(); assert.equal(calls, 2);
});

test('ticker falls back to CoinGecko, then to an empty list', async () => {
  const gecko = { bitcoin: { usd: 86000, usd_24h_change: 1 }, ethereum: { usd: 3100, usd_24h_change: -2 }, solana: { usd: 180, usd_24h_change: 3 } };
  const viaGecko = createTicker({ fetchImpl: async (url) => (url.includes('binance') ? { ok: false, status: 451 } : ok(gecko)) });
  assert.equal((await viaGecko())[2].price, 180);
  const offline = createTicker({ fetchImpl: async () => { throw new Error('offline'); } });
  assert.deepEqual(await offline(), []);
});

test('profile links must point to the right network', () => {
  assert.deepEqual(parseProfile({ tiktok: 'https://www.tiktok.com/@apexwavecapital', instagram: '', about: ' Hallo ' }),
    { tiktok: 'https://www.tiktok.com/@apexwavecapital', about: 'Hallo' });
  assert.throws(() => parseProfile({ tiktok: 'https://evil.example/@x' }), /tiktok\.com/);
  assert.throws(() => parseProfile({ instagram: 'javascript:alert(1)' }), /instagram/);
  assert.throws(() => parseProfile({ x: 'http://x.com/a' }), /https/);
});
