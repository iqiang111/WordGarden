const { Segment, useDefault, POSTAG } = require('segmentit');

const segmenter = useDefault(new Segment());
// Remove grammatical words while keeping topics, actions and emotions.
const ignoredPOS = POSTAG.D_C | POSTAG.D_D | POSTAG.D_P | POSTAG.D_R |
  POSTAG.D_U | POSTAG.D_W | POSTAG.D_Y | POSTAG.A_M | POSTAG.A_Q | POSTAG.D_MQ;
const stopwords = new Set(`的 了 着 过 是 在 有 和 与 及 或 而 但 也 都 就 很 更 最 太 又 还
  我 你 您 他 她 它 我们 你们 他们 这个 那个 这些 那些 什么 怎么 为什么
  觉得 感觉 认为 今天 这次 现在 一个 一种 一些 一点 比较 非常 特别 十分
  可以 能够 可能 应该 需要 希望 让 把 被 从 对 于 向 通过 因为 所以 如果
  然后 但是 而且 不过 以及 还有 更多 一起 自己 已经 正在 进行 方面
  中 中的 新 新的 带来 学会 增加 帮助 获得 感到 认识 充满`.split(/\s+/));

function extractKeywords(text) {
  const normalized = text.normalize('NFKC').toLowerCase();
  const words = segmenter.doSegment(normalized)
    .filter(token => !(token.p & ignoredPOS))
    .map(token => {
      let word = token.w.trim();
      // The dictionary optimizer can merge degree words with adjectives.
      // Normalize those phrases without splitting technical nouns.
      if (!token.p || (token.p & POSTAG.D_A)) {
        word = word.replace(/^(?:非常|十分|特别|比较|最|很|更|太)(?=.{2})/u, '')
          .replace(/的$/u, '');
      }
      return word;
    })
    .filter(word => word && !stopwords.has(word) && /[\p{L}]/u.test(word));
  // Each accepted response contributes at most one vote for each keyword.
  return [...new Set(words)];
}

function aggregateKeywords(responses, extract = extractKeywords) {
  const counts = new Map();
  for (const response of responses) {
    for (const word of extract(response.text)) counts.set(word, (counts.get(word) || 0) + response.count);
  }
  return [...counts].map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'zh-CN'));
}

module.exports = { extractKeywords, aggregateKeywords };
