module.exports = (db) =>
  db.exec(`
 CREATE TABLE IF NOT EXISTS party_state(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE, mode TEXT NOT NULL DEFAULT 'host' CHECK(mode IN ('host','explore')),host_participant_id TEXT NOT NULL,current_product_id TEXT NOT NULL,current_image_index INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'live' CHECK(status IN ('live','ended')),started_at TEXT NOT NULL,ended_at TEXT,share_id TEXT,host_muted INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS party_events(id INTEGER PRIMARY KEY AUTOINCREMENT,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,participant_id TEXT NOT NULL,type TEXT NOT NULL,product_id TEXT,payload_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS party_events_room_time ON party_events(room_id,id);
 CREATE TABLE IF NOT EXISTS party_suggestions(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,product_id TEXT NOT NULL,participant_id TEXT NOT NULL,note TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(room_id,product_id));
 CREATE TABLE IF NOT EXISTS party_results(share_id TEXT PRIMARY KEY,room_id TEXT NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,result_json TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,hide_names INTEGER NOT NULL DEFAULT 0);
`);
