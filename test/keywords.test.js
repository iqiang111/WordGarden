const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractKeywords, aggregateKeywords } = require('../keywords');
const { openDatabase } = require('../db');

test('中文句子分词、复合词、停用词过滤和单条回答内去重', () => {
  const words = extractKeywords('我觉得今天的课程很有趣，人工智能很有趣！');
  assert.deepEqual(new Set(words), new Set(['课程', '有趣', '人工智能']));
  assert.ok(extractKeywords('我喜欢人工智能，也喜欢编程').includes('编程'));
  assert.deepEqual(extractKeywords('AI ai Python python'), ['ai', 'python']);
  assert.deepEqual(extractKeywords('我 的 了 123 ！！！'), []);
  assert.deepEqual(new Set(extractKeywords('新的朋友，团队合作中的沟通非常重要')), new Set(['朋友', '团队', '合作', '沟通', '重要']));
});

test('跨句统计关键词，保留原始回答与独立的回答总数', () => {
  const store = openDatabase(':memory:');
  try {
    store.db.prepare('INSERT INTO gardens (id,question) VALUES (?,?)').run('sample', '收获？');
    store.submit('sample', '人工智能很有趣', 'ip1');
    store.submit('sample', '我喜欢人工智能，也喜欢编程', 'ip2');
    store.submit('sample', '人工智能很有趣', 'ip3');
    assert.equal(store.submit('sample', '人工智能很有趣', 'ip3'), false);
    const data = store.snapshot('sample');
    assert.equal(data.totalAnswers, 3);
    assert.equal(data.participants, 3);
    assert.equal(data.words.find(w => w.text === '人工智能').count, 3);
    assert.equal(data.words.find(w => w.text === '有趣').count, 2);
    assert.equal(data.words.find(w => w.text === '编程').count, 1);
    assert.equal(data.responses.find(w => w.text === '人工智能很有趣').count, 2);
    assert.ok(!data.words.some(w => w.text.includes('很')));
    assert.deepEqual(aggregateKeywords([{ text: '开心', count: 4 }]), [{ text: '开心', count: 4 }]);
  } finally { store.db.close(); }
});
