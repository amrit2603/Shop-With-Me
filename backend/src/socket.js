/**
 * Socket.IO module for Shop With Me (Phase 4 & Phase 6).
 * Handles real-time room subscriptions and authoritative event broadcasts,
 * including real-time decision summary synchronization.
 */

const { Server } = require('socket.io');
const { roomExists, isRoomExpired, getRoomById, getParticipant, verifyParticipantToken, addRoomMessage } = require('./store/roomRepository');
const { computeDecisionSummary } = require('./services/decisionSummary');
const redisRuntime = require('./services/redisRuntime');
const { logger } = require('./logger');

let io = null;
const messageAttempts = new Map();

/**
 * Initialize Socket.IO on an HTTP server.
 * @param {import('http').Server} httpServer
 * @param {object} [corsOptions]
 * @returns {Server}
 */
const roomPresence = new Map();

function addPresence(roomId, participantId, socketId) {
  if (!roomId || !participantId) return [];
  if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Map());
  const participants = roomPresence.get(roomId);
  if (!participants.has(participantId)) participants.set(participantId, new Set());
  participants.get(participantId).add(socketId);
  return Array.from(participants.keys());
}

function removePresence(roomId, participantId, socketId) {
  if (!roomId || !participantId || !roomPresence.has(roomId)) return [];
  const participants = roomPresence.get(roomId);
  if (participants.has(participantId)) {
    const sockets = participants.get(participantId);
    sockets.delete(socketId);
    if (sockets.size === 0) participants.delete(participantId);
  }
  if (participants.size === 0) roomPresence.delete(roomId);
  return Array.from(participants ? participants.keys() : []);
}

function getOnlineParticipants(roomId) {
  if (!roomId || !roomPresence.has(roomId)) return [];
  return Array.from(roomPresence.get(roomId).keys());
}

async function addPresenceShared(roomId, participantId, socketId) {
  const online = await redisRuntime.addOnlineSocket(roomId, participantId, socketId);
  return online || addPresence(roomId, participantId, socketId);
}

async function removePresenceShared(roomId, participantId, socketId) {
  const online = await redisRuntime.removeOnlineSocket(roomId, participantId, socketId);
  return online || removePresence(roomId, participantId, socketId);
}

async function getOnlineParticipantsShared(roomId) {
  const online = await redisRuntime.getOnlineParticipants(roomId);
  return online || getOnlineParticipants(roomId);
}

