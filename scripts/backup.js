const path = require('node:path');
const fs = require('node:fs');
const Database = require('../backend/node_modules/better-sqlite3');

async function main() {
  const source = path.resolve(process.argv[2] || 'backend/data/shop-with-me.sqlite');
  const target = path.resolve(process.argv[3] || `backend/backups/shop-with-me-${Date.now()}.sqlite`);
  if (source === target || fs.existsSync(target)) throw new Error('Choose a new backup path; existing files are never overwritten.');
  fs.mkdirSync(path.dirname(target), { recursive:true });
  const db = new Database(source, { readonly:true, fileMustExist:true });
  try { await db.backup(target); }
  finally { db.close(); }
  const copy = new Database(target, { readonly:true, fileMustExist:true });
  try {
    if (copy.pragma('integrity_check', { simple:true }) !== 'ok') throw new Error('Backup integrity check failed.');
    console.log(`Verified SQLite backup: ${target}`);
  } finally { copy.close(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
