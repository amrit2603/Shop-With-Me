/**
 * Room routes —
 * Phase 1: POST /api/rooms, GET /api/rooms/:roomId
 * Phase 2: POST /api/rooms/:roomId/products, DELETE /api/rooms/:roomId/products/:productId
 * Phase 3:
 *   - POST /api/rooms/:roomId/participants
 *   - PATCH /api/rooms/:roomId/participants/:participantId
 *   - GET /api/rooms/:roomId/participants
 *   - POST /api/rooms/:roomId/products/:productId/votes
 *   - GET /api/rooms/:roomId/products/:productId/votes
 *   - POST /api/rooms/:roomId/products/:productId/comments
 *   - GET /api/rooms/:roomId/products/:productId/comments
 * Phase 4:
 *   - Emits room-scoped Socket.IO events on successful mutations
 */
const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const {
  saveRoom,
  getRoomById,
  resolveActualRoomId,
  addProductToRoom,
  removeProductFromRoom,
  addOrUpdateParticipant,
  updateParticipantName,
  recordVote,
  getProductVotes,
  addComment,
  getProductComments,
  setRoomFinalChoice,
  getRoomMessages,
  getParticipant,
  verifyParticipantToken,
  verifyRoomCreatorToken,
  isRoomExpired,
} = require('../store/roomRepository');
const { getProductById } = require('../data/products');
const { broadcastRoomUpdate } = require('../socket');
const { computeDecisionSummary } = require('../services/decisionSummary');
const { generateAiSummary } = require('../services/aiSummary');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { safeFetchHtml } = require('../services/ssrfGuard');
const { storeImage } = require('../services/uploads');
const { getCachedSummary, getCachedRoom, cacheRoomSnapshot, cacheSummary } = require('../socket');
const { createRateLimitStore } = require('../services/redisRuntime');
const multer = require('multer');
const {
  saveAttachment,
  getAttachment,
  getAttachmentFilePath,
} = require('../services/attachmentService');

const { getDb } = require('../db/database');
const { requireAccount } = require('../services/accountSessions');
const router = express.Router();
const testLimiterBypass = () => process.env.NODE_ENV === 'test';
const roomCreateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, skip: testLimiterBypass, store: createRateLimitStore('vyumi:rooms:create:') });
const urlPreviewLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, skip: testLimiterBypass, store: createRateLimitStore('vyumi:products:preview:') });
const attachmentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: testLimiterBypass,
  store: createRateLimitStore('vyumi:attachments:upload:'),
  validate: { ip: false, keyGeneratorIpFallback: false },
  keyGenerator: (req) => `${req.params.roomId}:${req.headers['x-participant-id'] || req.query.participantId || req.ip}`,
});
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});
const paramsBoundary = z.record(z.string(), z.string());
const queryBoundary = z.record(z.string(), z.union([z.string(), z.array(z.string())]));
const bodyBoundary = z.record(z.string(), z.unknown()).optional();

function validateBoundary(req, res, next) {
  const params = paramsBoundary.safeParse(req.params || {});
  const query = queryBoundary.safeParse(req.query || {});
  const body = bodyBoundary.safeParse(req.body);
  if (!params.success || !query.success || !body.success) {
    return res.status(400).json({ error: 'Invalid request parameters, query, or body.' });
  }
  req.validated = { params: params.data, query: query.data, body: body.data || {} };
  return next();
}

function creatorAuthorized(req) {
 const owner=getDb().prepare('SELECT creator_user_id FROM rooms WHERE id=?').get(req.params.roomId);
 return owner?.creator_user_id ? req.user?.id===owner.creator_user_id : verifyRoomCreatorToken(req.params.roomId, creatorTokenFromRequest(req));
}
function requireCreator(req, res, next) {
  if (!getRoomById(req.params.roomId)) return res.status(404).json({ error: 'Room not found.' });
  if (!creatorAuthorized(req)) return res.status(403).json({ error: 'Only the room creator can change the shortlist or upload products.' });
  return next();
}

function participantAuthorized(roomId, participantId, token) {
  if (!roomId || !participantId) return false;
  return verifyParticipantToken(roomId, participantId, token);
}

function creatorTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  if (typeof req.headers['x-creator-token'] === 'string') return req.headers['x-creator-token'].trim();
  return typeof req.body?.creatorToken === 'string' ? req.body.creatorToken.trim() : '';
}