function initSocket(httpServer, corsOptions) {
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
  const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (origin === allowedOrigin) return true;
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
    if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
    return false;
  };

  io = new Server(httpServer, {
    maxHttpBufferSize: 100 * 1024,
    cors: corsOptions || {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });

  io.redisAdapterReady = redisRuntime.redisEnabled()
    ? redisRuntime.getSocketAdapter().then((adapter) => {
      io.adapter(adapter);
      logger.info('Socket.IO Redis adapter enabled for horizontal clustering');
    })
    : Promise.resolve();

  io.use((socket, next) => {
    const { roomId, participantId, token } = socket.handshake.auth || {};
    if (!roomId && !participantId && !token) return next();
    if (participantId && token) {
      if (!roomId || !verifyParticipantToken(roomId, participantId, token)) {
        return next(new Error('Invalid room participant credentials.'));
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    require('./partySocket').install(io,socket);
    // Client requests to subscribe to a room
    socket.on('room:join', async (payload) => {
      const roomId = payload && typeof payload === 'object' ? payload.roomId : (typeof payload === 'string' ? payload : null);

      if (!roomId || typeof roomId !== 'string' || roomId.trim().length === 0) {
        socket.emit('room:error', { error: 'Room ID is required to join.' });
        return;
      }

      const cleanRoomId = roomId.trim();

      if (!roomExists(cleanRoomId)) {
        socket.emit('room:error', {
          error: isRoomExpired(cleanRoomId) ? 'This shopping room has expired.' : 'Room not found. The link may be invalid.',
          code: isRoomExpired(cleanRoomId) ? 'ROOM_EXPIRED' : 'ROOM_NOT_FOUND',
        });
        return;
      }

      const requestedParticipantId = payload && typeof payload === 'object' ? payload.participantId : null;
      const participantToken = payload && typeof payload === 'object' ? (payload.participantToken || payload.token) : null;
      if (requestedParticipantId) {
        if (participantToken && !verifyParticipantToken(cleanRoomId, requestedParticipantId, participantToken)) {
          socket.emit('room:error', { error: 'Valid participant credentials are required to join this room.', code: 'INVALID_PARTICIPANT_TOKEN' });
          return;
        }
        if (process.env.ENFORCE_PARTICIPANT_TOKEN === 'true' && !participantToken) {
          socket.emit('room:error', { error: 'Valid participant credentials are required to join this room.', code: 'INVALID_PARTICIPANT_TOKEN' });
          return;
        }
      }

      const previousRoom = socket.data.roomId;
      const previousParticipantId = socket.data.participantId;
      // Remove this socket's old presence before switching rooms.
      if (previousRoom && (previousRoom !== cleanRoomId || previousParticipantId !== requestedParticipantId)) {
        if (previousRoom !== cleanRoomId) socket.leave(previousRoom);
        const online = await removePresenceShared(previousRoom, previousParticipantId, socket.id);
        io.to(previousRoom).emit('presence:update', { online });
      }
      // Leave any other subscribed room (except the socket's default private room).
      for (const currentRoom of socket.rooms) {
        if (currentRoom !== socket.id && currentRoom !== cleanRoomId) {
          socket.leave(currentRoom);
        }
      }

      socket.join(cleanRoomId);
      socket.data.roomId = cleanRoomId;
      const participantId = requestedParticipantId;
      socket.data.participantId = participantId;
      socket.data.participantToken = participantToken;
      socket.emit('room:joined', { roomId: cleanRoomId });

      if (participantId && getParticipant(cleanRoomId, participantId)) {
        const online = await addPresenceShared(cleanRoomId, participantId, socket.id);
        io.to(cleanRoomId).emit('presence:update', { online });
      } else {
        const online = await getOnlineParticipantsShared(cleanRoomId);
        socket.emit('presence:update', { online });
      }
    });

    // Client requests to leave a room
    socket.on('room:leave', async (payload) => {
      const roomId = payload && typeof payload === 'object' ? payload.roomId : (typeof payload === 'string' ? payload : null);
      if (roomId && typeof roomId === 'string') {
        const cleanRoomId = roomId.trim();
        if (socket.data.roomId !== cleanRoomId) return;
        socket.leave(cleanRoomId);
        if (socket.data.roomId === cleanRoomId && socket.data.participantId) {
          const online = await removePresenceShared(socket.data.roomId, socket.data.participantId, socket.id);
          io.to(socket.data.roomId).emit('presence:update', { online });
        }
        socket.data.roomId = null;
        socket.data.participantId = null;
        socket.emit('room:left', { roomId: cleanRoomId });
      }
    });

    socket.on('chat:send', (payload, acknowledge = () => {}) => {
      acknowledge=typeof acknowledge==='function'?acknowledge:()=>{};
      if(!verifyParticipantToken(socket.data.roomId,socket.data.participantId,socket.data.participantToken))return acknowledge({ok:false,error:'Rejoin the room to chat.'});
      const fail = (error) => acknowledge({ ok: false, error });
      const roomId = socket.data.roomId;
      const participantId = socket.data.participantId;
      if (!roomId || !socket.rooms.has(roomId)) return fail('Join the room before chatting.');
      const participant = getParticipant(roomId, participantId);
      if (!participant) return fail('Join the room before chatting.');
      const text = typeof payload?.text === 'string'
        ? payload.text.replace(/[\u0000-\u001f\u007f]/g, '').trim()
        : '';
      if (Array.isArray(payload?.attachmentIds) && payload.attachmentIds.length > 3) return fail('At most 3 attachments are allowed.');
      const attachmentIds = Array.isArray(payload?.attachmentIds) ? payload.attachmentIds : [];
      if (attachmentIds.length === 0 && (text.length < 1 || text.length > 500)) return fail('Message must be between 1 and 500 characters.');
      if (text.length > 500) return fail('Message must be between 1 and 500 characters.');
      const { containsProfanity } = require('./services/profanityFilter');
      if (text && containsProfanity(text)) return fail('Please remove the profane language before sending.');

      const now = Date.now();
      const key = `${roomId}:${participantId}`;
      const attempts = (messageAttempts.get(key) || []).filter((time) => now - time < 10000);
      if (attempts.length >= 5) return fail('Please wait before sending another message.');
      attempts.push(now);
      messageAttempts.delete(key);
      messageAttempts.set(key, attempts);
      if (messageAttempts.size > 5000) messageAttempts.delete(messageAttempts.keys().next().value);
      const party=require('./store/partyStore').state(roomId);
      if(party?.status==='ended')return fail('This party has ended.');
      const result = addRoomMessage(roomId, participantId, text, payload?.productId || null, attachmentIds);
      if (!result.success) return fail(result.error);
      io.to(roomId).emit('chat:message', { message: result.message });
      if(party&&/^(?:@host|\/host|\/compare)\b/i.test(text)){
        const shoppingHost=require('./services/shoppingHost');
        const room=getRoomById(roomId);
        let reply;
        if(/^\/compare\s+/i.test(text)){
          const parts=text.replace(/^\/compare\s+/i,'').split(/\s+vs\s+/i);
          const matches=parts.map(part=>room.products.filter(p=>p.id===part.trim()||p.name.toLowerCase()===part.trim().toLowerCase()));
          reply=matches.length===2&&matches.every(m=>m.length===1)?shoppingHost.compare(matches[0][0],matches[1][0]):{kind:'answer',text:'Choose two products with Compare products, or type their full names with /compare A vs B.'};
        }else reply=/summary/i.test(text)?shoppingHost.summary(room):shoppingHost.answer(room,party.currentProductId,text);
        require('./store/partyStore').event(roomId,participantId,'host-note',party.currentProductId,reply);
        io.to('party:'+roomId).emit('party:host',reply);
      }
      acknowledge({ ok: true, message: result.message });
    });

    socket.on('chat:react', (payload, acknowledge = () => {}) => {
      acknowledge=typeof acknowledge==='function'?acknowledge:()=>{};
      if(require('./store/partyStore').state(socket.data.roomId)?.status==='ended')return acknowledge({ok:false,error:'This party has ended.'});
      if(!verifyParticipantToken(socket.data.roomId,socket.data.participantId,socket.data.participantToken))return acknowledge({ok:false,error:'Rejoin the room to react.'});
      const roomId = socket.data.roomId;
      const participantId = socket.data.participantId;
      if (!roomId || !participantId || !socket.rooms.has(roomId) || isRoomExpired(roomId)) return acknowledge({ ok: false, error: 'Join an active room to react.' });
      const now = Date.now();
      if (now - (socket.data.lastReactionAt || 0) < 250) return acknowledge({ ok: false, error: 'Please wait before reacting again.' });
      socket.data.lastReactionAt = now;
      const { toggleReaction } = require('./services/chatReactions');
      const result = toggleReaction(roomId, participantId, payload?.messageId, payload?.emoji);
      if (!result.ok) return acknowledge(result);
      io.to(roomId).emit('chat:reaction', { messageId: payload.messageId, reactions: result.reactions });
      acknowledge(result);
    });

    socket.on('chat:typing', (payload) => {
      const roomId = socket.data.roomId;
      const participant = getParticipant(roomId, socket.data.participantId);
      if (!roomId || !participant || !socket.rooms.has(roomId)) return;
      const now = Date.now();
      if (now - (socket.data.lastTypingAt || 0) < 300) return;
      socket.data.lastTypingAt = now;
      socket.to(roomId).emit('chat:typing', { participantId: participant.id, participantName: participant.name, typing: Boolean(payload?.typing) });
    });

    socket.on('disconnect', async () => {
      if (socket.data.roomId && socket.data.participantId) {
        const online = await removePresenceShared(socket.data.roomId, socket.data.participantId, socket.id);
        io.to(socket.data.roomId).emit('presence:update', { online });
      }
    });
  });

  return io;
}

/**
 * Get the active Socket.IO server instance.
 * @returns {Server|null}
 */
function getIO() {
  return io;
}

const roomVersions = new Map();
const summaryDebounceTimers = new Map();
const summaryCache = new Map();
const roomSnapshotCache = new Map();
const MAX_ROOM_CACHE_ENTRIES = 500;

function setBoundedCache(cache, key, value) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_ROOM_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
}

function getRoomVersion(roomId) {
  return roomVersions.get(roomId) || 0;
}

function bumpRoomVersion(roomId) {
  const next = getRoomVersion(roomId) + 1;
  roomVersions.delete(roomId);
  roomVersions.set(roomId, next);
  if (roomVersions.size > 5000) {
    const oldest = roomVersions.keys().next().value;
    roomVersions.delete(oldest); summaryCache.delete(oldest); roomSnapshotCache.delete(oldest);
  }
  return next;
}

function computeAndBroadcastSummary(roomId, version) {
  let cached = summaryCache.get(roomId);
  let summary = cached?.version === version ? cached.summary : null;
  if (!summary) {
    const updatedRoom = getCachedRoom(roomId) || getRoomById(roomId);
    if (!updatedRoom) return null;
    cacheRoomSnapshot(roomId, updatedRoom);
    summary = computeDecisionSummary(updatedRoom);
    setBoundedCache(summaryCache, roomId, { version, summary });
  }

  if (io) {
    io.to(roomId).emit('summary:updated', { roomId, summary });
  }
  return summary;
}

function scheduleSummaryBroadcast(roomId, debounceMs = 150) {
  const version = bumpRoomVersion(roomId);
  if (summaryDebounceTimers.has(roomId)) {
    return;
  }
  const timer = setTimeout(() => {
    summaryDebounceTimers.delete(roomId);
    computeAndBroadcastSummary(roomId, getRoomVersion(roomId));
  }, debounceMs);
  if (timer.unref) timer.unref();
  summaryDebounceTimers.set(roomId, timer);
}

function getCachedSummary(roomId) {
  const cached = summaryCache.get(roomId);
  return cached && cached.version === getRoomVersion(roomId) ? cached.summary : null;
}

function getCachedRoom(roomId) {
  const cached = roomSnapshotCache.get(roomId);
  if (!cached || cached.version !== getRoomVersion(roomId)) return null;
  setBoundedCache(roomSnapshotCache, roomId, cached);
  return cached.room;
}

function cacheRoomSnapshot(roomId, room) {
  setBoundedCache(roomSnapshotCache, roomId, { version: getRoomVersion(roomId), room });
}

function cacheSummary(roomId, summary) {
  setBoundedCache(summaryCache, roomId, { version: getRoomVersion(roomId), summary });
}

/**
 * Broadcast an event, updated room state, and fresh decision summary to all clients in a room.
 * Emits small delta events immediately and debounces decision summary computation (150ms).
 * @param {string} roomId
 * @param {string} eventName
 * @param {object} payload
 */
function broadcastRoomUpdate(roomId, eventName, payload = {}) {
  if (!io) return;

  // Omit full room and summary snapshots; mutations travel as small deltas.
  const { room: _room, summary: _summary, ...delta } = payload;
  io.to(roomId).emit(eventName, { roomId, ...delta });

  // 2. Compute decision summary immediately for structural lifecycle changes;
  // debounce high-frequency vote/comment bursts to ~150ms.
  if (['decision:made', 'product:added', 'product:removed'].includes(eventName)) {
    const version = bumpRoomVersion(roomId);
    computeAndBroadcastSummary(roomId, version);
  } else {
    scheduleSummaryBroadcast(roomId, 150);
  }
}

module.exports = {
  initSocket,
  getIO,
  broadcastRoomUpdate,
  getRoomVersion,
  getCachedSummary,
  getCachedRoom,
  cacheRoomSnapshot,
  cacheSummary,
};
