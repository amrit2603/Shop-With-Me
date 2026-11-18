const pino = require('pino');
const crypto = require('crypto');

const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

const logger = pino({
  level: logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-session-token"]',
      'sessionToken',
      'req.headers["x-participant-token"]',
      'req.headers["x-creator-token"]',
      'headers["x-participant-token"]',
      'headers["x-creator-token"]',
      'participantToken',
      'creatorToken',
      'token',
      'password',
      '*.participantToken',
      '*.creatorToken',
      '*.token'
    ],
    censor: '[REDACTED]'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

function requestLoggingMiddleware(req, res, next) {
  const supplied = req.headers['x-request-id'];
  const requestId = typeof supplied === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID();
  req.id = requestId;
  req.log = logger.child({ requestId });
  res.setHeader('X-Request-Id', requestId);

  const startTime = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    req.log.info({
      method: req.method,
      url: req.path,
      statusCode: res.statusCode,
      durationMs
    }, `${req.method} ${req.path} ${res.statusCode} in ${durationMs}ms`);
  });

  next();
}

module.exports = {
  logger,
  requestLoggingMiddleware
};
