/**
 * api.js
 * -----------------------------------------------------------------------------
 * Tiny REST helper for the optional account system. Stores the session JWT in
 * localStorage and attaches it as a Bearer header. All calls are same-origin
 * (the backend serves the frontend), so no base URL is needed.
 */

const TOKEN_KEY = 'mathclash_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(pathname, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(pathname, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  config: () => request('/api/config'),
  me: () => request('/api/me'),
  history: () => request('/api/me/history'),
  leaderboard: () => request('/api/leaderboard'),
  liveGames: () => request('/api/live-games'),
  googleLogin: (credential) => request('/api/auth/google', { method: 'POST', body: { credential } }),
};
