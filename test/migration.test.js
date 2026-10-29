const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { openDatabase } = require('../db');

test('旧数据库自动增加 IP 列，保留历史记录并在重启后保存新增 IP', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordgarden-migration-'));
  const filename = path.join(directory, 'data.db');
  let legacy = new Database(filename);
  legacy.exec(`CREATE TABLE submissions (garden_id TEXT, word TEXT, ip_hash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(garden_id,word,ip_hash));
    INSERT INTO submissions (garden_id,word,ip_hash) VALUES ('sample','历史回答','old-hash');`);
  legacy.close();
  let store;
  try {
    store = openDatabase(filename);
    store.db.prepare('INSERT INTO gardens (id,question) VALUES (?,?)').run('sample', '收获？');
    store.db.prepare('INSERT INTO answers (garden_id,word) VALUES (?,?)').run('sample', '历史回答');
    assert.deepEqual(store.snapshot('sample').submissions, [{ text: '历史回答', ip: null }]);
    assert.equal(store.submit('sample', '新的想法', 'new-hash', '2001:db8::1'), true);
    assert.equal(store.submit('sample', '新的想法', 'new-hash', '2001:db8::1'), false);
    store.db.close(); store = openDatabase(filename);
    const snapshot = store.snapshot('sample');
    assert.equal(snapshot.totalAnswers, 2);
    assert.deepEqual(snapshot.submissions, [{ text: '新的想法', ip: '2001:db8::1' }, { text: '历史回答', ip: null }]);
    assert.ok(!JSON.stringify(snapshot.submissions).includes('hash'));
  } finally { store?.db.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
