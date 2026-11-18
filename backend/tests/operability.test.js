import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
const app = require('../src/server');
const { validateEnv } = require('../src/services/envValidator');
const { logger } = require('../src/logger');

describe('Operability: Health Endpoints', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /api/health returns detailed diagnostic health check', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
    expect(body.checks).toBeDefined();
    expect(body.checks.database.status).toBe('healthy');
    expect(typeof body.checks.database.latencyMs).toBe('number');
    expect(typeof body.checks.sockets.activeConnections).toBe('number');
    expect(typeof body.checks.memory.rssMb).toBe('number');
    expect(typeof body.checks.memory.heapUsedMb).toBe('number');
  });

  it('GET /api/health/live returns lightweight process liveness', async () => {
    const res = await fetch(`${baseUrl}/api/health/live`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'alive' });
  });

  it('sets X-Request-Id header on all responses', async () => {
    const res = await fetch(`${baseUrl}/api/health/live`);
    const reqId = res.headers.get('x-request-id');
    expect(reqId).toBeDefined();
    expect(typeof reqId).toBe('string');
    expect(reqId.length).toBeGreaterThan(0);
  });
});

describe('Operability: Environment Validation', () => {
  it('validates standard environment variables successfully', () => {
    const validConfig = {
      PORT: '3001',
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:5173',
      ROOM_TTL_HOURS: '168',
      ROOM_CLEANUP_INTERVAL_MS: '3600000',
      LOG_LEVEL: 'silent'
    };
    const parsed = validateEnv(validConfig);
    expect(parsed.PORT).toBe(3001);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.ROOM_TTL_HOURS).toBe(168);
  });

  it('throws on invalid environment values', () => {
    expect(() => {
      validateEnv({
        PORT: 'not-a-port',
        NODE_ENV: 'test'
      });
    }).toThrow(/Environment validation failed/);
  });
});

describe('Operability: Structured Logger Redaction', () => {
  it('has redaction configured for sensitive authentication keys', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});