router.get('/:roomId/messages', validateBoundary, (req, res) => {
  const { roomId } = req.params;
  const participantId = typeof req.query.participantId === 'string' ? req.query.participantId : '';
  const room = getRoomById(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!getParticipant(roomId, participantId)) return res.status(403).json({ error: 'Join this room before reading chat.' });
  if (!participantAuthorized(roomId, participantId, req.headers['x-participant-token'])) {
    return res.status(401).json({ error: 'A valid participant token is required.' });
  }
  const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const messages = getRoomMessages(roomId, { before: req.query.before, limit });
  const { getReactions } = require('../services/chatReactions');
  for (const message of messages) message.reactions = getReactions(roomId, message.id);
  return res.status(200).json({ messages, nextBefore: messages.length === limit ? messages[0].id : null });
});

// Automatically resolve short room codes or ID prefixes to the canonical UUID
router.param('roomId', (req, res, next, roomId) => {
  if (roomId) {
    const canonicalId = resolveActualRoomId(roomId);
    if (canonicalId) {
      if (isRoomExpired(canonicalId)) {
        return res.status(410).json({ error: 'This shopping room has expired. Ask the creator to start a new room.', code: 'ROOM_EXPIRED' });
      }
      req.params.roomId = canonicalId;
      if(!['GET','HEAD','OPTIONS'].includes(req.method)&&require('../store/partyStore').state(canonicalId)?.status==='ended')return res.status(409).json({error:'This party has ended.'});
    } else if (isRoomExpired(roomId)) {
      return res.status(410).json({ error: 'This shopping room has expired. Ask the creator to start a new room.', code: 'ROOM_EXPIRED' });
    }
  }
  next();
});

/**
 * POST /api/rooms
 * Body: { title: string }
 * Creates a new shopping room.
 */
router.post('/', requireAccount, validateBoundary, roomCreateLimiter, (req, res) => {
  const { title, expiresInHours = 168 } = req.body || {};
  if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 168) return res.status(400).json({ error: 'Deadline must be between 1 and 168 hours.' });

  // --- Validation ---
  const { validateRoomTitle } = require('../services/roomCode');
  const validation = validateRoomTitle(title);
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.error,
    });
  }

  // --- Create room with creator token ---
  const creatorId = uuidv4();
  const creatorToken = crypto.randomBytes(32).toString('hex');

  const room = {
    id: uuidv4(),
    title: validation.title,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresInHours * 3600000).toISOString(),
    creatorId,
    creatorToken,
    products: [],
  };

  const savedRoom = saveRoom(room);
  getDb().prepare('UPDATE rooms SET creator_user_id=? WHERE id=?').run(req.user.id, savedRoom.id);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const roomCode = savedRoom.code || savedRoom.id.slice(0, 6).toUpperCase();

  return res.status(201).json({
    room: savedRoom,
    shareableUrl: `${frontendUrl}/room/${savedRoom.id}`,
    roomCode,
    creatorId,
    creatorToken,
  });
});

/**
 * PATCH /api/rooms/:roomId
 * Body: { title: string }
 * Renames a room (creator only). Validates title.
 */
