const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { WebSocket } = require('ws');
const { createApp } = require('../server');
const { openDatabase } = require('../db');

test('固定三小时，客户端无法改时长；到期严格拒绝提交与 WebSocket，但结果仍可读', async () => {
  let clock = Date.now(); const start = clock;
  const service = createApp({ filename: ':memory:', now: () => clock });
  try {
    service.server.listen(0, '127.0.0.1'); await once(service.server, 'listening');
    const base = `http://127.0.0.1:${service.server.address().port}`;
    const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const { id, expiresAt } = await (await post('/api/garden', { question: '收获？', durationMinutes: 999999 })).json();
    assert.equal(expiresAt, start + 10800000);
    assert.equal((await post(`/api/garden/${id}/answer`, { word: '编程' })).status, 200);
    clock = expiresAt;
    assert.equal((await post(`/api/garden/${id}/answer`, { word: '有趣' })).status, 410);
    assert.throws(() => service.store.submit(id, '不能绕过接口', 'test'), { code: 'SESSION_ENDED' });
    const data = await (await fetch(base + `/api/garden/${id}`)).json();
    assert.equal(data.ended, true); assert.equal(data.totalAnswers, 1); assert.equal(data.words[0].text, '编程');
    const answer = await fetch(base + `/answer/${id}`, { redirect: 'manual' });
    assert.equal(answer.status, 302); assert.equal(answer.headers.get('location'), `/garden/${id}`);
    assert.equal((await fetch(base + `/api/garden/${id}/export.csv`)).status, 200);
    const wsStatus = await new Promise((resolve, reject) => {
      const request = http.get(base + `/ws/${id}`, { headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
      request.on('upgrade', (_, socket) => { socket.destroy(); reject(new Error('Expired WebSocket accepted')); }); request.on('error', reject);
    });
    assert.equal(wsStatus, 410);
  } finally { await service.close(); }
});

test('正在连接的展示页在到期时收到最终词云并关闭连接', async () => {
  const service = createApp({ filename: ':memory:' }); let ws;
  try {
    service.server.listen(0, '127.0.0.1'); await once(service.server, 'listening');
    const base = `http://127.0.0.1:${service.server.address().port}`;
    const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const { id } = await (await post('/api/garden', { question: '到期关闭测试' })).json();
    service.store.db.prepare('UPDATE gardens SET expires_at = ? WHERE id = ?').run(Date.now() + 700, id);
    ws = new WebSocket(base.replace('http', 'ws') + `/ws/${id}`);
    const first = JSON.parse((await once(ws, 'message'))[0]); assert.equal(first.ended, false);
    let ended;
    ws.on('message', raw => { const data = JSON.parse(raw); if (data.type === 'ended') ended = data; });
    const closed = once(ws, 'close');
    assert.equal((await post(`/api/garden/${id}/answer`, { word: '实践' })).status, 200);
    const [code] = await closed;
    assert.equal(code, 4001); assert.equal(ended.ended, true); assert.equal(ended.totalAnswers, 1);
    assert.ok(ended.words.some(word => word.text === '实践'));
    assert.equal((await post(`/api/garden/${id}/answer`, { word: '新回答' })).status, 410);
  } finally { ws?.terminate(); await service.close(); }
});

test('历史问题从原创建时间计算截止时间，重启不会重新开放三小时', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wordgarden-expiry-'));
  const filename = path.join(directory, 'data.db'); let store;
  const legacy = new Database(filename);
  legacy.exec("CREATE TABLE gardens (id TEXT PRIMARY KEY, question TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO gardens (id,question,created_at) VALUES ('sample','旧问题',datetime('now','-4 hours'));");
  legacy.close();
  try {
    store = openDatabase(filename); const before = store.snapshot('sample');
    assert.equal(before.ended, true); store.db.close(); store = openDatabase(filename);
    assert.equal(store.snapshot('sample').expiresAt, before.expiresAt);
    assert.equal(store.snapshot('sample').ended, true);
  } finally { store?.db.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});
