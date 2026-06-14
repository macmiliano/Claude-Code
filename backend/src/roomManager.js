/**
 * roomManager.js
 * -----------------------------------------------------------------------------
 * In-memory room registry for guest multiplayer play (no database required).
 *
 * A "room" holds the full authoritative game state for a single match. Room
 * codes are 6-character uppercase strings that are guaranteed unique among the
 * currently-active rooms. Rooms expire after 30 minutes of inactivity; a janitor
 * (see startJanitor) periodically removes stale rooms so memory does not leak.
 *
 * TEAMS / SIDES
 * -------------
 * Every competitor belongs to a "side": 0 = left (fox), 1 = right (bear). A side
 * can hold one or two humans, or a single computer-controlled bot. This supports:
 *   - Human vs Human   (1 human on each side)
 *   - Solo vs Computer (1 human on side 0, 1 bot on side 1)
 *   - Co-op vs Computer(2 humans share side 0, 1 bot on side 1)
 * Win conditions aggregate per SIDE (see gameLogic.js).
 * -----------------------------------------------------------------------------
 */

const { customAlphabet } = require('nanoid');

// Unambiguous alphabet (no 0/O/1/I) so codes are easy to read aloud / type.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = customAlphabet(CODE_ALPHABET, 6);

const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const WINNING_CORRECT = 10; // correct answers needed to win (both modes)
const ROPE_CENTER = 50; // tug-of-war rope starts centered (0..100)

const BOT_NAMES = { easy: 'Rookie Robo', medium: 'Mathbot', hard: 'Pro Calculator' };

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
 * Create a new room and register the host as the first player (side 0).
 *
 * @param opponent  'human' | 'cpu'  — is the other side a friend or a bot?
 * @param teamSize  number of HUMAN players expected before the game starts
 *                  (1 = solo-vs-cpu, 2 = human-vs-human or co-op-vs-cpu)
 * @param botLevel  'easy' | 'medium' | 'hard' (only used when opponent === 'cpu')
 */
function createRoom({ hostSocketId, username, difficulty, mode, opponent = 'human', teamSize = 2, botLevel = 'medium' }) {
  const code = generateUniqueCode();
  const room = {
    code,
    difficulty, // "elementary" | "middle" | "high"
    mode, // "tug" | "turn"
    opponent, // "human" | "cpu"
    teamSize, // number of humans required to start
    botLevel, // bot skill when opponent === "cpu"
    status: 'waiting', // waiting -> playing -> finished
    players: [createPlayer({ socketId: hostSocketId, username, side: 0 })],
    usedTexts: new Set(), // prevents repeated questions within the session
    currentQuestion: null,
    ropePosition: ROPE_CENTER, // tug-of-war only
    // Turn-based bookkeeping: alternate by side, rotate members within a side.
    turnSide: 0,
    sideMemberIdx: { 0: 0, 1: 0 },
    botTimer: null, // active setTimeout handle for the bot (server-only)
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

/** Build a fresh competitor record with zeroed stats. */
function createPlayer({ socketId, username, side, isBot = false }) {
  return {
    id: socketId || `bot:${Math.random().toString(36).slice(2, 9)}`, // bots have no socket
    socketId: socketId || null,
    username: (username || 'Player').slice(0, 16),
    side, // 0 = left (fox), 1 = right (bear)
    slot: side, // kept for backward-compatible visuals (avatar by side)
    isBot,
    connected: true,
    score: 0, // points (turn-based) — also tracked for display in tug
    correctCount: 0, // correct answers (win condition aggregates per side)
    answeredCount: 0, // total submissions (for accuracy)
    totalResponseMs: 0, // sum of response times (for average)
    fastestMs: null,
  };
}

/**
 * Ensure a computer opponent exists on side 1 when the room is vs-cpu. Called
 * just before the game starts (and is a no-op if a bot is already present).
 */
function ensureBot(room) {
  if (room.opponent !== 'cpu') return null;
  let bot = room.players.find((p) => p.isBot);
  if (!bot) {
    bot = createPlayer({
      socketId: null,
      username: BOT_NAMES[room.botLevel] || 'Computer',
      side: 1,
      isBot: true,
    });
    room.players.push(bot);
  }
  return bot;
}

/** Count the human (non-bot) players in a room. */
function humanCount(room) {
  return room.players.filter((p) => !p.isBot).length;
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
 * Add a human player to an existing room. Humans always join side 0 in co-op
 * (sharing with the host) when the opponent is the computer; otherwise they take
 * side 1 (classic 1-v-1). Returns { room, player } or { error }.
 */
function joinRoom({ code, socketId, username }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found. Check the code and try again.' };
  if (room.status !== 'waiting') return { error: 'That game has already started.' };
  if (humanCount(room) >= room.teamSize) return { error: 'That room is already full.' };

  // vs-cpu co-op: the joining friend teams up on side 0. vs-human: they take side 1.
  const side = room.opponent === 'cpu' ? 0 : 1;
  const player = createPlayer({ socketId, username, side });
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
  room.turnSide = 0;
  room.sideMemberIdx = { 0: 0, 1: 0 };
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
  if (rooms.get(code)?.botTimer) clearTimeout(rooms.get(code).botTimer);
  rooms.delete(code);
}

/**
 * Remove a human player from a room (on disconnect). Returns the first remaining
 * human, or null if no humans remain (in which case the room is deleted — a bot
 * alone is meaningless).
 */
function removePlayer(room, socketId) {
  room.players = room.players.filter((p) => p.socketId !== socketId);
  const remainingHumans = room.players.filter((p) => !p.isBot);
  if (remainingHumans.length === 0) {
    deleteRoom(room.code);
    return null;
  }
  touch(room);
  return remainingHumans[0];
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
        deleteRoom(code);
      }
    }
  }, intervalMs);
}

module.exports = {
  rooms,
  createRoom,
  joinRoom,
  ensureBot,
  humanCount,
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
