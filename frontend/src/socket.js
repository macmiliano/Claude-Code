import { io } from 'socket.io-client';

/**
 * Single shared Socket.IO client for the whole app.
 *
 * In development the Vite dev server (5173) proxies `/socket.io` to the backend
 * (4000), so we can connect to the same origin. In production the frontend is
 * served by the backend, so same-origin also works. Override with
 * VITE_SERVER_URL when the API lives on a different host.
 */
const URL = import.meta.env.VITE_SERVER_URL || undefined; // undefined => same origin

export const socket = io(URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
