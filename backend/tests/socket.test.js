/**
 * Integration tests for Socket.IO Real-Time Synchronization (Phase 4).
 * Tests room subscription, rejection of unknown rooms, broadcasts for
 * products, participants, votes, comments, and cross-room event isolation.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { io as Client } from 'socket.io-client';

const TEST_DB_PATH = path.resolve(__dirname, '../../data/test-socket.sqlite');
process.env.DATABASE_PATH = TEST_DB_PATH;

const { initDb, closeDb } = require('../src/db/database.js');
initDb(TEST_DB_PATH);

const app = require('../src/server.js');
const { initSocket } = require('../src/socket.js');
const { clearRooms } = require('../src/store/roomStore.js');
const { products: catalogProducts } = require('../src/data/products.js');

let httpServer;
let port;
let clientSockets = [];
const hostTokens = new Map();

/**
 * Helper to create a connected test socket client.
 */
function createClientSocket() {
  const socket = Client(`http://localhost:${port}`, {
    transports: ['websocket'],
    autoConnect: true,
  });
  clientSockets.push(socket);
  return socket;
}

/**
 * Helper to make HTTP requests against the test server.
 */
const accountFixture=require('./legacyAccountFixture.cjs');
function makeHttpRequest(method, path, body, headers = {}) {
  if(method==='POST'&&path==='/api/rooms')headers={...accountFixture.headers(),...headers};
  const url = `http://localhost:${port}${path}`;
  const roomId = path.match(/^\/api\/rooms\/([^/]+)/)?.[1];
  if (roomId && ((method === 'POST' && /\/products$/.test(path)) || method === 'DELETE')) {
    headers = { 'X-Creator-Token':hostTokens.get(roomId), ...headers };
  }
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return fetch(url, options).then(async (res) => {
    const body = await res.json().catch(() => null);
    if(method==='POST'&&path==='/api/rooms')accountFixture.legacy(body?.room);
    if (path === '/api/rooms' && body?.creatorToken) hostTokens.set(body.room.id, body.creatorToken);
    return { status:res.status, body };
  });
}

async function createParticipant(roomId, name = 'Socket Guest') {
  const result = await makeHttpRequest('POST', `/api/rooms/${roomId}/participants`, { name });
  return result.body;
}

async function joinSocket(socket, roomId, participant) {
  if (!socket.connected) await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return new Promise((resolve, reject) => {
    socket.once('room:joined', resolve);
    socket.once('room:error', reject);
    socket.emit('room:join', {
      roomId,
      participantId: participant.participant.id,
      participantToken: participant.participantToken,
    });
  });
}

function participantAuth(participant) {
  return { 'X-Participant-Token': participant.participantToken };
}

