const {prepared}=require("../db/statements");
/**
 * SQLite-backed room storage for Shop With Me (Phase 5).
 * Replaces in-memory Maps with SQLite database persistence using better-sqlite3.
 * Preserves synchronous store API and full backward compatibility.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { getProductById } = require('../data/products');
const { containsProfanity } = require('../services/profanityFilter');
const { createToken, hashToken, verifyToken } = require('../services/authTokens');
const { deleteUploadedImage } = require('../services/uploads');

/**
 * Maximum products allowed in a single room.
 */
const MAX_ROOM_PRODUCTS = 8;

/**
 * Valid vote responses for products in a room.
 */
const VALID_VOTES = ['Love', 'Like', 'No', 'Need more info'];

const VOTE_NORMALIZATION = {
  love: 'Love',
  like: 'Like',
  no: 'No',
  'need more info': 'Need more info',
  need_more_info: 'Need more info',
};

/**
 * Normalize and validate vote value.
 * @param {string} vote
 * @returns {string|null}
 */
function normalizeVote(vote) {
  if (!vote || typeof vote !== 'string') return null;
  const trimmed = vote.trim().toLowerCase();
  return VOTE_NORMALIZATION[trimmed] || (VALID_VOTES.includes(vote) ? vote : null);
}

/**
 * Initialize empty vote totals object.
 * @returns {{ Love: number, Like: number, No: number, 'Need more info': number }}
 */
function createEmptyTotals() {
  return {
    Love: 0,
    Like: 0,
    No: 0,
    'Need more info': 0,
  };
}

/**
 * Resolve a room ID or short code prefix to the actual canonical room ID.
 * @param {string} id
 * @returns {string|null}
 */
function resolveActualRoomId(id) {
  if (!id || typeof id !== 'string') return null;
  const db = getDb();
  const cleanId = id.trim();
  const exact = prepared(db,'SELECT id FROM rooms WHERE id = ?').get(cleanId);
  if (exact) return exact.id;

  const { normalizeRoomCode } = require('../services/roomCode');
  const normalized = normalizeRoomCode(cleanId);
  if (normalized) {
    const byCode = prepared(db,'SELECT id FROM rooms WHERE code = ?').get(normalized);
    if (byCode) return byCode.id;

    if (normalized.length >= 4) {
      const prefix = prepared(db,
        'SELECT id FROM rooms WHERE UPPER(SUBSTR(id, 1, ?)) = UPPER(?) LIMIT 1'
      ).get(normalized.length, normalized);
      if (prefix) return prefix.id;
    }
  }
  return null;
}

/**
 * Check if a room exists in the database.
 * @param {string} id
 * @returns {boolean}
 */
function roomExists(id) {
  const canonical = resolveActualRoomId(id);
  return Boolean(canonical && !isRoomExpired(canonical));
}

function isRoomExpired(id, now = Date.now()) {
  if (!id || typeof id !== 'string') return false;
  const db = getDb();
  const canonical = resolveActualRoomId(id);
  if (canonical) {
    const room = prepared(db,'SELECT expires_at AS expiresAt FROM rooms WHERE id = ?').get(canonical);
    return Boolean(room?.expiresAt && Date.parse(room.expiresAt) <= now);
  }
  return Boolean(prepared(db,'SELECT 1 FROM expired_rooms WHERE id = ?').get(id.trim()));
}

function cleanupExpiredRooms(now = new Date().toISOString()) {
  const db = getDb();
  const expiredAssets = [];
  const expiredCount = db.transaction(() => {
    const expired = prepared(db,'SELECT id, expires_at AS expiresAt FROM rooms WHERE expires_at IS NOT NULL AND expires_at <= ?').all(now);
    if (!expired.length) return 0;
    const expiredIds = expired.map((room) => room.id);
    const placeholders = expiredIds.map(() => '?').join(',');
    expiredAssets.push(...prepared(db,`SELECT DISTINCT cp.id, cp.image_url AS imageUrl FROM custom_products cp
      JOIN room_products rp ON rp.product_id = cp.id WHERE rp.room_id IN (${placeholders})`).all(...expiredIds));
    const insertTombstone = prepared(db,'INSERT OR IGNORE INTO expired_rooms (id, expired_at) VALUES (?, ?)');
    const { deleteRoomAttachments } = require('../services/attachmentService');
    for (const room of expired) {
      insertTombstone.run(room.id, room.expiresAt);
      deleteRoomAttachments(room.id);
    }
    prepared(db,'DELETE FROM rooms WHERE expires_at IS NOT NULL AND expires_at <= ?').run(now);
    return expired.length;
  })();
  for (const asset of expiredAssets) {
    const stillUsed = prepared(db,'SELECT 1 FROM room_products WHERE product_id = ? LIMIT 1').get(asset.id);
    if (!stillUsed) {
      deleteUploadedImage(asset.imageUrl);
      prepared(db,'DELETE FROM custom_products WHERE id = ?').run(asset.id);
    }
  }
  return expiredCount;
}

