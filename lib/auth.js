import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || randomBytes(9).toString('base64url');
export const PASSWORD_GENERATED = !process.env.ADMIN_PASSWORD;

const sign = (v) => createHmac('sha256', SECRET).update(v).digest('base64url');

function safeEqual(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(candidate) {
  const a = createHmac('sha256', SECRET).update(String(candidate)).digest();
  const b = createHmac('sha256', SECRET).update(ADMIN_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

export function makeToken() {
  const payload = String(Date.now() + SESSION_TTL_MS);
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  return Number(payload) > Date.now();
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export const sessionCookie = (token, secure) =>
  `ah_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? '; Secure' : ''}`;
export const clearCookie = () => 'ah_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';

// Simple in-memory brute-force limiter: 8 failures per 15 minutes per IP.
const failures = new Map();
export function loginAllowed(ip) {
  const e = failures.get(ip);
  return !e || e.resetAt < Date.now() || e.count < 8;
}
export function recordLogin(ip, ok) {
  if (ok) return failures.delete(ip);
  const e = failures.get(ip);
  if (!e || e.resetAt < Date.now()) failures.set(ip, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
  else e.count++;
}

// Member sessions: a signed "userId.expiry" token in its own cookie, separate from the admin session.
const USER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const makeUserToken = (userId) => { const payload = `u${userId}.${Date.now() + USER_TTL_MS}`; return `${payload}.${sign(payload)}`; };
export function userIdFromToken(token) {
  if (!token) return null;
  const [who, exp, sig] = token.split('.');
  if (!who || !exp || !sig || !who.startsWith('u') || !safeEqual(sig, sign(`${who}.${exp}`)) || Number(exp) <= Date.now()) return null;
  return Number(who.slice(1)) || null;
}
// When the token was issued (tokens issued before a password change are no longer accepted).
export const tokenIssuedAt = (token) => Number(String(token || '').split('.')[1]) - USER_TTL_MS;
export const userCookie = (token, secure) => `ah_user=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${USER_TTL_MS / 1000}${secure ? '; Secure' : ''}`;
export const clearUserCookie = () => 'ah_user=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
