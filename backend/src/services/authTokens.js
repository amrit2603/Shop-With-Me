const crypto = require('node:crypto');

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest();
}

function verifyToken(token, expectedHash) {
  if (typeof token !== 'string' || !token || typeof expectedHash !== 'string' || !expectedHash) return false;
  const supplied = hashToken(token);
  let expected;
  try { expected = Buffer.from(expectedHash, 'hex'); } catch { return false; }
  return expected.length === supplied.length && crypto.timingSafeEqual(supplied, expected);
}

module.exports = { createToken, hashToken, verifyToken };