/**
 * Retrieve a room by its ID or short code, serialized into the exact response shape expected by the frontend.
 * @param {string} id
 * @returns {object|undefined}
 */
function getRoomById(id) {
  if (!id || typeof id !== 'string') return undefined;
  const actualRoomId = resolveActualRoomId(id);
  if (!actualRoomId) return undefined;
  const db = getDb();

  const roomRow = prepared(db,
    'SELECT id, title, code, created_at AS createdAt, expires_at AS expiresAt, creator_id AS creatorId, creator_user_id AS creatorUserId, (SELECT display_name FROM users WHERE id=rooms.creator_user_id) AS creatorName, final_product_id AS finalProductId FROM rooms WHERE id = ?'
  ).get(actualRoomId);
  if (!roomRow) return undefined;

  // 1. Fetch Room Products
  const productRows = prepared(db,
    'SELECT product_id FROM room_products WHERE room_id = ? ORDER BY added_at ASC'
  ).all(actualRoomId);

  const products = [];
  for (const row of productRows) {
    const catalogItem = getProductById(row.product_id);
    if (catalogItem) {
      products.push({ ...catalogItem });
    }
  }

  // 2. Fetch Participants
  const participantRows = prepared(db,
    'SELECT id, name, joined_at AS joinedAt FROM participants WHERE room_id = ? ORDER BY joined_at ASC, rowid ASC'
  ).all(actualRoomId);

  // 3. Fetch Votes
  const voteRows = prepared(db,
    'SELECT product_id, participant_id, vote, created_at AS createdAt, updated_at AS updatedAt FROM votes WHERE room_id = ?'
  ).all(actualRoomId);

  const votes = {};
  const voteMetadata = {};
  const voteTotals = {};

  // Initialize empty structures for all current products
  for (const prod of products) {
    votes[prod.id] = {};
    voteMetadata[prod.id] = {};
    voteTotals[prod.id] = createEmptyTotals();
  }

  for (const row of voteRows) {
    if (!votes[row.product_id]) votes[row.product_id] = {};
    if (!voteMetadata[row.product_id]) voteMetadata[row.product_id] = {};
    if (!voteTotals[row.product_id]) voteTotals[row.product_id] = createEmptyTotals();

    votes[row.product_id][row.participant_id] = row.vote;
    voteMetadata[row.product_id][row.participant_id] = { vote: row.vote, createdAt: row.createdAt, updatedAt: row.updatedAt };
    if (voteTotals[row.product_id][row.vote] !== undefined) {
      voteTotals[row.product_id][row.vote]++;
    }
  }

  // 4. Fetch Comments
  const commentRows = prepared(db,
    'SELECT id, product_id, participant_id AS participantId, participant_name AS participantName, text, created_at AS createdAt, updated_at AS updatedAt FROM comments WHERE room_id = ? ORDER BY created_at ASC'
  ).all(actualRoomId);

  const comments = {};
  for (const prod of products) {
    comments[prod.id] = [];
  }

  for (const row of commentRows) {
    if (!comments[row.product_id]) comments[row.product_id] = [];
    comments[row.product_id].push({
      id: row.id,
      participantId: row.participantId,
      participantName: row.participantName,
      text: row.text,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  return {
    id: roomRow.id,
    code: roomRow.code || roomRow.id.slice(0, 6).toUpperCase(),
    title: (roomRow.title && roomRow.title.trim()) || 'Untitled room',
    createdAt: roomRow.createdAt,
    expiresAt: roomRow.expiresAt || null,
    creatorId: roomRow.creatorId || null,
    creatorUserId: roomRow.creatorUserId || null,
    creatorName: roomRow.creatorName || null,
    finalProductId: roomRow.finalProductId || null,
    products,
    participants: participantRows,
    votes,
    voteMetadata,
    voteTotals,
    comments,
  };
}

/**
 * Save a room to SQLite.
 * @param {object} room - { id, title, createdAt, products }
 * @returns {object} serialized room
 */
function saveRoom(room) {
  const db = getDb();
  const roomId = room.id || uuidv4();
  const title = (room.title || '').trim();
  const { generateRoomCode } = require('../services/roomCode');
  const roomCode = room.code ? room.code.toUpperCase() : generateRoomCode();
  const createdAt = room.createdAt || new Date().toISOString();
  const ttlHours = Math.max(1, Number.parseFloat(process.env.ROOM_TTL_HOURS) || 168);
  const expiresAt = room.expiresAt || new Date(Date.parse(createdAt) + ttlHours * 60 * 60 * 1000).toISOString();
  const creatorId = room.creatorId || null;
  const creatorToken = room.creatorToken || null;
  const creatorTokenHash = creatorToken ? hashToken(creatorToken).toString('hex') : null;
  const finalProductId = room.finalProductId || null;

  const insertRoomTx = db.transaction(() => {
    prepared(db,`
      INSERT INTO rooms (id, title, code, created_at, expires_at, creator_id, creator_token, creator_token_hash, final_product_id)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        code = COALESCE(excluded.code, rooms.code),
        expires_at = COALESCE(excluded.expires_at, rooms.expires_at),
        creator_id = COALESCE(excluded.creator_id, rooms.creator_id),
        creator_token = NULL,
        creator_token_hash = COALESCE(excluded.creator_token_hash, rooms.creator_token_hash),
        final_product_id = COALESCE(excluded.final_product_id, rooms.final_product_id)
    `).run(roomId, title, roomCode, createdAt, expiresAt, creatorId, creatorTokenHash, finalProductId);

    if (Array.isArray(room.products)) {
      const insertProdStmt = prepared(db,`
        INSERT OR IGNORE INTO room_products (room_id, product_id, added_at)
        VALUES (?, ?, ?)
      `);
      for (const prod of room.products) {
        insertProdStmt.run(roomId, prod.id, new Date().toISOString());
      }
    }
  });

  insertRoomTx();
  return getRoomById(roomId);
}

/**
 * Add a product to a room within a database transaction.
 * Enforces the maximum 8-product limit and duplicate prevention atomically.
 * @param {string} roomId
 * @param {object} product
 * @returns {{ success: boolean, room?: object, error?: string, status?: number }}
 */
function addProductToRoom(roomId, product) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  const cleanProdId = product && product.id ? product.id.trim() : '';

  let result = null;

  const addTx = db.transaction(() => {
    const room = prepared(db,'SELECT 1 FROM rooms WHERE id = ?').get(cleanRoomId);
    if (!room) {
      result = { success: false, error: 'Room not found.', status: 404 };
      return;
    }

    // Check capacity limit
    const countRow = prepared(db,
      'SELECT COUNT(*) AS count FROM room_products WHERE room_id = ?'
    ).get(cleanRoomId);

    if (countRow.count >= MAX_ROOM_PRODUCTS) {
      result = {
        success: false,
        error: `Room has reached the maximum limit of ${MAX_ROOM_PRODUCTS} products.`,
        status: 400,
      };
      return;
    }

    // Check for duplicate
    const existsRow = prepared(db,
      'SELECT 1 FROM room_products WHERE room_id = ? AND product_id = ?'
    ).get(cleanRoomId, cleanProdId);

    if (existsRow) {
      result = {
        success: false,
        error: 'Product is already in this room.',
        status: 400,
      };
      return;
    }

    // Insert product
    prepared(db,`
      INSERT INTO room_products (room_id, product_id, added_at)
      VALUES (?, ?, ?)
    `).run(cleanRoomId, cleanProdId, new Date().toISOString());

    result = {
      success: true,
      room: getRoomById(cleanRoomId),
    };
  });

  addTx();
  return result;
}

/**
 * Remove a product from a room by product ID.
 * Cascade deletion clears associated votes and comments atomically.
 * @param {string} roomId
 * @param {string} productId
 * @returns {{ success: boolean, room?: object, error?: string, status?: number }}
 */
function removeProductFromRoom(roomId, productId) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  const cleanProdId = (productId || '').trim();

  let result = null;

  const removeTx = db.transaction(() => {
    const room = prepared(db,'SELECT 1 FROM rooms WHERE id = ?').get(cleanRoomId);
    if (!room) {
      result = { success: false, error: 'Room not found.', status: 404 };
      return;
    }

    const delResult = prepared(db,
      'DELETE FROM room_products WHERE room_id = ? AND product_id = ?'
    ).run(cleanRoomId, cleanProdId);

    if (delResult.changes === 0) {
      result = {
        success: false,
        error: 'Product not found in this room.',
        status: 404,
      };
      return;
    }

    // Explicitly delete any orphaned votes or comments for maximum safety
    prepared(db,'DELETE FROM votes WHERE room_id = ? AND product_id = ?').run(cleanRoomId, cleanProdId);
    prepared(db,'DELETE FROM comments WHERE room_id = ? AND product_id = ?').run(cleanRoomId, cleanProdId);

    // If removed product was final choice, clear final choice
    prepared(db,'UPDATE rooms SET final_product_id = NULL WHERE id = ? AND final_product_id = ?').run(cleanRoomId, cleanProdId);

    result = {
      success: true,
      room: getRoomById(cleanRoomId),
    };
  });

  removeTx();
  return result;
}

/**
 * Register or update a guest participant in a room.
 * @param {string} roomId
 * @param {{ id?: string, name: string }} data
 * @returns {{ success: boolean, participant?: object, error?: string, status?: number }}
 */
function addOrUpdateParticipant(roomId, { id, name, token }) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();

  if (!name || typeof name !== 'string') {
    return { success: false, error: 'Participant name is required.', status: 400 };
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { success: false, error: 'Display name cannot be empty.', status: 400 };
  }

  if (trimmedName.length > 50) {
    return { success: false, error: 'Display name must be 50 characters or fewer.', status: 400 };
  }
  if (containsProfanity(trimmedName)) return { success: false, error: 'Please choose a different display name.', status: 400 };

  const participantId = id && typeof id === 'string' && id.trim().length > 0
    ? id.trim()
    : uuidv4();

  let result = null;

  const joinTx = db.transaction(() => {
    const room = prepared(db,'SELECT 1 FROM rooms WHERE id = ?').get(cleanRoomId);
    if (!room) {
      result = { success: false, error: 'Room not found.', status: 404 };
      return;
    }

    const existing = prepared(db,
      'SELECT id, name, joined_at AS joinedAt FROM participants WHERE room_id = ? AND id = ?'
    ).get(cleanRoomId, participantId);

    if (existing) {
      if (token && !verifyParticipantToken(cleanRoomId, participantId, token)) {
        result = { success: false, error: 'Participant token is invalid.', status: 401 };
        return;
      }
      prepared(db,
        'UPDATE participants SET name = ? WHERE room_id = ? AND id = ?'
      ).run(trimmedName, cleanRoomId, participantId);

      prepared(db,
        'UPDATE comments SET participant_name = ? WHERE room_id = ? AND participant_id = ?'
      ).run(trimmedName, cleanRoomId, participantId);

      result = {
        success: true,
        participant: {
          id: participantId,
          name: trimmedName,
          joinedAt: existing.joinedAt,
        },
        participantToken: token || undefined,
      };
    } else {
      const participantCount = prepared(db,'SELECT COUNT(*) AS count FROM participants WHERE room_id = ?').get(cleanRoomId).count;
      if (participantCount >= Math.max(1, Number.parseInt(process.env.MAX_PARTICIPANTS_PER_ROOM, 10) || 50)) {
        result = { success: false, error: 'This room has reached its participant limit.', status: 409 };
        return;
      }
      const participantToken = createToken();
      const joinedAt = new Date().toISOString();
      prepared(db,`
        INSERT INTO participants (room_id, id, name, joined_at, token_hash)
        VALUES (?, ?, ?, ?, ?)
      `).run(cleanRoomId, participantId, trimmedName, joinedAt, hashToken(participantToken).toString('hex'));

      result = {
        success: true,
        participant: {
          id: participantId,
          name: trimmedName,
          joinedAt,
        },
        participantToken,
      };
    }
  });

  joinTx();
  return result;
}

