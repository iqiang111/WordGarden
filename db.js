const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const { extractKeywords, aggregateKeywords } = require('./keywords');
const { isBlocked } = require('./moderation');
function openDatabase(filename, options = {}) {
  const now = options.now || Date.now;
  const maxDuration = 3 * 60 * 60 * 1000;
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE IF NOT EXISTS gardens (id TEXT PRIMARY KEY, question TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY, garden_id TEXT NOT NULL REFERENCES gardens(id), word TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(garden_id, word));
    CREATE TABLE IF NOT EXISTS submissions (garden_id TEXT NOT NULL REFERENCES gardens(id), word TEXT NOT NULL, ip_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(garden_id, word, ip_hash));
    CREATE INDEX IF NOT EXISTS idx_answers_garden ON answers(garden_id);`);
  // Old databases only recorded an IP hash; leave their new IP field empty.
  if (!db.prepare('PRAGMA table_info(submissions)').all().some(column => column.name === 'ip')) {
    db.exec('ALTER TABLE submissions ADD COLUMN ip TEXT');
  }
  if (!db.prepare('PRAGMA table_info(gardens)').all().some(column => column.name === 'expires_at')) {
    db.exec('ALTER TABLE gardens ADD COLUMN expires_at INTEGER');
  }
  // Legacy sessions get a deadline from their original UTC creation time, never from a restart.
  db.prepare("UPDATE gardens SET expires_at = COALESCE(CAST(strftime('%s', created_at) AS INTEGER) * 1000, ?) + ? WHERE expires_at IS NULL").run(now(), maxDuration);
  const session = id => {
    const row = db.prepare('SELECT question, created_at, expires_at FROM gardens WHERE id = ?').get(id);
    if (!row) return null;
    const createdAt = Date.parse(row.created_at.replace(' ', 'T') + 'Z');
    const expiresAt = row.expires_at ?? createdAt + maxDuration;
    return { question: row.question, expiresAt, ended: now() >= expiresAt };
  };
  const keywordCache = new Map();
  const cachedExtract = text => {
    if (!keywordCache.has(text)) {
      if (keywordCache.size >= 2000) keywordCache.delete(keywordCache.keys().next().value);
      keywordCache.set(text, extractKeywords(text));
    }
    return keywordCache.get(text);
  };
  const snapshot = id => {
    const garden = session(id);
    if (!garden) return null;
    const responses = db.prepare('SELECT word AS text, count FROM answers WHERE garden_id = ? ORDER BY count DESC, word').all(id).filter(response => !isBlocked(response.text));
    const submissions = db.prepare('SELECT word AS text, ip FROM submissions WHERE garden_id = ? ORDER BY created_at DESC, rowid DESC').all(id).filter(response => !isBlocked(response.text));
    return { question: isBlocked(garden.question) ? '该问题包含已屏蔽内容' : garden.question, expiresAt: garden.expiresAt, ended: garden.ended, words: aggregateKeywords(responses, cachedExtract), responses, submissions, ...db.prepare('SELECT COUNT(*) AS totalAnswers, COUNT(DISTINCT ip_hash) AS participants FROM submissions WHERE garden_id = ?').get(id) };
  };
  const submit = db.transaction((id, word, hash, ip = null) => {
    if (session(id)?.ended) {
      const error = new Error('讨论已结束，只能查看词云'); error.code = 'SESSION_ENDED'; throw error;
    }
    const result = db.prepare('INSERT OR IGNORE INTO submissions (garden_id,word,ip_hash,ip) VALUES (?,?,?,?)').run(id, word, hash, ip);
    if (!result.changes) return false;
    db.prepare('INSERT INTO answers (garden_id,word) VALUES (?,?) ON CONFLICT(garden_id,word) DO UPDATE SET count = count + 1').run(id, word);
    return true;
  });
  return { db, snapshot, submit, session };
}
module.exports = { openDatabase };
