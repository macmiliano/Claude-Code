import { io } from 'socket.io-client';
import { getToken } from './api.js';

/**
 * Single shared Socket.IO client for the whole app.
 *
 * In development the Vite dev server (5173) proxies `/socket.io` to the backend
 * (4000); in production the frontend is served by the backend, so same-origin
 * works in both cases. Override with VITE_SERVER_URL for a split deployment.
 *
 * The session JWT (if any) is sent in the handshake `auth` so the server can
 * link gameplay to a signed-in account. `reauthSocket()` re-handshakes after
 * login/logout so the identity updates immediately.
 */
const URL = import.meta.env.VITE_SERVER_URL || undefined; // undefined => same origin

export const socket = io(URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  auth: { token: getToken() || null },
});

/** Re-send the handshake with the current token (call after login/logout). */
export function reauthSocket() {
  socket.auth = { token: getToken() || null };
  socket.disconnect().connect();
}
