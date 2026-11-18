const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');
const ROOM_ATTACHMENTS_ROOT = path.join(UPLOADS_ROOT, 'rooms');

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB
const MAX_FILES_PER_MESSAGE = 3;
const DEFAULT_ROOM_TOTAL_LIMIT = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/**
 * Inspect magic bytes of buffer to determine verified file type.
 * Returns null if content does not match allowed magic bytes.
 * @param {Buffer} buffer
 * @returns {{ mime: string, ext: string } | null}
 */
function verifyMagicBytes(buffer) {
  if (!buffer || buffer.length < 5) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // WebP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  // PDF: %PDF-
  if (buffer.slice(0, 5).toString('ascii') === '%PDF-') {
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  // SVG, HTML, Executables, etc. are rejected
  return null;
}

/**
 * Sanitize client file name to prevent path traversal or unsafe characters.
 * @param {string} originalName
 * @returns {string}
 */
function sanitizeFileName(originalName) {
  if (!originalName || typeof originalName !== 'string') return 'attachment';
  const base = path.basename(originalName);
  return base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100) || 'attachment';
}

function getRoomStorageDir(roomId) {
  const safeRoomId = sanitizeFileName(roomId);
  return path.join(ROOM_ATTACHMENTS_ROOT, safeRoomId);
}

function getRoomTotalUsage(roomId) {
  const db = getDb();
  const row = db.prepare('SELECT COALESCE(SUM(size), 0) AS total FROM attachments WHERE room_id = ?').get(roomId);
  return Number(row?.total || 0);
}

/**
 * Store a validated attachment buffer under /uploads/rooms/<roomId>/
 * @param {string} roomId
 * @param {string} participantId
 * @param {Buffer} buffer
 * @param {string} clientOriginalName
 * @returns {{ id: string, roomId: string, participantId: string, originalName: string, mime: string, size: number, createdAt: string, url: string }}
 */
function saveAttachment(roomId, participantId, buffer, clientOriginalName) {
  const verified = verifyMagicBytes(buffer);
  if (!verified) {
    throw new Error('Unsupported or disguised file type. Only JPEG, PNG, WebP, and PDF are allowed.');
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File exceeds maximum size of 3 MB.');
  }

  const roomLimit = Number.parseInt(process.env.ROOM_ATTACHMENTS_MAX_BYTES, 10) || DEFAULT_ROOM_TOTAL_LIMIT;
  const currentUsage = getRoomTotalUsage(roomId);
  if (currentUsage + buffer.length > roomLimit) {
    throw new Error('Room attachment quota exceeded (20 MB limit).');
  }

  const roomDir = getRoomStorageDir(roomId);
  fs.mkdirSync(roomDir, { recursive: true });

  const attachmentId = uuidv4();
  const randomFileName = `${crypto.randomBytes(16).toString('hex')}.${verified.ext}`;
  const targetPath = path.join(roomDir, randomFileName);

  fs.writeFileSync(targetPath, buffer, { flag: 'wx', mode: 0o640 });

  const sanitizedOriginal = sanitizeFileName(clientOriginalName);
  const createdAt = new Date().toISOString();
  const db = getDb();

  db.prepare(`
    INSERT INTO attachments (id, room_id, message_id, participant_id, original_name, file_name, mime, size, created_at)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
  `).run(
    attachmentId,
    roomId,
    participantId,
    sanitizedOriginal,
    randomFileName,
    verified.mime,
    buffer.length,
    createdAt
  );

  return {
    id: attachmentId,
    roomId,
    participantId,
    originalName: sanitizedOriginal,
    mime: verified.mime,
    size: buffer.length,
    createdAt,
    url: `/api/rooms/${roomId}/attachments/${attachmentId}`,
  };
}

function getAttachment(roomId, attachmentId) {
  const db = getDb();
  return db.prepare(`
    SELECT id, room_id AS roomId, message_id AS messageId, participant_id AS participantId,
           original_name AS originalName, file_name AS fileName, mime, size, created_at AS createdAt
    FROM attachments
    WHERE room_id = ? AND id = ?
  `).get(roomId, attachmentId);
}

function getAttachmentFilePath(roomId, attachment) {
  const roomDir = getRoomStorageDir(roomId);
  const targetPath = path.resolve(roomDir, attachment.fileName);
  if (!targetPath.startsWith(`${roomDir}${path.sep}`)) {
    throw new Error('Path traversal detected');
  }
  return targetPath;
}

function linkAttachmentsToMessage(roomId, participantId, messageId, attachmentIds = []) {
  if (!attachmentIds || !attachmentIds.length) return [];
  const db = getDb();
  const placeholders = attachmentIds.map(() => '?').join(',');
  db.prepare(`
    UPDATE attachments
    SET message_id = ?
    WHERE room_id = ? AND participant_id = ? AND id IN (${placeholders})
  `).run(messageId, roomId, participantId, ...attachmentIds);

  return db.prepare(`
    SELECT id, room_id AS roomId, message_id AS messageId, participant_id AS participantId,
           original_name AS originalName, mime, size, created_at AS createdAt
    FROM attachments
    WHERE message_id = ?
  `).all(messageId).map((row) => ({
    ...row,
    url: `/api/rooms/${roomId}/attachments/${row.id}`,
  }));
}

function deleteRoomAttachments(roomId) {
  const db = getDb();
  db.prepare('DELETE FROM attachments WHERE room_id = ?').run(roomId);
  const roomDir = getRoomStorageDir(roomId);
  try {
    fs.rmSync(roomDir, { recursive: true, force: true });
  } catch {}
}

module.exports = {
  MAX_FILE_SIZE,
  MAX_FILES_PER_MESSAGE,
  DEFAULT_ROOM_TOTAL_LIMIT,
  verifyMagicBytes,
  sanitizeFileName,
  saveAttachment,
  getAttachment,
  getAttachmentFilePath,
  linkAttachmentsToMessage,
  deleteRoomAttachments,
};
