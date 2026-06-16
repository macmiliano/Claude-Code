/**
 * auth.js
 * -----------------------------------------------------------------------------
 * Google Sign-In + JWT sessions.
 *
 * Flow (no server-side OAuth redirect needed):
 *   1. The browser uses Google Identity Services to get an ID token ("credential").
 *   2. It POSTs that credential to /api/auth/google.
 *   3. We verify it here with google-auth-library (only needs GOOGLE_CLIENT_ID,
 *      no client secret), upsert the user, and return our own signed JWT.
 *   4. The client sends that JWT as a Bearer header (REST) and in the socket
 *      handshake auth (realtime) to identify itself.
 *
 * Everything degrades gracefully: if GOOGLE_CLIENT_ID / JWT_SECRET are unset,
 * `configured` is false and login is simply unavailable (guest play unaffected).
 * -----------------------------------------------------------------------------
 */

const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const TOKEN_TTL = '30d';

const configured = Boolean(GOOGLE_CLIENT_ID && JWT_SECRET);
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

/** Verify a Google ID token and return the basic profile, or throw. */
async function verifyGoogleCredential(credential) {
  if (!googleClient) throw new Error('Google login not configured');
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  return {
    sub: payload.sub, // stable Google user id
    email: payload.email,
    name: payload.name || payload.given_name || 'Player',
    picture: payload.picture || null,
  };
}

/** Sign a session JWT for one of our users. */
function signToken(user) {
  return jwt.sign({ uid: user.id, name: user.name, picture: user.picture }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

/** Verify a session JWT, returning its payload or null. */
function verifyToken(token) {
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/** Extract a Bearer token from an Express request. */
function bearerFromReq(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Express middleware: attach req.user when a valid token is present. */
function attachUser(req, _res, next) {
  req.user = verifyToken(bearerFromReq(req));
  next();
}

/** Express middleware: require a valid token (401 otherwise). */
function requireAuth(req, res, next) {
  req.user = verifyToken(bearerFromReq(req));
  if (!req.user) return res.status(401).json({ error: 'Sign in required.' });
  next();
}

module.exports = {
  configured,
  googleClientId: GOOGLE_CLIENT_ID,
  verifyGoogleCredential,
  signToken,
  verifyToken,
  attachUser,
  requireAuth,
};
