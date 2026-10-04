import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, resultPct } from '../lib/depot.js';
import { parsePosition, parseSettings } from '../lib/validate.js';

const base = { market: 'Crypto', asset: 'BTC/USD' };

test('hit rate counts only closed calls and shows the sample size', () => {
  const list = [
    ...Array.from({ length: 8 }, () => ({ status: 'hit', direction: 'long', entry_price: 100, exit_price: 110 })),
    ...Array.from({ length: 2 }, () => ({ status: 'stopped', direction: 'long', entry_price: 100, exit_price: 96 })),
    { status: 'open' }, { status: 'watching' },
  ];
  const s = computeStats(list);
  assert.deepEqual([s.closed, s.hits, s.stops, s.hit_rate, s.open, s.watching], [10, 8, 2, 80, 1, 1]);
  assert.equal(s.avg_result, 7.2);
});

test('no closed calls gives no hit rate instead of a made-up number', () => {
  const s = computeStats([{ status: 'open' }, { status: 'watching' }]);
  assert.equal(s.hit_rate, null);
  assert.equal(s.avg_result, null);
});

test('short results flip the sign and a manual result wins', () => {
  assert.equal(resultPct({ direction: 'short', entry_price: 100, exit_price: 90 }), 10);
  assert.equal(resultPct({ direction: 'long', entry_price: 100, exit_price: 90 }), -10);
  assert.equal(resultPct({ direction: 'long', entry_price: 100, exit_price: 90, result_pct: 3 }), 3);
  assert.equal(resultPct({ direction: 'long' }), null);
});

test('position validation rejects bad zones, numbers and unsafe proof links', () => {
  assert.throws(() => parsePosition({ ...base, buy_low: 70, buy_high: 60 }), /Buy zone low/);
  assert.throws(() => parsePosition({ ...base, stop: 'abc' }), /Stop must be a number/);
  assert.throws(() => parsePosition({ ...base, evidence_url: 'javascript:alert(1)' }), /http/);
  assert.throws(() => parsePosition({ ...base, status: 'won' }), /invalid status/);
  const ok = parsePosition({ ...base, buy_low: '61000', buy_high: 62400, stop: '', status: 'hit', evidence_url: 'https://example.com/p' });
  assert.deepEqual([ok.buy_low, ok.buy_high, ok.stop, ok.status, ok.direction], [61000, 62400, null, 'hit', 'long']);
});

test('settings validation', () => {
  assert.throws(() => parseSettings({ free_until: '', price: 29 }), /required/);
  assert.throws(() => parseSettings({ free_until: '2026-12-31', price: -1 }), /0 or more/);
  assert.deepEqual(parseSettings({ free_until: '2026-12-31', price: '39' }), { free_until: '2026-12-31', price: 39 });
});
