'use strict';
(() => {
  const en = {
    '简单提问 · 即时回应': 'Simple questions. Instant responses.',
    'LIVE WORD CLOUD / 实时互动': 'LIVE WORD CLOUD / COLLECT IDEAS',
    '一个问题。': 'One question.', '看见每一种想法。': 'Every idea, seen.',
    '创建问题，邀请大家扫码回答。': 'Ask a question. Invite everyone to scan and respond.',
    '让想法汇聚，实时呈现。': 'Bring ideas together, in real time.',
    '输入你的问题': 'Your question', '例如：用一个词描述你此刻的感受': 'For example: describe how you feel in one word',
    '创建词云': 'Create word cloud', '01 提出问题': '01 Ask', '02 扫码参与': '02 Join', '03 实时呈现': '03 See ideas',
    '无需注册 · 无广告 · 即时互动': 'No sign-up · No ads · Real-time interaction',
    'Q & A / 使用指南': 'Q & A / GETTING STARTED', '常见问题': 'Frequently asked questions',
    '如何开始一场词云互动？': 'How do I start a session?',
    '在上方输入问题，点击「创建词云」进入展示页。参与者扫描展示页上的二维码，或打开参与链接，即可提交回答。你可以把展示页投屏，与大家一起观看词云变化。': 'Enter a question above and select Create word cloud. Participants can scan the QR code or open the participation link to respond. Share the display on a screen and watch ideas appear together.',
    '需要注册或登录吗？': 'Do I need an account?',
    '不需要。创建问题和提交回答都无需注册。请保存展示页或参与链接，方便之后再次打开。': 'No. You can create questions and submit responses without an account. Save the display or participation link to return later.',
    '回答可以是一整句话吗？': 'Can I submit a full sentence?',
    '可以。每条回答最多 40 字，可以输入词语、短语或完整句子。系统会自动分词并过滤常见停用词，再将提取出的关键词汇总到词云中。': 'Yes. Each response can contain up to 40 characters: a word, phrase, or sentence. Responses are segmented into keywords, with common stop words removed, before appearing in the cloud.',
    '词云中的词为什么有大有小？': 'Why are some words larger?',
    '提到某个关键词的回答越多，这个词就越大。同一条回答内重复出现的关键词只计一次。词云最多展示排名靠前的 80 个关键词；展示页下方可以展开查看原始回答。': 'A keyword grows as more responses mention it. Repetitions within a single response count once. The cloud shows up to 80 top keywords. Expand Original responses below the display to read the full responses.',
    '一个人可以提交多次回答吗？': 'Can I respond more than once?',
    '可以继续提交不同的回答。同一浏览器在同一个问题下提交相同回答，只计一次；不同浏览器即使共用 Wi-Fi，也可以各自提交相同回答。匿名标识通过 Cookie 保存，清除 Cookie 或使用无痕窗口会产生新的标识。参与数按匿名标识统计，历史 IP 计数会保留，并非准确人数。': 'Yes. Identical responses from one browser count once per question. Different browsers on the same Wi-Fi can each submit the same response. An anonymous ID is saved in a cookie; clearing cookies or using a private window creates another ID. Participation counts anonymous IDs, with historical IP counts retained, rather than verified people.',
    '为什么我的回答没有出现在词云里？': 'Why is my response missing from the cloud?',
    '词云展示的是提取后的关键词，原句通常不会完整显示。停用词、标点、纯数字会被过滤，排名较低的关键词也可能不显示。包含屏蔽词的回答会被拒绝或隐藏。提交后如未更新，请先查看提交提示，并检查网络连接。': 'The cloud shows extracted keywords rather than full sentences. Stop words, punctuation, and numbers are removed; lower-ranked keywords may be omitted. Responses containing blocked terms are rejected or hidden. If the cloud does not update, check the submission message and your network connection.',
    '让每一种声音被看见。': 'Every voice deserves to be seen.',
    'LIVE SESSION / 实时讨论': 'LIVE SESSION / SHARED IDEAS', '加入这场讨论': 'JOIN THE CONVERSATION',
    '扫码参与': 'Scan to join', '用一个词或短语，说说你的想法': 'Share a word, a phrase, or a thought.',
    '打开回答页 ↗': 'Open response page ↗', '复制参与链接': 'Copy participation link',
    '⛶ 全屏展示': '⛶ Full screen', '⛶ 退出全屏': '⛶ Exit full screen',
    '等待第一个回答': 'Waiting for the first response', '扫码或打开参与链接，提交你的想法。': 'Scan the QR code or open the link to share your thoughts.',
    '暂未提取到关键词': 'No keywords extracted yet', '尝试输入具体的主题、感受或想法。': 'Try sharing a specific topic, feeling, or idea.',
    '连接中…': 'Connecting…', '● 实时连接中': '● Live', '○ 连接断开，正在重连…': '○ Disconnected. Reconnecting…',
    '数据同步失败': 'Unable to sync data', '连接不可用': 'Connection unavailable',
    '个参与标识': 'participants', '条回答': 'responses', '个关键词': 'keywords',
    '提到该关键词的回答越多，词语就越大': 'More mentions make a keyword larger', '查看原始回答': 'Original responses',
    '参与讨论': 'Join the conversation', 'YOUR RESPONSE / 你的想法': 'YOUR RESPONSE / SHARE AN IDEA',
    '你的回答': 'Your response', '输入一个词或简短短语': 'Enter a word, phrase, or short sentence', '提交回答 ↗': 'Submit response ↗',
    '可以多次提交不同的想法。同一浏览器的相同回答只计一次，共用 Wi-Fi 不受影响。发言和网络 IP 会展示在原始回答中。': 'You can submit different ideas. Identical responses from one browser count once; shared Wi-Fi is supported. Your response and network IP will be visible under Original responses.',
    '正在加载问题…': 'Loading question…', '正在提交…': 'Submitting…', '请输入 1–{max} 字的内容': 'Please enter 1–{max} characters.',
    '请求失败，请重试': 'Request failed. Please try again.', '连接失败，请重试': 'Connection failed. Please try again.',
    '暂时无法打开这个问题': 'Unable to load this question', '暂时无法打开这个词云': 'Unable to load this word cloud',
    '这个回答已收到，试试另一个想法吧。': 'We already have this response. Try another idea.', '✓ 提交成功，可以继续回答。': '✓ Response received. You can share another idea.',
    '参与链接已复制': 'Participation link copied', '请复制链接：{url}': 'Copy this link: {url}',
    '当前浏览器不支持全屏，请使用浏览器全屏功能': 'Full screen is unavailable. Try your browser’s full-screen option.',
    '请输入 1–100 字的问题': 'Please enter a question of 1–100 characters.', '请输入 1–40 字的回答': 'Please enter a response of 1–40 characters.',
    '内容包含屏蔽词，请修改后再创建': 'The question contains blocked terms. Please edit it.',
    '回答包含屏蔽词，请修改后再提交': 'Your response contains blocked terms. Please edit it.',
    '没有找到这个词云，请检查链接': 'Word cloud not found. Please check the link.', '服务暂时不可用，请稍后重试': 'Service unavailable. Please try again later.',
    '操作太频繁，请稍后再试': 'Too many requests. Please try again later.', '创建太频繁，请稍后再试': 'Too many sessions created. Please try again later.',
    '请求内容无效或过长': 'The request is invalid or too large.', 'Load failed': 'Network request failed. Please try again.', 'Failed to fetch': 'Network request failed. Please try again.',
    '回答页二维码': 'QR code for the response page', '实时词云': 'Live word cloud', '词云展示': 'Word cloud display',
    '该问题包含已屏蔽内容': 'This question contains blocked content',
    'WordGarden · 让想法生长': 'WordGarden · Let ideas grow', '实时词云 · WordGarden': 'Live word cloud · WordGarden', '留下你的想法 · WordGarden': 'Share your thoughts · WordGarden'
  };
  Object.assign(en, { '用户 IP': 'User IP', '原始发言': 'Original response', '未记录 IP': 'IP not recorded', '暂无可展示的回答': 'No responses to display yet', '收起二维码': 'Hide QR code', '展开二维码': 'Show QR code' });
  Object.assign(en, { '下载词云 PNG': 'Download cloud PNG', '导出回答 CSV': 'Export responses CSV', '回答已导出': 'Responses exported', '暂无可导出的词云': 'No word cloud to export yet', '词云图片已生成': 'Word cloud image downloaded', '导出失败，请重试': 'Export failed. Please try again.' });
  Object.assign(en, { '每个问题固定开放 3 小时，到期后仅可查看和导出词云。': 'Each question stays open for 3 hours. After that, the cloud is view-only and can still be exported.', '问题可以使用多久？': 'How long does a session stay open?', '每个问题自创建起固定开放 3 小时，无法延长。到期后停止接收回答并关闭实时连接；原链接仍可查看词云和导出已有结果，扫码回答链接会跳转到词云展示页。': 'Every session closes 3 hours after creation and cannot be extended. New responses stop and live connections close. Existing links still show the word cloud and allow exports. Participation links redirect to the display page.', '正在收集回答': 'Collecting responses', '每个问题开放 3 小时': 'Open for 3 hours', '剩余 {time}': '{time} remaining', '讨论已结束': 'Session ended', '仅供查看': 'View only', '讨论已结束，只能查看词云': 'This session has ended. You can only view the word cloud.' });
  Object.assign(en, { '本次讨论暂无关键词': 'No keywords in this session', '可以创建新问题，开始下一轮讨论。': 'Create a new question to start another session.' });
  let language = 'zh';
  try { if (localStorage.getItem('wordgarden-language') === 'en') language = 'en'; } catch {}
  const pageTitles = { home: 'WordGarden · 让想法生长', garden: '实时词云 · WordGarden', answer: '留下你的想法 · WordGarden' };
  const dynamic = new Map();
  const originalNodes = [];
  const attributes = [];
  const excluded = '#session-state, #session-countdown, #question-title, #word-list, #export-message, #message, #connection, #empty-title, #empty-description, #fullscreen, #toggle-join, script, textarea, input';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest(excluded) && Object.hasOwn(en, node.textContent.trim())) originalNodes.push([node, node.textContent]);
  }
  for (const element of document.querySelectorAll('[placeholder], [aria-label]')) {
    for (const attribute of ['placeholder', 'aria-label']) {
      const value = element.getAttribute(attribute);
      if (value && Object.hasOwn(en, value)) attributes.push([element, attribute, value]);
    }
  }
  function t(key, values = {}) {
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), language === 'en' ? (en[key] || key) : key);
  }
  function setText(id, key, values) {
    dynamic.set(id, [key, values]);
    const element = document.getElementById(id);
    if (element) element.textContent = t(key, values);
  }
  function setUserText(id, value) {
    dynamic.delete(id);
    document.getElementById(id).textContent = value;
  }
  function setLanguage(next, persist = true) {
    language = next === 'en' ? 'en' : 'zh';
    if (persist) { try { localStorage.setItem('wordgarden-language', language); } catch {} }
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.title = t(pageTitles[document.body.dataset.page]);
    for (const [node, source] of originalNodes) node.textContent = source.replace(source.trim(), t(source.trim()));
    for (const [element, attribute, source] of attributes) element.setAttribute(attribute, t(source));
    for (const [id, [key, values]] of dynamic) setText(id, key, values);
    const button = document.getElementById('language-toggle');
    button.textContent = language === 'en' ? '中文' : 'EN';
    button.lang = language === 'en' ? 'zh-CN' : 'en';
    button.setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : '切换为英文');
    window.dispatchEvent(new Event('wordgarden:languagechange'));
  }
  for (const id of ['session-state', 'session-countdown', 'question-title', 'connection', 'empty-title', 'empty-description', 'fullscreen', 'toggle-join']) {
    const element = document.getElementById(id);
    if (element) dynamic.set(id, [element.textContent]);
  }
  document.getElementById('language-toggle').addEventListener('click', () => setLanguage(language === 'zh' ? 'en' : 'zh'));
  window.addEventListener('storage', event => { if (event.key === 'wordgarden-language') setLanguage(event.newValue, false); });
  window.I18n = { t, setText, setUserText, setLanguage };
  setLanguage(language, false);
})();
