'use strict';
// Stable positions and deterministic colors, drawn off-screen to avoid blank frames.
((root) => {
  const palette = ['#2563eb', '#7c3aed', '#c026d3', '#db2777', '#dc2626', '#b45309', '#15803d', '#0f766e', '#0369a1'];
  const hash = text => { let value = 0; for (const char of text) value = (value * 31 + char.codePointAt(0)) | 0; return value >>> 0; };
  const overlaps = (a, b) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;
  function layout(words, width, height, measure, previous = []) {
    if (width < 32 || height < 32 || !words.length) return [];
    const visible = words.slice(0, 80), peak = Math.max(...visible.map(word => word.count));
    const byText = new Map(visible.map(word => [word.text, word]));
    const existing = previous.filter(word => byText.has(word.text));
    const existingTexts = new Set(existing.map(word => word.text));
    const ordered = [...existing.map(old => ({ ...byText.get(old.text), old })), ...visible.filter(word => !existingTexts.has(word.text))];
    const placed = [];
    for (const word of ordered) {
      let fontSize = Math.max(15, Math.min(width / 9, 72) * Math.sqrt(word.count / peak));
      const anchor = word.old ? { x: word.old.x / word.old.canvasWidth * width, y: word.old.y / word.old.canvasHeight * height } : { x: width / 2, y: height / 2 };
      let found;
      while (fontSize >= 10 && !found) {
        const box = { width: measure(word.text, fontSize) + 10, height: fontSize * 1.3 + 6 };
        if (box.width <= width - 20 && box.height <= height - 20) {
          for (let index = 0; index < 1800; index++) {
            const radius = index ? Math.sqrt(index / 1799) * Math.hypot(width, height) / 2 : 0;
            const angle = index * 2.39996323 + hash(word.text) % 628 / 100;
            const candidate = { ...box, x: anchor.x + radius * Math.cos(angle), y: anchor.y + radius * Math.sin(angle) };
            if (candidate.x - box.width / 2 < 10 || candidate.x + box.width / 2 > width - 10 || candidate.y - box.height / 2 < 10 || candidate.y + box.height / 2 > height - 10) continue;
            if (placed.every(other => !overlaps(candidate, other))) { found = candidate; break; }
          }
        }
        if (!found) fontSize -= 2;
      }
      if (found) placed.push({ ...found, text: word.text, count: word.count, fontSize, color: palette[hash(word.text) % palette.length], canvasWidth: width, canvasHeight: height });
    }
    return placed;
  }
  function draw(canvas, words, previous) {
    const width = Math.floor(canvas.parentElement.clientWidth), height = Math.floor(canvas.parentElement.clientHeight);
    if (!width || !height) return previous || [];
    const ratio = Math.min(root.devicePixelRatio || 1, 2);
    const buffer = document.createElement('canvas'); buffer.width = Math.floor(width * ratio); buffer.height = Math.floor(height * ratio);
    const context = buffer.getContext('2d'); context.scale(ratio, ratio);
    const font = size => `500 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    const positioned = layout(words, width, height, (text, size) => { context.font = font(size); return context.measureText(text).width; }, previous);
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
    context.textAlign = 'center'; context.textBaseline = 'middle';
    for (const word of positioned) { context.font = font(word.fontSize); context.fillStyle = word.color; context.fillText(word.text, word.x, word.y); }
    canvas.width = buffer.width; canvas.height = buffer.height;
    canvas.getContext('2d').drawImage(buffer, 0, 0);
    return positioned;
  }
  const api = { layout, draw, overlaps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WordGardenCloud = api;
})(typeof window !== 'undefined' ? window : globalThis);
