// Depot maths shared by server and tests. A call is "closed" when it hit its target zone or was stopped out.
const CLOSED = new Set(['hit', 'stopped']);

// Percent result of a position; sign follows the trade direction. Null if prices are missing.
export function resultPct(p) {
  if (p.result_pct != null) return p.result_pct;
  if (p.entry_price == null || p.exit_price == null || p.entry_price === 0) return null;
  const raw = ((p.exit_price - p.entry_price) / p.entry_price) * 100;
  return Math.round((p.direction === 'short' ? -raw : raw) * 100) / 100;
}

export function computeStats(positions) {
  const closed = positions.filter((p) => CLOSED.has(p.status));
  const hits = closed.filter((p) => p.status === 'hit').length;
  const results = closed.map(resultPct).filter((v) => v != null);
  return {
    closed: closed.length,
    hits,
    stops: closed.length - hits,
    hit_rate: closed.length ? Math.round((hits / closed.length) * 100) : null,
    open: positions.filter((p) => p.status === 'open').length,
    watching: positions.filter((p) => p.status === 'watching').length,
    avg_result: results.length ? Math.round((results.reduce((a, b) => a + b, 0) / results.length) * 100) / 100 : null,
  };
}
