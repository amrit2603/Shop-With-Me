/**
 * Express & Socket.IO server entry point for Shop With Me (Phase 7 Operability).
 * Validates environment, configures structured logging with Pino and request IDs,
 * connects SQLite database on startup, serves built static frontend in production,
 * and handles graceful shutdown.
 */
require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { validateEnv } = require('./services/envValidator');
validateEnv();

const { logger, requestLoggingMiddleware } = require('./logger');
const { initDb, closeDb } = require('./db/database');
const { cleanupExpiredRooms } = require('./store/roomRepository');
const healthRoutes = require('./routes/health');
const roomRoutes = require('./routes/rooms');
const productRoutes = require('./routes/products');
const { initSocket, getIO } = require('./socket');
const { UPLOADS_DIR } = require('./services/uploads');
const redisRuntime = require('./services/redisRuntime');
const loadMetrics = require('./services/loadMetrics');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URLS = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean);
const ALLOWED_ORIGINS = new Set(FRONTEND_URLS);
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.add('http://localhost:3001');
  ALLOWED_ORIGINS.add('http://127.0.0.1:3001');
  ALLOWED_ORIGINS.add('http://localhost:5173');
  ALLOWED_ORIGINS.add('http://127.0.0.1:5173');
}

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  return ALLOWED_ORIGINS.has(origin);
};

const testLimiterBypass = () => process.env.NODE_ENV === 'test';
const limitHandler = (_req, res) => res.status(429).json({ error: 'Too many requests. Please try again later.' });
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: testLimiterBypass,
  handler: limitHandler,
  store: redisRuntime.createRateLimitStore('vyumi:api:')
});

// Initialize SQLite database
initDb();

// --- Request ID & Logging Middleware ---
app.use(requestLoggingMiddleware);

// --- Consistent API error formatting with Request-ID ---
app.use((req, res, next) => {
  req.requestId = req.id;
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (res.statusCode >= 400 && typeof payload?.error === 'string') {
      const code = payload.code || (res.statusCode === 401 ? 'UNAUTHORIZED'
        : res.statusCode === 403 ? 'FORBIDDEN'
          : res.statusCode === 404 ? 'NOT_FOUND'
            : res.statusCode === 413 ? 'PAYLOAD_TOO_LARGE'
              : res.statusCode === 429 ? 'RATE_LIMITED' : 'BAD_REQUEST');
      payload = { error: { code, message: payload.error, requestId: req.id } };
    } else if (res.statusCode >= 400 && payload?.error && typeof payload.error === 'object') {
      payload = { ...payload, error: { ...payload.error, requestId: req.id } };
    }
    return originalJson(payload);
  };
  next();
});

app.use(loadMetrics.recordLoadRequest);

// Request timeout guard (15s)
app.use((req, res, next) => {
  req.setTimeout(15000, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timed out.', code: 'GATEWAY_TIMEOUT' });
    }
  });
  next();
});

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "http:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"]
    }
  } : false
}));

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Participant-Token', 'X-Creator-Token', 'X-Participant-Id', 'X-Session-Token'],
    exposedHeaders: ['X-Request-Id'],
  })
);

app.use('/api', generalApiLimiter);
app.use((req, res, next) => {
  const limit = req.path.endsWith('/from-screenshot') ? '3mb' : '100kb';
  express.json({ limit })(req, res, next);
});

app.use('/uploads/rooms', (_req, res) => res.status(404).json({ error: 'Use the authenticated attachment endpoint.' }));
app.use('/uploads', express.static(UPLOADS_DIR, {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  },
}));

// Session cookies are never used without an explicit browser-origin boundary.
app.use(require('./services/accountSessions').readSession);
app.use('/api', (req,res,next)=>{
 if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
  const origin=req.get('origin');
  if ((origin && !ALLOWED_ORIGINS.has(origin)) || ((!origin || origin==='null') && (req.sessionHash || req.path.startsWith('/auth/')))) return res.status(403).json({error:'This request origin is not allowed.'});
  if (!/^application\/json(?:;|$)/i.test(req.get('content-type') || '') && !req.path.endsWith('/attachments')) return res.status(415).json({error:'Send application/json.'});
 }
 next();
});
app.use('/api/auth',require('./routes/auth'));
// --- API Routes ---
app.use('/api/health', healthRoutes);
app.use('/api', require('./routes/parties').router);
app.get('/r/:shareId', require('./routes/parties').publicPage);
app.use('/api/rooms', roomRoutes);
app.use('/api/products', productRoutes);

if (process.env.NODE_ENV !== 'production' && process.env.LOAD_TEST_MODE === 'true') {
  app.post('/__load/reset', (_req, res) => { loadMetrics.resetLoadMetrics(); res.status(204).end(); });
  app.get('/__load/metrics', (_req, res) => res.json(loadMetrics.getLoadMetrics()));
}

// --- Serve built frontend in production if dist exists ---
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
      return next();
    }
    return res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// --- 404 fallback for API / unmatched routes ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// --- Global error handler ---
app.use((err, req, res, _next) => {
  const requestId = req.id || req.headers['x-request-id'] || undefined;
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload.', code: 'BAD_REQUEST', requestId });
  }
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'Request payload exceeds size limit.', code: 'PAYLOAD_TOO_LARGE', requestId });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message, code: 'REQUEST_ERROR', requestId });
  }
  (req.log || logger).error({ err, requestId }, 'Unhandled server error');
  return res.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR', requestId });
});

// --- Create HTTP Server & attach Socket.IO ---
const server = http.createServer(app);
initSocket(server, {
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
});

// Graceful shutdown handling
function handleShutdown(signal) {
  logger.info({ signal }, `Received ${signal}. Gracefully shutting down...`);
  if (cleanupTimer) clearInterval(cleanupTimer);
  const io = getIO();
  if (io) {
    try { io.close(); } catch { /* ignore */ }
  }
  server.close(() => {
    closeDb();
    redisRuntime.closeRedisRuntime().finally(() => {
      logger.info('HTTP server closed and SQLite database connection closed.');
      process.exit(0);
    });
  });
}

let cleanupTimer = null;

// Start server only when run directly (not during tests)
if (require.main === module) {
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  cleanupExpiredRooms();
  const cleanupIntervalMs = Math.max(1000, Number.parseInt(process.env.ROOM_CLEANUP_INTERVAL_MS, 10) || 60 * 60 * 1000);
  cleanupTimer = setInterval(cleanupExpiredRooms, cleanupIntervalMs);
  cleanupTimer.unref();

  Promise.resolve(getIO()?.redisAdapterReady)
    .then(() => server.listen(PORT, () => {
      logger.info({
        port: PORT,
        frontendUrls: FRONTEND_URLS,
        logLevel: process.env.LOG_LEVEL || 'info',
        env: process.env.NODE_ENV || 'development'
      }, `Shop With Me backend running on port ${PORT}`);
    }))
    .catch((error) => {
      logger.fatal({ err: error }, 'Redis startup failed');
      process.exitCode = 1;
      closeDb();
    });
}

// Export Express app by default for test compatibility, while exposing HTTP server, DB, and Socket.IO
module.exports = app;
module.exports.server = server;
module.exports.initSocket = initSocket;
module.exports.getIO = getIO;
module.exports.closeDb = closeDb;
module.exports.logger = logger;
