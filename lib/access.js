// Who may see the content, and what a visitor without access gets to see.
import { resultPct } from './depot.js';

// Reasons: admin, free_period (launch window, needs an account), member (active subscription), comped (granted by the admin),
// guest (not logged in), none (logged in, no access).
export function accessFor({ user, admin, config }) {
  if (admin) return { active: true, reason: 'admin' };
  if (!user) return { active: false, reason: 'guest' };
  if (config.days_left > 0) return { active: true, reason: 'free_period' };
  if (user.comped) return { active: true, reason: 'comped' };
  if (['active', 'trialing'].includes(user.sub_status)) return { active: true, reason: 'member' };
  return { active: false, reason: 'none' };
}

// Analyses are for members. Without access only a teaser is sent: asset, market, timeframe, date and tags.
// No chart (the file name stays secret), no wave count, no text – in neither language.
export function redactAnalysis(a, access) {
  if (access.active) return { ...a, locked: false };
  const { id, asset, market, timeframe, analysis_date, tags, status } = a;
  return { id, asset, market, timeframe, analysis_date, tags, status, image: null, wave_count: '', scenario_primary: '', scenario_alt: '',
    invalidation: '', targets: '', fib_levels: '', body: '', en: {}, locked: true };
}

// The live portfolio is for members: without access no positions are sent, only the public statistics.
export function redactPosition(p, access) {
  return access.active ? { ...p, result: resultPct(p), locked: false } : null;
}
