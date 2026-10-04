import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyses, packs, messages, UPLOAD_DIR } from './lib/db.js';
import {
  ADMIN_PASSWORD, PASSWORD_GENERATED, checkPassword, makeToken, verifyToken,
  parseCookies, sessionCookie, clearCookie, loginAllowed, recordLogin,
} from './lib/auth.js';
import { HttpError, parseAnalysis, parseContact, saveImage, deleteImage } from './lib/validate.js';
import { generatePack, finalize } from './lib/agent/index.js';

const PUBLIC_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 12 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}
const json = (res, status, data, headers = {}) =>
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

async function readJson(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Expected application/json');
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request too large');
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw new HttpError(400, 'Invalid JSON'); }
}

const contactHits = new Map();
const isAdmin = (req) => verifyToken(parseCookies(req.headers.cookie).ah_session);
const publicView = ({ updated_at, ...a }) => a;

async function serveFile(res, path, cache) {
  try {
    const st = await stat(path);
    if (!st.isFile()) throw new Error('not a file');
    const data = await readFile(path);
    send(res, 200, data, {
      'Content-Type': MIME[extname(path)] || 'application/octet-stream',
      'Cache-Control': cache,
    });
  } catch {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

async function api(req, res, url) {
  const path = url.pathname;
  const method = req.method;
  const ip = req.socket.remoteAddress || 'unknown';

  // Public API
  if (method === 'GET' && path === '/api/analyses') {
    return json(res, 200, analyses.list(true).map(publicView));
  }
  let m = /^\/api\/analyses\/(\d+)$/.exec(path);
  if (m && method === 'GET') {
    const a = analyses.get(Number(m[1]));
    if (!a || (a.status !== 'published' && !isAdmin(req))) throw new HttpError(404, 'Not found');
    return json(res, 200, publicView(a));
  }

  // Contact form (public, rate limited per IP: 5 messages per hour)
  if (method === 'POST' && path === '/api/contact') {
    const now = Date.now();
    const hits = (contactHits.get(ip) || []).filter((t) => now - t < 3600_000);
    if (hits.length >= 5) throw new HttpError(429, 'Too many messages. Please try again later.');
    const data = parseContact(await readJson(req));
    messages.create(data);
    contactHits.set(ip, [...hits, now]);
    return json(res, 201, { ok: true });
  }

  // Auth
  if (method === 'POST' && path === '/api/admin/login') {
    if (!loginAllowed(ip)) throw new HttpError(429, 'Too many attempts. Try again later.');
    const body = await readJson(req);
    const ok = checkPassword(body.password ?? '');
    recordLogin(ip, ok);
    if (!ok) throw new HttpError(401, 'Wrong password');
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(makeToken(), req.headers['x-forwarded-proto'] === 'https') });
  }
  if (method === 'POST' && path === '/api/admin/logout') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  }
  if (method === 'GET' && path === '/api/admin/me') {
    return json(res, 200, { admin: isAdmin(req) });
  }

  // Everything below requires admin
  if (!path.startsWith('/api/admin/')) throw new HttpError(404, 'Not found');
  if (!isAdmin(req)) throw new HttpError(401, 'Not logged in');

  if (method === 'GET' && path === '/api/admin/analyses') return json(res, 200, analyses.list(false));
  if (method === 'GET' && path === '/api/admin/messages') return json(res, 200, messages.list());
  m = /^\/api\/admin\/messages\/(\d+)$/.exec(path);
  if (m && method === 'DELETE') { messages.remove(Number(m[1])); return json(res, 200, { ok: true }); }

  if (method === 'POST' && path === '/api/admin/analyses') {
    const body = await readJson(req);
    const data = parseAnalysis(body);
    if (!body.image) throw new HttpError(400, 'A chart screenshot is required');
    data.image = saveImage(body.image);
    return json(res, 201, analyses.create(data));
  }

  m = /^\/api\/admin\/analyses\/(\d+)$/.exec(path);
  if (m) {
    const id = Number(m[1]);
    const existing = analyses.get(id);
    if (!existing) throw new HttpError(404, 'Not found');
    if (method === 'PUT') {
      const body = await readJson(req);
      const data = parseAnalysis(body);
      data.image = existing.image;
      if (body.image) data.image = saveImage(body.image);
      const updated = analyses.update(id, data);
      if (data.image !== existing.image) deleteImage(existing.image);
      return json(res, 200, updated);
    }
    if (method === 'DELETE') {
      analyses.remove(id);
      deleteImage(existing.image);
      return json(res, 200, { ok: true });
    }
  }

  m = /^\/api\/admin\/analyses\/(\d+)\/pack$/.exec(path);
  if (m) {
    const id = Number(m[1]);
    const a = analyses.get(id);
    if (!a) throw new HttpError(404, 'Not found');
    if (method === 'GET') return json(res, 200, packs.get(id));
    if (method === 'POST') {
      try {
        return json(res, 200, packs.save(id, await generatePack(a, join(UPLOAD_DIR, a.image)), 'draft'));
      } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(502, `Agent failed: ${e.message}`);
      }
    }
    if (method === 'PUT') {
      const body = await readJson(req);
      const status = body.status === 'approved' ? 'approved' : 'draft';
      const prev = packs.get(id)?.content;
      const content = finalize({ ...body.content, provider: prev?.provider, chart_notes: prev?.chart_notes });
      return json(res, 200, packs.save(id, content, status));
    }
  }

  throw new HttpError(404, 'Not found');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);

    if (url.pathname.startsWith('/uploads/')) {
      const name = url.pathname.slice('/uploads/'.length);
      if (!/^[a-f0-9]{24}\.(png|jpg|webp)$/.test(name)) return send(res, 404, 'Not found');
      return await serveFile(res, join(UPLOAD_DIR, name), 'public, max-age=31536000, immutable');
    }

    const pages = { '/': '/index.html', '/analyses': '/analyses.html', '/analysis': '/analysis.html', '/about': '/about.html',
      '/pricing': '/pricing.html', '/support': '/support.html', '/admin': '/admin.html' };
    const clean = pages[url.pathname] || url.pathname;
    const file = normalize(join(PUBLIC_DIR, clean));
    if (!file.startsWith(PUBLIC_DIR + sep)) return send(res, 403, 'Forbidden');
    return await serveFile(res, file, extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600');
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.message });
    console.error(e);
    return json(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Analysehaus running on http://localhost:${PORT}`);
  if (PASSWORD_GENERATED) console.log(`No ADMIN_PASSWORD set. Temporary admin password: ${ADMIN_PASSWORD}`);
});
