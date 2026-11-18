/**
 * SQLite Database Connection and Schema Initialization for Shop With Me (Phase 5).
 * Uses better-sqlite3 with WAL mode, foreign keys, and automatic schema initialization.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const { logger } = require('../logger');

let db = null;
let currentDbPath = null;

/**
 * Resolve the SQLite database file path.
 * Can be overridden via DATABASE_PATH environment variable or custom parameter.
 * @param {string} [customPath]
 * @returns {string}
 */
function resolveDatabasePath(customPath) {
  const envPath = customPath || process.env.DATABASE_PATH;
  if (!envPath) {
    return path.resolve(__dirname, '../../data/shop-with-me.sqlite');
  }
  return path.isAbsolute(envPath)
    ? envPath
    : path.resolve(__dirname, '../../', envPath);
}

/**
 * Initialize SQLite database schema.
 * Creates normalized tables with foreign keys and cascade deletions.
 * @param {import('better-sqlite3').Database} database
 */
function initSchema(database) {
  database.exec(`
    -- 1. Rooms Table
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      creator_id TEXT,
      creator_token TEXT,
      creator_token_hash TEXT,
      final_product_id TEXT,
      code TEXT
    );

    -- 2. Room Products Table (max 8 per room enforced in application transaction)
    CREATE TABLE IF NOT EXISTS room_products (
      room_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      PRIMARY KEY (room_id, product_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    -- 3. Room Participants Table (scoped to room)
    CREATE TABLE IF NOT EXISTS participants (
      room_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      token_hash TEXT,
      PRIMARY KEY (room_id, id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    -- 4. Product Votes Table (1 vote per participant per product in room)
    CREATE TABLE IF NOT EXISTS votes (
      room_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      vote TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      PRIMARY KEY (room_id, product_id, participant_id),
      FOREIGN KEY (room_id, product_id) REFERENCES room_products(room_id, product_id) ON DELETE CASCADE,
      FOREIGN KEY (room_id, participant_id) REFERENCES participants(room_id, id) ON DELETE CASCADE
    );

    -- 5. Product Comments Table
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      participant_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (room_id, product_id) REFERENCES room_products(room_id, product_id) ON DELETE CASCADE,
      FOREIGN KEY (room_id, participant_id) REFERENCES participants(room_id, id) ON DELETE CASCADE
    );

    -- 6. Room-wide live chat messages (separate from product comments)
    CREATE TABLE IF NOT EXISTS room_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      participant_name TEXT NOT NULL,
      product_id TEXT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id, participant_id) REFERENCES participants(room_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS message_reactions (
      room_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      emoji TEXT NOT NULL CHECK(emoji IN ('❤️', '👍', '😂')),
      PRIMARY KEY(message_id, participant_id, emoji),
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY(message_id) REFERENCES room_messages(id) ON DELETE CASCADE,
      FOREIGN KEY(room_id, participant_id) REFERENCES participants(room_id, id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_message_reactions_room ON message_reactions(room_id, message_id);
    CREATE INDEX IF NOT EXISTS idx_room_messages_room_created ON room_messages(room_id, created_at, id);

    -- Attachments Table
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      message_id TEXT,
      participant_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id, participant_id) REFERENCES participants(room_id, id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_attachments_room ON attachments(room_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);

    CREATE TABLE IF NOT EXISTS expired_rooms (
      id TEXT PRIMARY KEY,
      expired_at TEXT NOT NULL
    );

    -- 7. Custom Products Table (for URL/screenshot-added products)
    CREATE TABLE IF NOT EXISTS custom_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Custom',
      price REAL,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      source TEXT DEFAULT 'manual',
      source_url TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_room_products_room ON room_products(room_id);
    CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
    CREATE INDEX IF NOT EXISTS idx_participants_room_id ON participants(room_id, id);
    CREATE INDEX IF NOT EXISTS idx_votes_room_product ON votes(room_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_votes_covering ON votes(room_id, product_id, participant_id, vote);
    CREATE INDEX IF NOT EXISTS idx_comments_room_product ON comments(room_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_comments_room_product_created ON comments(room_id, product_id, created_at, id);
  `);

  migrateSchema(database);
  database.exec('CREATE INDEX IF NOT EXISTS idx_rooms_expires_at ON rooms(expires_at)');
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code) WHERE code IS NOT NULL');
}

/**
 * Safe, backward-compatible migration for existing SQLite databases.
 * Adds missing columns if they do not exist.
 * @param {import('better-sqlite3').Database} database
 */
