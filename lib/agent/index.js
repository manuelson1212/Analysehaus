// Marketing agent: turns a stored analysis into a TikTok script and an Instagram carousel.
// Providers implement `generate({ analysis, imagePath }) -> pack`. Swap via AGENT_PROVIDER.
import { generate as mock, generatePromo as mockPromo, generateBriefing as mockBriefing } from './mock.js';

export const DISCLAIMER =
  'Educational market analysis only. Not financial advice. Trading involves substantial risk of loss. Do your own research.';

// The Claude provider loads lazily so the mock works without the SDK installed.
const providers = { mock, claude: async (args) => (await import('./claude.js')).generate(args) };
const briefingProviders = { mock: mockBriefing, claude: async (args) => (await import('./claude.js')).generateBriefing(args) };
const promoProviders = { mock: mockPromo, claude: async (args) => (await import('./claude.js')).generatePromo(args) };
export const providerName = () => process.env.AGENT_PROVIDER || 'mock';

const clip = (s, n) => String(s ?? '').slice(0, n);
const list = (a, n, m) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => clip(x, m));

// Normalises any provider output (or user-edited pack) and enforces the disclaimer rules.
export function finalize(raw) {
  const t = raw?.tiktok ?? {};
  const i = raw?.instagram ?? {};
  const withDisclaimer = (caption) => {
    const c = clip(caption, 2000).replace(DISCLAIMER, '').trim();
    return `${c}\n\n${DISCLAIMER}`;
  };
  const slides = (Array.isArray(i.slides) ? i.slides : [])
    .filter((s) => !s?.disclaimer)
    .slice(0, 9)
    .map((s) => ({ title: clip(s?.title, 120), text: clip(s?.text, 500) }));
  slides.push({ title: 'Disclaimer', text: DISCLAIMER, disclaimer: true });

  return {
    provider: clip(raw?.provider, 40),
    chart_notes: clip(raw?.chart_notes, 1500),
    tiktok: {
      hook: clip(t.hook, 200),
      scenes: (Array.isArray(t.scenes) ? t.scenes : []).slice(0, 12).map((s) => ({
        visual: clip(s?.visual, 300),
        voiceover: clip(s?.voiceover, 400),
        onscreen: clip(s?.onscreen, 120),
      })),
      cta: clip(t.cta, 200),
      caption: withDisclaimer(t.caption),
      hashtags: list(t.hashtags, 20, 40),
    },
    instagram: {
      slides,
      caption: withDisclaimer(i.caption),
      hashtags: list(i.hashtags, 30, 40),
    },
  };
}

export async function generatePack(analysis, imagePath) {
  const name = process.env.AGENT_PROVIDER || 'mock';
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown AGENT_PROVIDER "${name}"`);
  const raw = await provider({ analysis, imagePath });
  return finalize({ ...raw, provider: name });
}

export async function generatePromoPack(facts) {
  const name = providerName();
  const provider = promoProviders[name];
  if (!provider) throw new Error(`Unknown AGENT_PROVIDER "${name}"`);
  return finalize({ ...(await provider({ facts })), provider: name });
}

// Connection check for the admin "AI agent" tab.
export async function testAgent() {
  const name = providerName();
  if (name === 'mock') return { ok: true, provider: 'mock', message: 'Mock provider is active. No AI call was made. Set AGENT_PROVIDER=claude to use the real agent.' };
  if (name !== 'claude') throw new Error(`Unknown AGENT_PROVIDER "${name}"`);
  const { ping, MODEL } = await import('./claude.js');
  const r = await ping();
  return { ok: true, provider: 'claude', message: `Connected. Claude answered using ${r.model || MODEL}.` };
}

// Daily briefing: returns { briefing, sources, pack } where pack is the finalized social pack.
export async function generateBriefingRecord(facts) {
  const name = providerName();
  const provider = briefingProviders[name];
  if (!provider) throw new Error(`Unknown AGENT_PROVIDER "${name}"`);
  const raw = await provider({ facts });
  const b = raw.briefing ?? {};
  const clip2 = (v, n) => String(v ?? '').slice(0, n);
  return {
    briefing: {
      headline: clip2(b.headline, 160),
      macro: (Array.isArray(b.macro) ? b.macro : []).slice(0, 8).map((m) => ({ title: clip2(m?.title, 140), text: clip2(m?.text, 500) })),
      analyses: (Array.isArray(b.analyses) ? b.analyses : []).slice(0, 8).map((a) => ({ asset: clip2(a?.asset, 60), text: clip2(a?.text, 400) })),
      depot_note: clip2(b.depot_note, 400),
    },
    sources: (raw.sources ?? []).filter((x) => /^https:\/\//.test(x?.url)).slice(0, 8).map((x) => ({ title: clip2(x.title, 160), url: x.url })),
    pack: finalize({ ...raw, provider: name }),
  };
}
