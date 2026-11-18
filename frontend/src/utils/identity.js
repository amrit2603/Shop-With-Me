const BLOCKED_WORDS = new Set([
  'asshole', 'bastard', 'bitch', 'cunt', 'dick', 'fuck', 'motherfucker', 'shit', 'slut', 'whore',
]);

export function normalizeForFilter(value) {
  let normalized = String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[013457@$]/g, (character) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' })[character]);
  for (let pass = 0; pass < 3; pass += 1) {
    normalized = normalized.replace(/([a-z])[._*+#-]([a-z])/g, '$1$2');
  }
  return normalized.replace(/([a-z])\1{2,}/g, '$1').match(/[a-z]+/g) || [];
}

export function containsProfanity(value) {
  return normalizeForFilter(value).some((word) => BLOCKED_WORDS.has(word));
}

export function validateDisplayName(name) {
  if (!name || typeof name !== 'string') return 'Display name is required.';
  const trimmed = name.trim();
  if (trimmed.length < 2) return 'Display name must be at least 2 characters.';
  if (trimmed.length > 24) return 'Display name must be 24 characters or fewer.';
  if (containsProfanity(trimmed)) return 'Please choose a different display name.';
  return null;
}

export function validateRoomTitle(title) {
  const FRIENDLY_ERROR = "Give your room a name so friends know what you're deciding";
  if (!title || typeof title !== 'string') return FRIENDLY_ERROR;
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length < 3 || clean.length > 60) return FRIENDLY_ERROR;
  if (clean.toLowerCase() === 'room') return FRIENDLY_ERROR;
  const hasLetterOrNumber = /[\p{L}\p{N}]/u.test(clean);
  if (!hasLetterOrNumber) return FRIENDLY_ERROR;
  if (containsProfanity(clean)) return FRIENDLY_ERROR;
  return null;
}

export function getParticipantColor(participantId) {
  if (!participantId || typeof participantId !== 'string') return 'var(--avatar-1)';
  let hash = 0;
  for (let i = 0; i < participantId.length; i++) {
    hash = (hash << 5) - hash + participantId.charCodeAt(i);
    hash |= 0;
  }
  return `var(--avatar-${Math.abs(hash) % 10})`;
}

export function getInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
