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
