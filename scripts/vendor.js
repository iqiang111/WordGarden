const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../public/lib');
fs.mkdirSync(target, { recursive: true });
for (const [from, to] of [['wordcloud/src/wordcloud2.js', 'wordcloud2.js'], ['qrcodejs/qrcode.min.js', 'qrcode.min.js']]) {
  fs.copyFileSync(require.resolve(from), path.join(target, to));
}
