const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { isBlocked } = require('../moderation');
const { extractKeywords } = require('../keywords');
const { createApp } = require('../server');

test('屏蔽词识别覆盖空格、标点、零宽字符、繁体和全角变体', () => {
  for (const text of ['生殖器官', '阴 茎', '生殖，器官', '生殖\u200b器官', '陰莖', 'ＰＥＮＩＳ', '生殖器官和人工智能']) {
    assert.equal(isBlocked(text), true, text);
    assert.deepEqual(extractKeywords(text), []);
  }
  for (const text of ['人工智能很有趣', '编程和团队合作', '中国文化', '国家公园']) assert.equal(isBlocked(text), false);
});

test('接口拒绝新内容，历史敏感回答不进入 REST / WebSocket / 原始列表', async () => {
  const service = createApp({ filename: ':memory:' });
  let ws;
  try {
    service.server.listen(0, '127.0.0.1'); await once(service.server, 'listening');
    const base = `http://127.0.0.1:${service.server.address().port}`;
    const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/api/garden', { question: '生殖器官' })).status, 400);
    const { id } = await (await post('/api/garden', { question: '有什么收获？' })).json();
    service.store.submit(id, '阴茎和编程', 'historical-1');
    service.store.submit(id, '生殖器官', 'historical-2');
    service.store.submit(id, '人工智能很有趣', 'historical-3');
    const check = data => {
      assert.equal(data.submissions.length, 1);
      assert.equal(data.submissions[0].text, '人工智能很有趣');
      assert.equal(data.responses.length, 1);
      assert.equal(data.responses[0].text, '人工智能很有趣');
      assert.ok(data.words.some(word => word.text === '人工智能'));
      assert.ok(!data.words.some(word => ['阴茎', '编程', '生殖器官'].includes(word.text)));
    };
    check(await (await fetch(base + `/api/garden/${id}`)).json());
    ws = new WebSocket(base.replace('http', 'ws') + `/ws/${id}`);
    check(JSON.parse((await once(ws, 'message'))[0]));
    for (const word of ['生殖 器官', '阴茎']) assert.equal((await post(`/api/garden/${id}/answer`, { word })).status, 400);
    assert.equal(service.store.snapshot(id).totalAnswers, 3);
    // Retain stored history, but redact a blocked question in all snapshots.
    service.store.db.prepare('UPDATE gardens SET question = ? WHERE id = ?').run('生殖器官', id);
    assert.equal(service.store.snapshot(id).question, '该问题包含已屏蔽内容');
  } finally { ws?.terminate(); await service.close(); }
});
