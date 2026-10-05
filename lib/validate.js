import { randomBytes } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { UPLOAD_DIR } from './db.js';

const MARKETS = ['Crypto', 'Stocks'];
const STATUSES = ['draft', 'published'];
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const str = (v, max, required, name) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new HttpError(400, `${name} is required`);
  if (s.length > max) throw new HttpError(400, `${name} is too long (max ${max})`);
  return s;
};

export function parseAnalysis(b) {
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Invalid body');
  const market = str(b.market, 20, true, 'market');
  if (!MARKETS.includes(market)) throw new HttpError(400, 'market must be Crypto or Stocks');
  const status = b.status ?? 'draft';
  if (!STATUSES.includes(status)) throw new HttpError(400, 'invalid status');
  const date = str(b.analysis_date, 10, true, 'analysis_date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new HttpError(400, 'analysis_date must be YYYY-MM-DD');
  const rawTags = Array.isArray(b.tags) ? b.tags : [];
  const tags = [...new Set(rawTags.map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 12);
  return {
    asset: str(b.asset, 40, true, 'asset'),
    market,
    timeframe: str(b.timeframe, 10, true, 'timeframe'),
    analysis_date: date,
    wave_count: str(b.wave_count, 500, false),
    scenario_primary: str(b.scenario_primary, 1500, false),
    scenario_alt: str(b.scenario_alt, 1500, false),
    invalidation: str(b.invalidation, 500, false),
    targets: str(b.targets, 800, false),
    fib_levels: str(b.fib_levels, 800, false),
    body: str(b.body, 20000, false),
    tags,
    status,
    en: parseEnglish(b.en),
  };
}

// Optional English version of the text fields; empty fields fall back to the German text on the site.
const EN_LIMITS = { wave_count: 500, scenario_primary: 1500, scenario_alt: 1500, invalidation: 500, targets: 800, fib_levels: 800, body: 20000 };
function parseEnglish(en) {
  if (!en || typeof en !== 'object') return {};
  const out = {};
  for (const [k, max] of Object.entries(EN_LIMITS)) { const v = str(en[k], max, false, `English ${k}`); if (v) out[k] = v; }
  return out;
}

const SIGNATURES = [
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
];

// Accepts a base64 data URL, verifies the magic bytes and stores it under a random name.
export function saveImage(dataUrl) {
  const m = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw new HttpError(400, 'Image must be a PNG, JPEG or WebP data URL');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Image too large (max 6 MB)');
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig) throw new HttpError(400, 'File content is not a valid image');
  const name = `${randomBytes(12).toString('hex')}.${sig.ext}`;
  writeFileSync(join(UPLOAD_DIR, name), buf);
  return name;
}

export function deleteImage(name) {
  if (name && /^[a-f0-9]{24}\.(png|jpg|webp)$/.test(name)) {
    try { unlinkSync(join(UPLOAD_DIR, name)); } catch { /* already gone */ }
  }
}

const TOPICS = ['Feedback / Verbesserungsidee', 'Allgemeine Frage', 'Frage zum Depot', 'Fehler melden'];

// Public forms answer in German; admin-only validation above stays English like the admin panel.
const field = (v, max, missing, tooLong) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new HttpError(400, missing);
  if (s.length > max) throw new HttpError(400, tooLong);
  return s;
};

export function parseContact(b) {
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Ungültige Anfrage');
  const name = field(b.name, 80, 'Bitte gib deinen Namen an', 'Der Name ist zu lang (max. 80 Zeichen)');
  const email = field(b.email, 120, 'Bitte gib deine E-Mail-Adresse an', 'Die E-Mail-Adresse ist zu lang');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Bitte gib eine gültige E-Mail-Adresse an');
  const topic = TOPICS.includes(b.topic) ? b.topic : TOPICS[0];
  return { name, email, topic, message: field(b.message, 4000, 'Bitte schreib eine Nachricht', 'Die Nachricht ist zu lang (max. 4000 Zeichen)') };
}

const POS_STATUSES = ['watching', 'open', 'hit', 'stopped'];
const num = (v, name) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) throw new HttpError(400, `${name} must be a number`);
  return n;
};
const optDate = (v, name) => {
  const d = typeof v === 'string' ? v.trim() : '';
  if (!d) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw new HttpError(400, `${name} must be YYYY-MM-DD`);
  return d;
};

