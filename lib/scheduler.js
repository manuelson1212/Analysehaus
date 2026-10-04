// Runs the daily briefing at 09:00 Berlin time. Pure helpers are exported so the timing can be tested.
export function berlinParts(date, tz = 'Europe/Berlin') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .formatToParts(date).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}

// Run once per day, any time after the target hour (so a restart at 09:30 still catches up), at most `maxAttempts` times.
export function shouldRun({ now, hour = 9, tz, lastDay, attempts = 0, maxAttempts = 3 }) {
  const p = berlinParts(now, tz);
  return p.hour >= hour && lastDay !== p.day && attempts < maxAttempts;
}

export function startScheduler({ run, getLastDay, onFail, hour = 9, tz = 'Europe/Berlin', everyMs = 60_000, now = () => new Date() }) {
  const attempts = new Map();
  let busy = false;
  const tick = async () => {
    if (busy) return;
    const day = berlinParts(now(), tz).day;
    const n = attempts.get(day) ?? 0;
    if (!shouldRun({ now: now(), hour, tz, lastDay: getLastDay(), attempts: n })) return;
    busy = true;
    attempts.set(day, n + 1);
    try { await run(day); }
    catch (e) { console.error(`Daily briefing failed (attempt ${n + 1}):`, e.message); if (n + 1 >= 3) onFail?.(day, e); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, everyMs);
  timer.unref?.();
  return { tick, stop: () => clearInterval(timer) };
}