router.patch('/:roomId', validateBoundary, (req, res) => {
  const { roomId } = req.params;
  const { title } = req.body || {};

  if (!creatorAuthorized(req)) {
    return res.status(403).json({ error: 'Only the room creator can rename the room.' });
  }

  const { validateRoomTitle } = require('../services/roomCode');
  const validation = validateRoomTitle(title);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const room = getRoomById(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const { getDb } = require('../db/database');
  getDb().prepare('UPDATE rooms SET title = ? WHERE id = ?').run(validation.title, roomId);
  const updated = getRoomById(roomId);

  broadcastRoomUpdate(roomId, 'room:updated', { room: updated });

  return res.status(200).json({
    message: 'Room title updated successfully.',
    room: updated,
  });
});

/**
 * GET /api/rooms/:roomId
 * Returns room details by ID, including products, participants, votes, voteTotals, and comments.
 */
router.get('/:roomId', validateBoundary, async (req, res) => {
  const { roomId } = req.params;
  const room = getCachedRoom(roomId) || getRoomById(roomId);

  if (!room) {
    return res.status(404).json({
      error: 'Room not found. It may have expired or the link may be incorrect.',
    });
  }

  cacheRoomSnapshot(roomId, room);
  const summary = getCachedSummary(roomId) || computeDecisionSummary(room);
  cacheSummary(roomId, summary);
  summary.aiSummary = await generateAiSummary(room, summary);
  return res.status(200).json({ room, summary });
});

/**
 * GET /api/rooms/:roomId/summary
 * Returns the final decision summary for the specified room.
 */
router.get('/:roomId/summary', validateBoundary, async (req, res) => {
  const { roomId } = req.params;
  const room = getCachedRoom(roomId) || getRoomById(roomId);

  if (!room) {
    return res.status(404).json({
      error: 'Room not found. It may have expired or the link may be incorrect.',
    });
  }

  cacheRoomSnapshot(roomId, room);
  const summary = getCachedSummary(roomId) || computeDecisionSummary(room);
  cacheSummary(roomId, summary);
  summary.aiSummary = await generateAiSummary(room, summary);
  return res.status(200).json(summary);
});

/**
 * PUT /api/rooms/:roomId/final-choice
 * Body: { productId: string, creatorToken?: string }
 * Headers: Authorization: Bearer <token> OR x-creator-token: <token>
 * Allows verified room creator to designate the official final choice product.
 */
router.put('/:roomId/final-choice', validateBoundary, (req, res) => {
  const { roomId } = req.params;
  const { productId } = req.body || {};

  // Validate room existence
  const room = getRoomById(roomId);
  if (!room) {
    return res.status(404).json({
      error: 'Room not found.',
    });
  }

  const creatorToken = creatorTokenFromRequest(req);

  if (!creatorToken && !creatorAuthorized(req)) {
    return res.status(401).json({
      error: 'Creator authorization token is required.',
    });
  }

  if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
    return res.status(400).json({
      error: 'Valid productId is required.',
    });
  }

  const cleanProductId = productId.trim();

  const result = setRoomFinalChoice(roomId, cleanProductId, creatorToken, req.user?.id);
  if (!result.success) {
    return res.status(result.status || 400).json({
      error: result.error,
    });
  }

  const finalProduct = result.room.products.find((product) => product.id === cleanProductId);
  const summary = computeDecisionSummary(result.room);

  // Broadcast decision:made event to the room via Socket.IO
  broadcastRoomUpdate(roomId, 'decision:made', {
    finalProductId: cleanProductId,
    finalProduct,
    room: result.room,
    summary,
  });

  return res.status(200).json({
    message: 'Final choice saved successfully.',
    room: result.room,
    finalProduct,
    summary,
  });
});

/**
 * POST /api/rooms/:roomId/products
 * Body: { productId: string }
 * Adds a catalog product to the specified room.
 */
router.post('/:roomId/products', validateBoundary, requireCreator, (req, res) => {
  const { roomId } = req.params;
  const { productId } = req.body || {};

  // Validate room existence
  const room = getRoomById(roomId);
  if (!room) {
    return res.status(404).json({
      error: 'Room not found.',
    });
  }

  // Validate productId in request body
  if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
    return res.status(400).json({
      error: 'Valid productId is required.',
    });
  }

  const cleanProductId = productId.trim();

  // Validate product exists in catalog
  const catalogProduct = getProductById(cleanProductId);
  if (!catalogProduct) {
    return res.status(400).json({
      error: `Product with ID '${cleanProductId}' not found in catalog.`,
    });
  }

  // Attempt to add product
  const result = addProductToRoom(roomId, catalogProduct);
  if (!result.success) {
    return res.status(result.status || 400).json({
      error: result.error,
    });
  }

  // Real-time broadcast after successful mutation
  broadcastRoomUpdate(roomId, 'product:added', {
    product: catalogProduct,
    room: result.room,
  });

  return res.status(200).json({
    message: 'Product added to room successfully.',
    room: result.room,
  });
});

/**
 * POST /api/rooms/:roomId/products/custom
 * Body: { name, category?, price?, description?, imageUrl?, source? }
 * Adds a fully custom product with manual details.
 */
