// Who may see the full content, and what a visitor without access gets to see.
import { resultPct } from './depot.js';

// Reasons: admin, free_period (launch window), member (active subscription), comped (granted by the admin), none.
export function accessFor({ user, admin, config }) {
  if (admin) return { active: true, reason: 'admin' };
  if (config.days_left > 0) return { active: true, reason: 'free_period' };
  if (user?.comped) return { active: true, reason: 'comped' };
  if (user && ['active', 'trialing'].includes(user.sub_status)) return { active: true, reason: 'member' };
  return { active: false, reason: 'none' };
}

// Analyses: chart, wave count and primary scenario stay public. Alternates, levels and the written text are for members.
export function redactAnalysis(a, access) {
  if (access.active) return { ...a, locked: false };
  const en = a.en ? { wave_count: a.en.wave_count, scenario_primary: a.en.scenario_primary } : undefined;
  return { ...a, scenario_alt: '', targets: '', fib_levels: '', invalidation: '', body: '', en, locked: true };
}

// Depot: every closed call is public with its proof (that is what backs the hit rate).
// Zones, stop and target of positions that are still running or waiting are for members.
export function redactPosition(p, access) {
  const result = resultPct(p);
  const closed = p.status === 'hit' || p.status === 'stopped';
  if (access.active || closed) return { ...p, result, locked: false };
  return { ...p, result, buy_low: null, buy_high: null, stop: null, target: null, entry_price: null, exit_price: null,
    note: '', evidence: null, evidence_url: null, locked: true };
}
