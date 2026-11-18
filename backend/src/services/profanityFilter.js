const blockedWords = new Set([
  'asshole', 'bastard', 'bitch', 'cunt', 'dick', 'fuck', 'motherfucker', 'shit', 'slut', 'whore',
]);

function normalizeForFilter(value) {
  let normalized = String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[013457@$]/g, (character) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' })[character]);
  // Join common punctuation obfuscation (f.u.c.k) while preserving word boundaries.
  for (let pass = 0; pass < 3; pass += 1) normalized = normalized.replace(/([a-z])[._*+#-]([a-z])/g, '$1$2');
  return normalized.replace(/([a-z])\1{2,}/g, '$1').match(/[a-z]+/g) || [];
}

function containsProfanity(value) {
  return normalizeForFilter(value).some((word) => blockedWords.has(word));
}

function rejectProfanity(value) {
  return !containsProfanity(value);
}

function maskProfanity(value) {
  if (!value || typeof value !== 'string') return value;
  let result = value;
  // Match words, ignoring case
  const words = value.split(/(\s+|[.,!?;:()]+)/);
  return words.map((token) => {
    if (containsProfanity(token)) {
      return '*'.repeat(token.length);
    }
    return token;
  }).join('');
}

module.exports = { normalizeForFilter, containsProfanity, rejectProfanity, maskProfanity };