router.post('/:roomId/products/custom', validateBoundary, requireCreator, (req, res) => {
  const { roomId } = req.params;
  const { name, category, price, description, imageUrl, source, sourceUrl } = req.body || {};

  // Validate room existence
  const room = getRoomById(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  for (const value of [category, description, imageUrl, source, sourceUrl]) {
    if (value != null && typeof value !== 'string') return res.status(400).json({ error: 'Product details must be text.' });
  }
  if (sourceUrl) {
    try { if (!['http:', 'https:'].includes(new URL(sourceUrl).protocol)) throw new Error(); }
    catch { return res.status(400).json({ error: 'Product link must be an HTTP or HTTPS URL.' }); }
  }
  if ((description || '').length > 2000) return res.status(400).json({ error: 'Product details are too long.' });

  // Validate product name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Product name is required.' });
  }

  if (name.trim().length > 200) {
    return res.status(400).json({ error: 'Product name must be 200 characters or fewer.' });
  }

  // Validate price if provided
  let parsedPrice = null;
  if (price !== undefined && price !== null && price !== '') {
    parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Price must be a non-negative number.' });
    }
  }

  // Save custom product
  const { saveCustomProduct } = require('../data/products');
  const savedProduct = saveCustomProduct({
    name: name.trim(),
    category: (category || 'Custom').trim(),
    price: parsedPrice,
    description: (description || '').trim(),
    imageUrl: (imageUrl || '').trim(),
    source: (source || 'manual').trim(),
    sourceUrl: (sourceUrl || '').trim(),
  });

  // Add to room
  const result = addProductToRoom(roomId, savedProduct);
  if (!result.success) {
    return res.status(result.status || 400).json({ error: result.error });
  }

  broadcastRoomUpdate(roomId, 'product:added', {
    product: savedProduct,
    room: result.room,
  });

  return res.status(200).json({
    message: 'Custom product added to room successfully.',
    product: savedProduct,
    room: result.room,
  });
});

/**
 * POST /api/rooms/:roomId/products/from-url
 * Body: { url: string }
 * Extracts basic metadata from a public product URL and creates a custom product.
 * Includes SSRF protection against private networks.
 */
router.post('/:roomId/products/from-url', validateBoundary, urlPreviewLimiter, async (req, res) => {
  const { roomId } = req.params;
  const { url } = req.body || {};

  // Stateless preview works before room creation.
  const room = roomId === 'preview' ? true : getRoomById(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({ error: 'A valid product URL is required.' });
  }

  const trimmedUrl = url.trim();

  // Attempt to fetch and extract basic metadata
  try {
    const page = await safeFetchHtml(trimmedUrl);
    const html = page.html;

    // Extract metadata from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);

    const extractedName = (ogTitleMatch?.[1] || titleMatch?.[1] || '').trim().slice(0, 200);
    const extractedDesc = (ogDescMatch?.[1] || descMatch?.[1] || '').trim().slice(0, 500);
    const extractedImage = (ogImageMatch?.[1] || '').trim();

    return res.status(200).json({
      extracted: Boolean(extractedName),
      message: extractedName
        ? 'Product details extracted from the page. Review and edit before adding.'
        : 'Could not extract product details automatically. Please enter them manually.',
      product: {
        name: extractedName,
        category: 'Custom',
        price: null, // Never invent prices
        description: extractedDesc,
        imageUrl: extractedImage,
        source: 'url',
        sourceUrl: trimmedUrl,
      },
    });
  } catch (err) {
    if (/only http/i.test(err.message || '')) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are supported.' });
    }
    if (/blocked/i.test(err.message || '')) {
      return res.status(400).json({ error: 'URLs pointing to internal or private networks are not allowed.' });
    }
    if (/invalid url/i.test(err.message || '')) {
      return res.status(400).json({ error: 'Invalid URL format. Please enter a valid web address.' });
    }
    const message = err.name === 'AbortError'
      ? 'The page took too long to respond. You can add product details manually.'
      : 'Could not reach the URL. Please check the address or add product details manually.';

    return res.status(200).json({
      extracted: false,
      message,
      product: {
        name: '',
        category: 'Custom',
        price: null,
        description: '',
        imageUrl: '',
        source: 'url',
        sourceUrl: trimmedUrl,
      },
    });
  }
});

/**
 * POST /api/rooms/:roomId/products/from-screenshot
 * Body: { imageData: string (base64), fileName?: string }
 * Accepts a product screenshot, validates it, and returns a product stub for manual details entry.
 * Note: No OCR/vision extraction is performed — the user provides product details manually.
 */
