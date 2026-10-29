const configuredTerms = require('./config/blocked-terms.json');

// Match before segmentation so blocked phrases cannot leak as smaller words.
function normalizeForModeration(text) {
  return text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\p{C}\p{S}\s]/gu, '');
}
const terms = configuredTerms.map(normalizeForModeration).filter(Boolean);
const cache = new Map();
function isBlocked(text) {
  if (cache.has(text)) return cache.get(text);
  const normalized = normalizeForModeration(text);
  const blocked = terms.some(term => normalized.includes(term));
  if (cache.size >= 2000) cache.delete(cache.keys().next().value);
  cache.set(text, blocked);
  return blocked;
}
module.exports = { isBlocked };
