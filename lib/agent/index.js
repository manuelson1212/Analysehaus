// Marketing agent: turns a stored analysis into a TikTok script and an Instagram carousel.
// Providers implement `generate({ analysis, imagePath }) -> pack`. Swap via AGENT_PROVIDER.
import { generate as mock } from './mock.js';
import { generate as claude } from './claude.js';

export const DISCLAIMER =
  'Educational market analysis only. Not financial advice. Trading involves substantial risk of loss. Do your own research.';

const providers = { mock, claude };

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