/**
 * Update display name of an existing participant.
 * @param {string} roomId
 * @param {string} participantId
 * @param {string} name
 * @returns {{ success: boolean, participant?: object, error?: string, status?: number }}
 */
function updateParticipantName(roomId, participantId, name) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  const cleanParticipantId = (participantId || '').trim();

  if (!name || typeof name !== 'string') {
    return { success: false, error: 'Participant name is required.', status: 400 };
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { success: false, error: 'Display name cannot be empty.', status: 400 };
  }

  if (trimmedName.length > 50) {
    return { success: false, error: 'Display name must be 50 characters or fewer.', status: 400 };
  }
  if (containsProfanity(trimmedName)) return { success: false, error: 'Please choose a different display name.', status: 400 };

  let result = null;

  const updateTx = db.transaction(() => {
    const room = prepared(db,'SELECT 1 FROM rooms WHERE id = ?').get(cleanRoomId);
    if (!room) {
      result = { success: false, error: 'Room not found.', status: 404 };
      return;
    }

    const participant = prepared(db,
      'SELECT id, name, joined_at AS joinedAt FROM participants WHERE room_id = ? AND id = ?'
    ).get(cleanRoomId, cleanParticipantId);

    if (!participant) {
      result = { success: false, error: 'Participant not found in this room.', status: 404 };
      return;
    }

    prepared(db,
      'UPDATE participants SET name = ? WHERE room_id = ? AND id = ?'
    ).run(trimmedName, cleanRoomId, cleanParticipantId);

    prepared(db,
      'UPDATE comments SET participant_name = ? WHERE room_id = ? AND participant_id = ?'
    ).run(trimmedName, cleanRoomId, cleanParticipantId);

    result = {
      success: true,
      participant: {
        id: cleanParticipantId,
        name: trimmedName,
      },
    };
  });

  updateTx();
  return result;
}

