import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
export const UPLOAD_DIR = join(DATA_DIR, 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'analysehaus.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset TEXT NOT NULL,
    market TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    analysis_date TEXT NOT NULL,
    wave_count TEXT NOT NULL DEFAULT '',
    scenario_primary TEXT NOT NULL DEFAULT '',
    scenario_alt TEXT NOT NULL DEFAULT '',
    invalidation TEXT NOT NULL DEFAULT '',
    targets TEXT NOT NULL DEFAULT '',
    fib_levels TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    image TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status, analysis_date DESC);
  CREATE TABLE IF NOT EXISTS packs (
    analysis_id INTEGER PRIMARY KEY REFERENCES analyses(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id INTEGER REFERENCES analyses(id) ON DELETE SET NULL,
    asset TEXT NOT NULL,
    market TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'long',
    buy_low REAL, buy_high REAL, stop REAL, target REAL,
    entry_price REAL, exit_price REAL, result_pct REAL,
    status TEXT NOT NULL DEFAULT 'watching',
    opened_at TEXT, closed_at TEXT,
    note TEXT NOT NULL DEFAULT '',
    evidence TEXT, evidence_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pw_hash TEXT NOT NULL,
    accepted_terms_at TEXT NOT NULL,
    comped INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    sub_status TEXT,
    sub_period_end TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_users_customer ON users(stripe_customer_id);
  CREATE TABLE IF NOT EXISTS briefings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    topic TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const FIELDS = ['asset', 'market', 'timeframe', 'analysis_date', 'wave_count', 'scenario_primary',
  'scenario_alt', 'invalidation', 'targets', 'fib_levels', 'body', 'tags', 'status'];

export function toRow(r) {
  if (!r) return null;
  return { ...r, tags: JSON.parse(r.tags || '[]') };
}

export const analyses = {
  list(publishedOnly) {
    const sql = `SELECT * FROM analyses ${publishedOnly ? "WHERE status = 'published'" : ''}
                 ORDER BY analysis_date DESC, id DESC`;
    return db.prepare(sql).all().map(toRow);
  },
  get(id) {
    return toRow(db.prepare('SELECT * FROM analyses WHERE id = ?').get(id));
  },
  create(data) {
    const cols = [...FIELDS, 'image'];
    const res = db.prepare(`INSERT INTO analyses (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => (c === 'tags' ? JSON.stringify(data.tags) : data[c] ?? null)));
    return this.get(Number(res.lastInsertRowid));
  },
  update(id, data) {
    const cols = [...FIELDS, 'image'];
    db.prepare(`UPDATE analyses SET ${cols.map((c) => `${c} = ?`).join(',')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...cols.map((c) => (c === 'tags' ? JSON.stringify(data.tags) : data[c] ?? null)), id);
    return this.get(id);
  },
  remove(id) {
    db.prepare('DELETE FROM analyses WHERE id = ?').run(id);
  },
};

export const packs = {
  get(analysisId) {
    const r = db.prepare('SELECT * FROM packs WHERE analysis_id = ?').get(analysisId);
    return r ? { content: JSON.parse(r.content), status: r.status, updated_at: r.updated_at } : null;
  },
  save(analysisId, content, status) {
    db.prepare(`INSERT INTO packs (analysis_id, content, status) VALUES (?, ?, ?)
      ON CONFLICT(analysis_id) DO UPDATE SET content = excluded.content, status = excluded.status,
      updated_at = datetime('now')`).run(analysisId, JSON.stringify(content), status);
    return this.get(analysisId);
  },
};

export const messages = {
  list: () => db.prepare('SELECT * FROM messages ORDER BY id DESC').all(),
  create: (m) => db.prepare('INSERT INTO messages (name, email, topic, message) VALUES (?, ?, ?, ?)').run(m.name, m.email, m.topic, m.message),
  remove: (id) => db.prepare('DELETE FROM messages WHERE id = ?').run(id),
};

const POS_COLS = ['analysis_id', 'asset', 'market', 'direction', 'buy_low', 'buy_high', 'stop', 'target', 'entry_price', 'exit_price',
  'result_pct', 'status', 'opened_at', 'closed_at', 'note', 'evidence', 'evidence_url'];

export const positions = {
  list: () => db.prepare('SELECT * FROM positions ORDER BY COALESCE(closed_at, opened_at, created_at) DESC, id DESC').all(),
  get: (id) => db.prepare('SELECT * FROM positions WHERE id = ?').get(id),
  create(d) {
    const r = db.prepare(`INSERT INTO positions (${POS_COLS.join(',')}) VALUES (${POS_COLS.map(() => '?').join(',')})`).run(...POS_COLS.map((c) => d[c] ?? null));
    return this.get(Number(r.lastInsertRowid));
  },
  update(id, d) {
    db.prepare(`UPDATE positions SET ${POS_COLS.map((c) => `${c} = ?`).join(',')}, updated_at = datetime('now') WHERE id = ?`).run(...POS_COLS.map((c) => d[c] ?? null), id);
    return this.get(id);
  },
  remove: (id) => db.prepare('DELETE FROM positions WHERE id = ?').run(id),
};

export const kv = {
  get(key, fallback = null) {
    const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(key);
    return r ? JSON.parse(r.value) : fallback;
  },
  set: (key, value) => db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value)),
};

export const users = {
  get: (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  byEmail: (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
  byCustomer: (cid) => db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(cid),
  list: () => db.prepare('SELECT * FROM users ORDER BY id DESC').all(),
  create: (email, pw_hash) => {
    const r = db.prepare("INSERT INTO users (email, pw_hash, accepted_terms_at) VALUES (?, ?, datetime('now'))").run(email, pw_hash);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid));
  },
  update(id, fields) {
    const keys = Object.keys(fields);
    if (keys.length) db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(',')} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
    return this.get(id);
  },
  remove: (id) => db.prepare('DELETE FROM users WHERE id = ?').run(id),
};

// One briefing per day. content = { briefing, sources, pack }.
const briefingRow = (r) => r && { id: r.id, day: r.day, status: r.status, created_at: r.created_at, updated_at: r.updated_at, ...JSON.parse(r.content) };
export const briefings = {
  list: (limit = 14) => db.prepare('SELECT * FROM briefings ORDER BY day DESC LIMIT ?').all(limit).map(briefingRow),
  get: (id) => briefingRow(db.prepare('SELECT * FROM briefings WHERE id = ?').get(id)),
  latestDay: () => db.prepare('SELECT day FROM briefings ORDER BY day DESC LIMIT 1').get()?.day ?? null,
  save(day, content, status = 'draft') {
    db.prepare(`INSERT INTO briefings (day, content, status) VALUES (?, ?, ?)
      ON CONFLICT(day) DO UPDATE SET content = excluded.content, status = excluded.status, updated_at = datetime('now')`).run(day, JSON.stringify(content), status);
    return briefingRow(db.prepare('SELECT * FROM briefings WHERE day = ?').get(day));
  },
  update(id, content, status) {
    db.prepare("UPDATE briefings SET content = ?, status = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(content), status, id);
    return this.get(id);
  },
  remove: (id) => db.prepare('DELETE FROM briefings WHERE id = ?').run(id),
};