router.post('/:roomId/products/from-screenshot', validateBoundary, requireCreator, (req, res) => {
  const { roomId } = req.params;
  const { imageData, fileName } = req.body || {};

  // Validate room
  const room = getRoomById(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found.' });
  }

  if (!imageData || typeof imageData !== 'string' || imageData.trim().length === 0) {
    return res.status(400).json({ error: 'Image data is required.' });
  }

  // Extract and validate base64 content
  const base64Match = imageData.match(/^data:image\/(jpeg|jpg|png|gif|webp|bmp);base64,(.+)$/i);
  let imageType, rawBase64;

  if (base64Match) {
    imageType = base64Match[1].toLowerCase();
    rawBase64 = base64Match[2];
  } else {
    // Could be raw base64 without data URI prefix
    rawBase64 = imageData.trim();
    imageType = 'unknown';
  }

  // Accept at most a 2 MB decoded image; JSON base64 adds roughly one third overhead.
  const maxBytes = 2 * 1024 * 1024;
  const estimatedBytes = Math.ceil(rawBase64.length * 3 / 4);
  if (estimatedBytes > maxBytes) {
    return res.status(400).json({
      error: 'Image file is too large. Maximum allowed size is 2 MB.',
    });
  }

  // Validate actual image content by checking magic bytes
  let buffer;
  try {
    buffer = Buffer.from(rawBase64, 'base64');
    const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
    const isWEBP = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    const isBMP = buffer[0] === 0x42 && buffer[1] === 0x4D;

    if (!isJPEG && !isPNG && !isGIF && !isWEBP && !isBMP) {
      return res.status(400).json({
        error: 'The uploaded file does not appear to be a valid image. Please upload a JPEG, PNG, GIF, WebP, or BMP file.',
      });
    }

    // Determine actual type from magic bytes
    if (isJPEG) imageType = 'jpeg';
    else if (isPNG) imageType = 'png';
    else if (isGIF) imageType = 'gif';
    else if (isWEBP) imageType = 'webp';
    else if (isBMP) imageType = 'bmp';
  } catch {
    return res.status(400).json({
      error: 'Could not process the image data. Please try a different file.',
    });
  }

  // Persist validated bytes under a random name; SQLite stores only the URL.
  let uploaded;
  try {
    uploaded = storeImage(buffer, imageType);
  } catch {
    return res.status(500).json({ error: 'Could not save the image. Please retry.' });
  }

  // Return a product stub for manual entry.
  const { v4: uuidv4 } = require('uuid');
  const apiBase = process.env.API_PUBLIC_URL || '';
  const productStub = {
    id: `screenshot-${uuidv4()}`,
    name: '',
    category: 'Custom',
    price: null,
    description: '',
    imageUrl: `${apiBase}${uploaded.url}`,
    source: 'screenshot',
    sourceUrl: '',
  };

  return res.status(200).json({
    message: 'Screenshot uploaded successfully. Please enter the product details below.',
    validated: true,
    imageType,
    product: productStub,
  });
});

/**
 * DELETE /api/rooms/:roomId/products/:productId
 * Removes a product from the specified room and cleans up associated votes and comments.
 */
router.delete('/:roomId/products/:productId', validateBoundary, (req, res) => {
  const { roomId, productId } = req.params;
  if (!creatorAuthorized(req)) {
    return res.status(403).json({ error: 'Only the room creator can remove products.' });
  }

  // Validate room existence
  const room = getRoomById(roomId);
  if (!room) {
    return res.status(404).json({
      error: 'Room not found.',
    });
  }

  if (!productId) {
    return res.status(400).json({
      error: 'productId parameter is required.',
    });
  }

  const result = removeProductFromRoom(roomId, productId);
  if (!result.success) {
    return res.status(result.status || 404).json({
      error: result.error,
    });
  }

  // Real-time broadcast after successful mutation
  broadcastRoomUpdate(roomId, 'product:removed', {
    productId,
    room: result.room,
  });

  return res.status(200).json({
    message: 'Product removed from room successfully.',
    room: result.room,
  });
});

// ============================================================
// Phase 3 & 4: Participants Endpoints with Real-Time Broadcast
// ============================================================

