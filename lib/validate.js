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
  };
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