export function parsePosition(b) {
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Invalid body');
  const market = str(b.market, 20, true, 'market');
  if (!MARKETS.includes(market)) throw new HttpError(400, 'market must be Crypto or Stocks');
  const direction = b.direction === 'short' ? 'short' : 'long';
  const status = b.status ?? 'watching';
  if (!POS_STATUSES.includes(status)) throw new HttpError(400, 'invalid status');
  const buy_low = num(b.buy_low, 'Buy zone low'), buy_high = num(b.buy_high, 'Buy zone high');
  if (buy_low != null && buy_high != null && buy_low > buy_high) throw new HttpError(400, 'Buy zone low must not exceed buy zone high');
  const evidence_url = str(b.evidence_url, 300, false);
  if (evidence_url && !/^https?:\/\/\S+$/.test(evidence_url)) throw new HttpError(400, 'Evidence link must start with http:// or https://');
  const analysis_id = b.analysis_id === '' || b.analysis_id == null ? null : Number(b.analysis_id);
  if (analysis_id != null && !Number.isInteger(analysis_id)) throw new HttpError(400, 'invalid analysis');
  return {
    analysis_id, asset: str(b.asset, 40, true, 'asset'), market, direction, buy_low, buy_high,
    stop: num(b.stop, 'Stop'), target: num(b.target, 'Target'), entry_price: num(b.entry_price, 'Entry price'),
    exit_price: num(b.exit_price, 'Exit price'), result_pct: num(b.result_pct, 'Result'), status,
    opened_at: optDate(b.opened_at, 'Opened date'), closed_at: optDate(b.closed_at, 'Closed date'),
    note: str(b.note, 1000, false), evidence_url: evidence_url || null,
  };
}

export function parseSettings(b) {
  const free_until = optDate(b?.free_until, 'Free access end date');
  if (!free_until) throw new HttpError(400, 'Free access end date is required');
  const price = num(b?.price, 'Price');
  if (price == null || price < 0) throw new HttpError(400, 'Price must be 0 or more');
  return { free_until, price, small_business: b?.small_business !== false };
}

const SOCIAL = { tiktok: 'tiktok.com', instagram: 'instagram.com', youtube: 'youtube.com', x: 'x.com' };

// Social profile links and the "about" text on the home page. Links must point to the matching network.
export function parseProfile(b) {
  const out = {};
  for (const [k, host] of Object.entries(SOCIAL)) {
    const v = str(b?.[k], 200, false, k);
    if (!v) continue;
    let u;
    try { u = new URL(v); } catch { throw new HttpError(400, `${k} link is not a valid URL`); }
    if (u.protocol !== 'https:' || !(u.hostname === host || u.hostname.endsWith(`.${host}`))) throw new HttpError(400, `${k} link must start with https:// and point to ${host}`);
    out[k] = u.href;
  }
  const about = str(b?.about, 1500, false, 'about');
  if (about) out.about = about;
  return out;
}

export function parseCredentials(b, { register = false } = {}) {
  const email = field(b?.email, 120, 'Bitte gib deine E-Mail-Adresse an', 'Die E-Mail-Adresse ist zu lang').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Bitte gib eine gültige E-Mail-Adresse an');
  const password = typeof b?.password === 'string' ? b.password : '';
  if (!password) throw new HttpError(400, 'Bitte gib ein Passwort ein');
  if (register) {
    if (password.length < 10) throw new HttpError(400, 'Das Passwort braucht mindestens 10 Zeichen');
    if (password.length > 200) throw new HttpError(400, 'Das Passwort ist zu lang');
    if (b.accept_terms !== true) throw new HttpError(400, 'Bitte akzeptiere die AGB und bestätige die Datenschutzerklärung');
  }
  return { email, password };
}

export function parseNewPassword(v) {
  const password = typeof v === 'string' ? v : '';
  if (!password) throw new HttpError(400, 'Bitte gib ein Passwort ein');
  if (password.length < 10) throw new HttpError(400, 'Das Passwort braucht mindestens 10 Zeichen');
  if (password.length > 200) throw new HttpError(400, 'Das Passwort ist zu lang');
  return password;
}

export function parseLegal(b) {
  const out = {};
  for (const k of ['imprint', 'privacy', 'terms']) out[k] = str(b?.[k], 60000, false);
  return out;
}

// Cancellation form (German law: § 312k BGB). Ordinary = to the next possible date; extraordinary needs a reason.
export function parseCancellation(b) {
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Ungültige Anfrage');
  const name = str(b.name, 120, false);
  if (!name) throw new HttpError(400, 'Bitte gib deinen Namen an');
  const email = str(b.email, 120, false).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Bitte gib eine gültige E-Mail-Adresse an');
  const kind = b.kind === 'extraordinary' ? 'extraordinary' : 'ordinary';
  const reason = str(b.reason, 2000, false);
  if (kind === 'extraordinary' && !reason) throw new HttpError(400, 'Bitte gib bei einer außerordentlichen Kündigung den Kündigungsgrund an');
  const effective_date = optDate(b.effective_date, 'Datum');
  return { name, email, kind, reason, effective_date };
}