/**
 * POST /api/rooms/:roomId/participants
 * Body: { participantId?: string, name: string }
 * Registers a guest participant or updates their name if already registered.
 */
router.post('/:roomId/participants', validateBoundary, (req, res) => {
  const { roomId } = req.params;
  let { participantId, participantToken, name } = req.body || {};
  if(require('../store/partyStore').state(roomId)){const members=getRoomById(roomId)?.participants||[];const accountMember=req.user&&getDb().prepare('SELECT id FROM participants WHERE room_id=? AND user_id=?').get(roomId,req.user.id);if(!accountMember&&!members.some(p=>p.id===participantId)&&members.length>=12)return res.status(409).json({error:'This party has reached its 12-person limit.'});}
  if(req.user) {
   name=req.user.displayName;
   const existing=getDb().prepare('SELECT id FROM participants WHERE room_id=? AND user_id=?').get(roomId,req.user.id);
   if(existing) {
    participantId=existing.id;
    const {createToken,hashToken}=require('../services/authTokens');
    participantToken=createToken();
    getDb().prepare('INSERT INTO account_room_tokens VALUES(?,?,?,?)').run(roomId,participantId,req.sessionHash,hashToken(participantToken).toString('hex'));
   }
  }

  if(typeof name === 'string' && !name.trim()) return res.status(400).json({error:'Display name cannot be empty.'});
  if(typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 24) return res.status(400).json({error:'Choose a display name of 2–24 characters.'});

  if (participantId) {
    const existing = getParticipant(roomId, participantId);
    if (existing && !verifyParticipantToken(roomId, participantId, participantToken)) {
      return res.status(401).json({ error: 'A valid participant token is required to restore this identity.' });
    }
  }

  const result = addOrUpdateParticipant(roomId, { id: participantId, name, token: participantToken });
  if (!result.success) {
    return res.status(result.status || 400).json({
      error: result.error,
    });
  }

  if(req.user) {
   getDb().prepare('UPDATE participants SET user_id=? WHERE room_id=? AND id=?').run(req.user.id,roomId,result.participant.id);
   getDb().prepare('INSERT OR IGNORE INTO account_room_tokens VALUES(?,?,?,?)').run(roomId,result.participant.id,req.sessionHash,require('../services/authTokens').hashToken(result.participantToken).toString('hex'));
  }

  // Real-time broadcast after successful mutation
  broadcastRoomUpdate(roomId, 'participant:joined', {
    participant: result.participant,
  });

  return res.status(201).json({
    message: 'Participant registered successfully.',
    participant: result.participant,
    participantToken: result.participantToken,
  });
});

/**
 * PATCH /api/rooms/:roomId/participants/:participantId
 * Body: { name: string }
 * Updates the display name of a participant in a room.
 */
router.patch('/:roomId/participants/:participantId', validateBoundary, (req, res) => {
  const { roomId, participantId } = req.params;
  const { name } = req.body || {};

  const existingParticipant = getParticipant(roomId, participantId);
  if (!existingParticipant) {
    return res.status(404).json({ error: 'Participant not found in this room.' });
  }

  if (!getParticipant(roomId, participantId)) return res.status(404).json({ error: 'Participant not found in this room.' });
  if (!participantAuthorized(roomId, participantId, req.headers['x-participant-token'])) {
    return res.status(401).json({ error: 'A valid participant token is required.' });
  }

  const result = updateParticipantName(roomId, participantId, name);
  if (!result.success) {
    return res.status(result.status || 400).json({
      error: result.error,
    });
  }

  // Real-time broadcast after successful mutation
  broadcastRoomUpdate(roomId, 'participant:updated', {
    participant: result.participant,
  });

  return res.status(200).json({
    message: 'Display name updated successfully.',
    participant: result.participant,
  });
});

/**
 * GET /api/rooms/:roomId/participants
 * Retrieves all registered participants in a room.
 */
router.get('/:roomId/participants', validateBoundary, (req, res) => {
  const { roomId } = req.params;
  const room = getRoomById(roomId);

  if (!room) {
    return res.status(404).json({
      error: 'Room not found.',
    });
  }

  return res.status(200).json({
    participants: room.participants || [],
  });
});

// ============================================================
// Phase 3 & 4: Product Voting Endpoints with Real-Time Broadcast
// ============================================================

