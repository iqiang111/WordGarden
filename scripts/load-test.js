// Isolated, disk-backed service in another process: never touches the running app.
const { fork } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { WebSocket } = require('ws');

if (process.argv[2] === '--server') {
  const service = require('../server').createApp();
  service.server.listen(0, '127.0.0.1', () => process.send({ port: service.server.address().port }));
  process.on('message', () => service.close().then(() => process.exit()));
} else {
  async function scenario(users, shared) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordgarden-load-'));
    const child = fork(__filename, ['--server'], { env: { ...process.env, DB_PATH: path.join(dir, 'data.db'), TRUST_PROXY: 'loopback' }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    let ws;
    try {
      const [{ port }] = await once(child, 'message');
      const base = `http://127.0.0.1:${port}`;
      async function request(route, ip, body) {
        const response = await fetch(base + route, { headers: { 'X-Forwarded-For': ip, 'Content-Type': 'application/json' }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
        return { status: response.status, data: await response.json() };
      }
      const { data: { id } } = await request('/api/garden', '192.0.2.1', { question: '并发压测' });
      const route = `/api/garden/${id}`;
      ws = new WebSocket(base.replace('http', 'ws') + `/ws/${id}`);
      await once(ws, 'message');
      let latest = 0, lastPushTime = 0;
      ws.on('message', raw => { latest = JSON.parse(raw).totalAnswers; lastPushTime = performance.now(); });
      const ip = i => shared ? '10.0.0.1' : `10.${Math.floor(i / 65536)}.${Math.floor(i / 256) % 256}.${i % 256}`;
      const start = performance.now();
      const reads = await Promise.all(Array.from({ length: users }, (_, i) => request(route, ip(i))));
      const durations = [];
      const submitStart = performance.now();
      const answers = await Promise.all(Array.from({ length: users }, async (_, i) => {
        const t = performance.now(); const result = await request(route + '/answer', ip(i), { word: `想法${i % 20}` }); durations.push(performance.now() - t); return result;
      }));
      const submitMs = performance.now() - submitStart;
      const successful = answers.filter(r => r.status === 200 && !r.data.duplicate).length;
      const deadline = performance.now() + 5000;
      while (latest !== successful && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      const { data } = await request(route, '192.0.2.2');
      assert.equal(data.totalAnswers, successful);
      assert.equal(data.words.reduce((sum, w) => sum + w.count, 0), successful);
      assert.equal(latest, successful);
      if (!shared) { assert.equal(successful, users); assert.equal(data.participants, users); }
      durations.sort((a, b) => a - b);
      const statuses = rows => rows.reduce((counts, row) => { counts[row.status] = (counts[row.status] || 0) + 1; return counts; }, {});
      console.log(JSON.stringify({ users, network: shared ? 'shared-IP' : 'distinct-IPs', pageLoads: statuses(reads), answers: statuses(answers), counted: data.totalAnswers, participants: data.participants, submitBatchMs: Math.round(submitMs), responseP50Ms: Math.round(durations[Math.floor(users * .5)]), responseP95Ms: Math.round(durations[Math.floor(users * .95)]), responseMaxMs: Math.round(durations.at(-1)), finalPushFromBatchStartMs: successful ? Math.round(lastPushTime - submitStart) : null, totalMs: Math.round(performance.now() - start), countsAndPushCorrect: true }));
    } finally {
      ws?.terminate();
      const stopped = once(child, 'exit'); child.send('stop'); await stopped;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  (async () => { await scenario(250, false); await scenario(500, false); await scenario(250, true); })().catch(error => { console.error(error); process.exitCode = 1; });
}
