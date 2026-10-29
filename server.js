const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('node:http');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('./db');
const { isBlocked } = require('./moderation');
function createApp(options = {}) {
  const filename = options.filename || process.env.DB_PATH || path.join(__dirname, 'data/data.db');
  const store = openDatabase(filename);
  // Persist a private salt so IP hashes remain stable across restarts.
  let salt = options.salt || process.env.IP_HASH_SALT;
  if (!salt && filename !== ':memory:') {
    const saltPath = `${filename}.salt`;
    try { salt = fs.readFileSync(saltPath, 'utf8'); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      salt = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(saltPath, salt, { mode: 0o600 });
    }
  }
  salt ||= crypto.randomBytes(32).toString('hex');
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');
  app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'same-origin'); next(); });
  app.use(express.json({ limit: '4kb' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: '操作太频繁，请稍后再试' } }));
  const createLimit = rateLimit({ windowMs: 60000, limit: 20, message: { error: '创建太频繁，请稍后再试' } });
  const validText = (text, max) => typeof text === 'string' && text.trim().length > 0 && [...text.trim()].length <= max && !/[\u0000-\u001f\u007f]/u.test(text.trim());
  app.post('/api/garden', createLimit, (req, res) => {
    if (!validText(req.body?.question, 100)) return res.status(400).json({ error: '请输入 1–100 字的问题' });
    if (isBlocked(req.body.question)) return res.status(400).json({ error: '内容包含屏蔽词，请修改后再创建' });
    let id;
    do { id = crypto.randomBytes(6).toString('base64url').slice(0, 6); } while (store.snapshot(id));
    store.db.prepare('INSERT INTO gardens (id,question) VALUES (?,?)').run(id, req.body.question.trim());
    res.status(201).json({ id });
  });
  const requireGarden = (req, res, next) => {
    const data = /^[\w-]{6}$/.test(req.params.id) && store.snapshot(req.params.id);
    if (!data) return res.status(404).json({ error: '没有找到这个词云，请检查链接' });
    req.garden = data; next();
  };
  app.get('/api/garden/:id', requireGarden, (req, res) => res.json(req.garden));
  const rooms = new Map();
  app.post('/api/garden/:id/answer', requireGarden, (req, res) => {
    if (!validText(req.body?.word, 40)) return res.status(400).json({ error: '请输入 1–40 字的回答' });
    if (isBlocked(req.body.word)) return res.status(400).json({ error: '回答包含屏蔽词，请修改后再提交' });
    const hash = crypto.createHmac('sha256', salt).update(req.ip).digest('hex');
    const accepted = store.submit(req.params.id, req.body.word.trim().normalize('NFC'), hash);
    if (accepted) {
      const message = JSON.stringify({ type: 'update', ...store.snapshot(req.params.id) });
      for (const client of rooms.get(req.params.id) || []) if (client.readyState === WebSocket.OPEN) {
        if (client.bufferedAmount > 1024 * 1024) client.terminate(); else client.send(message);
      }
    }
    res.json({ success: true, duplicate: !accepted });
  });
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/garden/:id', (req, res) => res.sendFile(path.join(__dirname, 'public/garden.html')));
  app.get('/answer/:id', (req, res) => res.sendFile(path.join(__dirname, 'public/answer.html')));
  app.use((req, res) => res.status(404).json({ error: '页面不存在' }));
  app.use((error, req, res, next) => {
    if (error.status === 400 || error.status === 413) return res.status(error.status).json({ error: '请求内容无效或过长' });
    console.error(error); res.status(500).json({ error: '服务暂时不可用，请稍后重试' });
  });
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  server.on('upgrade', (req, socket, head) => {
    const match = /^\/ws\/([\w-]{6})$/.exec(req.url);
    if (!match || !store.snapshot(match[1])) return socket.destroy();
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return socket.destroy();
    wss.handleUpgrade(req, socket, head, ws => {
      const id = match[1];
      if (!rooms.has(id)) rooms.set(id, new Set());
      rooms.get(id).add(ws); ws.alive = true;
      ws.on('pong', () => { ws.alive = true; });
      ws.on('error', () => ws.terminate());
      ws.on('close', () => { rooms.get(id)?.delete(ws); if (!rooms.get(id)?.size) rooms.delete(id); });
      ws.send(JSON.stringify({ type: 'update', ...store.snapshot(id) }));
    });
  });
  const heartbeat = setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } } }, 30000);
  heartbeat.unref();
  const close = async () => { clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); await new Promise(resolve => server.close(resolve)); store.db.close(); };
  return { app, server, close, store };
}
if (require.main === module) {
  const service = createApp();
  service.server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('WordGarden listening on port ' + (process.env.PORT || 3000)));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => service.close().then(() => process.exit(0)));
}
module.exports = { createApp };