describe('Socket.IO Real-Time Synchronization', () => {
  beforeEach(async () => {
    clearRooms();
    clientSockets = [];

    await new Promise((resolve) => {
      httpServer = http.createServer(app);
      initSocket(httpServer, {
        origin: '*',
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      });
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Close all connected sockets
    for (const socket of clientSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    // Close the HTTP server
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });

  it('allows a socket to join a valid existing room and receives room:joined', async () => {
    const roomRes = await makeHttpRequest('POST', '/api/rooms', { title: 'Socket Test Room' });
    const roomId = roomRes.body.room.id;
    const participant = await createParticipant(roomId);

    const socket = createClientSocket();
    const result = await joinSocket(socket, roomId, participant);
    expect(result.roomId).toBe(roomId);
  });

  it('rejects joining a nonexistent room and emits room:error', async () => {
    const socket = createClientSocket();

    const errorPromise = new Promise((resolve) => {
      socket.on('room:error', (data) => resolve(data));
    });

    socket.emit('room:join', { roomId: 'nonexistent-room-999' });

    const result = await errorPromise;
    expect(result.error).toContain('Room not found');
  });

  it('broadcasts a product-added delta without a full room snapshot', async () => {
    const roomRes = await makeHttpRequest('POST', '/api/rooms', { title: 'Product Room' });
    const roomId = roomRes.body.room.id;
    const participant = await createParticipant(roomId);

    const socketA = createClientSocket();
    const socketB = createClientSocket();

    await Promise.all([joinSocket(socketA, roomId, participant), joinSocket(socketB, roomId, participant)]);

    const productPromise = new Promise((resolve) => {
      socketB.on('product:added', (data) => resolve(data));
    });

    // REST mutation by Client A
    await makeHttpRequest('POST', `/api/rooms/${roomId}/products`, {
      productId: catalogProducts[0].id,
    });

    const productEvent = await productPromise;
    expect(productEvent.roomId).toBe(roomId);
    expect(productEvent.product.id).toBe(catalogProducts[0].id);
    expect(productEvent.room).toBeUndefined();
  });

  it('broadcasts product:removed when a product is removed', async () => {
    const roomRes = await makeHttpRequest('POST', '/api/rooms', { title: 'Removal Room' });
    const roomId = roomRes.body.room.id;
    const participant = await createParticipant(roomId);
    await makeHttpRequest('POST', `/api/rooms/${roomId}/products`, {
      productId: catalogProducts[0].id,
    });

    const socket = createClientSocket();
    await joinSocket(socket, roomId, participant);

    const removedPromise = new Promise((resolve) => {
      socket.on('product:removed', resolve);
    });

    await makeHttpRequest('DELETE', `/api/rooms/${roomId}/products/${catalogProducts[0].id}`, undefined, { 'X-Creator-Token': roomRes.body.creatorToken });

    const event = await removedPromise;
    expect(event.productId).toBe(catalogProducts[0].id);
    expect(event.room).toBeUndefined();
  });

  it('broadcasts participant:joined and participant:updated in real time', async () => {
    const roomRes = await makeHttpRequest('POST', '/api/rooms', { title: 'Participants Room' });
    const roomId = roomRes.body.room.id;
    const listener = await createParticipant(roomId);

    const socket = createClientSocket();
    await joinSocket(socket, roomId, listener);

    const joinedPromise = new Promise((resolve) => {
      socket.on('participant:joined', resolve);
    });

    // REST: Guest joins
    const joinRes = await makeHttpRequest('POST', `/api/rooms/${roomId}/participants`, {
      name: 'Samir',
    });
    const participantId = joinRes.body.participant.id;

    const joinEvent = await joinedPromise;
    expect(joinEvent.participant.name).toBe('Samir');

    const updatePromise = new Promise((resolve) => {
      socket.on('participant:updated', resolve);
    });

    // REST: Guest updates name
    await makeHttpRequest('PATCH', `/api/rooms/${roomId}/participants/${participantId}`, {
      name: 'Samir Verma',
    }, participantAuth(joinRes.body));

    const updateEvent = await updatePromise;
    expect(updateEvent.participant.name).toBe('Samir Verma');
  });

  it('broadcasts vote:updated when a vote is cast or changed', async () => {
    const roomRes = await makeHttpRequest('POST', '/api/rooms', { title: 'Voting Room' });
    const roomId = roomRes.body.room.id;
    await makeHttpRequest('POST', `/api/rooms/${roomId}/products`, {
      productId: catalogProducts[0].id,
    });
    const joinRes = await makeHttpRequest('POST', `/api/rooms/${roomId}/participants`, {
      name: 'Voter 1',
    });
    const participantId = joinRes.body.participant.id;

    const socket = createClientSocket();
    await joinSocket(socket, roomId, joinRes.body);

    const votePromise = new Promise((resolve) => {
      socket.on('vote:updated', resolve);
    });

    await makeHttpRequest('POST', `/api/rooms/${roomId}/products/${catalogProducts[0].id}/votes`, {
      participantId,
      vote: 'Love',
    }, participantAuth(joinRes.body));

    const voteEvent = await votePromise;
    expect(voteEvent.productId).toBe(catalogProducts[0].id);
    expect(voteEvent.vote).toBe('Love');
    expect(voteEvent.totals.Love).toBe(1);
  });

  it('broadcasts comment:added when a comment is posted', async () => {
    const roomRes = await makeHttpRequest('POST', '/api/rooms', { title: 'Comments Room' });
    const roomId = roomRes.body.room.id;
    await makeHttpRequest('POST', `/api/rooms/${roomId}/products`, {
      productId: catalogProducts[0].id,
    });
    const joinRes = await makeHttpRequest('POST', `/api/rooms/${roomId}/participants`, {
      name: 'Commenter',
    });
    const participantId = joinRes.body.participant.id;

    const socket = createClientSocket();
    await joinSocket(socket, roomId, joinRes.body);

    const commentPromise = new Promise((resolve) => {
      socket.on('comment:added', resolve);
    });

    await makeHttpRequest(
      'POST',
      `/api/rooms/${roomId}/products/${catalogProducts[0].id}/comments`,
      {
        participantId,
        text: 'Real-time comment test!',
      },
      participantAuth(joinRes.body)
    );

    const commentEvent = await commentPromise;
    expect(commentEvent.comment.text).toBe('Real-time comment test!');
    expect(commentEvent.comment.participantName).toBe('Commenter');
  });

  it('ensures room events are isolated and events from Room A do not reach Room B', async () => {
    const roomA = await makeHttpRequest('POST', '/api/rooms', { title: 'Room A' });
    const roomB = await makeHttpRequest('POST', '/api/rooms', { title: 'Room B' });
    const roomAId = roomA.body.room.id;
    const roomBId = roomB.body.room.id;
    const [participantA, participantB] = await Promise.all([
      createParticipant(roomAId, 'Room A Guest'),
      createParticipant(roomBId, 'Room B Guest'),
    ]);

    const socketA = createClientSocket();
    const socketB = createClientSocket();

    await Promise.all([joinSocket(socketA, roomAId, participantA), joinSocket(socketB, roomBId, participantB)]);

    let receivedBySocketB = false;
    socketB.on('product:added', () => {
      receivedBySocketB = true;
    });

    // Add product to Room A
    await makeHttpRequest('POST', `/api/rooms/${roomAId}/products`, {
      productId: catalogProducts[0].id,
    });

    // Wait a brief moment to ensure socketB didn't receive the event
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(receivedBySocketB).toBe(false);
  });

  it('broadcasts vote deltas and a separate decision summary', async () => {
    const roomRes = await makeHttpRequest('POST', '/api/rooms', { title: 'Summary Socket Room' });
    const roomId = roomRes.body.room.id;
    const prod = catalogProducts[0];

    await makeHttpRequest('POST', `/api/rooms/${roomId}/products`, {
      productId: prod.id,
    });
    const joinRes = await makeHttpRequest('POST', `/api/rooms/${roomId}/participants`, {
      name: 'Voter Live',
    });
    const participantId = joinRes.body.participant.id;

    const socket = createClientSocket();
    await joinSocket(socket, roomId, joinRes.body);

    const summaryPromise = new Promise((resolve) => {
      socket.on('summary:updated', resolve);
    });

    const votePromise = new Promise((resolve) => {
      socket.on('vote:updated', resolve);
    });

    await makeHttpRequest('POST', `/api/rooms/${roomId}/products/${prod.id}/votes`, {
      participantId,
      vote: 'Love',
    }, participantAuth(joinRes.body));

    const [summaryEvent, voteEvent] = await Promise.all([summaryPromise, votePromise]);

    expect(summaryEvent.roomId).toBe(roomId);
    expect(summaryEvent.summary.status).toBe('winner');
    expect(summaryEvent.summary.winner.product.id).toBe(prod.id);
    expect(summaryEvent.summary.winner.score).toBe(3);

    expect(voteEvent.productId).toBe(prod.id);
    expect(voteEvent.vote).toBe('Love');
    expect(voteEvent.room).toBeUndefined();
    expect(voteEvent.summary).toBeUndefined();
  });

  it('safely handles invalid or missing join payloads without server crashes', async () => {
    const socket = createClientSocket();

    const errorPromise = new Promise((resolve) => {
      socket.on('room:error', resolve);
    });

    socket.emit('room:join', null);
    const err1 = await errorPromise;
    expect(err1.error).toBe('Room ID is required to join.');

    const errorPromise2 = new Promise((resolve) => {
      socket.on('room:error', resolve);
    });

    socket.emit('room:join', {});
    const err2 = await errorPromise2;
    expect(err2.error).toBe('Room ID is required to join.');
  });

  it('broadcasts decision:made and summary:updated without full room snapshots', async () => {
    const createRes = await makeHttpRequest('POST', '/api/rooms', { title: 'Socket Final Choice Room' });
    const roomId = createRes.body.room.id;
    const token = createRes.body.creatorToken;
    const p1 = catalogProducts[0];

    await makeHttpRequest('POST', `/api/rooms/${roomId}/products`, { productId: p1.id });

    // Client 1 joins the room
    const client1 = createClientSocket();
    await joinSocket(client1, roomId, await createParticipant(roomId, 'Creator Observer'));

    // Listen for events on client 1
    const decisionMadePromise = new Promise((resolve) => {
      client1.on('decision:made', resolve);
    });
    const summaryUpdatedPromise = new Promise((resolve) => {
      client1.on('summary:updated', resolve);
    });

    // Creator sets final choice via REST
    const putRes = await makeHttpRequest(
      'PUT',
      `/api/rooms/${roomId}/final-choice`,
      { productId: p1.id },
      { Authorization: `Bearer ${token}` }
    );
    expect(putRes.status).toBe(200);

    // Verify all 3 real-time events were received
    const [decisionPayload, summaryPayload] = await Promise.all([
      decisionMadePromise,
      summaryUpdatedPromise,
    ]);

    expect(decisionPayload.roomId).toBe(roomId);
    expect(decisionPayload.finalProductId).toBe(p1.id);
    expect(decisionPayload.finalProduct.id).toBe(p1.id);
    expect(decisionPayload.summary).toBeUndefined();
    expect(decisionPayload.room).toBeUndefined();

    expect(summaryPayload.roomId).toBe(roomId);
    expect(summaryPayload.summary.finalChoice.product.id).toBe(p1.id);
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
