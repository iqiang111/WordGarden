const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const { extractKeywords, aggregateKeywords } = require('./keywords');
const { isBlocked } = require('./moderation');
function openDatabase(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE IF NOT EXISTS gardens (id TEXT PRIMARY KEY, question TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY, garden_id TEXT NOT NULL REFERENCES gardens(id), word TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(garden_id, word));
    CREATE TABLE IF NOT EXISTS submissions (garden_id TEXT NOT NULL REFERENCES gardens(id), word TEXT NOT NULL, ip_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(garden_id, word, ip_hash));
    CREATE INDEX IF NOT EXISTS idx_answers_garden ON answers(garden_id);`);
  const keywordCache = new Map();
  const cachedExtract = text => {
    if (!keywordCache.has(text)) {
      if (keywordCache.size >= 2000) keywordCache.delete(keywordCache.keys().next().value);
      keywordCache.set(text, extractKeywords(text));
    }
    return keywordCache.get(text);
  };
  const snapshot = id => {
    const garden = db.prepare('SELECT question FROM gardens WHERE id = ?').get(id);
    if (!garden) return null;
    const responses = db.prepare('SELECT word AS text, count FROM answers WHERE garden_id = ? ORDER BY count DESC, word').all(id).filter(response => !isBlocked(response.text));
    return { question: isBlocked(garden.question) ? '该问题包含已屏蔽内容' : garden.question, words: aggregateKeywords(responses, cachedExtract), responses, ...db.prepare('SELECT COUNT(*) AS totalAnswers, COUNT(DISTINCT ip_hash) AS participants FROM submissions WHERE garden_id = ?').get(id) };
  };
  const submit = db.transaction((id, word, hash) => {
    const result = db.prepare('INSERT OR IGNORE INTO submissions (garden_id,word,ip_hash) VALUES (?,?,?)').run(id, word, hash);
    if (!result.changes) return false;
    db.prepare('INSERT INTO answers (garden_id,word) VALUES (?,?) ON CONFLICT(garden_id,word) DO UPDATE SET count = count + 1').run(id, word);
    return true;
  });
  return { db, snapshot, submit };
}
module.exports = { openDatabase };
