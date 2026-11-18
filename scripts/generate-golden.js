const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'backend', 'tests', 'golden');
fs.mkdirSync(dir, { recursive: true });

const fixtures = [
  {
    id: 'room-01',
    title: 'Unanimous Love for Product A',
    items: [{ id: 'p1', name: 'Silk Dress' }, { id: 'p2', name: 'Cotton Shirt' }],
    votes: { p1: { u1: 'Love', u2: 'Love', u3: 'Love' }, p2: { u1: 'No', u2: 'No' } },
    comments: { p1: [{ text: 'Absolute perfection!' }], p2: [{ text: 'Too casual' }] },
    expected: { status: 'winner', winnerId: 'p1', feedbackCategory: 'positive' }
  },
  {
    id: 'room-02',
    title: 'Score tie broken by Love votes (A: 1 Love = 3 pts vs B: 1 Like + 1 Need more info = 3 pts)',
    items: [{ id: 'p1', name: 'Velvet Blazer' }, { id: 'p2', name: 'Wool Coat' }],
    votes: { p1: { u1: 'Love' }, p2: { u2: 'Like', u3: 'Need more info' } },
    comments: { p1: [{ text: 'Stunning luxury' }], p2: [{ text: 'A bit heavy' }] },
    expected: { status: 'winner', winnerId: 'p1', tieBreakReason: 'Love votes' }
  },
  {
    id: 'room-03',
    title: 'Score tie broken by Love votes (A: 1 Love + 1 Like = 5 pts, 2 votes vs B: 2 Like + 1 Need more info = 5 pts, 3 votes, 0 Love)',
    items: [{ id: 'p1', name: 'Gold Watch' }, { id: 'p2', name: 'Silver Ring' }],
    votes: { p1: { u1: 'Love', u2: 'Like' }, p2: { u1: 'Like', u2: 'Like', u3: 'Need more info' } },
    comments: { p1: [{ text: 'Timeless piece' }] },
    expected: { status: 'winner', winnerId: 'p1', tieBreakReason: 'Love votes' }
  },
  {
    id: 'room-04',
    title: 'Authentic 2-way unbreakable tie',
    items: [{ id: 'p1', name: 'Sneakers' }, { id: 'p2', name: 'Loafers' }],
    votes: { p1: { u1: 'Love', u2: 'Like' }, p2: { u3: 'Love', u4: 'Like' } },
    comments: { p1: [{ text: 'Comfy' }], p2: [{ text: 'Classy' }] },
    expected: { status: 'tie', tiedProductIds: ['p1', 'p2'] }
  },
  {
    id: 'room-05',
    title: 'Zero votes cast across items',
    items: [{ id: 'p1', name: 'Lamp' }, { id: 'p2', name: 'Rug' }],
    votes: { p1: {}, p2: {} },
    comments: {},
    expected: { status: 'insufficient_data', winnerId: null }
  },
  {
    id: 'room-06',
    title: 'All No votes (0 points each)',
    items: [{ id: 'p1', name: 'Stool' }, { id: 'p2', name: 'Desk' }],
    votes: { p1: { u1: 'No', u2: 'No' }, p2: { u1: 'No', u2: 'No' } },
    comments: { p1: [{ text: 'Poor quality' }], p2: [{ text: 'Overpriced' }] },
    expected: { status: 'tie', tiedProductIds: ['p1', 'p2'] }
  },
  {
    id: 'room-07',
    title: 'Volume likes outweigh fewer loves (A: 2 Love = 6 pts vs B: 4 Like = 8 pts)',
    items: [{ id: 'p1', name: 'Earrings' }, { id: 'p2', name: 'Necklace' }],
    votes: { p1: { u1: 'Love', u2: 'Love' }, p2: { u1: 'Like', u2: 'Like', u3: 'Like', u4: 'Like' } },
    comments: { p2: [{ text: 'Everyone likes it!' }] },
    expected: { status: 'winner', winnerId: 'p2' }
  },
  {
    id: 'room-08',
    title: 'Single vote decides the room',
    items: [{ id: 'p1', name: 'Backpack' }, { id: 'p2', name: 'Tote' }],
    votes: { p1: { u1: 'Like' }, p2: {} },
    comments: { p1: [{ text: 'Useful for travel' }] },
    expected: { status: 'winner', winnerId: 'p1' }
  },
  {
    id: 'room-09',
    title: 'Three-way authentic tie (1 Love each)',
    items: [{ id: 'p1', name: 'Hat' }, { id: 'p2', name: 'Scarf' }, { id: 'p3', name: 'Gloves' }],
    votes: { p1: { u1: 'Love' }, p2: { u2: 'Love' }, p3: { u3: 'Love' } },
    comments: {},
    expected: { status: 'tie', tiedProductIds: ['p1', 'p2', 'p3'] }
  },
  {
    id: 'room-10',
    title: 'Three-way tie broken by Love votes (A: 1 Love = 3 pts vs B: 1 Like + 1 Need = 3 pts vs C: 3 Need = 3 pts)',
    items: [{ id: 'p1', name: 'Cup' }, { id: 'p2', name: 'Plate' }, { id: 'p3', name: 'Bowl' }],
    votes: { p1: { u1: 'Love' }, p2: { u1: 'Like', u2: 'Need more info' }, p3: { u1: 'Need more info', u2: 'Need more info', u3: 'Need more info' } },
    comments: {},
    expected: { status: 'winner', winnerId: 'p1', tieBreakReason: 'Love votes' }
  },
  {
    id: 'room-11',
    title: 'High concern feedback category',
    items: [{ id: 'p1', name: 'Headphones' }],
    votes: { p1: { u1: 'Like', u2: 'No' } },
    comments: { p1: [{ text: 'Too expensive and looks fragile. Bad battery.' }] },
    expected: { status: 'winner', winnerId: 'p1', feedbackCategory: 'concerns' }
  },
  {
    id: 'room-12',
    title: 'High question feedback category',
    items: [{ id: 'p1', name: 'Jacket' }],
    votes: { p1: { u1: 'Need more info', u2: 'Like' } },
    comments: { p1: [{ text: 'Does this fit true to size? Is it waterproof?' }] },
    expected: { status: 'winner', winnerId: 'p1', feedbackCategory: 'questions' }
  },
  {
    id: 'room-13',
    title: 'Positive highlights feedback category',
    items: [{ id: 'p1', name: 'Leather Boots' }],
    votes: { p1: { u1: 'Love', u2: 'Love' } },
    comments: { p1: [{ text: 'Great quality, beautiful color, super comfortable!' }] },
    expected: { status: 'winner', winnerId: 'p1', feedbackCategory: 'highlights' }
  },
  {
    id: 'room-14',
    title: 'Single participant room with Love vote',
    items: [{ id: 'p1', name: 'Watch' }],
    votes: { p1: { u1: 'Love' } },
    comments: { p1: [{ text: 'I really love this one.' }] },
    expected: { status: 'winner', winnerId: 'p1' }
  },
  {
    id: 'room-15',
    title: 'Tie with identical score and Love votes broken by total vote count (A: 3 Like = 6 pts, 3 votes vs B: 2 Like + 2 Need = 6 pts, 4 votes)',
    items: [{ id: 'p1', name: 'Item 1' }, { id: 'p2', name: 'Item 2' }],
    votes: {
      p1: { u1: 'Like', u2: 'Like', u3: 'Like' },
      p2: { u1: 'Like', u2: 'Like', u3: 'Need more info', u4: 'Need more info' }
    },
    comments: {},
    expected: { status: 'winner', winnerId: 'p2', tieBreakReason: 'total votes' }
  },
  {
    id: 'room-16',
    title: 'Clear winner with 5 participants',
    items: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }, { id: 'p3', name: 'C' }],
    votes: {
      p1: { u1: 'Love', u2: 'Love', u3: 'Love', u4: 'Like', u5: 'Love' },
      p2: { u1: 'No', u2: 'No', u3: 'Like' },
      p3: { u1: 'Need more info' }
    },
    comments: { p1: [{ text: 'Clear winner for all of us!' }] },
    expected: { status: 'winner', winnerId: 'p1' }
  },
  {
    id: 'room-17',
    title: 'Only Need more info votes cast',
    items: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }],
    votes: { p1: { u1: 'Need more info', u2: 'Need more info' }, p2: { u1: 'Need more info' } },
    comments: {},
    expected: { status: 'winner', winnerId: 'p1' }
  },
  {
    id: 'room-18',
    title: 'Max capacity 8 products with one distinct winner',
    items: [
      { id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }, { id: 'p3', name: 'P3' }, { id: 'p4', name: 'P4' },
      { id: 'p5', name: 'P5' }, { id: 'p6', name: 'P6' }, { id: 'p7', name: 'P7' }, { id: 'p8', name: 'P8' }
    ],
    votes: {
      p1: { u1: 'Love', u2: 'Love', u3: 'Love' },
      p2: { u1: 'Like' }, p3: { u1: 'Like' }, p4: { u1: 'No' },
      p5: { u1: 'No' }, p6: { u1: 'No' }, p7: { u1: 'Need more info' }, p8: {}
    },
    comments: { p1: [{ text: 'Best of all 8 options' }] },
    expected: { status: 'winner', winnerId: 'p1' }
  },
  {
    id: 'room-19',
    title: 'Two products both have 1 Like, 0 Love, 1 vote -> Authentic tie',
    items: [{ id: 'p1', name: 'Item X' }, { id: 'p2', name: 'Item Y' }],
    votes: { p1: { u1: 'Like' }, p2: { u2: 'Like' } },
    comments: {},
    expected: { status: 'tie', tiedProductIds: ['p1', 'p2'] }
  },
  {
    id: 'room-20',
    title: 'Tie-break between 2 items with same score (3 pts each), where one has Love and one has only No and Like',
    items: [{ id: 'p1', name: 'Chair' }, { id: 'p2', name: 'Bench' }],
    votes: { p1: { u1: 'Love' }, p2: { u1: 'Like', u2: 'Need more info', u3: 'No' } },
    comments: { p1: [{ text: 'Comfortable' }] },
    expected: { status: 'winner', winnerId: 'p1', tieBreakReason: 'Love votes' }
  },
  {
    id: 'room-21',
    title: 'Mixed feedback with highlights and questions',
    items: [{ id: 'p1', name: 'Table' }],
    votes: { p1: { u1: 'Love', u2: 'Need more info' } },
    comments: { p1: [{ text: 'Love the solid oak finish! Does it require assembly?' }] },
    expected: { status: 'winner', winnerId: 'p1', feedbackCategory: 'mixed' }
  },
  {
    id: 'room-22',
    title: 'Room with profanity masked comments preserving valid consensus',
    items: [{ id: 'p1', name: 'Sofa' }, { id: 'p2', name: 'Futon' }],
    votes: { p1: { u1: 'Love', u2: 'Like' }, p2: { u1: 'No' } },
    comments: { p1: [{ text: 'Really awesome design and comfy' }] },
    expected: { status: 'winner', winnerId: 'p1' }
  }
];

fixtures.forEach((f) => {
  fs.writeFileSync(path.join(dir, f.id + '.json'), JSON.stringify(f, null, 2));
});
console.log('Successfully generated ' + fixtures.length + ' golden fixtures.');
