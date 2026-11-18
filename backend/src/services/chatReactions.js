const { getDb } = require('../db/database');

function getReactions(roomId, messageId) {
  const result = {};
  for (const row of getDb().prepare('SELECT emoji, participant_id FROM message_reactions WHERE room_id = ? AND message_id = ?').all(roomId, messageId)) {
    (result[row.emoji] ||= []).push(row.participant_id);
  }
  return result;
}

function toggleReaction(roomId, participantId, messageId, emoji) {
  if (typeof messageId !== 'string' || !['❤️', '👍', '😂'].includes(emoji)) return { ok: false, error: 'Choose a supported reaction.' };
  const db = getDb();
  return db.transaction(() => {
    const room = db.prepare('SELECT expires_at FROM rooms WHERE id = ?').get(roomId);
    if (!room || (room.expires_at && Date.parse(room.expires_at) <= Date.now())) return { ok: false, error: 'This room is unavailable.' };
    if (!db.prepare('SELECT 1 FROM participants WHERE room_id = ? AND id = ?').get(roomId, participantId)) return { ok: false, error: 'Join this room first.' };
    if (!db.prepare('SELECT 1 FROM room_messages WHERE room_id = ? AND id = ?').get(roomId, messageId)) return { ok: false, error: 'Message not found in this room.' };
    const removed = db.prepare('DELETE FROM message_reactions WHERE room_id = ? AND message_id = ? AND participant_id = ? AND emoji = ?').run(roomId, messageId, participantId, emoji);
    if (!removed.changes) db.prepare('INSERT INTO message_reactions(room_id, message_id, participant_id, emoji) VALUES (?, ?, ?, ?)').run(roomId, messageId, participantId, emoji);
    return { ok: true, reactions: getReactions(roomId, messageId) };
  })();
}

module.exports = { getReactions, toggleReaction };