/**
 * Get a participant from a room.
 * @param {string} roomId
 * @param {string} participantId
 * @returns {object|undefined}
 */
function getParticipant(roomId, participantId) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  return prepared(db,
    'SELECT id, name, joined_at AS joinedAt FROM participants WHERE room_id = ? AND id = ?'
  ).get(cleanRoomId, (participantId || '').trim());
}

function verifyParticipantToken(roomId, participantId, token) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  const row = prepared(db,'SELECT token_hash AS tokenHash, user_id AS userId FROM participants WHERE room_id = ? AND id = ?')
    .get(cleanRoomId, (participantId || '').trim());
  if(row?.userId) {
    const credentials=prepared(db,'SELECT t.token_hash AS tokenHash FROM account_room_tokens t JOIN sessions s ON s.token_hash=t.session_hash WHERE t.room_id=? AND t.participant_id=? AND s.expires_at>?').all(cleanRoomId,participantId,Date.now());
    return credentials.some(c=>verifyToken(token,c.tokenHash));
  }
  return Boolean(row && verifyToken(token, row.tokenHash));
}

/** Persist and page room-wide chat messages. */
function addRoomMessage(roomId, participantId, text, productId = null, attachmentIds = []) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId);
  const cleanText = typeof text === 'string' ? text.trim() : '';
  const cleanAttachmentIds = Array.isArray(attachmentIds) ? attachmentIds.slice(0, 3) : [];

  if (!cleanRoomId) return { success: false, status: 404, error: 'Room not found.' };
  if (cleanAttachmentIds.length === 0 && cleanText.length < 1) {
    return { success: false, status: 400, error: 'Message must not be empty.' };
  }
  if (cleanText.length > 500) {
    return { success: false, status: 400, error: 'Message must be between 1 and 500 characters.' };
  }
  if (cleanText && containsProfanity(cleanText)) return { success: false, status: 400, error: 'Please remove the profane language before sending.' };
  const participant = getParticipant(cleanRoomId, participantId);
  if (!participant) return { success: false, status: 403, error: 'Join this room before chatting.' };
  if (productId) {
    const attached = prepared(db,'SELECT 1 FROM room_products WHERE room_id = ? AND product_id = ?').get(cleanRoomId, productId);
    if (!attached) return { success: false, status: 400, error: 'Product is not in this room.' };
  }
  const previous = prepared(db,'SELECT created_at AS createdAt FROM room_messages WHERE room_id = ? ORDER BY created_at DESC, id DESC LIMIT 1').get(cleanRoomId);
  const createdAt = new Date(Math.max(Date.now(), previous ? Date.parse(previous.createdAt) + 1 : 0)).toISOString();
  const message = {
    id: uuidv4(), roomId: cleanRoomId, participantId,
    participantName: participant.name, text: cleanText, productId: productId || null,
    createdAt,
    attachments: [],
  };
  prepared(db,`INSERT INTO room_messages (id, room_id, participant_id, participant_name, product_id, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(message.id, cleanRoomId, participantId, participant.name, productId || null, cleanText, message.createdAt);

  if (cleanAttachmentIds.length > 0) {
    const { linkAttachmentsToMessage } = require('../services/attachmentService');
    message.attachments = linkAttachmentsToMessage(cleanRoomId, participantId, message.id, cleanAttachmentIds);
  }

  return { success: true, message };
}

function getRoomMessages(roomId, { before, limit = 50 } = {}) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId);
  if (!cleanRoomId) return null;
  const pageSize = Math.max(1, Math.min(200, Number(limit) || 50));
  const cursor = before
    ? prepared(db,'SELECT created_at AS createdAt, id FROM room_messages WHERE room_id = ? AND id = ?').get(cleanRoomId, before)
    : null;
  const rows = cursor
    ? prepared(db,`SELECT id, room_id AS roomId, participant_id AS participantId,
        participant_name AS participantName, product_id AS productId, text, created_at AS createdAt
        FROM room_messages WHERE room_id = ? AND (created_at, id) < (?, ?)
        ORDER BY created_at DESC, id DESC LIMIT ?`).all(cleanRoomId, cursor.createdAt, cursor.id, pageSize)
    : prepared(db,`SELECT id, room_id AS roomId, participant_id AS participantId,
        participant_name AS participantName, product_id AS productId, text, created_at AS createdAt
        FROM room_messages WHERE room_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`).all(cleanRoomId, pageSize);

  const messageIds = rows.map((r) => r.id);
  const attachmentsByMsg = {};
  if (messageIds.length > 0) {
    const placeholders = messageIds.map(() => '?').join(',');
    const attRows = prepared(db,`
      SELECT id, room_id AS roomId, message_id AS messageId, participant_id AS participantId,
             original_name AS originalName, mime, size, created_at AS createdAt
      FROM attachments
      WHERE message_id IN (${placeholders})
    `).all(...messageIds);
    for (const att of attRows) {
      if (!attachmentsByMsg[att.messageId]) attachmentsByMsg[att.messageId] = [];
      attachmentsByMsg[att.messageId].push({
        ...att,
        url: `/api/rooms/${att.roomId}/attachments/${att.id}`,
      });
    }
  }

  const messagesWithAttachments = rows.map((r) => ({
    ...r,
    attachments: attachmentsByMsg[r.id] || [],
  }));

  return messagesWithAttachments.reverse();
}

/**
 * Record or replace a vote for a product by a joined participant.
 * Upserts atomically into SQLite.
 * @param {string} roomId
 * @param {string} productId
 * @param {string} participantId
 * @param {string} rawVote
 * @returns {{ success: boolean, vote?: string, totals?: object, userVote?: string, error?: string, status?: number }}
 */
function recordVote(roomId, productId, participantId, rawVote) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  const cleanProdId = (productId || '').trim();
  const cleanParticipantId = (participantId || '').trim();

  const normalizedVote = normalizeVote(rawVote);
  if (!normalizedVote) {
    return {
      success: false,
      error: `Invalid vote. Allowed values: ${VALID_VOTES.join(', ')}.`,
      status: 400,
    };
  }

  let result = null;

  const voteTx = db.transaction(() => {
    const room = prepared(db,'SELECT 1 FROM rooms WHERE id = ?').get(cleanRoomId);
    if (!room) {
      result = { success: false, error: 'Room not found.', status: 404 };
      return;
    }

    const productInRoom = prepared(db,
      'SELECT 1 FROM room_products WHERE room_id = ? AND product_id = ?'
    ).get(cleanRoomId, cleanProdId);

    if (!productInRoom) {
      result = { success: false, error: 'Product is not in this room.', status: 400 };
      return;
    }

    const participantInRoom = prepared(db,
      'SELECT 1 FROM participants WHERE room_id = ? AND id = ?'
    ).get(cleanRoomId, cleanParticipantId);

    if (!participantInRoom) {
      result = {
        success: false,
        error: 'You must join the room before voting.',
        status: 403,
      };
      return;
    }

    // Upsert vote (replaces previous vote)
    const now = new Date().toISOString();
    const priorVote = prepared(db,'SELECT created_at AS createdAt FROM votes WHERE room_id = ? AND product_id = ? AND participant_id = ?').get(cleanRoomId, cleanProdId, cleanParticipantId);
    const createdAt = priorVote?.createdAt || now;
    prepared(db,`
      INSERT INTO votes (room_id, product_id, participant_id, vote, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(room_id, product_id, participant_id) DO UPDATE SET vote = excluded.vote, updated_at = excluded.updated_at
    `).run(cleanRoomId, cleanProdId, cleanParticipantId, normalizedVote, createdAt, now);

    // Compute updated totals
    const totals = createEmptyTotals();
    const countRows = prepared(db,
      'SELECT vote, COUNT(*) AS count FROM votes WHERE room_id = ? AND product_id = ? GROUP BY vote'
    ).all(cleanRoomId, cleanProdId);

    for (const r of countRows) {
      if (totals[r.vote] !== undefined) {
        totals[r.vote] = r.count;
      }
    }

    result = {
      success: true,
      vote: normalizedVote,
      totals,
      userVote: normalizedVote,
      createdAt,
      updatedAt: now,
    };
  });

  voteTx();
  return result;
}

/**
 * Get votes and totals for a product.
 * @param {string} roomId
 * @param {string} productId
 * @param {string} [participantId]
 * @returns {{ success: boolean, totals?: object, userVote?: string, votes?: object, error?: string, status?: number }}
 */
function getProductVotes(roomId, productId, participantId) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  const cleanProdId = (productId || '').trim();

  const room = prepared(db,'SELECT 1 FROM rooms WHERE id = ?').get(cleanRoomId);
  if (!room) {
    return { success: false, error: 'Room not found.', status: 404 };
  }

  const productInRoom = prepared(db,
    'SELECT 1 FROM room_products WHERE room_id = ? AND product_id = ?'
  ).get(cleanRoomId, cleanProdId);

  if (!productInRoom) {
    return { success: false, error: 'Product is not in this room.', status: 400 };
  }

  const voteRows = prepared(db,
    'SELECT participant_id, vote, created_at AS createdAt, updated_at AS updatedAt FROM votes WHERE room_id = ? AND product_id = ?'
  ).all(cleanRoomId, cleanProdId);

  const totals = createEmptyTotals();
  const votes = {};
  const voteMetadata = {};
  let userVote = null;

  for (const r of voteRows) {
    votes[r.participant_id] = r.vote;
    voteMetadata[r.participant_id] = { vote: r.vote, createdAt: r.createdAt, updatedAt: r.updatedAt };
    if (totals[r.vote] !== undefined) {
      totals[r.vote]++;
    }
    if (participantId && r.participant_id === participantId.trim()) {
      userVote = r.vote;
    }
  }

  return {
    success: true,
    totals,
    userVote,
    votes,
    voteMetadata,
  };
}

/**
 * Post a comment on a product in a room.
 * @param {string} roomId
 * @param {string} productId
 * @param {{ participantId: string, text: string }} data
 * @returns {{ success: boolean, comment?: object, comments?: Array<object>, error?: string, status?: number }}
 */
function addComment(roomId, productId, { participantId, text }) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  const cleanProdId = (productId || '').trim();
  const cleanParticipantId = (participantId || '').trim();

  if (!text || typeof text !== 'string') {
    return { success: false, error: 'Comment text is required.', status: 400 };
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return { success: false, error: 'Comment cannot be empty.', status: 400 };
  }

  if (trimmedText.length > 500) {
    return { success: false, error: 'Comment cannot exceed 500 characters.', status: 400 };
  }
  if (containsProfanity(trimmedText)) return { success: false, error: 'Please remove the profane language before posting.', status: 400 };

  let result = null;

  const commentTx = db.transaction(() => {
    const room = prepared(db,'SELECT 1 FROM rooms WHERE id = ?').get(cleanRoomId);
    if (!room) {
      result = { success: false, error: 'Room not found.', status: 404 };
      return;
    }

    const productInRoom = prepared(db,
      'SELECT 1 FROM room_products WHERE room_id = ? AND product_id = ?'
    ).get(cleanRoomId, cleanProdId);

    if (!productInRoom) {
      result = { success: false, error: 'Product is not in this room.', status: 400 };
      return;
    }

    const participant = prepared(db,
      'SELECT id, name FROM participants WHERE room_id = ? AND id = ?'
    ).get(cleanRoomId, cleanParticipantId);

    if (!participant) {
      result = {
        success: false,
        error: 'You must join the room before commenting.',
        status: 403,
      };
      return;
    }

    const commentId = uuidv4();
    const createdAt = new Date().toISOString();

    prepared(db,`
      INSERT INTO comments (id, room_id, product_id, participant_id, participant_name, text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      commentId,
      cleanRoomId,
      cleanProdId,
      cleanParticipantId,
      participant.name,
      trimmedText,
      createdAt,
      createdAt
    );

    const comment = {
      id: commentId,
      participantId: cleanParticipantId,
      participantName: participant.name,
      text: trimmedText,
      createdAt,
      updatedAt: createdAt,
    };

    result = {
      success: true,
      comment,
    };
  });

  commentTx();
  return result;
}