/**
 * POST /api/rooms/:roomId/products/:productId/votes
 * Body: { participantId: string, vote: string }
 * Records or updates a participant's vote on a product in a room.
 */
router.post('/:roomId/products/:productId/votes', validateBoundary, (req, res) => {
  const { roomId, productId } = req.params;
  const { participantId, vote } = req.body || {};

  if (!participantId || typeof participantId !== 'string' || participantId.trim().length === 0) {
    return res.status(400).json({
      error: 'participantId is required to vote.',
    });
  }

  if (!vote || typeof vote !== 'string') {
    return res.status(400).json({
      error: 'vote value is required.',
    });
  }

  if (!getParticipant(roomId, participantId.trim())) {
    return res.status(403).json({ error: 'You must join the room before voting.' });
  }

  const token = req.headers['x-participant-token'] || req.body?.participantToken;
  if (!participantAuthorized(roomId, participantId.trim(), token)) {
    return res.status(401).json({ error: 'A valid participant token is required.' });
  }

  const result = recordVote(roomId, productId, participantId.trim(), vote);
  if (!result.success) {
    return res.status(result.status || 400).json({
      error: result.error,
    });
  }

  // Real-time broadcast after successful mutation
  broadcastRoomUpdate(roomId, 'vote:updated', {
    productId,
    participantId: participantId.trim(),
    vote: result.vote,
    totals: result.totals,
    userVote: result.userVote,
  });

  return res.status(200).json({
    message: 'Vote recorded successfully.',
    vote: result.vote,
    totals: result.totals,
    userVote: result.userVote,
  });
});

/**
 * GET /api/rooms/:roomId/products/:productId/votes
 * Query: ?participantId=...
 * Returns vote totals and optionally the specific participant's vote.
 */
router.get('/:roomId/products/:productId/votes', validateBoundary, (req, res) => {
  const { roomId, productId } = req.params;
  const { participantId } = req.query;

  const result = getProductVotes(roomId, productId, participantId);
  if (!result.success) {
    return res.status(result.status || 400).json({
      error: result.error,
    });
  }

  return res.status(200).json({
    totals: result.totals,
    userVote: result.userVote,
    votes: result.votes,
    voteMetadata: result.voteMetadata,
  });
});

// ============================================================
// Phase 3 & 4: Product Comments Endpoints with Real-Time Broadcast
// ============================================================

/**
 * POST /api/rooms/:roomId/products/:productId/comments
 * Body: { participantId: string, text: string }
 * Posts a comment on a selected product in a room.
 */
router.post('/:roomId/products/:productId/comments', validateBoundary, (req, res) => {
  const { roomId, productId } = req.params;
  const { participantId, text } = req.body || {};

  if (!participantId || typeof participantId !== 'string' || participantId.trim().length === 0) {
    return res.status(400).json({
      error: 'participantId is required to post a comment.',
    });
  }

  if (!getParticipant(roomId, participantId.trim())) {
    return res.status(403).json({ error: 'You must join the room before commenting.' });
  }

  const token = req.headers['x-participant-token'] || req.body?.participantToken;
  if (!participantAuthorized(roomId, participantId.trim(), token)) {
    return res.status(401).json({ error: 'A valid participant token is required.' });
  }

  const result = addComment(roomId, productId, {
    participantId: participantId.trim(),
    text,
  });

  if (!result.success) {
    return res.status(result.status || 400).json({
      error: result.error,
    });
  }

  // Real-time broadcast after successful mutation
  broadcastRoomUpdate(roomId, 'comment:added', {
    productId,
    comment: result.comment,
  });

  return res.status(201).json({
    message: 'Comment posted successfully.',
    comment: result.comment,
  });
});

/**
 * GET /api/rooms/:roomId/products/:productId/comments
 * Returns a cursor-paginated comment page in chronological order.
 */
router.get('/:roomId/products/:productId/comments', validateBoundary, (req, res) => {
  const { roomId, productId } = req.params;

  const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const result = getProductComments(roomId, productId, { before: req.query.before, limit });
  if (!result.success) {
    return res.status(result.status || 400).json({
      error: result.error,
    });
  }

  return res.status(200).json({
    comments: result.comments,
    nextBefore: result.comments.length === limit ? result.comments[0].id : null,
  });
});

