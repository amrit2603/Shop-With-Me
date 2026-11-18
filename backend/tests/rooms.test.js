/**
 * Backend API tests for Phase 1, Phase 2, and Phase 3.
 *
 * Tests:
 * - Phase 1: Room creation, retrieval, validation, health check.
 * - Phase 2: Product catalog, adding products, 8-product limit, removing products.
 * - Phase 3: Participants (join, update name), Voting (Love, Like, No, Need more info, totals,
 *            replacement, validation), Comments (posting, character limits, chronological order,
 *            non-room product rejection, unjoined rejection), Product removal data cleanup,
 *            and cross-room data isolation.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.resolve(__dirname, '../../data/test-rooms.sqlite');
process.env.DATABASE_PATH = TEST_DB_PATH;

const { initDb, closeDb } = require('../src/db/database.js');
initDb(TEST_DB_PATH);

const app = require('../src/server.js');
const { clearRooms } = require('../src/store/roomStore.js');
const { products: catalogProducts } = require('../src/data/products.js');
const testTokens = new Map();
const accountFixture=require('./legacyAccountFixture.cjs');

/**
 * Helper: make an HTTP request to the Express app.
 */
function request(app) {
  let server;

  function makeRequest(method, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
      server = createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        const url = `http://localhost:${port}${path}`;
        const suppliedHeaders = { ...(method==='POST' && path==='/api/rooms'?accountFixture.headers():{}), ...headers };
        const roomId = path.match(/^\/api\/rooms\/([^/?]+)/)?.[1];
        const participantId = body?.participantId || path.match(/^\/api\/rooms\/[^/]+\/participants\/([^/?]+)/)?.[1];
        const hasHeader = (name) => Object.keys(suppliedHeaders).some((key) => key.toLowerCase() === name.toLowerCase());
        if (roomId && participantId && !hasHeader('x-participant-token')) {
          const token = testTokens.get(`${roomId}:${participantId}`);
          if (token) suppliedHeaders['X-Participant-Token'] = token;
        }
        if (roomId && (method === 'DELETE' || (method === 'POST' && /\/products(?:\/(?:custom|from-screenshot))?$/.test(path))) && !hasHeader('x-creator-token')) {
          const token = testTokens.get(`${roomId}:creator`);
          if (token) suppliedHeaders['X-Creator-Token'] = token;
        }
        const options = {
          method,
          headers: { 'Content-Type': 'application/json', ...suppliedHeaders },
        };

        if (body !== undefined) {
          options.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        fetch(url, options)
          .then(async (res) => {
            const json = await res.json().catch(() => null);
            if(method==='POST' && path==='/api/rooms')accountFixture.legacy(json?.room);
            if (method === 'POST' && path === '/api/rooms' && json?.room?.id && json.creatorToken) {
              testTokens.set(`${json.room.id}:creator`, json.creatorToken);
            }
            if (method === 'POST' && /\/participants$/.test(path) && roomId && json?.participant?.id && json.participantToken) {
              testTokens.set(`${roomId}:${json.participant.id}`, json.participantToken);
            }
            const body = json?.error && typeof json.error === 'object'
              ? { ...json, error: json.error.message, errorDetail: json.error }
              : json;
            resolve({ status: res.status, body });
          })
          .catch(reject)
          .finally(() => server.close());
      });
    });
  }

  return {
    get: (path, headers) => makeRequest('GET', path, undefined, headers),
    post: (path, body, headers) => makeRequest('POST', path, body, headers),
    patch: (path, body, headers) => makeRequest('PATCH', path, body, headers),
    put: (path, body, headers) => makeRequest('PUT', path, body, headers),
    delete: (path, headers) => makeRequest('DELETE', path, undefined, headers),
  };
}

describe('Health endpoint', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('Product Catalog — GET /api/products', () => {
  it('returns a catalog containing at least 10 products', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.products).toBeDefined();
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThanOrEqual(10);
  });

  it('each product contains required fields (id, name, category, price, description, imageUrl)', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    for (const prod of res.body.products) {
      expect(prod.id).toBeTypeOf('string');
      expect(prod.name).toBeTypeOf('string');
      expect(prod.category).toBeTypeOf('string');
      expect(prod.price).toBeTypeOf('number');
      expect(prod.price).toBeGreaterThan(0);
      expect(prod.description).toBeTypeOf('string');
      expect(prod.imageUrl).toBeTypeOf('string');
    }
  });
});

