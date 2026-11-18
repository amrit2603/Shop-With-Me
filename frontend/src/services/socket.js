/**
 * Socket.IO client service for Shop With Me (Phase 4).
 * Handles connection, room joining, event listeners, and reconnection handling.
 */
import { io } from 'socket.io-client';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  window.location.origin;

/**
 * Initialize and return a new Socket.IO client connection.
 * @param {object} [options]
 * @returns {import('socket.io-client').Socket}
 */
export function initRoomSocket(options = {}) {
  return io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
    ...options,
  });
}
