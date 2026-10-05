// Live crypto prices for the home page ticker. Fetched server-side (visitors never contact a third party),
// cached for a minute, Binance first with CoinGecko as fallback. Returns [] when both are unreachable.
const COINS = [['BTC', 'BTCUSDT', 'bitcoin'], ['ETH', 'ETHUSDT', 'ethereum'], ['SOL', 'SOLUSDT', 'solana']];
const TTL_MS = 60_000;

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fromBinance(fetchImpl) {
  const symbols = encodeURIComponent(JSON.stringify(COINS.map((c) => c[1])));
  const rows = await getJson(fetchImpl, `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`);
  return COINS.map(([sym, pair]) => {
    const r = rows.find((x) => x.symbol === pair);
    return { sym, price: Number(r.lastPrice), change: Number(r.priceChangePercent) };
  });
}

async function fromCoinGecko(fetchImpl) {
  const ids = COINS.map((c) => c[2]).join(',');
  const d = await getJson(fetchImpl, `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
  return COINS.map(([sym, , id]) => ({ sym, price: Number(d[id].usd), change: Number(d[id].usd_24h_change) }));
}

const valid = (list) => list.length === COINS.length && list.every((c) => Number.isFinite(c.price) && c.price > 0 && Number.isFinite(c.change));

export function createTicker({ fetchImpl = fetch, now = Date.now } = {}) {
  let cache = { at: -Infinity, data: [] }, pending = null;
  return async function ticker() {
    if (now() - cache.at < TTL_MS) return cache.data;
    pending ||= (async () => {
      let data = [];
      for (const source of [fromBinance, fromCoinGecko]) {
        try { const d = await source(fetchImpl); if (valid(d)) { data = d.map((c) => ({ ...c, change: Math.round(c.change * 100) / 100 })); break; } } catch { /* try next */ }
      }
      cache = { at: now(), data };
      pending = null;
      return data;
    })();
    return pending;
  };
}
