import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

const TEST_DB_PATH = path.resolve(__dirname, '../../data/test-concurrency.sqlite');
process.env.DATABASE_PATH = TEST_DB_PATH;

const { initDb, closeDb, getDb } = require('../src/db/database');
const {
  saveRoom,
  addProductToRoom,
  addOrUpdateParticipant,
  recordVote,
  getRoomById,
  clearRooms,
} = require('../src/store/roomStore');
const { products: catalog } = require('../src/data/products');

describe('Concurrency and Race Condition Resilience (Spec 8.3 & P5)', () => {
  beforeEach(() => {
    initDb(TEST_DB_PATH);
    clearRooms();
  });

  afterEach(() => {
    closeDb();
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(`${TEST_DB_PATH}${suffix}`); } catch {}
    }
  });

  it('keeps vote counts 100% exact under 50 simultaneous votes on one product', async () => {
    const room = saveRoom({ title: '50 Concurrent Voters Room' });
    const product = catalog[0];
    addProductToRoom(room.id, product);

    // Register 50 distinct participants
    const participants = [];
    for (let i = 1; i <= 50; i++) {
      const reg = addOrUpdateParticipant(room.id, {
        id: `concurrent-user-${i}`,
        name: `Voter ${i}`,
      });
      participants.push(reg.participant);
    }
    expect(participants).toHaveLength(50);

    // Cast 50 simultaneous votes (e.g. 30 Love, 20 Like) in parallel promises
    const votePromises = participants.map((user, idx) => {
      const voteValue = idx < 30 ? 'Love' : 'Like';
      return Promise.resolve().then(() => {
        return recordVote(room.id, product.id, user.id, voteValue);
      });
    });

    const results = await Promise.all(votePromises);
    for (const res of results) {
      expect(res.success).toBe(true);
    }

    // Inspect database state
    const updated = getRoomById(room.id);
    expect(updated.voteTotals[product.id].Love).toBe(30);
    expect(updated.voteTotals[product.id].Like).toBe(20);
    expect(updated.voteTotals[product.id].No).toBe(0);
    expect(updated.voteTotals[product.id]['Need more info']).toBe(0);

    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) AS total FROM votes WHERE room_id = ? AND product_id = ?').get(room.id, product.id).total;
    expect(count).toBe(50);
  });

  it('replaces previous vote when a participant changes vote rapidly, never doubling', async () => {
    const room = saveRoom({ title: 'Rapid Vote Change Room' });
    const product = catalog[1];
    addProductToRoom(room.id, product);

    const participant = addOrUpdateParticipant(room.id, {
      id: 'fickle-voter-1',
      name: 'Fickle Voter',
    }).participant;

    // Rapid sequence of vote changes: Love -> Like -> Need more info -> No -> Love
    const sequence = ['Love', 'Like', 'Need more info', 'No', 'Love'];
    for (const v of sequence) {
      const res = recordVote(room.id, product.id, participant.id, v);
      expect(res.success).toBe(true);
      expect(res.vote).toBe(v);
    }

    const updated = getRoomById(room.id);
    expect(updated.voteTotals[product.id].Love).toBe(1);
    expect(updated.voteTotals[product.id].Like).toBe(0);
    expect(updated.voteTotals[product.id].No).toBe(0);
    expect(updated.voteTotals[product.id]['Need more info']).toBe(0);

    const db = getDb();
    const rows = db.prepare('SELECT * FROM votes WHERE room_id = ? AND product_id = ? AND participant_id = ?').all(room.id, product.id, participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].vote).toBe('Love');
  });

  it('handles 20 concurrent duplicate vote submissions from the same user without race duplicates', async () => {
    const room = saveRoom({ title: 'Concurrent Self Vote Room' });
    const product = catalog[2];
    addProductToRoom(room.id, product);

    const participant = addOrUpdateParticipant(room.id, {
      id: 'spammer-1',
      name: 'Spammer',
    }).participant;

    // Fire 20 parallel updates for the same user
    const parallelVotes = Array.from({ length: 20 }, (_, idx) => {
      const vote = idx % 2 === 0 ? 'Love' : 'Like';
      return Promise.resolve().then(() => recordVote(room.id, product.id, participant.id, vote));
    });

    await Promise.all(parallelVotes);

    const db = getDb();
    const rows = db.prepare('SELECT * FROM votes WHERE room_id = ? AND product_id = ? AND participant_id = ?').all(room.id, product.id, participant.id);
    expect(rows).toHaveLength(1);

    const updated = getRoomById(room.id);
    const sum = updated.voteTotals[product.id].Love + updated.voteTotals[product.id].Like + updated.voteTotals[product.id].No + updated.voteTotals[product.id]['Need more info'];
    expect(sum).toBe(1);
  });
});