/**
 * Get comments for a product in chronological order.
 * @param {string} roomId
 * @param {string} productId
 * @returns {{ success: boolean, comments?: Array<object>, error?: string, status?: number }}
 */
function getProductComments(roomId, productId, { before, limit = 50 } = {}) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  const cleanProdId = (productId || '').trim();

  const room = prepared(db,'SELECT 1 FROM rooms WHERE id = ?').get(cleanRoomId);
  if (!room) {
    return { success: false, error: 'Room not found.', status: 404 };
  }

  const productInRoom = prepared(db,
    'SELECT 1 FROM room_products WHERE room_id = ? AND product_id = ?'
  ).get(cleanRoomId, cleanProdId);

  if (!productInRoom) {
    return { success: false, error: 'Product is not in this room.', status: 400 };
  }

  const pageSize = Math.max(1, Math.min(200, Number(limit) || 50));
  const cursor = before
    ? prepared(db,'SELECT created_at AS createdAt, id FROM comments WHERE room_id = ? AND product_id = ? AND id = ?').get(cleanRoomId, cleanProdId, before)
    : null;
  const rows = cursor
    ? prepared(db,`SELECT id, participant_id AS participantId, participant_name AS participantName, text, created_at AS createdAt, updated_at AS updatedAt
      FROM comments WHERE room_id = ? AND product_id = ? AND (created_at, id) < (?, ?)
      ORDER BY created_at DESC, id DESC LIMIT ?`).all(cleanRoomId, cleanProdId, cursor.createdAt, cursor.id, pageSize)
    : prepared(db,`
    SELECT id, participant_id AS participantId, participant_name AS participantName, text, created_at AS createdAt, updated_at AS updatedAt
    FROM comments
    WHERE room_id = ? AND product_id = ?
    ORDER BY created_at DESC, id DESC LIMIT ?
  `).all(cleanRoomId, cleanProdId, pageSize);
  const comments = rows.reverse();

  return {
    success: true,
    comments,
  };
}

