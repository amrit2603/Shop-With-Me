import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { io as Client } from 'socket.io-client';

const dbPath = path.resolve(__dirname, '../../data/test-security.sqlite');
process.env.DATABASE_PATH = dbPath;
const { initDb, closeDb, getDb } = require('../src/db/database.js');
initDb(dbPath);
const app = require('../src/server.js');
const { initSocket } = require('../src/socket.js');
const { clearRooms, saveRoom, addProductToRoom, cleanupExpiredRooms } = require('../src/store/roomStore.js');
const { hashToken } = require('../src/services/authTokens.js');
const { storeImage, UPLOADS_DIR } = require('../src/services/uploads.js');
const { saveCustomProduct } = require('../src/data/products.js');
const { products } = require('../src/data/products.js');

const accountFixture=require('./legacyAccountFixture.cjs');
let server;
let io;
let base;

async function json(method, url, body, headers = {}) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(method==='POST'&&url==='/api/rooms'?accountFixture.headers():{}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data=await response.json();if(method==='POST'&&url==='/api/rooms')accountFixture.legacy(data?.room);
  return { status: response.status, requestId: response.headers.get('x-request-id'), data };
}

describe('identity and security hardening', () => {
  beforeEach(async () => {
    clearRooms();
    server = createServer(app);
    io = initSocket(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (io) await new Promise((resolve) => io.close(resolve));
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    closeDb();
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* absent */ }
    }
  });

  it('stores only creator and participant SHA-256 hashes and rejects impersonation', async () => {
    const created = await json('POST', '/api/rooms', { title: '<img src=x onerror=alert(1)>' });
    const roomId = created.data.room.id;
    const participant = await json('POST', `/api/rooms/${roomId}/participants`, { name: 'Avery' });
    const id = participant.data.participant.id;
    const creatorRow = getDb().prepare('SELECT creator_token, creator_token_hash FROM rooms WHERE id = ?').get(roomId);
    const participantRow = getDb().prepare('SELECT token_hash FROM participants WHERE room_id = ? AND id = ?').get(roomId, id);
    expect(creatorRow.creator_token).toBeNull();
    expect(creatorRow.creator_token_hash).toBe(hashToken(created.data.creatorToken).toString('hex'));
    expect(participantRow.token_hash).toBe(hashToken(participant.data.participantToken).toString('hex'));
    expect((await json('POST', `/api/rooms/${roomId}/participants`, { participantId: id, name: 'Impostor' })).status).toBe(401);
    expect((await json('POST', `/api/rooms/${roomId}/participants`, { participantId: id, participantToken: 'wrong-token', name: 'Impostor' })).status).toBe(401);

    const product = products[0];
    await json('POST', `/api/rooms/${roomId}/products`, { productId: product.id }, { 'X-Creator-Token': created.data.creatorToken });
    expect((await json('DELETE', `/api/rooms/${roomId}/products/${product.id}`)).status).toBe(403);
    const unauthenticated = await json('POST', `/api/rooms/${roomId}/products/${product.id}/votes`, { participantId: id, vote: 'Love' });
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.data.error).toMatchObject({ code: 'UNAUTHORIZED', requestId: unauthenticated.requestId });
    expect(unauthenticated.data.error.message).toMatch(/participant token/i);
    expect((await json('POST', `/api/rooms/${roomId}/products/${product.id}/votes`, { participantId: id, vote: 'Love' }, { 'X-Participant-Token': 'wrong-token' })).status).toBe(401);
    const vote = await json('POST', `/api/rooms/${roomId}/products/${product.id}/votes`, { participantId: id, vote: 'Love' }, { 'X-Participant-Token': participant.data.participantToken });
    expect(vote.status).toBe(200);

    const room = await json('GET', `/api/rooms/${roomId}`);
    expect(room.data.room.title).toBe('<img src=x onerror=alert(1)>');
    expect(JSON.stringify(room.data.room)).not.toContain(created.data.creatorToken);
    expect(JSON.stringify(room.data.room)).not.toContain(participant.data.participantToken);
  });

  it('requires the correct host token for every shortlist mutation and keeps chat files private', async () => {
    const first = await json('POST', '/api/rooms', { title:'Host room' });
    const second = await json('POST', '/api/rooms', { title:'Other host' });
    const id = first.data.room.id;
    for (const [suffix, body] of [['products', { productId:products[0].id }], ['products/custom', { name:'Custom item' }], ['products/from-screenshot', { imageData:'not an image' }]]) {
      expect((await json('POST', `/api/rooms/${id}/${suffix}`, body)).status).toBe(403);
      expect((await json('POST', `/api/rooms/${id}/${suffix}`, body, { 'X-Creator-Token':second.data.creatorToken })).status).toBe(403);
    }
    expect((await json('POST', `/api/rooms/${id}/products`, { productId:products[0].id }, { 'X-Creator-Token':first.data.creatorToken })).status).toBe(200);
    expect((await fetch(`${base}/uploads/rooms/arbitrary/file.png`)).status).toBe(404);
  });

  it('validates deadlines and custom input without inventing prices', async () => {
    for (const expiresInHours of [0, -1, 169, '24', 1.5]) expect((await json('POST', '/api/rooms', { title:'Deadline', expiresInHours })).status).toBe(400);
    const created = await json('POST', '/api/rooms', { title:'Deadline', expiresInHours:6 });
    const hours = (Date.parse(created.data.room.expiresAt) - Date.parse(created.data.room.createdAt)) / 3600000;
    expect(hours).toBeCloseTo(6, 2);
    const headers = { 'X-Creator-Token':created.data.creatorToken };
    const url = `/api/rooms/${created.data.room.id}/products/custom`;
    expect((await json('POST', url, { name:'Test', category:{} }, headers)).status).toBe(400);
    expect((await json('POST', url, { name:'Test', price:'Infinity' }, headers)).status).toBe(400);
    expect((await json('POST', url, { name:'Test', sourceUrl:'javascript:alert(1)' }, headers)).status).toBe(400);
    const product = await json('POST', url, { name:'Test', price:null }, headers);
    expect(product.status).toBe(200); expect(product.data.product.price).toBeNull();
    const preview = await json('POST', '/api/rooms/preview/products/from-url', { url:'http://127.0.0.1/private' });
    expect(preview.status).toBe(400); expect(preview.data.error.message).toMatch(/internal or private/i);
  });

  it('rejects cross-room access and impersonation attempts', async () => {
    const room1 = await json('POST', '/api/rooms', { title: 'Room 1' });
    const room2 = await json('POST', '/api/rooms', { title: 'Room 2' });
    const product = products[0];
    await json('POST', `/api/rooms/${room1.data.room.id}/products`, { productId: product.id }, { 'X-Creator-Token': room1.data.creatorToken });
    await json('POST', `/api/rooms/${room2.data.room.id}/products`, { productId: product.id }, { 'X-Creator-Token': room2.data.creatorToken });

    const p1 = await json('POST', `/api/rooms/${room1.data.room.id}/participants`, { name: 'User 1' });
    const p2 = await json('POST', `/api/rooms/${room2.data.room.id}/participants`, { name: 'User 2' });

    // Cross-room access: User 1 tries to vote in Room 2
    const crossRes = await json(
      'POST',
      `/api/rooms/${room2.data.room.id}/products/${product.id}/votes`,
      { participantId: p1.data.participant.id, vote: 'Love' },
      { 'X-Participant-Token': p1.data.participantToken }
    );
    expect(crossRes.status).toBe(403);

    // Impersonation: User 2 in Room 2 tries to vote as User 1 with User 2's token
    const impersonateRes = await json(
      'POST',
      `/api/rooms/${room2.data.room.id}/products/${product.id}/votes`,
      { participantId: p1.data.participant.id, vote: 'Love' },
      { 'X-Participant-Token': p2.data.participantToken }
    );
    expect(impersonateRes.status).toBe(403);
  });

  it('blocks SSRF targets via product from-url endpoint', async () => {
    const room = await json('POST', '/api/rooms', { title: 'SSRF Test Room' });
    const targets = [
      'http://127.0.0.1/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/secret',
      'http://localhost:8080',
    ];
    for (const target of targets) {
      const res = await json('POST', `/api/rooms/${room.data.room.id}/products/from-url`, { url: target });
      expect(res.status).toBe(400);
      expect(res.data.error.message).toMatch(/internal or private/i);
    }
  });

  it('rejects oversized JSON request bodies exceeding 100 KB limit', async () => {
    const hugeTitle = 'A'.repeat(120 * 1024);
    const response = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: hugeTitle }),
    });
    expect(response.status).toBe(413);
  });

  it('safely stores and returns XSS strings in room title, comments, and chat without corruption', async () => {
    const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const room = await json('POST', '/api/rooms', { title: xssPayload });
    expect(room.data.room.title).toBe(xssPayload);

    const product = products[0];
    await json('POST', `/api/rooms/${room.data.room.id}/products`, { productId: product.id }, { 'X-Creator-Token': room.data.creatorToken });
    const p = await json('POST', `/api/rooms/${room.data.room.id}/participants`, { name: 'Tester' });

    const comment = await json(
      'POST',
      `/api/rooms/${room.data.room.id}/products/${product.id}/comments`,
      { participantId: p.data.participant.id, text: xssPayload },
      { 'X-Participant-Token': p.data.participantToken }
    );
    expect(comment.status).toBe(201);
    expect(comment.data.comment.text).toBe(xssPayload);
  });

  it('applies Helmet headers, request IDs, strict origin checks, and the participant cap', async () => {
    const health = await fetch(`${base}/api/health`, { headers: { Origin: 'https://untrusted.example' } });
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.headers.get('x-request-id')).toBeTruthy();
    expect(health.headers.get('access-control-allow-origin')).toBeNull();

    const room = await json('POST', '/api/rooms', { title: 'Limited guests' });
    process.env.MAX_PARTICIPANTS_PER_ROOM = '1';
    try {
      expect((await json('POST', `/api/rooms/${room.data.room.id}/participants`, { name: 'Avery' })).status).toBe(201);
      expect((await json('POST', `/api/rooms/${room.data.room.id}/participants`, { name: 'Blair' })).status).toBe(409);
    } finally {
      delete process.env.MAX_PARTICIPANTS_PER_ROOM;
    }
  });

  it('deletes a room-owned uploaded image when the expired room is cleaned up', () => {
    const room = saveRoom({ title: 'Uploaded product', createdAt: '2020-01-01T00:00:00.000Z', expiresAt: '2020-01-02T00:00:00.000Z' });
    const upload = storeImage(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'png');
    const product = saveCustomProduct({ name: 'Uploaded image', imageUrl: `http://localhost:3001${upload.url}` });
    addProductToRoom(room.id, product);
    const filePath = path.join(UPLOADS_DIR, upload.filename);
    expect(fs.existsSync(filePath)).toBe(true);

    expect(cleanupExpiredRooms('2026-10-29T00:00:00.000Z')).toBe(1);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
