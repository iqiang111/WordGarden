const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { createApp } = require('../server');
const { exportResponses } = require('../csv');
const { layout, overlaps } = require('../public/js/stable-cloud');

test('同 Wi-Fi 的浏览器独立计数、匿名 Cookie 防篡改、浏览器限流与合并推送', async () => {
  process.env.TRUST_PROXY = 'loopback';
  const service = createApp({ filename: ':memory:' }); let ws;
  try {
    service.server.listen(0, '127.0.0.1'); await once(service.server, 'listening');
    const base = `http://127.0.0.1:${service.server.address().port}`;
    const browser = () => ({ cookie: '' });
    const call = async (client, route, body, ip = '10.0.0.1') => {
      const response = await fetch(base + route, { headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(client.cookie ? { Cookie: client.cookie } : {}) }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
      if (response.headers.has('set-cookie')) client.cookie = response.headers.get('set-cookie').split(';')[0];
      return response;
    };
    const teacher = browser(), a = browser(), b = browser();
    const created = await call(teacher, '/api/garden', { question: '收获？' });
    assert.match(created.headers.get('set-cookie'), /HttpOnly/);
    assert.match(created.headers.get('set-cookie'), /SameSite=Lax/);
    const { id } = await created.json(); const route = `/api/garden/${id}`;
    assert.equal((await (await call(a, route + '/answer', { word: '开心' })).json()).duplicate, false);
    assert.equal((await (await call(a, route + '/answer', { word: '开心' })).json()).duplicate, true);
    assert.equal((await (await call(b, route + '/answer', { word: '开心' })).json()).duplicate, false);
    assert.equal((await (await call(a, route + '/answer', { word: '开心' }, '10.0.0.2')).json()).duplicate, true);
    let data = await (await call(teacher, route)).json();
    assert.equal(data.totalAnswers, 2); assert.equal(data.participants, 2); assert.equal(data.words[0].count, 2);
    assert.ok(data.submissions.every(row => row.ip === '10.0.0.1'));
    const forged = { cookie: 'wg_browser=' + 'a'.repeat(32) + '.' + 'b'.repeat(64) };
    const originalCookie = forged.cookie; await call(forged, route); assert.notEqual(forged.cookie, originalCookie);
    const busy = browser();
    for (let index = 0; index < 30; index++) assert.equal((await call(busy, route + '/answer', { word: `观点${index}` })).status, 200);
    assert.equal((await call(busy, route + '/answer', { word: '超过频率' })).status, 429);
    assert.equal((await call(b, route + '/answer', { word: '编程' })).status, 200);
    data = await (await call(teacher, route)).json(); const targetCount = data.totalAnswers + 20;
    ws = new WebSocket(base.replace('http', 'ws') + `/ws/${id}`); await once(ws, 'message');
    let updateCount = 0;
    const finalPush = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Missing final batch update')), 4000);
      ws.on('message', raw => { updateCount++; const update = JSON.parse(raw); if (update.totalAnswers === targetCount) { clearTimeout(timeout); resolve(update); } });
    });
    await Promise.all(Array.from({ length: 20 }, () => call(browser(), route + '/answer', { word: '团队合作' })));
    const update = await finalPush; assert.equal(update.totalAnswers, targetCount); assert.ok(updateCount <= 3);
    const csvResponse = await call(teacher, route + '/export.csv?lang=en');
    assert.match(csvResponse.headers.get('content-type'), /text\/csv/);
    assert.match(csvResponse.headers.get('content-disposition'), /attachment/);
    const csv = Buffer.from(await csvResponse.arrayBuffer()); assert.equal(csv.subarray(0, 3).toString('hex'), 'efbbbf');
    assert.match(csv.toString(), /Original response/); assert.match(csv.toString(), /开心/);
  } finally { ws?.terminate(); await service.close(); delete process.env.TRUST_PROXY; }
});

test('CSV 保留原文和 IP，并防止单元格公式执行与引号破坏', () => {
  const csv = exportResponses({ question: '=1+1', submissions: [{ ip: '::1', text: '=HYPERLINK("x")' }, { ip: null, text: '含逗号,和"引号"\n换行' }, { ip: '127.0.0.1', text: '  @SUM(1)' }] });
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=1+1"')); assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"含逗号,和""引号""\n换行"')); assert.ok(csv.includes('未记录 IP'));
  assert.ok(csv.includes("'  @SUM(1)"));
});

test('新增低频词保持已有位置，布局无碰撞，调整尺寸后仍位于画布内', () => {
  const words = [{ text: '人工智能', count: 20 }, { text: '编程', count: 10 }, { text: '实践', count: 5 }];
  const measure = (text, size) => [...text].length * size;
  const first = layout(words, 900, 480, measure);
  const next = layout([...words, { text: '合作', count: 1 }, { text: '灵感', count: 1 }], 900, 480, measure, first);
  assert.equal(next.length, 5);
  for (const old of first) { const word = next.find(row => row.text === old.text); assert.equal(word.x, old.x); assert.equal(word.y, old.y); }
  const resized = layout(words, 320, 360, measure, next);
  assert.equal(resized.length, words.length);
  for (const [index, word] of resized.entries()) {
    assert.ok(word.x - word.width / 2 >= 0 && word.x + word.width / 2 <= 320);
    assert.ok(word.y - word.height / 2 >= 0 && word.y + word.height / 2 <= 360);
    for (const other of resized.slice(index + 1)) assert.equal(overlaps(word, other), false);
  }
});
