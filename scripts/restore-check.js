const path = require('node:path');
const fs = require('node:fs');
const Database = require('../backend/node_modules/better-sqlite3');

try {
  if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node scripts/restore-check.js backup.sqlite new-restore.sqlite');
  const source = path.resolve(process.argv[2]); const target = path.resolve(process.argv[3]);
  if (source === target || fs.existsSync(target)) throw new Error('Restore target must be a new file.');
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  const restored = new Database(target, { readonly:true, fileMustExist:true });
  try {
    if (restored.pragma('integrity_check', { simple:true }) !== 'ok') throw new Error('Restore integrity check failed.');
    const rooms = restored.prepare('SELECT count(*) AS total FROM rooms').get().total;
    console.log(`Restore verified at ${target}; ${rooms} rooms. The running database was not changed.`);
  } finally { restored.close(); }
} catch (error) { console.error(error.message); process.exitCode = 1; }