/**
 * POST /api/rooms/:roomId/attachments
 * Upload multipart attachments with participant authorization.
 * Limits: 3 MB per file, max 3 files, 20 MB room limit, rate-limited.
 */
router.post(
  '/:roomId/attachments',
  attachmentRateLimiter,
  (req, res, next) => {
    attachmentUpload.any()(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File exceeds maximum size of 3 MB.' });
        }
        return res.status(400).json({ error: err.message || 'Upload error.' });
      }
      next();
    });
  },
  (req, res) => {
    const { roomId } = req.params;
    const room = getRoomById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found.' });
    if (isRoomExpired(roomId)) {
      return res.status(410).json({ error: 'This shopping room has expired. Ask the creator to start a new room.' });
    }

    const participantId = (
      req.headers['x-participant-id'] ||
      req.body?.participantId ||
      req.query?.participantId ||
      ''
    ).toString().trim();
    const token = (
      req.headers['x-participant-token'] ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : '') ||
      req.query?.token ||
      ''
    ).toString().trim();

    if (!participantId || !getParticipant(roomId, participantId)) {
      return res.status(403).json({ error: 'You must join this room before uploading attachments.' });
    }
    if (!verifyParticipantToken(roomId, participantId, token)) {
      return res.status(401).json({ error: 'A valid participant token is required to upload attachments.' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files provided for upload.' });
    }
    if (files.length > 3) {
      return res.status(400).json({ error: 'You can upload at most 3 files per message.' });
    }

    const savedAttachments = [];
    try {
      for (const file of files) {
        const saved = saveAttachment(roomId, participantId, file.buffer, file.originalname);
        savedAttachments.push({
          id: saved.id,
          originalName: saved.originalName,
          mime: saved.mime,
          size: saved.size,
          url: saved.url,
          createdAt: saved.createdAt,
        });
      }
    } catch (saveErr) {
      return res.status(400).json({ error: saveErr.message || 'Failed to process attachment.' });
    }

    return res.status(201).json({
      success: true,
      attachments: savedAttachments,
    });
  }
);

/**
 * GET /api/rooms/:roomId/attachments/:attachmentId
 * Download / stream attachment with participant authorization.
 * Sets nosniff, inline for images, attachment for PDFs.
 */
router.get('/:roomId/attachments/:attachmentId', (req, res) => {
  const { roomId, attachmentId } = req.params;
  const room = getRoomById(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const participantId = (
    req.headers['x-participant-id'] ||
    req.query?.participantId ||
    ''
  ).toString().trim();
  const token = (
    req.headers['x-participant-token'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : '') ||
    req.query?.token ||
    ''
  ).toString().trim();

  if (!participantId || !getParticipant(roomId, participantId)) {
    return res.status(403).json({ error: 'You must be a participant of this room to access attachments.' });
  }
  if (!verifyParticipantToken(roomId, participantId, token)) {
    return res.status(401).json({ error: 'Invalid or missing participant token.' });
  }

  const attachment = getAttachment(roomId, attachmentId);
  if (!attachment) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  let filePath;
  try {
    filePath = getAttachmentFilePath(roomId, attachment);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid file path or path traversal detected.' });
  }

  const fs = require('node:fs');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Attachment file does not exist on disk.' });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', attachment.mime);
  if (attachment.mime === 'application/pdf') {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.sendFile(filePath);
});

router.post('/:roomId/help', (req, res) => {
  const room = getRoomById(req.params.roomId);
  const { participantId, participantToken, action, productId, otherProductId, query } = req.body || {};
  if (!room || isRoomExpired(req.params.roomId)) return res.status(404).json({error:{message:'Room unavailable.'}});
  if (!verifyParticipantToken(room.id, participantId, participantToken)) return res.status(403).json({error:{message:'Join this room first.'}});
  const product = room.products.find(p => p.id === productId);
  const other = room.products.find(p => p.id === otherProductId);
  if (!product || !['question','compare'].includes(action) || (action === 'compare' && (!other || other.id === product.id)) || (action === 'question' && (typeof query !== 'string' || !query.trim() || query.length > 300))) return res.status(400).json({error:{message:'Choose valid products or enter a question (up to 300 characters).'}});
  const help = require('../services/shoppingHost');
  res.json({reply: action === 'compare' ? help.compare(product, other) : help.answer(room, product.id, query.trim())});
});

module.exports = router;
