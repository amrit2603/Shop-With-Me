import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import http from 'http';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.resolve(__dirname, '../../data/test-attachments.sqlite');
process.env.DATABASE_PATH = TEST_DB_PATH;

const { initDb, closeDb, getDb } = require('../src/db/database.js');
initDb(TEST_DB_PATH);

const app = require('../src/server.js');
const { clearRooms } = require('../src/store/roomStore.js');

let server;
let baseUrl;

function buildMultipart(fields = {}, files = [], boundary = '----Boundary123456789') {
  const parts = [];
  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }
  for (const file of files) {
    const fieldname = file.fieldname || 'files';
    const filename = file.filename || 'file.bin';
    const contentType = file.mime || 'application/octet-stream';
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldname}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`));
    parts.push(Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content));
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

const accountFixture=require('./legacyAccountFixture.cjs');
function request(method, reqPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, baseUrl);
    const headers = { ...(method==='POST'&&reqPath==='/api/rooms'?accountFixture.headers():{}), ...(options.headers || {}) };
    let body = options.body;

    if (body && !Buffer.isBuffer(body) && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let parsed;
        try {
          parsed = JSON.parse(raw.toString('utf8'));
        } catch {
          parsed = raw.toString('utf8');
        }
        if(method==='POST'&&reqPath==='/api/rooms')accountFixture.legacy(parsed?.room);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          rawBody: raw,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Sample file buffers
const VALID_PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
const VALID_JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
const FAKE_JPG_HTML = Buffer.from('<html><head><script>alert("hacked")</script></head><body>evil</body></html>');

describe('Room Chat Attachments & Security Hardening (R3)', () => {
  beforeEach(async () => {
    clearRooms();
    if (!server) {
      await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, () => {
          baseUrl = `http://localhost:${server.address().port}`;
          resolve();
        });
      });
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    closeDb();
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    } catch {}
  });

  async function createRoomAndJoin(title = 'Attachment Test Room', participantName = 'Tester') {
    const roomRes = await request('POST', '/api/rooms', {
      body: { title },
    });
    const roomId = roomRes.body.room.id;

    const joinRes = await request('POST', `/api/rooms/${roomId}/participants`, {
      body: { name: participantName },
    });
    const participant = joinRes.body.participant;
    const token = joinRes.body.participantToken;

    return { roomId, participant, token };
  }

  it('rejects disguised file type (HTML disguised as .jpg)', async () => {
    const { roomId, participant, token } = await createRoomAndJoin();

    const multipart = buildMultipart(
      { participantId: participant.id },
      [{ filename: 'malicious.jpg', mime: 'image/jpeg', content: FAKE_JPG_HTML }]
    );

    const res = await request('POST', `/api/rooms/${roomId}/attachments`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });

    expect(res.status).toBe(400);
    const errMsg = typeof res.body?.error === 'object' ? res.body.error.message : res.body?.error;
    expect(errMsg).toMatch(/Unsupported or disguised file type/i);
  });

  it('rejects oversize file (> 3 MB)', async () => {
    const { roomId, participant, token } = await createRoomAndJoin();

    // 3.1 MB with valid JPEG header
    const oversizeBuffer = Buffer.alloc(3.1 * 1024 * 1024);
    VALID_JPEG.copy(oversizeBuffer, 0);

    const multipart = buildMultipart(
      { participantId: participant.id },
      [{ filename: 'huge.jpg', mime: 'image/jpeg', content: oversizeBuffer }]
    );

    const res = await request('POST', `/api/rooms/${roomId}/attachments`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });

    expect(res.status).toBe(400);
    const errMsg = typeof res.body?.error === 'object' ? res.body.error.message : res.body?.error;
    expect(errMsg).toMatch(/exceeds maximum size of 3 MB/i);
  });

  it('rejects uploading more than 3 files in a single request', async () => {
    const { roomId, participant, token } = await createRoomAndJoin();

    const multipart = buildMultipart(
      { participantId: participant.id },
      [
        { filename: 'img1.png', content: VALID_PNG },
        { filename: 'img2.png', content: VALID_PNG },
        { filename: 'img3.png', content: VALID_PNG },
        { filename: 'img4.png', content: VALID_PNG },
      ]
    );

    const res = await request('POST', `/api/rooms/${roomId}/attachments`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });

    expect(res.status).toBe(400);
    const errMsg = typeof res.body?.error === 'object' ? res.body.error.message : res.body?.error;
    expect(errMsg).toMatch(/at most 3 files/i);
  });

  it('allows valid image and PDF uploads and serves them with proper security headers', async () => {
    const { roomId, participant, token } = await createRoomAndJoin();

    const multipart = buildMultipart(
      { participantId: participant.id },
      [
        { filename: 'outfit.png', mime: 'image/png', content: VALID_PNG },
        { filename: 'spec.pdf', mime: 'application/pdf', content: VALID_PDF },
      ]
    );

    const uploadRes = await request('POST', `/api/rooms/${roomId}/attachments`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.attachments).toHaveLength(2);

    const imgAtt = uploadRes.body.attachments.find((a) => a.originalName === 'outfit.png');
    const pdfAtt = uploadRes.body.attachments.find((a) => a.originalName === 'spec.pdf');

    expect(imgAtt.mime).toBe('image/png');
    expect(pdfAtt.mime).toBe('application/pdf');

    // Download Image
    const imgRes = await request('GET', `/api/rooms/${roomId}/attachments/${imgAtt.id}`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
      },
    });
    expect(imgRes.status).toBe(200);
    expect(imgRes.headers['x-content-type-options']).toBe('nosniff');
    expect(imgRes.headers['content-type']).toBe('image/png');
    expect(imgRes.headers['content-disposition']).toMatch(/^inline;/);

    // Download PDF
    const pdfRes = await request('GET', `/api/rooms/${roomId}/attachments/${pdfAtt.id}`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
      },
    });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['x-content-type-options']).toBe('nosniff');
    expect(pdfRes.headers['content-type']).toBe('application/pdf');
    expect(pdfRes.headers['content-disposition']).toMatch(/^attachment;/);
  });

  it('prevents non-member download and invalid token download', async () => {
    const { roomId, participant, token } = await createRoomAndJoin();

    const multipart = buildMultipart(
      { participantId: participant.id },
      [{ filename: 'secret.png', content: VALID_PNG }]
    );
    const uploadRes = await request('POST', `/api/rooms/${roomId}/attachments`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });
    const attId = uploadRes.body.attachments[0].id;

    // No token / unauthenticated
    const unauthRes = await request('GET', `/api/rooms/${roomId}/attachments/${attId}`);
    expect([401, 403]).toContain(unauthRes.status);

    // Wrong token
    const wrongTokenRes = await request('GET', `/api/rooms/${roomId}/attachments/${attId}`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': 'wrong-token-abc',
      },
    });
    expect(wrongTokenRes.status).toBe(401);

    // Fake participant ID
    const fakeMemberRes = await request('GET', `/api/rooms/${roomId}/attachments/${attId}`, {
      headers: {
        'x-participant-id': 'non-existent-user',
        'x-participant-token': token,
      },
    });
    expect(fakeMemberRes.status).toBe(403);
  });

  it('prevents cross-room attachment access', async () => {
    const room1 = await createRoomAndJoin('Room 1', 'Alice');
    const room2 = await createRoomAndJoin('Room 2', 'Bob');

    // Alice uploads in Room 1
    const multipart = buildMultipart(
      { participantId: room1.participant.id },
      [{ filename: 'room1_file.png', content: VALID_PNG }]
    );
    const uploadRes = await request('POST', `/api/rooms/${room1.roomId}/attachments`, {
      headers: {
        'x-participant-id': room1.participant.id,
        'x-participant-token': room1.token,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });
    const attId = uploadRes.body.attachments[0].id;

    // Bob attempts to download Alice's file via Room 2
    const crossRes = await request('GET', `/api/rooms/${room2.roomId}/attachments/${attId}`, {
      headers: {
        'x-participant-id': room2.participant.id,
        'x-participant-token': room2.token,
      },
    });
    expect(crossRes.status).toBe(404);
  });

  it('sanitizes path traversal in filenames safely', async () => {
    const { roomId, participant, token } = await createRoomAndJoin();

    const multipart = buildMultipart(
      { participantId: participant.id },
      [{ filename: '../../../../etc/passwd', content: VALID_PNG }]
    );
    const uploadRes = await request('POST', `/api/rooms/${roomId}/attachments`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });

    expect(uploadRes.status).toBe(201);
    const att = uploadRes.body.attachments[0];
    expect(att.originalName).not.toContain('..');
    expect(att.originalName).not.toContain('/');
    expect(att.originalName).not.toContain('\\');
  });

  it('links attachments to chat messages and serves them via getRoomMessages', async () => {
    const { roomId, participant, token } = await createRoomAndJoin();

    const multipart = buildMultipart(
      { participantId: participant.id },
      [{ filename: 'dress.png', content: VALID_PNG }]
    );
    const uploadRes = await request('POST', `/api/rooms/${roomId}/attachments`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });
    const attId = uploadRes.body.attachments[0].id;

    // Link attachment by sending a message via roomStore / socket
    const { addRoomMessage } = require('../src/store/roomStore');
    const msgResult = addRoomMessage(roomId, participant.id, 'Check out this dress!', null, [attId]);
    expect(msgResult.success).toBe(true);
    expect(msgResult.message.attachments).toHaveLength(1);
    expect(msgResult.message.attachments[0].id).toBe(attId);

    // Query messages via REST endpoint
    const messagesRes = await request('GET', `/api/rooms/${roomId}/messages?participantId=${participant.id}`, {
      headers: {
        'x-participant-token': token,
      },
    });
    expect(messagesRes.status).toBe(200);
    expect(messagesRes.body.messages).toHaveLength(1);
    expect(messagesRes.body.messages[0].attachments).toHaveLength(1);
    expect(messagesRes.body.messages[0].attachments[0].originalName).toBe('dress.png');
  });

  it('rejects uploads to expired rooms (410)', async () => {
    const { roomId, participant, token } = await createRoomAndJoin();

    // Mark room expired in database
    const db = getDb();
    db.prepare("UPDATE rooms SET expires_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(roomId);

    const multipart = buildMultipart(
      { participantId: participant.id },
      [{ filename: 'late.png', content: VALID_PNG }]
    );
    const uploadRes = await request('POST', `/api/rooms/${roomId}/attachments`, {
      headers: {
        'x-participant-id': participant.id,
        'x-participant-token': token,
        'Content-Type': multipart.contentType,
      },
      body: multipart.body,
    });

    expect(uploadRes.status).toBe(410);
  });
});
