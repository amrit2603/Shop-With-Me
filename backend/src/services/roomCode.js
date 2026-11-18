const crypto = require('crypto');

// 27-character unambiguous alphabet
// Omits: 0 and O, 1 and I and L, 5 and S, 8 and B
const UNAMBIGUOUS_ALPHABET = '234679ACDEFGHJKMNPQRTUVWXYZ';

/**
 * Generate a 6-character room code using only the unambiguous alphabet.
 * Stored and compared uppercase.
 * @returns {string}
 */
function generateRoomCode() {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += UNAMBIGUOUS_ALPHABET[bytes[i] % UNAMBIGUOUS_ALPHABET.length];
  }
  return code;
}

/**
 * Normalize user input when joining via room code or link.
 * Extracts the code from full links, strips spaces/hyphens, and uppercases.
 * Accepts: "d79 pcv", "d79-pcv", "D79PCV", "http://localhost:5173/room/d79pcv"
 * @param {string} input
 * @returns {string}
 */
function normalizeRoomCode(input) {
  if (!input || typeof input !== 'string') return '';
  let raw = input.trim();
  // If it's a URL path, extract the trailing segment
  const urlMatch = raw.match(/\/room\/([a-zA-Z0-9\s-]+)$/i);
  if (urlMatch) {
    raw = urlMatch[1];
  }
  return raw.replace(/[\s-]+/g, '').toUpperCase();
}

/**
 * Validates a room title according to Phase R2 requirements:
 * - String, trimmed length 3-60
 * - Not only punctuation or symbols (must contain at least 1 unicode letter or number)
 * - Collapses repeated spaces
 * - Not the literal word "room"
 * - Passes profanity filter
 * - Allows valid unicode scripts (Hindi, Kannada, etc.)
 * @param {any} title
 * @returns {{ valid: boolean, title?: string, error?: string }}
 */
function validateRoomTitle(title) {
  const FRIENDLY_ERROR = "Give your room a name so friends know what you're deciding";

  if (title === undefined || title === null || typeof title !== 'string') {
    return { valid: false, error: FRIENDLY_ERROR };
  }

  // Collapse repeated spaces and trim
  const cleanTitle = title.replace(/\s+/g, ' ').trim();

  // Length 3-60
  if (cleanTitle.length < 3 || cleanTitle.length > 60) {
    return { valid: false, error: FRIENDLY_ERROR };
  }

  // Must not be the literal word "room" (case-insensitive)
  if (cleanTitle.toLowerCase() === 'room') {
    return { valid: false, error: FRIENDLY_ERROR };
  }

  // Must contain at least one unicode letter or digit (allows Hindi, Kannada, etc.)
  // \p{L} = unicode letters, \p{N} = unicode numbers
  const hasLetterOrNumber = /[\p{L}\p{N}]/u.test(cleanTitle);
  if (!hasLetterOrNumber) {
    return { valid: false, error: FRIENDLY_ERROR };
  }

  // Profanity filter
  const { containsProfanity } = require('./profanityFilter');
  if (containsProfanity(cleanTitle)) {
    return { valid: false, error: FRIENDLY_ERROR };
  }

  return { valid: true, title: cleanTitle };
}

module.exports = {
  UNAMBIGUOUS_ALPHABET,
  generateRoomCode,
  normalizeRoomCode,
  validateRoomTitle,
};
