const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
async function main() {
  const source = process.env.DB_PATH || path.join(__dirname, '../data/data.db');
  const target = path.resolve(process.argv[2] || path.join(__dirname, '../data/backups'));
  fs.mkdirSync(target, { recursive: true });
  const name = path.join(target, `wordgarden-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  const db = new Database(source, { readonly: true });
  try { await db.backup(name); if (fs.existsSync(`${source}.salt`)) fs.copyFileSync(`${source}.salt`, `${name}.salt`); console.log(name); } finally { db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
