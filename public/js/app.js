'use strict';
const $ = id => document.getElementById(id);
const page = document.body.dataset.page;
const id = location.pathname.split('/').pop();
const uiText = window.I18n.setText;
const userText = window.I18n.setUserText;
let serverClockOffset = 0, sessionExpiresAt, sessionClock, sessionClosed = false, onSessionEnd;
async function api(url, body) {
  const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await response.json();
  const date = Date.parse(response.headers.get('date'));
  if (Number.isFinite(date)) serverClockOffset = date - Date.now();
  if (!response.ok) { const error = new Error(data.error || '请求失败，请重试'); error.code = data.code; throw error; }
  return data;
}
function tickSession(forceEnded = false) {
  if (!Number.isFinite(sessionExpiresAt)) return;
  const remaining = Math.max(0, Math.ceil((sessionExpiresAt - Date.now() - serverClockOffset) / 1000));
  if (forceEnded || !remaining || sessionClosed) {
    sessionClosed = true; clearInterval(sessionClock); sessionClock = undefined;
    document.body.classList.add('session-ended');
    uiText('session-state', '讨论已结束'); uiText('session-countdown', '仅供查看');
    const end = onSessionEnd; onSessionEnd = undefined; end?.();
    return;
  }
  uiText('session-state', '正在收集回答');
  const time = [Math.floor(remaining / 3600), Math.floor(remaining % 3600 / 60), remaining % 60].map(value => String(value).padStart(2, '0')).join(':');
  uiText('session-countdown', '剩余 {time}', { time });
}
function watchSession(data, finish) {
  sessionExpiresAt = data.expiresAt;
  if (!sessionClosed) onSessionEnd = finish;
  tickSession(data.ended);
  if (!sessionClosed && !sessionClock) sessionClock = setInterval(tickSession, 1000);
}
window.addEventListener('pagehide', () => clearInterval(sessionClock));
window.addEventListener('pageshow', event => {
  if (event.persisted && Number.isFinite(sessionExpiresAt)) {
    tickSession();
    if (!sessionClosed) sessionClock = setInterval(tickSession, 1000);
  }
});
function bindForm(formId, inputId, max, handler) {
  const form = $(formId), input = $(inputId), button = form.querySelector('button');
  input.addEventListener('input', () => { $('counter').textContent = `${[...input.value].length} / ${max}`; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (button.disabled) return;
    const value = input.value.trim();
    if (!value || [...value].length > max) { uiText('message', '请输入 1–{max} 字的内容', { max }); return; }
    button.disabled = true; uiText('message', '正在提交…');
    try { await handler(value); } catch (error) {
      uiText('message', error instanceof TypeError ? '连接失败，请重试' : error.message || '连接失败，请重试');
      if (error.code === 'SESSION_ENDED' && page === 'answer') { form.dataset.ended = 'true'; location.replace(`/garden/${id}`); }
    }
    finally { button.disabled = form.dataset.ended === 'true'; }
  });
}
if (page === 'home') bindForm('create-form', 'question', 100, async question => { const data = await api('/api/garden', { question }); location.assign(`/garden/${data.id}`); });
if (page === 'answer') {
  api(`/api/garden/${id}`).then(data => {
    userText('question-title', data.question);
    watchSession(data, () => {
      $('answer-form').dataset.ended = 'true'; $('word').disabled = true; $('answer-form').querySelector('button').disabled = true;
      location.replace(`/garden/${id}`);
    });
    if (!sessionClosed) { $('word').disabled = false; $('answer-form').querySelector('button').disabled = false; }
  }).catch(error => { uiText('question-title', '暂时无法打开这个问题'); uiText('message', error instanceof TypeError ? '连接失败，请重试' : error.message); });
  bindForm('answer-form', 'word', 40, async word => {
    const result = await api(`/api/garden/${id}/answer`, { word });
    uiText('message', result.duplicate ? '这个回答已收到，试试另一个想法吧。' : '✓ 提交成功，可以继续回答。');
    $('word').value = ''; $('counter').textContent = '0 / 40'; $('word').focus();
  });
}
if (page === 'garden') {
  let words = [], submissions = [], retry = 1000, socket, timer, disposed = false;
  let positions = [], renderTimer, renderedSignature = '', question = '';
  const joinToggle = $('toggle-join');
  joinToggle.addEventListener('click', () => {
    const collapsed = !$('join-panel').hidden;
    $('join-panel').hidden = collapsed;
    $('garden-layout').classList.toggle('join-collapsed', collapsed);
    joinToggle.setAttribute('aria-expanded', String(!collapsed));
    uiText('toggle-join', collapsed ? '展开二维码' : '收起二维码');
    // ResizeObserver redraws the cloud after its available width changes.
  });
  const url = new URL(`/answer/${id}`, location.origin).href;
  $('answer-link').href = url;
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(url); uiText('message', '参与链接已复制'); } catch { uiText('message', '请复制链接：{url}', { url }); } };
  $('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { uiText('message', '当前浏览器不支持全屏，请使用浏览器全屏功能'); } };
  document.addEventListener('fullscreenchange', () => { uiText('fullscreen', document.fullscreenElement ? '⛶ 退出全屏' : '⛶ 全屏展示'); });
  function render() {
    clearTimeout(renderTimer); renderTimer = undefined;
    const canvas = $('cloud');
    const signature = JSON.stringify([canvas.parentElement.clientWidth, canvas.parentElement.clientHeight, words]);
    if (signature === renderedSignature) return;
    $('empty').hidden = words.length > 0;
    positions = window.WordGardenCloud.draw(canvas, words, positions);
    renderedSignature = signature;
    $('export-image').disabled = !words.length;
  }
  function scheduleRender() {
    // Do not reset this timer: a continuous stream must still produce regular frames.
    if (!renderTimer) renderTimer = setTimeout(render, 250);
  }
  function update(data) {
    question = data.question;
    userText('question-title', data.question); words = data.words;
    $('participants').textContent = data.participants; $('total').textContent = data.totalAnswers; $('unique').textContent = words.length;
    submissions = data.submissions || [];
    renderSubmissions();
    $('empty').hidden = words.length > 0;
    uiText('empty-title', data.ended ? '本次讨论暂无关键词' : data.totalAnswers ? '暂未提取到关键词' : '等待第一个回答');
    uiText('empty-description', data.ended ? '可以创建新问题，开始下一轮讨论。' : data.totalAnswers ? '尝试输入具体的主题、感受或想法。' : '扫码或打开参与链接，提交你的想法。');
    watchSession(data, () => {
      clearTimeout(timer);
      $('join-panel').hidden = true; joinToggle.hidden = true;
      $('garden-layout').classList.add('join-collapsed');
      uiText('connection', '讨论已结束');
      socket?.close();
      scheduleRender();
      // Fetch once after closing so an offline/reconnecting viewer gets the final result.
      if (!data.ended) api(`/api/garden/${id}`).then(update).catch(() => {});
    });
    scheduleRender();
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  $('export-responses').onclick = async () => {
    const button = $('export-responses'); button.disabled = true;
    try {
      const response = await fetch(`/api/garden/${id}/export.csv?lang=${document.documentElement.lang === 'en' ? 'en' : 'zh'}`, { cache: 'no-store' });
      if (!response.ok) throw new Error((await response.json()).error);
      download(await response.blob(), `wordgarden-${id}-responses.csv`);
      uiText('export-message', '回答已导出');
    } catch (error) { uiText('export-message', error instanceof TypeError ? '连接失败，请重试' : error.message || '导出失败，请重试'); }
    finally { button.disabled = false; }
  };
  $('export-image').onclick = () => {
    render();
    if (!words.length) { uiText('export-message', '暂无可导出的词云'); return; }
    const canvas = $('cloud'), image = document.createElement('canvas');
    image.width = Math.max(1200, canvas.width); const padding = 64;
    const context = image.getContext('2d');
    context.font = '500 32px "Microsoft YaHei", sans-serif';
    const lines = []; let line = '';
    for (const char of question) { if (line && context.measureText(line + char).width > image.width - padding * 2) { lines.push(line); line = ''; } line += char; }
    if (line) lines.push(line);
    const titleHeight = padding * 2 + lines.length * 46, cloudHeight = Math.round(canvas.height * image.width / canvas.width);
    image.height = titleHeight + cloudHeight + 86;
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, image.width, image.height);
    context.fillStyle = '#202124'; context.font = '500 32px "Microsoft YaHei", sans-serif';
    lines.forEach((text, index) => context.fillText(text, padding, padding + 32 + index * 46));
    // Redraw vector text at export resolution instead of enlarging screen pixels.
    const scale = image.width / (positions[0]?.canvasWidth || canvas.parentElement.clientWidth);
    context.textAlign = 'center'; context.textBaseline = 'middle';
    for (const word of positions) {
      context.font = `500 ${word.fontSize * scale}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      context.fillStyle = word.color; context.fillText(word.text, word.x * scale, titleHeight + word.y * scale);
    }
    context.textAlign = 'left'; context.textBaseline = 'alphabetic';
    context.fillStyle = '#62646b'; context.font = '20px sans-serif';
    context.fillText(`WordGarden · ${$('total').textContent} ${window.I18n.t('条回答')} · Copyright © ${new Date().getFullYear()} · github.com/iqiang111/WordGarden`, padding, image.height - 32);
    image.toBlob(blob => { if (blob) { download(blob, `wordgarden-${id}.png`); uiText('export-message', '词云图片已生成'); } else uiText('export-message', '导出失败，请重试'); }, 'image/png');
  };
  function renderSubmissions() {
    const rows = submissions.map(response => {
      const row = document.createElement('tr');
      const ip = document.createElement('td');
      ip.className = 'response-ip';
      ip.textContent = response.ip || window.I18n.t('未记录 IP');
      const text = document.createElement('td');
      text.textContent = response.text;
      row.append(ip, text);
      return row;
    });
    if (!rows.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 2; cell.className = 'responses-empty';
      cell.textContent = window.I18n.t('暂无可展示的回答'); row.append(cell); rows.push(row);
    }
    $('word-list').replaceChildren(...rows);
  }
  window.addEventListener('wordgarden:languagechange', renderSubmissions);
  function connect() {
    tickSession();
    if (disposed || sessionClosed || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${id}`);
    socket.onopen = () => { retry = 1000; if (sessionClosed) socket.close(); else uiText('connection', '● 实时连接中'); };
    socket.onmessage = event => { try { const data = JSON.parse(event.data); if (data.type === 'update' || data.type === 'ended') update(data); } catch { uiText('connection', '数据同步失败'); } };
    socket.onclose = event => {
      if (event.code === 4001) tickSession(true); else tickSession();
      if (!disposed && !sessionClosed) { uiText('connection', '○ 连接断开，正在重连…'); timer = setTimeout(connect, retry); retry = Math.min(retry * 2, 15000); }
    };
    socket.onerror = () => socket.close();
  }
  api(`/api/garden/${id}`).then(data => { update(data); if (!sessionClosed) { if (window.QRCode) new QRCode($('qrcode'), { text: url, width: 180, height: 180, colorDark: '#202124', correctLevel: QRCode.CorrectLevel.M }); connect(); } }).catch(error => { uiText('question-title', '暂时无法打开这个词云'); uiText('message', error instanceof TypeError ? '连接失败，请重试' : error.message); uiText('connection', '连接不可用'); });
  new ResizeObserver(scheduleRender).observe($('cloud').parentElement);
  window.addEventListener('pagehide', () => { disposed = true; clearTimeout(timer); clearTimeout(renderTimer); socket?.close(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; tickSession(); if (!sessionClosed) connect(); scheduleRender(); } });
}
