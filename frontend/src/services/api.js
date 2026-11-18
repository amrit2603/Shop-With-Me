import { tabFetch } from "./tabSession";
/**
 * API service layer — all backend communication goes through here.
 * The base URL comes from a Vite environment variable.
 */

export const API_BASE = import.meta.env.VITE_API_URL || '';
export const apiUrl = (url) => url?.startsWith('/uploads/') ? `${API_BASE}${url}` : url;

function creatorHeaders(roomId) {
  try { return { 'X-Creator-Token': sessionStorage.getItem(`creator_token_${roomId}`) || '' }; } catch { return {}; }
}

function responseError(data, fallback) {
  return typeof data?.error === 'string' ? data.error : (data?.error?.message || fallback);
}

export async function getRoomMessages(roomId, { participantId, participantToken, before, limit = 50 } = {}) {
  const query = new URLSearchParams({ participantId: participantId || '', limit: String(limit) });
  if (before) query.set('before', before);
  const response = await tabFetch(`${API_BASE}/api/rooms/${roomId}/messages?${query}`, { headers: { 'X-Participant-Token': participantToken || '' } });
  const data = await response.json();
  if (!response.ok) throw new Error(responseError(data, 'Could not load chat. Please retry.'));
  return data;
}

export async function uploadRoomAttachments(roomId, { participantId, participantToken, files }) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : '';
  const response = await tabFetch(`${API_BASE}/api/rooms/${roomId}/attachments${query}`, {
    method: 'POST',
    headers: {
      'x-participant-id': participantId || '',
      'x-participant-token': participantToken || '',
    },
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(responseError(data, 'Could not upload attachment. Please check file type and size.'));
  }
  return data;
}

/**
 * Create a new shopping room.
 * @param {string} title
 * @returns {Promise<{ room: object, shareableUrl: string }>}
 */
export async function createRoom(title, expiresInHours = 168) {
  const res = await tabFetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, expiresInHours }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to create room.'));
  }

  return data;
}

/**
 * Fetch room details by ID.
 * @param {string} roomId
 * @returns {Promise<{ room: object }>}
 */
export async function getRoom(roomId) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to fetch room.'));
  }

  return data;
}

/**
 * Fetch the final decision summary for a room.
 * @param {string} roomId
 * @returns {Promise<object>}
 */
export async function getRoomSummary(roomId) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/summary`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to fetch decision summary.'));
  }

  return data;
}

/**
 * Fetch the demo product catalog.
 * @returns {Promise<{ products: Array<object> }>}
 */
export async function getProducts() {
  const res = await tabFetch(`${API_BASE}/api/products`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to fetch product catalog.'));
  }

  return data;
}

/**
 * Add a product to a room.
 * @param {string} roomId
 * @param {string} productId
 * @returns {Promise<{ message: string, room: object }>}
 */
export async function addProductToRoom(roomId, productId) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...creatorHeaders(roomId) },
    body: JSON.stringify({ productId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to add product to room.'));
  }

  return data;
}

/**
 * Remove a product from a room.
 * @param {string} roomId
 * @param {string} productId
 * @returns {Promise<{ message: string, room: object }>}
 */
export async function removeProductFromRoom(roomId, productId, creatorToken) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/products/${productId}`, {
    method: 'DELETE',
    headers: { 'Content-Type':'application/json', 'X-Creator-Token': creatorToken || '' },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to remove product from room.'));
  }

  return data;
}

// ============================================================
// Phase 3: Participants API
// ============================================================

/**
 * Register or restore a guest participant in a room.
 * @param {string} roomId
 * @param {{ participantId?: string, name: string }} payload
 * @returns {Promise<{ message: string, participant: { id: string, name: string, joinedAt: string } }>}
 */
export async function joinRoom(roomId, { participantId, participantToken, name }) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/participants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, participantToken, name }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to join room.'));
  }

  return data;
}

/**
 * Update display name for a participant.
 * @param {string} roomId
 * @param {string} participantId
 * @param {string} name
 * @returns {Promise<{ message: string, participant: { id: string, name: string } }>}
 */
export async function updateParticipantName(roomId, participantId, name, participantToken) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/participants/${participantId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Participant-Token': participantToken || '' },
    body: JSON.stringify({ name }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to update name.'));
  }

  return data;
}

// ============================================================
// Phase 3: Product Voting API
// ============================================================

/**
 * Cast or update a vote on a product in a room.
 * @param {string} roomId
 * @param {string} productId
 * @param {{ participantId: string, vote: string }} payload
 * @returns {Promise<{ message: string, vote: string, totals: object, userVote: string }>}
 */
export async function voteProduct(roomId, productId, { participantId, participantToken, vote }) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/products/${productId}/votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Participant-Token': participantToken || '' },
    body: JSON.stringify({ participantId, vote }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to submit vote.'));
  }

  return data;
}

// ============================================================
// Phase 3: Product Comments API
// ============================================================

/**
 * Post a comment on a product.
 * @param {string} roomId
 * @param {string} productId
 * @param {{ participantId: string, text: string }} payload
 * @returns {Promise<{ message: string, comment: object, comments: Array<object> }>}
 */
export async function postComment(roomId, productId, { participantId, participantToken, text }) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/products/${productId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Participant-Token': participantToken || '' },
    body: JSON.stringify({ participantId, text }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to post comment.'));
  }

  return data;
}

/**
 * Set the final choice product for a room (creator only).
 * @param {string} roomId
 * @param {string} productId
 * @param {string} creatorToken
 * @returns {Promise<{ message: string, room: object, finalProduct: object, summary: object }>}
 */
export async function setFinalChoice(roomId, productId, creatorToken) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/final-choice`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creatorToken}`,
      'x-creator-token': creatorToken,
    },
    body: JSON.stringify({ productId, creatorToken }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to set final choice.'));
  }

  return data;
}

// ============================================================
// Custom Product Input APIs
// ============================================================

/**
 * Extract product metadata from a public URL.
 * @param {string} roomId
 * @param {string} url
 * @returns {Promise<{ extracted: boolean, message: string, product: object }>}
 */
export async function extractProductFromUrl(roomId, url) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/products/from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to extract product from URL.'));
  }

  return data;
}

/**
 * Upload a product screenshot for validation.
 * @param {string} roomId
 * @param {string} imageData - base64 data URI
 * @param {string} [fileName]
 * @returns {Promise<{ validated: boolean, message: string, product: object }>}
 */
export async function uploadProductScreenshot(roomId, imageData, fileName) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/products/from-screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...creatorHeaders(roomId) },
    body: JSON.stringify({ imageData, fileName }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to upload screenshot.'));
  }

  return data;
}

/**
 * Add a fully custom product to a room with manual details.
 * @param {string} roomId
 * @param {object} product - { name, category?, price?, description?, imageUrl?, source?, sourceUrl? }
 * @returns {Promise<{ message: string, product: object, room: object }>}
 */
export async function addCustomProduct(roomId, product) {
  const res = await tabFetch(`${API_BASE}/api/rooms/${roomId}/products/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...creatorHeaders(roomId) },
    body: JSON.stringify(product),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(responseError(data, 'Failed to add custom product.'));
  }

  return data;
}

/**
 * Check backend health.
 * @returns {Promise<{ status: string, timestamp: string }>}
 */
export async function checkHealth() {
  const res = await tabFetch(`${API_BASE}/api/health`);
  return res.json();
}