/**
 * Clear all tables in database (useful for isolated automated tests).
 */
function clearRooms() {
  const db = getDb();
  const clearTx = db.transaction(() => {
    prepared(db,'DELETE FROM comments').run();
    prepared(db,'DELETE FROM votes').run();
    prepared(db,'DELETE FROM participants').run();
    prepared(db,'DELETE FROM room_products').run();
    prepared(db,'DELETE FROM rooms').run();
    prepared(db,'DELETE FROM expired_rooms').run();
  });
  clearTx();
}

/**
 * Retrieve the creator authorization token for a room.
 * Used exclusively for server-side verification and never exposed in public room queries.
 * @param {string} id
 * @returns {string|null}
 */
function getRoomCreatorToken(id) {
  if (!id || typeof id !== 'string') return null;
  const db = getDb();
  const cleanId = resolveActualRoomId(id) || id.trim();
  const row = prepared(db,'SELECT creator_token_hash AS creatorTokenHash FROM rooms WHERE id = ?').get(cleanId);
  return row ? row.creatorTokenHash : null;
}

function verifyRoomCreatorToken(id, token) {
  return verifyToken(token, getRoomCreatorToken(id));
}

/**
 * Set the final choice product for a room with creator authorization.
 * @param {string} roomId
 * @param {string} productId
 * @param {string} creatorToken
 * @returns {{ success: boolean, room?: object, finalProductId?: string, error?: string, status?: number }}
 */
