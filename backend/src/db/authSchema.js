// Additive, idempotent migration; legacy rooms remain readable.
module.exports = function migrateAuth(db) {
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL,last_login_at INTEGER);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
 CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
 for (const [table,column] of [['rooms','creator_user_id'],['participants','user_id']]) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT REFERENCES users(id)`);
 }
 db.exec(`CREATE TABLE IF NOT EXISTS account_room_tokens(room_id TEXT NOT NULL,participant_id TEXT NOT NULL,session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,FOREIGN KEY(room_id,participant_id) REFERENCES participants(room_id,id) ON DELETE CASCADE); CREATE INDEX IF NOT EXISTS account_room_tokens_member ON account_room_tokens(room_id,participant_id);`);
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS participants_account ON participants(room_id,user_id) WHERE user_id IS NOT NULL');
};
