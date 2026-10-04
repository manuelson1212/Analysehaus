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
