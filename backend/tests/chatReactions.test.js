import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
const dbPath = path.resolve(__dirname, '../../data/test-reactions.sqlite');
process.env.DATABASE_PATH = dbPath;
const { initDb, closeDb } = require('../src/db/database');
const { saveRoom, addOrUpdateParticipant, addRoomMessage, clearRooms } = require('../src/store/roomStore');
const { toggleReaction, getReactions } = require('../src/services/chatReactions');
let room, person, message;
beforeEach(() => {
  initDb(dbPath); clearRooms();
  room = saveRoom({ id:'reaction-room', title:'Choose together' });
  person = addOrUpdateParticipant(room.id, { name:'Avery' }).participant;
  message = addRoomMessage(room.id, person.id, 'Love this one').message;
});
afterAll(() => { closeDb(); for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(dbPath + suffix); } catch {} } });
describe('persistent chat reactions', () => {
  it('toggles one reaction per person and persists across a database reopen', () => {
    expect(toggleReaction(room.id, person.id, message.id, '❤️').reactions['❤️']).toEqual([person.id]);
    closeDb(); initDb(dbPath);
    expect(getReactions(room.id, message.id)['❤️']).toEqual([person.id]);
    expect(toggleReaction(room.id, person.id, message.id, '❤️').reactions).toEqual({});
  });
  it('rejects cross-room messages, unknown participants and unsupported emoji', () => {
    const other = saveRoom({ id:'other-room', title:'Other room' });
    const guest = addOrUpdateParticipant(other.id, { name:'Blair' }).participant;
    expect(toggleReaction(other.id, guest.id, message.id, '❤️').ok).toBe(false);
    expect(toggleReaction(room.id, guest.id, message.id, '❤️').ok).toBe(false);
    expect(toggleReaction(room.id, person.id, message.id, '<script>').ok).toBe(false);
  });
  it('allows independent reactions from two friends and cascades on room deletion', () => {
    const other = addOrUpdateParticipant(room.id, { name:'Blair' }).participant;
    toggleReaction(room.id, person.id, message.id, '👍'); toggleReaction(room.id, other.id, message.id, '👍');
    expect(getReactions(room.id, message.id)['👍']).toHaveLength(2);
    clearRooms(); expect(getReactions(room.id, message.id)).toEqual({});
  });
});
