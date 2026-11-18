import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import path from 'node:path';
import Database from 'better-sqlite3';

const dbPath = path.resolve(__dirname, '../../data/test-expiry.sqlite');
process.env.DATABASE_PATH = dbPath;
const { initDb, getDb, closeDb } = require('../src/db/database.js');
const { hashToken } = require('../src/services/authTokens.js');
initDb(dbPath);
const app = require('../src/server.js');
const { initSocket } = require('../src/socket.js');
const { io: Client } = require('socket.io-client');
const {
  saveRoom, clearRooms, addProductToRoom, addOrUpdateParticipant,
  recordVote, addComment, addRoomMessage, cleanupExpiredRooms,
} = require('../src/store/roomStore.js');
const product = require('../src/data/products.js').products[0];

describe('room expiry and audit timestamps', () => {
  beforeEach(() => clearRooms());

  afterAll(() => {
    closeDb();
    for (const base of [dbPath, path.resolve(__dirname, '../../data/test-legacy-schema.sqlite')]) {
      for (const suffix of ['', '-wal', '-shm']) {
        try { require('node:fs').unlinkSync(`${base}${suffix}`); } catch { /* absent */ }
      }
    }
  });

  it('sets a configurable default TTL and returns 410 for an expired room', async () => {
    delete process.env.ROOM_TTL_HOURS;
    const defaultRoom = saveRoom({ title: 'Default TTL room' });
    expect(Date.parse(defaultRoom.expiresAt) - Date.parse(defaultRoom.createdAt)).toBe(168 * 60 * 60 * 1000);
    process.env.ROOM_TTL_HOURS = '48';
    const room = saveRoom({ title: 'TTL room' });
    expect(Date.parse(room.expiresAt) - Date.parse(room.createdAt)).toBe(48 * 60 * 60 * 1000);
    process.env.ROOM_TTL_HOURS = '168';

    const old = saveRoom({ title: 'Expired room', expiresAt: new Date(Date.now() - 1000).toISOString() });
    const server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/rooms/${old.id}`);
      expect(response.status).toBe(410);
      expect((await response.json()).error.message).toMatch(/expired/i);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('persists vote created/updated and comment created/updated timestamps', () => {
    const room = saveRoom({ title: 'Timestamp room' });
    addProductToRoom(room.id, product);
    const participant = addOrUpdateParticipant(room.id, { name: 'Sam' }).participant;
    recordVote(room.id, product.id, participant.id, 'Love');
    const first = getDb().prepare('SELECT created_at, updated_at FROM votes WHERE room_id = ?').get(room.id);
    expect(first.created_at).toBeTruthy();
    expect(first.updated_at).toBeTruthy();
    recordVote(room.id, product.id, participant.id, 'Like');
    const changed = getDb().prepare('SELECT vote, created_at, updated_at FROM votes WHERE room_id = ?').get(room.id);
    expect(changed.vote).toBe('Like');
    expect(changed.created_at).toBe(first.created_at);
    expect(Date.parse(changed.updated_at)).toBeGreaterThanOrEqual(Date.parse(changed.created_at));

    const result = addComment(room.id, product.id, { participantId: participant.id, text: 'A useful thought' });
    const stored = getDb().prepare('SELECT created_at, updated_at FROM comments WHERE id = ?').get(result.comment.id);
    expect(stored.created_at).toBeTruthy();
    expect(stored.updated_at).toBeTruthy();
    expect(result.comment.updatedAt).toBe(stored.updated_at);
  });

  it('filters profanity in names, product comments, and room chat without rejecting common words', () => {
    const room = saveRoom({ title: 'Language filter room' });
    addProductToRoom(room.id, product);
    expect(addOrUpdateParticipant(room.id, { name: 'b1tch' }).success).toBe(false);
    const scunthorpe = addOrUpdateParticipant(room.id, { name: 'Scunthorpe' });
    const classmate = addOrUpdateParticipant(room.id, { name: 'Class' });
    expect(scunthorpe.success).toBe(true);
    expect(classmate.success).toBe(true);
    expect(addComment(room.id, product.id, { participantId: classmate.participant.id, text: 'shiiiit' }).success).toBe(false);
    expect(addComment(room.id, product.id, { participantId: classmate.participant.id, text: 'class is useful' }).success).toBe(true);
    expect(addRoomMessage(room.id, classmate.participant.id, 'f.u.c.k')).toMatchObject({ success: false, status: 400 });
    expect(addRoomMessage(room.id, classmate.participant.id, 'Scunthorpe class trip').success).toBe(true);
  });

  it('deletes expired room data but keeps a tombstone so links continue to return 410', async () => {
    const room = saveRoom({ title: 'Cleanup me', expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(cleanupExpiredRooms()).toBe(1);
    expect(getDb().prepare('SELECT 1 FROM rooms WHERE id = ?').get(room.id)).toBeUndefined();
    expect(getDb().prepare('SELECT 1 FROM expired_rooms WHERE id = ?').get(room.id)).toBeTruthy();
    const server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/rooms/${room.id}`);
      expect(response.status).toBe(410);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('rejects socket joins to expired rooms with a stable error code', async () => {
    const room = saveRoom({ title: 'Expired socket room', expiresAt: new Date(Date.now() - 1000).toISOString() });
    const server = createServer(app);
    const socketServer = initSocket(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const socket = Client(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'] });
    try {
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
      const roomError = new Promise((resolve) => socket.once('room:error', resolve));
      socket.emit('room:join', { roomId: room.id });
      await expect(roomError).resolves.toMatchObject({ code: 'ROOM_EXPIRED' });
    } finally {
      socket.disconnect();
      await new Promise((resolve) => socketServer.close(resolve));
    }
  });

  it('upgrades an existing pre-timestamp database without losing records', () => {
    const legacyPath = path.resolve(__dirname, '../../data/test-legacy-schema.sqlite');
    const legacy = new Database(legacyPath);
    legacy.exec(`
      CREATE TABLE rooms (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, creator_id TEXT, creator_token TEXT, final_product_id TEXT);
      CREATE TABLE room_products (room_id TEXT, product_id TEXT, added_at TEXT, PRIMARY KEY (room_id, product_id));
      CREATE TABLE participants (room_id TEXT, id TEXT, name TEXT, joined_at TEXT, PRIMARY KEY (room_id, id));
      CREATE TABLE votes (room_id TEXT, product_id TEXT, participant_id TEXT, vote TEXT, PRIMARY KEY (room_id, product_id, participant_id));
      CREATE TABLE comments (id TEXT PRIMARY KEY, room_id TEXT, product_id TEXT, participant_id TEXT, participant_name TEXT, text TEXT, created_at TEXT);
      INSERT INTO rooms VALUES ('legacy-room', 'Old room', '2026-10-01T00:00:00.000Z', NULL, 'legacy-creator-token', NULL);
      INSERT INTO participants VALUES ('legacy-room', 'guest', 'Guest', '2026-10-01T00:00:00.000Z');
      INSERT INTO votes VALUES ('legacy-room', 'p', 'guest', 'Love');
      INSERT INTO comments VALUES ('legacy-comment', 'legacy-room', 'p', 'guest', 'Guest', 'Old note', '2026-10-01T00:00:00.000Z');
    `);
    legacy.close();

    initDb(legacyPath);
    const migrated = getDb();
    expect(migrated.prepare('SELECT vote, created_at, updated_at FROM votes WHERE room_id = ?').get('legacy-room')).toMatchObject({ vote: 'Love' });
    expect(migrated.prepare('SELECT created_at, updated_at FROM comments WHERE id = ?').get('legacy-comment')).toEqual({ created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' });
    expect(migrated.prepare('SELECT expires_at FROM rooms WHERE id = ?').get('legacy-room')).toBeDefined();
    expect(migrated.prepare('SELECT creator_token, creator_token_hash FROM rooms WHERE id = ?').get('legacy-room')).toEqual({
      creator_token: null,
      creator_token_hash: hashToken('legacy-creator-token').toString('hex'),
    });
    expect(migrated.prepare('SELECT token_hash FROM participants WHERE id = ?').get('guest')).toEqual({ token_hash: null });
  });
});
