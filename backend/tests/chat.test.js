import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import path from 'node:path';
import { io as Client } from 'socket.io-client';
import fs from 'node:fs';

const dbPath = path.resolve(__dirname, '../../data/test-chat.sqlite');
process.env.DATABASE_PATH = dbPath;
const { initDb, closeDb } = require('../src/db/database.js');
initDb(dbPath);
const app = require('../src/server.js');
const { initSocket } = require('../src/socket.js');
const { clearRooms, saveRoom, addOrUpdateParticipant } = require('../src/store/roomStore.js');

let server;
let socketServer;
let base;
let clients;
let roomA;
let roomB;
let peopleA;
let personB;

async function join(socket, room, participant) {
  const joined = new Promise((resolve) => socket.once('room:joined', resolve));
  socket.emit('room:join', { roomId: room.id, participantId: participant.id, participantToken: participant.participantToken });
  await expect(joined).resolves.toMatchObject({ roomId: room.id });
}

function send(socket, text, extras = {}) {
  return new Promise((resolve) => socket.emit('chat:send', { text, ...extras }, resolve));
}

async function connect() {
  const socket = Client(base, { transports: ['websocket'], timeout: 3000 });
  clients.push(socket);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

describe('persistent room chat', () => {
  beforeEach(async () => {
    clearRooms();
    clients = [];
    roomA = saveRoom({ title: 'Chat room A' });
    roomB = saveRoom({ title: 'Chat room B' });
    peopleA = ['Avery', 'Blair', 'Casey'].map((name) => {
      const result = addOrUpdateParticipant(roomA.id, { name });
      return { ...result.participant, participantToken: result.participantToken };
    });
    const other = addOrUpdateParticipant(roomB.id, { name: 'Drew' });
    personB = { ...other.participant, participantToken: other.participantToken };
    server = createServer(app);
    socketServer = initSocket(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    for (const socket of clients) socket.disconnect();
    if (socketServer) await new Promise((resolve) => socketServer.close(resolve));
  });

  it('delivers ordered messages from A to B and C, never to a client in another room', async () => {
    const [a, b, c, other] = await Promise.all([connect(), connect(), connect(), connect()]);
    await Promise.all([join(a, roomA, peopleA[0]), join(b, roomA, peopleA[1]), join(c, roomA, peopleA[2]), join(other, roomB, personB)]);
    const receivedB = [];
    const receivedC = [];
    const leaked = vi.fn();
    b.on('chat:message', (event) => receivedB.push(event.message.text));
    c.on('chat:message', (event) => receivedC.push(event.message.text));
    other.on('chat:message', leaked);

    expect((await send(a, 'first')).ok).toBe(true);
    expect((await send(a, 'second')).ok).toBe(true);
    await vi.waitFor(() => expect(receivedB).toEqual(['first', 'second']));
    expect(receivedC).toEqual(['first', 'second']);
    expect(leaked).not.toHaveBeenCalled();
  });

  it('persists messages and returns a cursor page in server order after reconnect', async () => {
    const a = await connect();
    await join(a, roomA, peopleA[0]);
    await send(a, 'one');
    await send(a, 'two');
    await send(a, 'three');
    a.disconnect();

    const auth = { 'X-Participant-Token': peopleA[0].participantToken };
    const response = await fetch(`${base}/api/rooms/${roomA.id}/messages?participantId=${peopleA[0].id}&limit=50`, { headers: auth });
    expect(response.status).toBe(200);
    const { messages } = await response.json();
    expect(messages.map((message) => message.text)).toEqual(['one', 'two', 'three']);
    expect(new Set(messages.map((message) => message.id)).size).toBe(3);
    expect(Date.parse(messages[1].createdAt)).toBeGreaterThan(Date.parse(messages[0].createdAt));
    const latestPageResponse = await fetch(`${base}/api/rooms/${roomA.id}/messages?participantId=${peopleA[0].id}&limit=2`, { headers: auth });
    const latestPage = await latestPageResponse.json();
    expect(latestPage.messages.map((message) => message.text)).toEqual(['two', 'three']);
    const earlierResponse = await fetch(`${base}/api/rooms/${roomA.id}/messages?participantId=${peopleA[0].id}&limit=2&before=${latestPage.nextBefore}`, { headers: auth });
    expect((await earlierResponse.json()).messages.map((message) => message.text)).toEqual(['one']);
    const forbidden = await fetch(`${base}/api/rooms/${roomA.id}/messages?participantId=not-a-member`);
    expect(forbidden.status).toBe(403);
  });

  it('validates messages and rejects a non-member participant ID', async () => {
    const a = await connect();
    await join(a, roomA, peopleA[0]);
    expect(await send(a, '   ')).toMatchObject({ ok: false });
    expect(await send(a, 'x'.repeat(501))).toMatchObject({ ok: false });
    expect(await send(a, 'shiiiit')).toMatchObject({ ok: false });
    const rejectedJoin = new Promise((resolve) => a.once('room:error', resolve));
    a.emit('room:join', { roomId: roomA.id, participantId: peopleA[1].id, participantToken: peopleA[0].participantToken });
    await expect(rejectedJoin).resolves.toMatchObject({ code: 'INVALID_PARTICIPANT_TOKEN' });
    const stillOwn = await send(a, 'still my identity');
    expect(stillOwn).toMatchObject({ ok: true, message: { participantId: peopleA[0].id } });

  });

  it('limits a participant to five messages per ten seconds', async () => {
    const a = await connect();
    await join(a, roomA, peopleA[0]);
    for (let index = 0; index < 5; index += 1) {
      expect(await send(a, `valid ${index}`)).toMatchObject({ ok: true });
    }
    expect(await send(a, 'sixth')).toMatchObject({ ok: false, error: expect.stringMatching(/wait/i) });
  });

  it('updates online presence on join and disconnect, and throttles ephemeral typing events', async () => {
    const [a, b] = await Promise.all([connect(), connect()]);
    await join(a, roomA, peopleA[0]);
    const joinedPresence = new Promise((resolve) => a.on('presence:update', (event) => {
      if (event.online.length === 2) resolve(event);
    }));
    await join(b, roomA, peopleA[1]);
    await expect(joinedPresence).resolves.toMatchObject({ online: [peopleA[0].id, peopleA[1].id] });

    const typing = vi.fn();
    b.on('chat:typing', typing);
    a.emit('chat:typing', { typing: true });
    a.emit('chat:typing', { typing: false });
    await vi.waitFor(() => expect(typing).toHaveBeenCalledTimes(1));
    expect(typing.mock.calls[0][0]).toMatchObject({ participantId: peopleA[0].id, typing: true });

    const leftPresence = new Promise((resolve) => a.on('presence:update', (event) => {
      if (event.online.length === 1) resolve(event);
    }));
    b.disconnect();
    await expect(leftPresence).resolves.toMatchObject({ online: [peopleA[0].id] });
  });
});

afterEach(() => {
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* absent */ }
  }
});
