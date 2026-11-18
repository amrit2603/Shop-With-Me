/**
 * Database & Persistence Tests for Shop With Me (Phase 5).
 * Tests SQLite schema integrity, transactions, constraints,
 * and data survival across connection close and restart.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.resolve(__dirname, '../../data/test-persistence.sqlite');
process.env.DATABASE_PATH = TEST_DB_PATH;

const { initDb, closeDb, getDb } = require('../src/db/database.js');
const {
  saveRoom,
  getRoomById,
  roomExists,
  addProductToRoom,
  removeProductFromRoom,
  addOrUpdateParticipant,
  recordVote,
  addComment,
  clearRooms,
} = require('../src/store/roomStore.js');
const { products: catalogProducts } = require('../src/data/products.js');

describe('Phase 5: SQLite Database Persistence', () => {
  beforeEach(() => {
    initDb(TEST_DB_PATH);
    clearRooms();
  });

  afterAll(() => {
    closeDb();
    // Clean up test sqlite files
    for (const ext of ['', '-wal', '-shm']) {
      const file = `${TEST_DB_PATH}${ext}`;
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch {
          // ignore
        }
      }
    }
  });

  it('persists rooms, products, participants, votes, and comments across connection close and restart', () => {
    // 1. Create Room
    const createdRoom = saveRoom({
      title: 'Living Room Remodel',
    });
    const roomId = createdRoom.id;
    expect(roomId).toBeDefined();

    // 2. Add Products
    const prod1 = catalogProducts[0];
    const prod2 = catalogProducts[1];
    addProductToRoom(roomId, prod1);
    addProductToRoom(roomId, prod2);

    // 3. Register Participants
    const p1 = addOrUpdateParticipant(roomId, { name: 'Priya Sharma' });
    const p2 = addOrUpdateParticipant(roomId, { name: 'Vikram Rao' });
    const p1Id = p1.participant.id;
    const p2Id = p2.participant.id;

    // 4. Cast Votes
    recordVote(roomId, prod1.id, p1Id, 'Love');
    recordVote(roomId, prod1.id, p2Id, 'Love');
    recordVote(roomId, prod2.id, p1Id, 'Need more info');

    // 5. Post Comments
    addComment(roomId, prod1.id, {
      participantId: p1Id,
      text: 'Ergonomic lumbar support is crucial!',
    });
    addComment(roomId, prod1.id, {
      participantId: p2Id,
      text: 'Agreed, definitely voting Love.',
    });

    // 6. Simulate Server Restart / DB Connection Reopen
    closeDb();

    // Reopen database from disk
    initDb(TEST_DB_PATH);

    // 7. Retrieve room and verify full state is restored from SQLite
    const restored = getRoomById(roomId);
    expect(restored).toBeDefined();
    expect(restored.title).toBe('Living Room Remodel');

    // Products restored
    expect(restored.products).toHaveLength(2);
    expect(restored.products[0].id).toBe(prod1.id);
    expect(restored.products[1].id).toBe(prod2.id);

    // Participants restored
    expect(restored.participants).toHaveLength(2);
    expect(restored.participants.map((p) => p.name)).toContain('Priya Sharma');
    expect(restored.participants.map((p) => p.name)).toContain('Vikram Rao');

    // Votes & Totals recalculated correctly from persistent storage
    expect(restored.voteTotals[prod1.id].Love).toBe(2);
    expect(restored.voteTotals[prod2.id]['Need more info']).toBe(1);
    expect(restored.votes[prod1.id][p1Id]).toBe('Love');
    expect(restored.votes[prod1.id][p2Id]).toBe('Love');

    // Comments restored in chronological order
    expect(restored.comments[prod1.id]).toHaveLength(2);
    expect(restored.comments[prod1.id][0].text).toBe('Ergonomic lumbar support is crucial!');
    expect(restored.comments[prod1.id][0].participantName).toBe('Priya Sharma');
    expect(restored.comments[prod1.id][1].text).toBe('Agreed, definitely voting Love.');
  });

  it('enforces 8-product maximum limit within transaction', () => {
    const room = saveRoom({ title: 'Capacity Test' });

    for (let i = 0; i < 8; i++) {
      const res = addProductToRoom(room.id, catalogProducts[i]);
      expect(res.success).toBe(true);
    }

    const ninth = addProductToRoom(room.id, catalogProducts[8]);
    expect(ninth.success).toBe(false);
    expect(ninth.error).toContain('maximum limit of 8 products');

    const check = getRoomById(room.id);
    expect(check.products).toHaveLength(8);
  });

  it('cascades deletion of votes and comments when a product is removed', () => {
    const room = saveRoom({ title: 'Cascade Test' });
    const prod = catalogProducts[0];
    addProductToRoom(room.id, prod);

    const user = addOrUpdateParticipant(room.id, { name: 'User A' });
    recordVote(room.id, prod.id, user.participant.id, 'Love');
    addComment(room.id, prod.id, { participantId: user.participant.id, text: 'Sample comment' });

    // Verify present in SQLite
    const db = getDb();
    expect(db.prepare('SELECT COUNT(*) AS count FROM votes WHERE room_id = ?').get(room.id).count).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS count FROM comments WHERE room_id = ?').get(room.id).count).toBe(1);

    // Remove product
    removeProductFromRoom(room.id, prod.id);

    // Verify votes and comments for that product are completely removed from SQLite
    expect(db.prepare('SELECT COUNT(*) AS count FROM votes WHERE room_id = ?').get(room.id).count).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS count FROM comments WHERE room_id = ?').get(room.id).count).toBe(0);
  });

  it('updates existing vote on re-vote without creating duplicate records', () => {
    const room = saveRoom({ title: 'Revote Test' });
    const prod = catalogProducts[0];
    addProductToRoom(room.id, prod);
    const user = addOrUpdateParticipant(room.id, { name: 'User Vote' });
    const userId = user.participant.id;

    recordVote(room.id, prod.id, userId, 'Love');
    recordVote(room.id, prod.id, userId, 'No');

    const db = getDb();
    const rows = db.prepare('SELECT * FROM votes WHERE room_id = ? AND product_id = ? AND participant_id = ?').all(
      room.id,
      prod.id,
      userId
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].vote).toBe('No');
  });

  it('enforces room existence and rejects invalid room queries', () => {
    expect(roomExists('nonexistent-uuid')).toBe(false);
    expect(getRoomById('nonexistent-uuid')).toBeUndefined();
  });
});
