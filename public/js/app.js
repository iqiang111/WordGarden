'use strict';
const $ = id => document.getElementById(id);
const page = document.body.dataset.page;
const id = location.pathname.split('/').pop();
async function api(url, body) {
  const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败，请重试');
  return data;
}
function bindForm(formId, inputId, max, handler) {
  const form = $(formId), input = $(inputId), button = form.querySelector('button');
  input.addEventListener('input', () => { $('counter').textContent = `${[...input.value].length} / ${max}`; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (button.disabled) return;
    const value = input.value.trim();
    if (!value || [...value].length > max) { $('message').textContent = `请输入 1–${max} 字的内容`; return; }
    button.disabled = true; $('message').textContent = '正在提交…';
    try { await handler(value); } catch (error) { $('message').textContent = error.message || '连接失败，请重试'; }
    finally { button.disabled = false; }
  });
}
if (page === 'home') bindForm('create-form', 'question', 100, async question => { const data = await api('/api/garden', { question }); location.assign(`/garden/${data.id}`); });
if (page === 'answer') {
  api(`/api/garden/${id}`).then(data => {
    $('question-title').textContent = data.question; $('word').disabled = false; $('answer-form').querySelector('button').disabled = false;
  }).catch(error => { $('question-title').textContent = '暂时无法打开这个问题'; $('message').textContent = error.message; });
  bindForm('answer-form', 'word', 40, async word => {
    const result = await api(`/api/garden/${id}/answer`, { word });
    $('message').textContent = result.duplicate ? '这个回答已收到，试试另一个想法吧。' : '✓ 提交成功，可以继续回答。';
    $('word').value = ''; $('counter').textContent = '0 / 40'; $('word').focus();
  });
}
if (page === 'garden') {
  let words = [], retry = 1000, socket, timer, disposed = false;
  const url = new URL(`/answer/${id}`, location.origin).href;
  $('answer-link').href = url;
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(url); $('message').textContent = '参与链接已复制'; } catch { $('message').textContent = `请复制链接：${url}`; } };
  $('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { $('message').textContent = '当前浏览器不支持全屏，请使用浏览器全屏功能'; } };
  document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? '⛶ 退出全屏' : '⛶ 全屏展示'; });
  function render() {
    const canvas = $('cloud'), bounds = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.floor(bounds.width); canvas.height = Math.floor(bounds.height);
    $('empty').hidden = words.length > 0;
    if (!words.length || !window.WordCloud) return;
    // Keep the highest-frequency 80 words; the complete list remains accessible below.
    const visible = words.slice(0, 80), peak = visible[0].count;
    WordCloud(canvas, { list: visible.map(w => [w.text, w.count]), gridSize: 7, weightFactor: count => Math.max(15, Math.min(bounds.width / 9, 72) * Math.sqrt(count / peak)), fontFamily: 'Microsoft YaHei, sans-serif', color: () => ['#202124', '#43454c', '#62656d', '#747780', '#535761'][Math.floor(Math.random() * 5)], backgroundColor: '#ffffff', rotateRatio: 0.12, minRotation: -Math.PI / 2, maxRotation: Math.PI / 2, shrinkToFit: true, drawOutOfBound: false });
  }
  function update(data) {
    $('question-title').textContent = data.question; words = data.words;
    $('participants').textContent = data.participants; $('total').textContent = data.totalAnswers; $('unique').textContent = words.length;
    $('word-list').replaceChildren(...words.map(w => { const li = document.createElement('li'); li.textContent = `${w.text} · ${w.count}`; return li; })); render();
  }
  function connect() {
    if (disposed) return;
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${id}`);
    socket.onopen = () => { retry = 1000; $('connection').textContent = '● 实时连接中'; };
    socket.onmessage = event => { try { const data = JSON.parse(event.data); if (data.type === 'update') update(data); } catch { $('connection').textContent = '数据同步失败'; } };
    socket.onclose = () => { if (!disposed) { $('connection').textContent = '○ 连接断开，正在重连…'; timer = setTimeout(connect, retry); retry = Math.min(retry * 2, 15000); } };
    socket.onerror = () => socket.close();
  }
  api(`/api/garden/${id}`).then(data => { update(data); if (window.QRCode) new QRCode($('qrcode'), { text: url, width: 180, height: 180, colorDark: '#202124', correctLevel: QRCode.CorrectLevel.M }); connect(); }).catch(error => { $('question-title').textContent = '暂时无法打开这个词云'; $('message').textContent = error.message; $('connection').textContent = '连接不可用'; });
  let resizeTimer; new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 180); }).observe($('cloud').parentElement);
  window.addEventListener('pagehide', () => { disposed = true; clearTimeout(timer); socket?.close(); });
}
