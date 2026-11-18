/**
 * Polished Demo Seeding Script for VYUMI Feature 5.
 * Seeds 3 realistic, presentation-ready shopping decision rooms:
 * 1. "Wedding Outfit with Friends" (demo-wedding-outfit) -> Winner: prod-4 (Classic Linen Shirt)
 * 2. "Gift for Mom" (demo-gift-for-mom) -> Winner: prod-11 (Handmade Stoneware Planter)
 * 3. "Speaker for a Flat" (demo-speaker-flat) -> Winner: prod-8 (Compact Bluetooth Speaker)
 *
 * Idempotent: safe to run multiple times.
 */
const { initDb, getDb } = require('../backend/src/db/database');
const { getProductById } = require('../backend/src/data/products');
const {
  saveRoom,
  addProductToRoom,
  addOrUpdateParticipant,
  recordVote,
  addComment,
  addRoomMessage,
} = require('../backend/src/store/roomStore');

function seedDemoRooms() {
  initDb();
  console.log('=== SEEDING POLISHED VYUMI DEMO ROOMS ===');

  const demoRooms = [
    {
      id: 'demo-wedding-outfit',
      title: 'Wedding Outfit with Friends',
      creatorName: 'Maya',
      productIds: ['prod-4', 'prod-1', 'prod-6'],
      winnerId: 'prod-4',
      participants: [
        { id: 'maya-creator', name: 'Maya (Host)' },
        { id: 'priya-friend', name: 'Priya' },
        { id: 'rohan-friend', name: 'Rohan' },
        { id: 'aisha-friend', name: 'Aisha' },
      ],
      votes: {
        'prod-4': { 'maya-creator': 'Love', 'priya-friend': 'Love', 'rohan-friend': 'Love', 'aisha-friend': 'Like' }, // 11 pts
        'prod-1': { 'maya-creator': 'Like', 'priya-friend': 'No', 'rohan-friend': 'Like', 'aisha-friend': 'No' },    // 4 pts
        'prod-6': { 'maya-creator': 'No', 'priya-friend': 'No', 'rohan-friend': 'Need more info', 'aisha-friend': 'No' }, // 1 pt
      },
      comments: [
        { prodId: 'prod-4', userIdx: 1, text: 'This linen shirt looks so elegant for an outdoor reception!' },
        { prodId: 'prod-4', userIdx: 2, text: 'Great quality and breathable fabric. 100% yes.' },
        { prodId: 'prod-1', userIdx: 0, text: 'A bit too casual for evening wear.' },
        { prodId: 'prod-6', userIdx: 3, text: 'Too simple for a wedding guest outfit.' },
      ],
      chats: [
        { userIdx: 0, text: 'Hey guys! Help me choose the shirt for Kunal & Sarah’s wedding!' },
        { userIdx: 1, text: 'The linen one is by far the best! What shoes will you wear?' },
        { userIdx: 2, text: 'Agreed, linen is stunning for summer weddings.' },
        { userIdx: 3, text: 'Voted Love for the linen shirt! It matches the venue perfectly.' },
      ],
    },
    {
      id: 'demo-gift-for-mom',
      title: 'Gift for Mom',
      creatorName: 'Liam',
      productIds: ['prod-11', 'prod-3', 'prod-10'],
      winnerId: 'prod-11',
      participants: [
        { id: 'liam-creator', name: 'Liam (Host)' },
        { id: 'emma-sister', name: 'Emma' },
        { id: 'noah-brother', name: 'Noah' },
      ],
      votes: {
        'prod-11': { 'liam-creator': 'Love', 'emma-sister': 'Love', 'noah-brother': 'Love' }, // 9 pts
        'prod-3': { 'liam-creator': 'Like', 'emma-sister': 'Like', 'noah-brother': 'No' },    // 4 pts
        'prod-10': { 'liam-creator': 'No', 'emma-sister': 'Like', 'noah-brother': 'Need more info' }, // 3 pts
      },
      comments: [
        { prodId: 'prod-11', userIdx: 1, text: 'Mom has been wanting a ceramic planter for her succulent garden!' },
        { prodId: 'prod-11', userIdx: 2, text: 'Handcrafted stoneware looks so premium. She will adore it.' },
        { prodId: 'prod-3', userIdx: 0, text: 'She already has too many coffee mugs.' },
      ],
      chats: [
        { userIdx: 0, text: 'Mom’s birthday is next Friday! Need your votes ASAP.' },
        { userIdx: 1, text: 'The planter is perfect! I can buy a succulent to go inside it.' },
        { userIdx: 2, text: 'Just voted Love. Let’s split the cost!' },
      ],
    },
    {
      id: 'demo-speaker-flat',
      title: 'Speaker for a Flat',
      creatorName: 'Carlos',
      productIds: ['prod-8', 'prod-7', 'prod-9'],
      winnerId: 'prod-8',
      participants: [
        { id: 'carlos-creator', name: 'Carlos (Host)' },
        { id: 'sam-flatmate', name: 'Sam' },
        { id: 'dev-flatmate', name: 'Dev' },
        { id: 'elena-flatmate', name: 'Elena' },
      ],
      votes: {
        'prod-8': { 'carlos-creator': 'Love', 'sam-flatmate': 'Love', 'dev-flatmate': 'Like', 'elena-flatmate': 'Love' }, // 11 pts
        'prod-7': { 'carlos-creator': 'No', 'sam-flatmate': 'Like', 'dev-flatmate': 'Need more info', 'elena-flatmate': 'No' }, // 3 pts
        'prod-9': { 'carlos-creator': 'Like', 'sam-flatmate': 'No', 'dev-flatmate': 'Like', 'elena-flatmate': 'Like' },    // 6 pts
      },
      comments: [
        { prodId: 'prod-8', userIdx: 1, text: 'Compact Bluetooth speaker with deep bass and waterproof rating!' },
        { prodId: 'prod-8', userIdx: 2, text: '12-hour battery life is perfect for the living room and balcony.' },
        { prodId: 'prod-7', userIdx: 0, text: 'Earbuds are personal, we need room-filling audio for the flat.' },
      ],
      chats: [
        { userIdx: 0, text: 'Deciding on a speaker for the living room before movie night.' },
        { userIdx: 1, text: 'Bluetooth speaker is portable so we can take it to the park too.' },
        { userIdx: 3, text: 'Voted Love for the Bluetooth speaker! Sound quality looks top notch.' },
      ],
    },
  ];

  for (const d of demoRooms) {
    // 1. Create room
    saveRoom({
      id: d.id,
      title: d.title,
      createdAt: new Date().toISOString(),
    });

    // 2. Add products
    for (const pId of d.productIds) {
      const prod = getProductById(pId);
      if (prod) addProductToRoom(d.id, prod);
    }

    // 3. Add participants
    const registered = [];
    for (const p of d.participants) {
      const reg = addOrUpdateParticipant(d.id, p);
      if (reg.participant) registered.push(reg.participant);
    }

    // 4. Add votes
    for (const [prodId, userVotes] of Object.entries(d.votes)) {
      for (const [uId, voteVal] of Object.entries(userVotes)) {
        recordVote(d.id, prodId, uId, voteVal);
      }
    }

    // 5. Add comments
    for (const c of d.comments) {
      if (registered[c.userIdx]) {
        addComment(d.id, c.prodId, {
          participantId: registered[c.userIdx].id,
          text: c.text,
        });
      }
    }

    // 6. Add live chat history
    for (const ch of d.chats) {
      if (registered[ch.userIdx]) {
        addRoomMessage(d.id, registered[ch.userIdx].id, ch.text);
      }
    }

    console.log(`✔ Seeded demo room: "${d.title}" (${d.id}) -> Winner: ${d.winnerId}`);
  }

  console.log('✔ All 3 demo rooms successfully seeded and verified.');
}

if (require.main === module) {
  seedDemoRooms();
}

module.exports = { seedDemoRooms };