function setRoomFinalChoice(roomId, productId, creatorToken, accountUserId) {
  const db = getDb();
  const cleanRoomId = resolveActualRoomId(roomId) || (roomId || '').trim();
  const cleanProdId = (productId || '').trim();

  let result = null;

  const choiceTx = db.transaction(() => {
    const roomRow = prepared(db,
      'SELECT id, creator_user_id AS creatorUserId, creator_token_hash AS creatorTokenHash, final_product_id AS finalProductId FROM rooms WHERE id = ?'
    ).get(cleanRoomId);

    if (!roomRow) {
      result = { success: false, error: 'Room not found.', status: 404 };
      return;
    }

    if (
      (roomRow.creatorUserId ? accountUserId !== roomRow.creatorUserId : !verifyToken(creatorToken, roomRow.creatorTokenHash))
    ) {
      result = {
        success: false,
        error: 'Unauthorized: Only the verified room creator can make the final choice.',
        status: 403,
      };
      return;
    }

    const productInRoom = prepared(db,
      'SELECT 1 FROM room_products WHERE room_id = ? AND product_id = ?'
    ).get(cleanRoomId, cleanProdId);

    if (!productInRoom) {
      result = {
        success: false,
        error: 'Selected product is not in this room.',
        status: 400,
      };
      return;
    }

    prepared(db,'UPDATE rooms SET final_product_id = ? WHERE id = ?').run(cleanProdId, cleanRoomId);

    result = {
      success: true,
      room: getRoomById(cleanRoomId),
      finalProductId: cleanProdId,
    };
  });

  choiceTx();
  return result;
}

module.exports = {
  MAX_ROOM_PRODUCTS,
  VALID_VOTES,
  saveRoom,
  getRoomById,
  resolveActualRoomId,
  roomExists,
  isRoomExpired,
  cleanupExpiredRooms,
  addProductToRoom,
  removeProductFromRoom,
  addOrUpdateParticipant,
  updateParticipantName,
  getParticipant,
  verifyParticipantToken,
  addRoomMessage,
  getRoomMessages,
  recordVote,
  getProductVotes,
  addComment,
  getProductComments,
  getRoomCreatorToken,
  verifyRoomCreatorToken,
  setRoomFinalChoice,
  clearRooms,
};

