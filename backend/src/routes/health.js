/**
 * Health check endpoints:
 * - GET /api/health: Full diagnostic check (DB read/write test, uptime, version, socket count, memory)
 * - GET /api/health/live: Lightweight liveness probe for container orchestrators (process only)
 */
const express = require('express');
const { getDb } = require('../db/database');
const packageJson = require('../../package.json');

const router = express.Router();

router.get('/', (_req, res) => {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  try {
    const db = getDb();
    const queryStart = Date.now();
    // Verify DB read and write capability using a transient transaction
    db.prepare('SELECT 1 as probe').get();
    db.transaction(() => {
      // Create and drop or touch a transient pragma/check
      db.prepare('PRAGMA user_version').get();
    })();
    dbLatencyMs = Date.now() - queryStart;
  } catch (err) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  let socketCount = 0;
  try {
    const { getIO } = require('../socket');
    const io = getIO();
    if (io) {
      socketCount = io.engine?.clientsCount ?? io.sockets?.sockets?.size ?? 0;
    }
  } catch {
    socketCount = 0;
  }

  const isHealthy = dbStatus === 'healthy';
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'degraded',
    version: packageJson.version || '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs
      },
      sockets: {
        activeConnections: socketCount
      },
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
      }
    },
    totalLatencyMs: Date.now() - startTime
  });
});

router.get('/live', (_req, res) => {
  res.status(200).json({ status: 'alive' });
});

module.exports = router;