describe('Room creation & retrieval — Phase 1 & 2', () => {
  beforeEach(() => {
    clearRooms();
  });

  it('creates a room with valid title, empty products and participants', async () => {
    const res = await request(app).post('/api/rooms', { title: 'Weekend Shopping' });
    expect(res.status).toBe(201);
    expect(res.body.room).toBeDefined();
    expect(res.body.room.id).toBeDefined();
    expect(res.body.room.title).toBe('Weekend Shopping');
    expect(res.body.room.products).toEqual([]);
    expect(res.body.room.participants).toEqual([]);
    expect(res.body.shareableUrl).toContain(`/room/${res.body.room.id}`);
  });

  it('rejects invalid titles', async () => {
    const resEmpty = await request(app).post('/api/rooms', { title: '   ' });
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error).toContain("Give your room a name so friends know what you're deciding");

    const resTooLong = await request(app).post('/api/rooms', { title: 'A'.repeat(101) });
    expect(resTooLong.status).toBe(400);
  });

  it('R2: enforces mandatory room name validation rules', async () => {
    const expectedError = "Give your room a name so friends know what you're deciding";

    // 1. Empty string
    const rEmpty = await request(app).post('/api/rooms', { title: '' });
    expect(rEmpty.status).toBe(400);
    expect(rEmpty.body.error).toBe(expectedError);

    // 2. Spaces only
    const rSpaces = await request(app).post('/api/rooms', { title: '     ' });
    expect(rSpaces.status).toBe(400);
    expect(rSpaces.body.error).toBe(expectedError);

    // 3. Exactly 2 chars
    const r2chars = await request(app).post('/api/rooms', { title: 'ab' });
    expect(r2chars.status).toBe(400);
    expect(r2chars.body.error).toBe(expectedError);

    // 4. Exactly 61 chars
    const r61chars = await request(app).post('/api/rooms', { title: 'a'.repeat(61) });
    expect(r61chars.status).toBe(400);
    expect(r61chars.body.error).toBe(expectedError);

    // 5. Punctuation only
    const rPunct = await request(app).post('/api/rooms', { title: '???!!!...' });
    expect(rPunct.status).toBe(400);
    expect(rPunct.body.error).toBe(expectedError);

    // 6. Emoji only
    const rEmoji = await request(app).post('/api/rooms', { title: '🎉🎁✨' });
    expect(rEmoji.status).toBe(400);
    expect(rEmoji.body.error).toBe(expectedError);

    // 7. Literal word "room"
    const rRoom = await request(app).post('/api/rooms', { title: 'room' });
    expect(rRoom.status).toBe(400);
    expect(rRoom.body.error).toBe(expectedError);

    const rRoomUpper = await request(app).post('/api/rooms', { title: '  ROOM  ' });
    expect(rRoomUpper.status).toBe(400);
    expect(rRoomUpper.body.error).toBe(expectedError);

    // 8. Profanity
    const rProfane = await request(app).post('/api/rooms', { title: 'Buy some shit' });
    expect(rProfane.status).toBe(400);
    expect(rProfane.body.error).toBe(expectedError);

    // 9. Valid Unicode: Hindi / Devanagari script
    const rHindi = await request(app).post('/api/rooms', { title: 'शादी का लहंगा' });
    expect(rHindi.status).toBe(201);
    expect(rHindi.body.room.title).toBe('शादी का लहंगा');

    // 10. Valid Unicode: Kannada script
    const rKannada = await request(app).post('/api/rooms', { title: 'ಮದುವೆ ಉಡುಪು' });
    expect(rKannada.status).toBe(201);
    expect(rKannada.body.room.title).toBe('ಮದುವೆ ಉಡುಪು');

    // 11. Collapse repeated spaces
    const rSpacesCollapsed = await request(app).post('/api/rooms', { title: 'Wedding   Outfit   Ideas' });
    expect(rSpacesCollapsed.status).toBe(201);
    expect(rSpacesCollapsed.body.room.title).toBe('Wedding Outfit Ideas');
  });

  it('R2: generates unambiguous 6-char room code and resolves lowercase/spaced/hyphenated join inputs', async () => {
    const { UNAMBIGUOUS_ALPHABET } = require('../src/services/roomCode');
    const res = await request(app).post('/api/rooms', { title: 'Weekend Outfits' });
    expect(res.status).toBe(201);

    const roomCode = res.body.roomCode;
    expect(roomCode).toBeDefined();
    expect(roomCode).toHaveLength(6);

    // Check all characters belong to the unambiguous alphabet
    for (const char of roomCode) {
      expect(UNAMBIGUOUS_ALPHABET).toContain(char);
    }
    // Verify unambiguous exclusions: no 0, O, 1, I, L, 5, S, 8, B
    const ambiguous = ['0', 'O', '1', 'I', 'L', '5', 'S', '8', 'B'];
    for (const amb of ambiguous) {
      expect(roomCode).not.toContain(amb);
    }

    // Join / retrieve with lowercase and spaces (e.g. "d79 pcv")
    const spacedLower = `${roomCode.slice(0, 3).toLowerCase()} ${roomCode.slice(3).toLowerCase()}`;
    const getSpaced = await request(app).get(`/api/rooms/${encodeURIComponent(spacedLower)}`);
    expect(getSpaced.status).toBe(200);
    expect(getSpaced.body.room.id).toBe(res.body.room.id);

    // Join / retrieve with hyphens (e.g. "d79-pcv")
    const hyphenLower = `${roomCode.slice(0, 3).toLowerCase()}-${roomCode.slice(3).toLowerCase()}`;
    const getHyphen = await request(app).get(`/api/rooms/${encodeURIComponent(hyphenLower)}`);
    expect(getHyphen.status).toBe(200);
    expect(getHyphen.body.room.id).toBe(res.body.room.id);
  });

  it('retrieves an existing room with serialized Phase 3 fields', async () => {
    const createRes = await request(app).post('/api/rooms', { title: 'Room A' });
    const roomId = createRes.body.room.id;

    const getRes = await request(app).get(`/api/rooms/${roomId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.room.id).toBe(roomId);
    expect(getRes.body.room.participants).toEqual([]);
    expect(getRes.body.room.votes).toBeDefined();
    expect(getRes.body.room.voteTotals).toBeDefined();
    expect(getRes.body.room.comments).toBeDefined();
  });

  it('returns 404 for nonexistent room', async () => {
    const res = await request(app).get('/api/rooms/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

describe('Product Addition, Removal & Limit — Phase 2', () => {
  let roomId;

  beforeEach(async () => {
    clearRooms();
    const createRes = await request(app).post('/api/rooms', { title: 'Product Room' });
    roomId = createRes.body.room.id;
  });

  it('adds product to room and rejects duplicates', async () => {
    const res = await request(app).post(`/api/rooms/${roomId}/products`, {
      productId: catalogProducts[0].id,
    });
    expect(res.status).toBe(200);
    expect(res.body.room.products).toHaveLength(1);

    const dupRes = await request(app).post(`/api/rooms/${roomId}/products`, {
      productId: catalogProducts[0].id,
    });
    expect(dupRes.status).toBe(400);
    expect(dupRes.body.error).toContain('already in this room');
  });

  it('enforces maximum 8 products limit', async () => {
    for (let i = 0; i < 8; i++) {
      const res = await request(app).post(`/api/rooms/${roomId}/products`, {
        productId: catalogProducts[i].id,
      });
      expect(res.status).toBe(200);
    }

    const ninth = await request(app).post(`/api/rooms/${roomId}/products`, {
      productId: catalogProducts[8].id,
    });
    expect(ninth.status).toBe(400);
    expect(ninth.body.error).toContain('maximum limit of 8 products');
  });
});

describe('Phase 3: Participants Management', () => {
  let roomId;

  beforeEach(async () => {
    clearRooms();
    const createRes = await request(app).post('/api/rooms', { title: 'Living Room Project' });
    roomId = createRes.body.room.id;
  });

  it('allows a guest to join a room with a valid display name', async () => {
    const res = await request(app).post(`/api/rooms/${roomId}/participants`, {
      name: 'Alice Johnson',
    });
    expect(res.status).toBe(201);
    expect(res.body.participant).toBeDefined();
    expect(res.body.participant.id).toBeDefined();
    expect(res.body.participant.name).toBe('Alice Johnson');
    expect(res.body.participant.joinedAt).toBeDefined();

    // Verify participant appears in room details
    const roomRes = await request(app).get(`/api/rooms/${roomId}`);
    expect(roomRes.body.room.participants).toHaveLength(1);
    expect(roomRes.body.room.participants[0].name).toBe('Alice Johnson');
  });

  it('allows joining with a client-provided stable participant ID', async () => {
    const clientId = 'guest-client-uuid-1234';
    const res = await request(app).post(`/api/rooms/${roomId}/participants`, {
      participantId: clientId,
      name: 'Bob',
    });
    expect(res.status).toBe(201);
    expect(res.body.participant.id).toBe(clientId);
    expect(res.body.participant.name).toBe('Bob');
  });

  it('rejects joining when display name is missing or whitespace', async () => {
    const res1 = await request(app).post(`/api/rooms/${roomId}/participants`, {});
    expect(res1.status).toBe(400);

    const res2 = await request(app).post(`/api/rooms/${roomId}/participants`, { name: '   ' });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toContain('cannot be empty');
  });

  it('rejects display name exceeding the new 24 character limit', async () => {
    const res = await request(app).post(`/api/rooms/${roomId}/participants`, {
      name: 'A'.repeat(25),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('2–24 characters');
  });

  it('allows updating display name via PATCH', async () => {
    const joinRes = await request(app).post(`/api/rooms/${roomId}/participants`, {
      name: 'Charlie',
    });
    const pId = joinRes.body.participant.id;

    const patchRes = await request(app).patch(`/api/rooms/${roomId}/participants/${pId}`, {
      name: 'Charlie Super',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.participant.name).toBe('Charlie Super');

    // Confirm updated name in room
    const roomRes = await request(app).get(`/api/rooms/${roomId}`);
    expect(roomRes.body.room.participants[0].name).toBe('Charlie Super');
  });

  it('returns 404 when updating non-existent participant', async () => {
    const res = await request(app).patch(`/api/rooms/${roomId}/participants/nonexistent-id`, {
      name: 'Nobody',
    });
    expect(res.status).toBe(404);
  });
});

describe('Phase 3: Product Voting', () => {
  let roomId;
  let participant1Id;
  let participant2Id;
  const prod1 = catalogProducts[0];
  const prod2 = catalogProducts[1];

  beforeEach(async () => {
    clearRooms();
    const createRes = await request(app).post('/api/rooms', { title: 'Voting Room' });
    roomId = createRes.body.room.id;

    // Add 2 products to room
    await request(app).post(`/api/rooms/${roomId}/products`, { productId: prod1.id });
    await request(app).post(`/api/rooms/${roomId}/products`, { productId: prod2.id });

    // Join two participants
    const p1 = await request(app).post(`/api/rooms/${roomId}/participants`, { name: 'User 1' });
    participant1Id = p1.body.participant.id;

    const p2 = await request(app).post(`/api/rooms/${roomId}/participants`, { name: 'User 2' });
    participant2Id = p2.body.participant.id;
  });

  it('casts each of the four valid votes (Love, Like, No, Need more info)', async () => {
    const votes = ['Love', 'Like', 'No', 'Need more info'];

    for (const voteOption of votes) {
      const res = await request(app).post(`/api/rooms/${roomId}/products/${prod1.id}/votes`, {
        participantId: participant1Id,
        vote: voteOption,
      });
      expect(res.status).toBe(200);
      expect(res.body.vote).toBe(voteOption);
      expect(res.body.totals[voteOption]).toBe(1);
    }
  });

  it('changing a vote replaces the previous vote for that product without duplicating', async () => {
    // Vote Love
    await request(app).post(`/api/rooms/${roomId}/products/${prod1.id}/votes`, {
      participantId: participant1Id,
      vote: 'Love',
    });

    // Change to Like
    const res = await request(app).post(`/api/rooms/${roomId}/products/${prod1.id}/votes`, {
      participantId: participant1Id,
      vote: 'Like',
    });

    expect(res.status).toBe(200);
    expect(res.body.vote).toBe('Like');
    expect(res.body.totals.Love).toBe(0);
    expect(res.body.totals.Like).toBe(1);

    // Verify via GET room
    const roomRes = await request(app).get(`/api/rooms/${roomId}`);
    expect(roomRes.body.room.voteTotals[prod1.id].Love).toBe(0);
    expect(roomRes.body.room.voteTotals[prod1.id].Like).toBe(1);
  });

  it('allows different participants to vote independently', async () => {
    await request(app).post(`/api/rooms/${roomId}/products/${prod1.id}/votes`, {
      participantId: participant1Id,
      vote: 'Love',
    });
    await request(app).post(`/api/rooms/${roomId}/products/${prod1.id}/votes`, {
      participantId: participant2Id,
      vote: 'Love',
    });

    const roomRes = await request(app).get(`/api/rooms/${roomId}`);
    expect(roomRes.body.room.voteTotals[prod1.id].Love).toBe(2);
  });

  it('rejects votes for products not in the room', async () => {
    const unaddedProduct = catalogProducts[5];
    const res = await request(app).post(
      `/api/rooms/${roomId}/products/${unaddedProduct.id}/votes`,
      {
        participantId: participant1Id,
        vote: 'Love',
      }
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Product is not in this room');
  });

  it('rejects voting before joining the room', async () => {
    const res = await request(app).post(`/api/rooms/${roomId}/products/${prod1.id}/votes`, {
      participantId: 'unregistered-guest-id',
      vote: 'Love',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('You must join the room');
  });

  it('rejects invalid vote values', async () => {
    const res = await request(app).post(`/api/rooms/${roomId}/products/${prod1.id}/votes`, {
      participantId: participant1Id,
      vote: 'Maybe Later',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid vote');
  });
});

describe('Phase 3: Product Comments', () => {
  let roomId;
  let participantId;
  const prod = catalogProducts[0];

  beforeEach(async () => {
    clearRooms();
    const createRes = await request(app).post('/api/rooms', { title: 'Comments Room' });
    roomId = createRes.body.room.id;
    await request(app).post(`/api/rooms/${roomId}/products`, { productId: prod.id });

    const joinRes = await request(app).post(`/api/rooms/${roomId}/participants`, {
      name: 'Reviewer Dave',
    });
    participantId = joinRes.body.participant.id;
  });

  it('posts a valid comment and returns it in chronological order', async () => {
    const res1 = await request(app).post(`/api/rooms/${roomId}/products/${prod.id}/comments`, {
      participantId,
      text: 'First comment: Looks super comfortable!',
    });
    expect(res1.status).toBe(201);
    expect(res1.body.comment.text).toBe('First comment: Looks super comfortable!');
    expect(res1.body.comment.participantName).toBe('Reviewer Dave');

    const res2 = await request(app).post(`/api/rooms/${roomId}/products/${prod.id}/comments`, {
      participantId,
      text: 'Second comment: Does it come in black?',
    });
    expect(res2.status).toBe(201);
    expect(res2.body.comments).toBeUndefined();
    expect(res2.body.comment.text).toContain('Second comment');

    // Retrieve comments
    const listRes = await request(app).get(`/api/rooms/${roomId}/products/${prod.id}/comments`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.comments).toHaveLength(2);
    expect(listRes.body.comments[0].text).toContain('First comment');
    expect(listRes.body.comments[1].text).toContain('Second comment');
  });

  it('rejects empty comments and whitespace-only comments', async () => {
    const res = await request(app).post(`/api/rooms/${roomId}/products/${prod.id}/comments`, {
      participantId,
      text: '   ',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('cannot be empty');
  });

  it('rejects comments exceeding 500 characters', async () => {
    const longText = 'A'.repeat(501);
    const res = await request(app).post(`/api/rooms/${roomId}/products/${prod.id}/comments`, {
      participantId,
      text: longText,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('500 characters');
  });

  it('rejects commenting before joining the room', async () => {
    const res = await request(app).post(`/api/rooms/${roomId}/products/${prod.id}/comments`, {
      participantId: 'unregistered-guest',
      text: 'Nice product!',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('You must join the room');
  });

  it('rejects comments on products not in the room', async () => {
    const outsideProd = catalogProducts[5];
    const res = await request(app).post(
      `/api/rooms/${roomId}/products/${outsideProd.id}/comments`,
      {
        participantId,
        text: 'Not in room',
      }
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Product is not in this room');
  });
});

describe('Phase 3: Clean up on product removal & cross-room isolation', () => {
  beforeEach(() => {
    clearRooms();
  });

  it('removes product and clears its associated votes and comments so re-adding starts fresh', async () => {
    const createRes = await request(app).post('/api/rooms', { title: 'Cleanup Room' });
    const roomId = createRes.body.room.id;
    const prod = catalogProducts[0];

    // Add product
    await request(app).post(`/api/rooms/${roomId}/products`, { productId: prod.id });

    // Join user
    const joinRes = await request(app).post(`/api/rooms/${roomId}/participants`, { name: 'Dan' });
    const pId = joinRes.body.participant.id;

    // Vote and Comment
    await request(app).post(`/api/rooms/${roomId}/products/${prod.id}/votes`, {
      participantId: pId,
      vote: 'Love',
    });
    await request(app).post(`/api/rooms/${roomId}/products/${prod.id}/comments`, {
      participantId: pId,
      text: 'Love it so far!',
    });

    // Verify present
    const check1 = await request(app).get(`/api/rooms/${roomId}`);
    expect(check1.body.room.voteTotals[prod.id].Love).toBe(1);
    expect(check1.body.room.comments[prod.id]).toHaveLength(1);

    // Remove product
    const delRes = await request(app).delete(`/api/rooms/${roomId}/products/${prod.id}`);
    expect(delRes.status).toBe(200);

    // Add product back again
    await request(app).post(`/api/rooms/${roomId}/products`, { productId: prod.id });

    // Verify votes and comments for this product are completely cleared/fresh
    const check2 = await request(app).get(`/api/rooms/${roomId}`);
    expect(check2.body.room.voteTotals[prod.id].Love).toBe(0);
    expect(check2.body.room.comments[prod.id]).toEqual([]);
  });

  it('keeps participant, vote, and comment data completely isolated between rooms', async () => {
    const r1 = await request(app).post('/api/rooms', { title: 'Room 1' });
    const r2 = await request(app).post('/api/rooms', { title: 'Room 2' });
    const r1Id = r1.body.room.id;
    const r2Id = r2.body.room.id;

    const prod = catalogProducts[0];
    await request(app).post(`/api/rooms/${r1Id}/products`, { productId: prod.id });
    await request(app).post(`/api/rooms/${r2Id}/products`, { productId: prod.id });

    // User joins Room 1
    const joinRes = await request(app).post(`/api/rooms/${r1Id}/participants`, { name: 'Elena' });
    const pId = joinRes.body.participant.id;

    // User can vote in Room 1
    const voteRes = await request(app).post(`/api/rooms/${r1Id}/products/${prod.id}/votes`, {
      participantId: pId,
      vote: 'Love',
    });
    expect(voteRes.status).toBe(200);

    // User CANNOT vote in Room 2 without joining Room 2
    const failVote = await request(app).post(`/api/rooms/${r2Id}/products/${prod.id}/votes`, {
      participantId: pId,
      vote: 'Love',
    });
    expect(failVote.status).toBe(403);

    // Room 2 totals remain 0
    const room2Data = await request(app).get(`/api/rooms/${r2Id}`);
    expect(room2Data.body.room.voteTotals[prod.id].Love).toBe(0);
  });

  describe('Phase 6: Final Decision Summary Endpoint', () => {
    it('returns 404 when requesting summary for a non-existent room', async () => {
      const res = await request(app).get('/api/rooms/non-existent-room-id/summary');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('returns structured summary via GET /api/rooms/:roomId/summary', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Summary Test Room' });
      const roomId = createRes.body.room.id;
      const p1 = catalogProducts[0];
      const p2 = catalogProducts[1];

      await request(app).post(`/api/rooms/${roomId}/products`, { productId: p1.id });
      await request(app).post(`/api/rooms/${roomId}/products`, { productId: p2.id });

      const joinRes = await request(app).post(`/api/rooms/${roomId}/participants`, { name: 'Sarah' });
      const pId = joinRes.body.participant.id;

      await request(app).post(`/api/rooms/${roomId}/products/${p1.id}/votes`, {
        participantId: pId,
        vote: 'Love',
      });
      await request(app).post(`/api/rooms/${roomId}/products/${p2.id}/votes`, {
        participantId: pId,
        vote: 'Like',
      });

      // Fetch summary endpoint
      const summaryRes = await request(app).get(`/api/rooms/${roomId}/summary`);
      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.roomId).toBe(roomId);
      expect(summaryRes.body.roomTitle).toBe('Summary Test Room');
      expect(summaryRes.body.status).toBe('winner');
      expect(summaryRes.body.winner.product.id).toBe(p1.id);
      expect(summaryRes.body.winner.score).toBe(3);
      expect(summaryRes.body.rankings).toHaveLength(2);
      expect(summaryRes.body.algorithm).toBeDefined();

      // Check GET /api/rooms/:roomId also includes summary
      const getRoomRes = await request(app).get(`/api/rooms/${roomId}`);
      expect(getRoomRes.status).toBe(200);
      expect(getRoomRes.body.room).toBeDefined();
      expect(getRoomRes.body.summary).toBeDefined();
      expect(getRoomRes.body.summary.status).toBe('winner');
      expect(getRoomRes.body.summary.winner.product.id).toBe(p1.id);
    });
  });

  describe('Phase 7.1 Regression: Request body validation & malformed payload resilience', () => {
    it('returns 400 Bad Request when request body is completely missing or empty', async () => {
      const res = await request(app).post('/api/rooms', '');

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 Bad Request when request body has malformed JSON syntax', async () => {
      const res = await request(app).post('/api/rooms', '{"title": malformed');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Malformed JSON payload');
    });

    it('returns 400 Bad Request when adding product with missing request body', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Body Test Room' });
      const roomId = createRes.body.room.id;

      const res = await request(app).post(`/api/rooms/${roomId}/products`, '');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Valid productId is required.');
    });

    it('returns 400 Bad Request when posting vote with missing request body', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Vote Body Room' });
      const roomId = createRes.body.room.id;

      const res = await request(app).post(`/api/rooms/${roomId}/products/prod-1/votes`, '');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('participantId is required to vote.');
    });
  });

  describe('Phase B: Final Choice and Creator Authorization', () => {
    it('POST /api/rooms returns a secure creatorToken and creatorId only to creator', async () => {
      const res = await request(app).post('/api/rooms', { title: 'Creator Auth Room' });
      expect(res.status).toBe(201);
      expect(res.body.creatorToken).toBeDefined();
      expect(typeof res.body.creatorToken).toBe('string');
      expect(res.body.creatorToken.length).toBeGreaterThan(20);
      expect(res.body.creatorId).toBeDefined();

      // GET /api/rooms/:id must not leak creatorToken
      const getRes = await request(app).get(`/api/rooms/${res.body.room.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.room.creatorId).toBe(res.body.creatorId);
      expect(getRes.body.room.creatorToken).toBeUndefined();
    });

    it('PUT /api/rooms/:roomId/final-choice rejects requests missing creator authorization token with 401', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'No Auth Room' });
      const roomId = createRes.body.room.id;
      const p1 = catalogProducts[0];
      await request(app).post(`/api/rooms/${roomId}/products`, { productId: p1.id });

      const res = await request(app).put(`/api/rooms/${roomId}/final-choice`, { productId: p1.id });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/authorization token is required/i);
    });

    it('PUT /api/rooms/:roomId/final-choice rejects requests with invalid creator token with 403', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Wrong Token Room' });
      const roomId = createRes.body.room.id;
      const p1 = catalogProducts[0];
      await request(app).post(`/api/rooms/${roomId}/products`, { productId: p1.id });

      const res = await request(app).put(
        `/api/rooms/${roomId}/final-choice`,
        { productId: p1.id },
        { Authorization: 'Bearer wrong-fake-token' }
      );
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Only the verified room creator can make the final choice/i);
    });

    it('PUT /api/rooms/:roomId/final-choice returns 404 if room does not exist', async () => {
      const res = await request(app).put(
        '/api/rooms/non-existent-room-id/final-choice',
        { productId: catalogProducts[0].id },
        { Authorization: 'Bearer valid-token-structure' }
      );
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/room not found/i);
    });

    it('PUT /api/rooms/:roomId/final-choice returns 400 for missing or empty productId', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Bad Product ID Room' });
      const roomId = createRes.body.room.id;
      const token = createRes.body.creatorToken;

      const res = await request(app).put(
        `/api/rooms/${roomId}/final-choice`,
        { productId: '   ' },
        { Authorization: `Bearer ${token}` }
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Valid productId is required/i);
    });

    it('PUT /api/rooms/:roomId/final-choice rejects products that do not belong to the room with 400', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Product Not In Room' });
      const roomId = createRes.body.room.id;
      const token = createRes.body.creatorToken;
      const p1 = catalogProducts[0];
      const p2 = catalogProducts[1];

      // Add only p1
      await request(app).post(`/api/rooms/${roomId}/products`, { productId: p1.id });

      // Attempt to set p2 as final choice
      const res = await request(app).put(
        `/api/rooms/${roomId}/final-choice`,
        { productId: p2.id },
        { Authorization: `Bearer ${token}` }
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Selected product is not in this room/i);
    });

    it('PUT /api/rooms/:roomId/final-choice successfully records final choice and returns updated state', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Successful Final Choice Room' });
      const roomId = createRes.body.room.id;
      const token = createRes.body.creatorToken;
      const p1 = catalogProducts[0];

      await request(app).post(`/api/rooms/${roomId}/products`, { productId: p1.id });

      // Set final choice using Authorization header
      const res = await request(app).put(
        `/api/rooms/${roomId}/final-choice`,
        { productId: p1.id },
        { Authorization: `Bearer ${token}` }
      );

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Final choice saved successfully/i);
      expect(res.body.room.finalProductId).toBe(p1.id);
      expect(res.body.finalProduct.id).toBe(p1.id);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.finalChoice).toBeDefined();
      expect(res.body.summary.finalChoice.product.id).toBe(p1.id);

      // Verify retrieval returns finalProductId
      const getRes = await request(app).get(`/api/rooms/${roomId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.room.finalProductId).toBe(p1.id);
      expect(getRes.body.summary.finalChoice.product.id).toBe(p1.id);
    });

    it('PUT /api/rooms/:roomId/final-choice accepts creator token via x-creator-token header or body', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Alternative Token Passing Room' });
      const roomId = createRes.body.room.id;
      const token = createRes.body.creatorToken;
      const p1 = catalogProducts[0];
      await request(app).post(`/api/rooms/${roomId}/products`, { productId: p1.id });

      // 1. Via x-creator-token header
      const res1 = await request(app).put(
        `/api/rooms/${roomId}/final-choice`,
        { productId: p1.id },
        { 'x-creator-token': token }
      );
      expect(res1.status).toBe(200);

      // 2. Via body creatorToken
      const res2 = await request(app).put(`/api/rooms/${roomId}/final-choice`, {
        productId: p1.id,
        creatorToken: token,
      });
    });
  });

  describe('Feature 5: Custom Product Input Paths (URL, Screenshot, Manual Custom)', () => {
    it('POST /api/rooms/:roomId/products/custom adds custom product with manual details', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Custom Product Test Room' });
      const roomId = createRes.body.room.id;

      const res = await request(app).post(`/api/rooms/${roomId}/products/custom`, {
        name: 'Handmade Ceramic Vase',
        category: 'Home',
        price: 1499,
        description: 'Locally crafted stoneware vase with reactive glaze.',
        imageUrl: 'https://example.com/vase.jpg',
        source: 'manual',
      });

      expect(res.status).toBe(200);
      expect(res.body.product).toBeDefined();
      expect(res.body.product.name).toBe('Handmade Ceramic Vase');
      expect(res.body.product.price).toBe(1499);
      expect(res.body.product.category).toBe('Home');
      expect(res.body.room.products).toHaveLength(1);
      expect(res.body.room.products[0].name).toBe('Handmade Ceramic Vase');

      // Verify persistence on room reload
      const getRes = await request(app).get(`/api/rooms/${roomId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.room.products).toHaveLength(1);
      expect(getRes.body.room.products[0].name).toBe('Handmade Ceramic Vase');
    });

    it('POST /api/rooms/:roomId/products/from-url enforces SSRF protection against private IPs', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'SSRF Test Room' });
      const roomId = createRes.body.room.id;

      // Localhost attempt
      const resLocalhost = await request(app).post(`/api/rooms/${roomId}/products/from-url`, {
        url: 'http://localhost:3000/secret',
      });
      expect(resLocalhost.status).toBe(400);
      expect(resLocalhost.body.error).toMatch(/internal or private/i);

      // Private 192.168.x.x attempt
      const resPrivate = await request(app).post(`/api/rooms/${roomId}/products/from-url`, {
        url: 'http://192.168.1.1/admin',
      });
      expect(resPrivate.status).toBe(400);
      expect(resPrivate.body.error).toMatch(/internal or private/i);

      // File protocol attempt
      const resFile = await request(app).post(`/api/rooms/${roomId}/products/from-url`, {
        url: 'file:///etc/passwd',
      });
      expect(resFile.status).toBe(400);
      expect(resFile.body.error).toMatch(/HTTP and HTTPS/i);
    });

    it('POST /api/rooms/:roomId/products/from-screenshot validates image magic bytes and returns stub', async () => {
      const createRes = await request(app).post('/api/rooms', { title: 'Screenshot Test Room' });
      const roomId = createRes.body.room.id;

      // Valid 1x1 PNG transparent pixel in base64: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=
      const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

      const res = await request(app).post(`/api/rooms/${roomId}/products/from-screenshot`, {
        imageData: validPngBase64,
        fileName: 'test-product.png',
      });

      expect(res.status).toBe(200);
      expect(res.body.validated).toBe(true);
      expect(res.body.imageType).toBe('png');
      expect(res.body.product).toBeDefined();
      expect(res.body.product.source).toBe('screenshot');
      expect(res.body.product.imageUrl).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
      const storedFilename = new URL(res.body.product.imageUrl, 'http://localhost').pathname.split('/').pop();
      const storedImage = fs.readFileSync(path.resolve(__dirname, '../uploads', storedFilename));
      expect(storedImage[0]).toBe(0x89);
      expect(storedImage[1]).toBe(0x50);

      // Invalid non-image data
      const resInvalid = await request(app).post(`/api/rooms/${roomId}/products/from-screenshot`, {
        imageData: 'data:image/png;base64,SGVsbG8gV29ybGQ=', // "Hello World" is not an image
      });
      expect(resInvalid.status).toBe(400);
      fs.unlinkSync(path.resolve(__dirname, '../uploads', storedFilename));
      expect(resInvalid.body.error).toMatch(/valid image/i);
    });
  });

  afterAll(() => {
    closeDb();
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
});