function migrateSchema(database) {
  try {
    const columns = database.prepare('PRAGMA table_info(rooms)').all();
    const columnNames = new Set(columns.map((c) => c.name));

    if (!columnNames.has('creator_id')) {
      database.exec('ALTER TABLE rooms ADD COLUMN creator_id TEXT');
    }
    if (!columnNames.has('creator_token')) {
      database.exec('ALTER TABLE rooms ADD COLUMN creator_token TEXT');
    }
    if (!columnNames.has('creator_token_hash')) database.exec('ALTER TABLE rooms ADD COLUMN creator_token_hash TEXT');
    if (!columnNames.has('final_product_id')) {
      database.exec('ALTER TABLE rooms ADD COLUMN final_product_id TEXT');
    }
    if (!columnNames.has('expires_at')) database.exec('ALTER TABLE rooms ADD COLUMN expires_at TEXT');
    if (!columnNames.has('code')) {
      database.exec('ALTER TABLE rooms ADD COLUMN code TEXT');
      database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code) WHERE code IS NOT NULL');
    }
    const participantColumns = new Set(database.prepare('PRAGMA table_info(participants)').all().map((column) => column.name));
    if (!participantColumns.has('token_hash')) database.exec('ALTER TABLE participants ADD COLUMN token_hash TEXT');
    const oldCreatorTokens = database.prepare('SELECT id, creator_token AS token FROM rooms WHERE creator_token IS NOT NULL AND creator_token_hash IS NULL').all();
    const storeCreatorHash = database.prepare('UPDATE rooms SET creator_token_hash = ?, creator_token = NULL WHERE id = ?');
    for (const row of oldCreatorTokens) {
      storeCreatorHash.run(crypto.createHash('sha256').update(row.token, 'utf8').digest('hex'), row.id);
    }
    const voteColumns = new Set(database.prepare('PRAGMA table_info(votes)').all().map((column) => column.name));
    if (!voteColumns.has('created_at')) database.exec('ALTER TABLE votes ADD COLUMN created_at TEXT');
    if (!voteColumns.has('updated_at')) database.exec('ALTER TABLE votes ADD COLUMN updated_at TEXT');
    database.exec(`UPDATE votes SET created_at = COALESCE(created_at, (SELECT created_at FROM rooms WHERE rooms.id = votes.room_id), CURRENT_TIMESTAMP),
      updated_at = COALESCE(updated_at, created_at, (SELECT created_at FROM rooms WHERE rooms.id = votes.room_id), CURRENT_TIMESTAMP)`);
    const commentColumns = new Set(database.prepare('PRAGMA table_info(comments)').all().map((column) => column.name));
    if (!commentColumns.has('updated_at')) database.exec('ALTER TABLE comments ADD COLUMN updated_at TEXT');
    database.exec('UPDATE comments SET updated_at = COALESCE(updated_at, created_at)');
    const messageColumns = new Set(database.prepare('PRAGMA table_info(room_messages)').all().map((column) => column.name));
    if (messageColumns.size && !messageColumns.has('product_id')) {
      database.exec('ALTER TABLE room_messages ADD COLUMN product_id TEXT');
    }
  } catch (err) {
    logger.error({ err }, 'Database migration failed');
    throw err;
  }
}

/**
 * Initialize and configure SQLite database.
 * @param {string} [customPath]
 * @returns {import('better-sqlite3').Database}
 */
function initDb(customPath) {
  const dbPath = resolveDatabasePath(customPath);

  // If already initialized with the same path and open, return existing
  if (db && currentDbPath === dbPath && db.open) {
    return db;
  }

  // Close previous connection if path changed
  if (db && db.open) {
    db.close();
  }

  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Open database connection
  db = new Database(dbPath, {
    timeout: 5000,
  });

  currentDbPath = dbPath;

  // Configure Pragmas for data integrity and high performance
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  // Initialize schema
  initSchema(db);
  require('./authSchema')(db);
  require('./partySchema')(db);

  return db;
}

/**
 * Get active database instance (initializes if necessary).
 * @returns {import('better-sqlite3').Database}
 */
function getDb() {
  if (!db || !db.open) {
    return initDb();
  }
  return db;
}

/**
 * Close active database connection cleanly.
 */
function closeDb() {
  if (db && db.open) {
    db.close();
    db = null;
    currentDbPath = null;
  }
}

module.exports = {
  resolveDatabasePath,
  initDb,
  getDb,
  closeDb,
};
