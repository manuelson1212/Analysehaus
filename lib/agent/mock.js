// Deterministic mock provider: builds content from the structured analysis fields.
// It does not read the screenshot; the real provider will add chart vision.
const lines = (s) => String(s || '').split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean);
const first = (s, n = 140) => {
  const t = lines(s)[0] || '';
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export async function generate({ analysis: a }) {
  const sym = a.asset.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const targets = first(a.targets);
  const fib = first(a.fib_levels);
  const primary = first(a.scenario_primary, 160) || 'Primary Elliott Wave scenario';
  const alt = first(a.scenario_alt, 160);
  const count = first(a.wave_count, 120) || 'Current wave structure';

  const hook = `${a.asset} ${a.timeframe}: here is the Elliott Wave count most traders miss.`;
  const tags = [...new Set(['elliottwave', 'technicalanalysis', sym.toLowerCase(),
    a.market === 'Crypto' ? 'crypto' : 'stockmarket', 'trading', 'tradingview',
    ...a.tags.map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''))].filter(Boolean))];

  return {
    chart_notes: 'Mock provider: the screenshot was not analysed. Set AGENT_PROVIDER=claude for chart vision.',
    tiktok: {
      hook,
      scenes: [
        { visual: 'Full chart screenshot, slow zoom in', voiceover: hook, onscreen: `${a.asset} · ${a.timeframe}` },
        { visual: 'Highlight the labelled waves on the chart', voiceover: `The count: ${count}.`, onscreen: count },
        { visual: 'Draw the primary path on the chart', voiceover: `Primary scenario: ${primary}`, onscreen: 'Primary scenario' },
        ...(fib || targets ? [{ visual: 'Mark Fibonacci levels and target zones',
          voiceover: `Key zones to watch: ${[fib, targets].filter(Boolean).join('. ')}`, onscreen: 'Key levels' }] : []),
        ...(a.invalidation ? [{ visual: 'Mark the invalidation level in red',
          voiceover: `The count is invalid if: ${first(a.invalidation)}`, onscreen: 'Invalidation' }] : []),
        ...(alt ? [{ visual: 'Show the alternate path as a dashed line',
          voiceover: `Alternate scenario: ${alt}`, onscreen: 'Alternate scenario' }] : []),
      ],
      cta: 'Follow for daily Elliott Wave breakdowns. Which count do you see?',
      caption: `${hook} ${primary}`,
      hashtags: tags,
    },
    instagram: {
      slides: [
        { title: `${a.asset} · ${a.timeframe}`, text: 'Elliott Wave analysis. Swipe for the full count →' },
        { title: 'The wave count', text: count },
        { title: 'Primary scenario', text: primary },
        ...(fib || targets ? [{ title: 'Key levels', text: [fib, targets].filter(Boolean).join('\n') }] : []),
        ...(a.invalidation ? [{ title: 'Invalidation', text: first(a.invalidation, 200) }] : []),
        ...(alt ? [{ title: 'Alternate scenario', text: alt }] : []),
        { title: 'Your view?', text: 'Save this post and tell us which count you see.' },
      ],
      caption: `${a.asset} ${a.timeframe} Elliott Wave update. ${primary}`,
      hashtags: tags,
    },
  };
}

// Promo ad for the website itself. Facts come from the server (free days, hit rate with sample size).
export async function generatePromo({ facts }) {
  const free = facts.free_days_left > 0 ? `${facts.free_days_left} days` : 'the free period';
  const rate = facts.hit_rate != null ? `Hit rate so far: ${facts.hit_rate}%, ${facts.hits} of ${facts.closed} closed calls in our simulated demo depot.` : null;
  const hook = `Elliott Wave analysis with buy zones and proof. Free for ${free}.`;
  const tags = ['elliottwave', 'bitcoin', 'crypto', 'technicalanalysis', 'trading', 'tradingview', 'freeaccess'];
  return {
    chart_notes: `Mock provider: template ad built from the facts (free days left: ${facts.free_days_left ?? 'n/a'}, closed calls: ${facts.closed ?? 0}).`,
    tiktok: {
      hook,
      scenes: [
        { visual: 'Screen recording: the animated wave hero of the website', voiceover: hook, onscreen: `Free for ${free}` },
        { visual: 'Scroll through an analysis with buy zone, target and invalidation', voiceover: 'Every analysis shows the buy zone, the target and the level that proves it wrong.', onscreen: 'Zone. Target. Invalidation.' },
        { visual: 'Open the live depot table, zoom on the status column', voiceover: `Every call is tracked in a simulated live depot, wins and losses, with proof. ${rate ?? ''}`.trim(), onscreen: 'Live demo depot' },
        { visual: 'Show the free access sign-up form', voiceover: `Early members get free access for ${free} and tell us what to improve. Afterwards it is paid.`, onscreen: 'Founding access' },
      ],
      cta: 'Link in bio. Start your free access.',
      caption: `${hook} Try the research, check the depot, tell us what to improve.`,
      hashtags: tags,
    },
    instagram: {
      slides: [
        { title: 'Free for early members', text: `Elliott Wave research with buy zones and proof. ${free} free.` },
        { title: 'Zone, target, invalidation', text: 'Every analysis names the buy zone, the target and the level that proves it wrong.' },
        { title: 'Live demo depot', text: rate ?? 'Every call is tracked in a simulated depot, wins and losses, with proof.' },
        { title: 'Help us improve', text: 'Early members shape the product. Tell us what is missing.' },
        { title: 'Start free', text: 'Link in bio. Afterwards the site is paid.' },
      ],
      caption: `${hook} Link in bio.`,
      hashtags: tags,
    },
  };
}

// Offline daily briefing built only from our own data (no news source). The social pack is derived from it.
export async function generateBriefing({ facts }) {
  const analyses = facts.analyses.slice(0, 4).map((a) => ({ asset: `${a.asset} ${a.timeframe}`, text: [a.wave_count, a.scenario_primary].filter(Boolean).join('. ') || 'New analysis published.' }));
  const d = facts.depot;
  const depot_note = d.closed ? `Live depot: ${d.hits} of ${d.closed} closed calls hit their target (simulated, no real money). ${d.open} open, ${d.watching} watching.` : `Live depot: ${d.open} open, ${d.watching} watching.`;
  const headline = `Market briefing ${facts.date}`;
  const hook = `Your ${facts.date} market briefing in 30 seconds.`;
  const scenes = [
    { visual: 'Animated wave background with the date', voiceover: hook, onscreen: 'Daily briefing' },
    ...analyses.slice(0, 3).map((a) => ({ visual: `Show the ${a.asset} chart`, voiceover: `${a.asset}: ${a.text}`, onscreen: a.asset })),
    { visual: 'Depot table', voiceover: depot_note, onscreen: 'Live demo depot' },
  ];
  const tags = ['elliottwave', 'bitcoin', 'crypto', 'macro', 'trading', 'marketupdate'];
  return {
    briefing: { headline, macro: [], analyses, depot_note },
    chart_notes: 'Mock provider: built from our own analyses and depot only. No news source was used, so the macro section is empty.',
    tiktok: { hook, scenes, cta: 'Follow for the daily briefing. Link in bio.', caption: `${headline}. ${depot_note}`, hashtags: tags },
    instagram: {
      slides: [{ title: headline, text: 'Swipe for today’s structure.' }, ...analyses.slice(0, 3).map((a) => ({ title: a.asset, text: a.text.slice(0, 120) })), { title: 'Live depot', text: depot_note }],
      caption: `${headline}. ${depot_note}`, hashtags: tags,
    },
    sources: [],
  };
}
