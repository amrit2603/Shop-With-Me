/**
 * Synthetic Test Data Generator for Shop With Me (Spec 8.3).
 * Generates 100 synthetic rooms with 3-8 participants, mixed votes,
 * duplicate-vote attempts, ties, and feedback comments.
 * Idempotent: can be run repeatedly safely.
 */
const path = require('node:path');
const { initDb, getDb } = require('../backend/src/db/database');
const { products: catalog } = require('../backend/src/data/products');
const { saveRoom, addProductToRoom, addOrUpdateParticipant, recordVote, addComment, addRoomMessage } = require('../backend/src/store/roomStore');

const NAMES = [
  'Avery', 'Blair', 'Charlie', 'Devon', 'Elliot', 'Finley', 'Harper', 'Jordan',
  'Kai', 'Logan', 'Morgan', 'Peyton', 'Quinn', 'Reese', 'Rowan', 'Sam', 'Taylor'
];

const VOTE_OPTIONS = ['Love', 'Like', 'Need more info', 'No'];

const COMMENT_SNIPPETS = [
  'Love the color and high quality finish!',
  'Too expensive for my budget, looks fragile.',
  'Does this fit true to size? Is it comfortable?',
  'Super stylish and clean aesthetic, highly recommend!',
  'Looks decent but battery life could be an issue.',
  'Great value for money, perfect for our trip.',
  'Not really feeling this one, a bit bulky.'
];

function run() {
  initDb();
  console.log('--- Generating 100 Synthetic Test Rooms ---');

  for (let i = 1; i <= 100; i++) {
    const roomId = `synth-room-${String(i).padStart(3, '0')}`;
    const productCount = 2 + (i % 7); // 2 to 8 products
    const participantCount = 3 + (i % 6); // 3 to 8 participants

    // 1. Create or update room
    saveRoom({
      id: roomId,
      title: `Synthetic Decision Room #${i}`,
      createdAt: new Date(Date.now() - (100 - i) * 60000).toISOString(),
    });

    // 2. Add products
    const selectedProds = [];
    for (let p = 0; p < productCount; p++) {
      const prod = catalog[(i + p) % catalog.length];
      addProductToRoom(roomId, prod);
      selectedProds.push(prod);
    }

    // 3. Register participants
    const participants = [];
    for (let u = 0; u < participantCount; u++) {
      const pId = `synth-user-${i}-${u + 1}`;
      const name = `${NAMES[(i + u) % NAMES.length]} ${i}`;
      const reg = addOrUpdateParticipant(roomId, { id: pId, name });
      if (reg.participant) participants.push(reg.participant);
    }

    // 4. Record votes with intentional variations (ties, duplicates, unanimous)
    for (const prod of selectedProds) {
      for (let uIdx = 0; uIdx < participants.length; uIdx++) {
        const user = participants[uIdx];
        if (i % 10 === 0) {
          // Unanimous room
          recordVote(roomId, prod.id, user.id, 'Love');
        } else if (i % 7 === 0) {
          // Tie room: alternate Love and Like
          recordVote(roomId, prod.id, user.id, uIdx % 2 === 0 ? 'Love' : 'Like');
        } else {
          // Normal distribution
          const voteChoice = VOTE_OPTIONS[(i + uIdx + prod.name.length) % VOTE_OPTIONS.length];
          // Duplicate-vote attempt: cast initial vote then replace
          if (uIdx === 0 && i % 3 === 0) {
            recordVote(roomId, prod.id, user.id, 'No'); // Initial vote
            recordVote(roomId, prod.id, user.id, voteChoice); // Replaced vote (must not double)
          } else {
            recordVote(roomId, prod.id, user.id, voteChoice);
          }
        }
      }

      // 5. Add comments
      if (participants.length > 0) {
        const commenter = participants[prod.name.length % participants.length];
        const commentText = COMMENT_SNIPPETS[(i + prod.name.length) % COMMENT_SNIPPETS.length];
        addComment(roomId, prod.id, {
          participantId: commenter.id,
          text: commentText,
        });
      }
    }

    // 6. Add sample chat message
    if (participants.length > 1) {
      addRoomMessage(roomId, participants[0].id, `Hey everyone, check room #${i}!`);
    }
  }

  const db = getDb();
  const roomTotal = db.prepare("SELECT COUNT(*) AS c FROM rooms WHERE id LIKE 'synth-room-%'").get().c;
  const voteTotal = db.prepare("SELECT COUNT(*) AS c FROM votes WHERE room_id LIKE 'synth-room-%'").get().c;
  const commentTotal = db.prepare("SELECT COUNT(*) AS c FROM comments WHERE room_id LIKE 'synth-room-%'").get().c;

  console.log(`✔ Successfully generated ${roomTotal} synthetic rooms.`);
  console.log(`✔ Persisted ${voteTotal} total votes and ${commentTotal} comments.`);
}

if (require.main === module) {
  run();
}

module.exports = { run };
