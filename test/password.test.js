import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const procs = [];
async function startServer(port, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ah-pwd-'));
  const p = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: dir, ADMIN_PASSWORD: 'adminpw', SESSION_SECRET: 'test-secret', TRUST_PROXY: '1', PUBLIC_URL: 'https://example.com', ...env }, stdio: 'ignore' });
  procs.push(p);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${base}/healthz`)).ok) return base; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('server did not start');
}
const call = async (base, path, { method = 'GET', body, cookie } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, cookie: (res.headers.getSetCookie?.()[0] || '').split(';')[0] };
};

const OUTBOX = join(mkdtempSync(join(tmpdir(), 'ah-mail-')), 'outbox.jsonl');
const mails = () => (existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
let M, N;
before(async () => { M = await startServer(3981, { MAIL_OUTBOX: OUTBOX }); N = await startServer(3982); });
after(() => procs.forEach((p) => p.kill()));

test('forgot password: email with a one-time link, new password works, old one and old sessions do not', async () => {
  const reg = await call(M, '/api/account/register', { method: 'POST', body: { email: 'anna@example.com', password: 'old-password-1', accept_terms: true } });
  assert.equal(reg.status, 201);

  // unknown address: same answer, no mail
  assert.deepEqual((await call(M, '/api/account/forgot', { method: 'POST', body: { email: 'nobody@example.com' } })).data, { ok: true });
  assert.equal(mails().length, 0);

  assert.deepEqual((await call(M, '/api/account/forgot', { method: 'POST', body: { email: 'Anna@Example.com' } })).data, { ok: true });
  const mail = mails()[0];
  assert.equal(mail.to, 'anna@example.com');
  const token = /reset=([\w-]+)/.exec(mail.text)[1];
  assert.match(mail.text, /https:\/\/example\.com\/account\?reset=/);

  assert.equal((await call(M, '/api/account/reset', { method: 'POST', body: { token, password: 'short' } })).status, 400);
  const ok = await call(M, '/api/account/reset', { method: 'POST', body: { token, password: 'new-password-22' } });
  assert.equal(ok.status, 200); assert.equal(ok.data.user.email, 'anna@example.com'); assert.ok(ok.cookie);

  // link works only once; old password and the session from before the reset are dead
  assert.equal((await call(M, '/api/account/reset', { method: 'POST', body: { token, password: 'another-pass-3' } })).status, 400);
  assert.equal((await call(M, '/api/account/login', { method: 'POST', body: { email: 'anna@example.com', password: 'old-password-1' } })).status, 401);
  assert.equal((await call(M, '/api/account/login', { method: 'POST', body: { email: 'anna@example.com', password: 'new-password-22' } })).status, 200);
  assert.equal((await call(M, '/api/account/me', { cookie: reg.cookie })).data.user, null);
  assert.equal((await call(M, '/api/account/me', { cookie: ok.cookie })).data.user.email, 'anna@example.com');
});

test('change password while logged in needs the current one', async () => {
  const login = await call(M, '/api/account/login', { method: 'POST', body: { email: 'anna@example.com', password: 'new-password-22' } });
  assert.equal((await call(M, '/api/account/password', { method: 'POST', cookie: login.cookie, body: { current: 'wrong-one-123', password: 'third-password-3' } })).status, 401);
  const r = await call(M, '/api/account/password', { method: 'POST', cookie: login.cookie, body: { current: 'new-password-22', password: 'third-password-3' } });
  assert.equal(r.status, 200);
  assert.equal((await call(M, '/api/account/me', { cookie: r.cookie })).data.user.email, 'anna@example.com');
  assert.equal((await call(M, '/api/account/login', { method: 'POST', body: { email: 'anna@example.com', password: 'third-password-3' } })).status, 200);
});

test('without email settings: forgot says so, the admin can still create a reset link', async () => {
  await call(N, '/api/account/register', { method: 'POST', body: { email: 'ben@example.com', password: 'bens-password-1', accept_terms: true } });
  assert.equal((await call(N, '/api/account/forgot', { method: 'POST', body: { email: 'ben@example.com' } })).status, 503);
  const admin = (await call(N, '/api/admin/login', { method: 'POST', body: { password: 'adminpw' } })).cookie;
  const id = (await call(N, '/api/admin/users', { cookie: admin })).data[0].id;
  assert.equal((await call(N, `/api/admin/users/${id}/reset-link`, { method: 'POST', body: {} })).status, 401);
  const { link } = (await call(N, `/api/admin/users/${id}/reset-link`, { method: 'POST', cookie: admin, body: {} })).data;
  const token = new URL(link).searchParams.get('reset');
  assert.equal((await call(N, '/api/account/reset', { method: 'POST', body: { token, password: 'bens-new-pass-2' } })).status, 200);
});
