const { createClient } = require('redis');
const { RedisStore } = require('rate-limit-redis');
const { logger } = require('../logger');

let client;
let pubClient;
let subClient;
let connectPromise;

function redisEnabled() { return Boolean(process.env.REDIS_URL); }

function ensureClients() {
  if (!redisEnabled()) return Promise.resolve(null);
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    pubClient = client.duplicate();
    subClient = client.duplicate();
    for (const connection of [client, pubClient, subClient]) {
      connection.on('error', (error) => logger.error({ err: error }, 'Redis connection error'));
    }
  }
  if (!connectPromise) {
    connectPromise = Promise.all([client.connect(), pubClient.connect(), subClient.connect()])
      .then(() => client)
      .catch((error) => {
        connectPromise = null;
        throw error;
      });
  }
  return connectPromise;
}

function createRateLimitStore(prefix) {
  if (!redisEnabled()) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args) => {
      if (!client?.isReady) return Promise.reject(new Error('Redis rate limit store is not connected.'));
      return client.sendCommand(args);
    },
  });
}

function getSocketAdapter() {
  return ensureClients().then(() => {
    if (!redisEnabled()) return null;
    const { createAdapter } = require('@socket.io/redis-adapter');
    return createAdapter(pubClient, subClient);
  });
}

async function getOnlineParticipants(roomId) {
  if (!client?.isReady) return null;
  return client.hKeys(`presence:${roomId}`);
}

async function addOnlineSocket(roomId, participantId, socketId) {
  if (!client?.isReady) return null;
  const key = `presence:${roomId}`;
  const script = `local raw = redis.call('HGET', KEYS[1], ARGV[1]); local ids = raw and cjson.decode(raw) or {}; for _, id in ipairs(ids) do if id == ARGV[2] then return redis.call('HKEYS', KEYS[1]) end end; table.insert(ids, ARGV[2]); redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(ids)); return redis.call('HKEYS', KEYS[1])`;
  return client.eval(script, { keys: [key], arguments: [participantId, socketId] });
}

async function removeOnlineSocket(roomId, participantId, socketId) {
  if (!client?.isReady) return null;
  const key = `presence:${roomId}`;
  const script = `local raw = redis.call('HGET', KEYS[1], ARGV[1]); if not raw then return redis.call('HKEYS', KEYS[1]) end; local ids = cjson.decode(raw); local next = {}; for _, id in ipairs(ids) do if id ~= ARGV[2] then table.insert(next, id) end end; if #next == 0 then redis.call('HDEL', KEYS[1], ARGV[1]) else redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(next)) end; return redis.call('HKEYS', KEYS[1])`;
  return client.eval(script, { keys: [key], arguments: [participantId, socketId] });
}

async function closeRedisRuntime() {
  const connections = [client, pubClient, subClient].filter((connection) => connection?.isOpen);
  await Promise.all(connections.map((connection) => connection.quit().catch(() => {})));
  client = pubClient = subClient = connectPromise = null;
}

module.exports = {
  redisEnabled,
  ensureClients,
  createRateLimitStore,
  getSocketAdapter,
  getOnlineParticipants,
  addOnlineSocket,
  removeOnlineSocket,
  closeRedisRuntime,
};
