/**
 * roomManager.js
 * -----------------------------------------------------------------------------
 * In-memory room registry for guest multiplayer play (no database required).
 *
 * A "room" holds the full authoritative game state for a single match. Room
 * codes are 6-character uppercase strings that are guaranteed unique among the
 * currently-active rooms. Rooms expire after 30 minutes of inactivity; a janitor
 * (see startJanitor) periodically removes stale rooms so memory does not leak.
 * -----------------------------------------------------------------------------
 */

const { customAlphabet } = require('nanoid');

// Unambiguous alphabet (no 0/O/1/I) so codes are easy to read aloud / type.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = customAlphabet(CODE_ALPHABET, 6);

const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const WINNING_CORRECT = 10; // correct answers needed to win (both modes)
const ROPE_CENTER = 50; // tug-of-war rope starts centered (0..100)

/** Map<roomCode, room>. The single source of truth for all live games. */
const rooms = new Map();

/** Generate a room code that is not currently in use. */
function generateUniqueCode() {
  let code;
  do {
    code = makeCode();
  } while (rooms.has(code));
  return code;
}

/** Stamp a room as recently active to reset its inactivity TTL. */
function touch(room) {
  room.lastActivity = Date.now();
}

/**
 * Create a new room and register the host as the first player.
 * Returns the room object (status starts as "waiting").
 */
function createRoom({ hostSocketId, username, difficulty, mode }) {
  const code = generateUniqueCode();
  const room = {
    code,
    difficulty, // "elementary" | "middle" | "high"
    mode, // "tug" | "turn"
    status: 'waiting', // waiting -> playing -> finished
    players: [createPlayer(hostSocketId, username, 0)],
    usedTexts: new Set(), // prevents repeated questions within the session
    currentQuestion: null,
    ropePosition: ROPE_CENTER, // tug-of-war only
    turnIndex: 0, // turn-based only: whose turn it is (index into players)
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

/** Build a fresh player record with zeroed stats. */
function createPlayer(socketId, username, slot) {
  return {
    id: socketId, // we use the socket id as the player id
    socketId,
    username: (username || 'Player').slice(0, 16),
    slot, // 0 = left (fox), 1 = right (bear)
    connected: true,
    score: 0, // points (turn-based) — also tracked for display in tug
    correctCount: 0, // correct answers (win condition = WINNING_CORRECT)
    answeredCount: 0, // total submissions (for accuracy)
    totalResponseMs: 0, // sum of response times (for average)
    fastestMs: null,
  };
}

/** Look up a room by code (or undefined). */
function getRoom(code) {
  return rooms.get(code);
}

/** Find whichever room contains the given socket id, or undefined. */
function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) return room;
  }
  return undefined;
}

/**
 * Add a second player to an existing room. Returns { room, player } on success
 * or { error } when the room is missing / full / already started.
 */
function joinRoom({ code, socketId, username }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found. Check the code and try again.' };
  if (room.status !== 'waiting') return { error: 'That game has already started.' };
  if (room.players.length >= 2) return { error: 'That room is already full.' };

  const player = createPlayer(socketId, username, 1);
  room.players.push(player);
  touch(room);
  return { room, player };
}

/** Reset a room's per-match state so the same players can "Play Again". */
function resetRoom(room) {
  room.status = 'waiting';
  room.usedTexts = new Set();
  room.currentQuestion = null;
  room.ropePosition = ROPE_CENTER;
  room.turnIndex = 0;
  for (const p of room.players) {
    p.score = 0;
    p.correctCount = 0;
    p.answeredCount = 0;
    p.totalResponseMs = 0;
    p.fastestMs = null;
  }
  touch(room);
}

/** Remove a room entirely (e.g. when it empties out). */
function deleteRoom(code) {
  rooms.delete(code);
}

/**
 * Remove a player from a room (on disconnect). Returns the remaining player, or
 * null if the room is now empty (in which case the room is deleted).
 */
function removePlayer(room, socketId) {
  room.players = room.players.filter((p) => p.socketId !== socketId);
  if (room.players.length === 0) {
    deleteRoom(room.code);
    return null;
  }
  touch(room);
  return room.players[0];
}

/**
 * Periodically sweep out rooms that have been inactive longer than ROOM_TTL_MS.
 * Returns the interval handle so the caller can clear it during shutdown/tests.
 */
function startJanitor(intervalMs = 60 * 1000) {
  return setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      if (now - room.lastActivity > ROOM_TTL_MS) {
        rooms.delete(code);
      }
    }
  }, intervalMs);
}

module.exports = {
  rooms,
  createRoom,
  joinRoom,
  getRoom,
  getRoomBySocket,
  resetRoom,
  removePlayer,
  deleteRoom,
  startJanitor,
  touch,
  generateUniqueCode,
  constants: { ROOM_TTL_MS, WINNING_CORRECT, ROPE_CENTER },
};
