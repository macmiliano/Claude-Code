/**
 * gameLogic.js
 * -----------------------------------------------------------------------------
 * Pure-ish helpers that mutate a room's authoritative state. Keeping the rules
 * here (separate from the socket wiring in server.js) makes the win conditions,
 * scoring, and rope physics easy to read and test.
 *
 * IMPORTANT: every function in this file runs ONLY on the server. The client is
 * never trusted to score answers or move the rope.
 * -----------------------------------------------------------------------------
 */

const { generateQuestion, validateAnswer } = require('./questionGenerator');
const { touch, constants } = require('./roomManager');

const { WINNING_CORRECT, ROPE_CENTER } = constants;

// Tug-of-war rope tuning. A correct answer always moves the rope by BASE_PULL;
// answering quickly adds up to SPEED_BONUS_MAX more. Values are in "rope %".
// Calibrated so a 10-answer blow-out (opponent scoreless) pulls the rope from
// the centre (50) exactly to the edge — i.e. the rope fills in lock-step with
// the "first to 10 correct" win condition, while speed still rewards a bigger
// pull. Max pull = BASE_PULL + SPEED_BONUS_MAX = 5, and 10 × 5 = 50 = half-width.
const BASE_PULL = 3.5;
const SPEED_BONUS_MAX = 1.5;
const FAST_THRESHOLD_MS = 4000; // answers at/under this time earn the full bonus

// Turn-based countdown length, surfaced so the client and server agree.
const TURN_SECONDS = 30;

/** Convenience: get the player record for a socket id within a room. */
function getPlayer(room, socketId) {
  return room.players.find((p) => p.socketId === socketId);
}

/** Build the lightweight player view sent to clients (no internal fields). */
function publicPlayers(room) {
  return room.players.map((p) => ({
    id: p.id,
    username: p.username,
    slot: p.slot,
    connected: p.connected,
    score: p.score,
    correctCount: p.correctCount,
    answeredCount: p.answeredCount,
  }));
}

/** Strip the answer before sending a question to clients (anti-cheat). */
function publicQuestion(question) {
  if (!question) return null;
  return { id: question.id, text: question.text };
}

/** Advance the room to a fresh, non-repeating question. */
function setNextQuestion(room) {
  room.currentQuestion = generateQuestion(room.difficulty, room.usedTexts);
  room.questionStartedAt = Date.now();
  return room.currentQuestion;
}

/**
 * Compute how far a correct answer pulls the rope. Faster answers pull harder:
 * a full SPEED_BONUS_MAX at/under FAST_THRESHOLD_MS, decaying linearly to 0 by
 * ~3x that time.
 */
function pullAmount(responseMs) {
  const span = FAST_THRESHOLD_MS * 2; // window over which the bonus decays
  const overBy = Math.max(0, responseMs - FAST_THRESHOLD_MS);
  const bonus = SPEED_BONUS_MAX * Math.max(0, 1 - overBy / span);
  return BASE_PULL + bonus;
}

/**
 * Process a submitted answer.
 *
 * Returns a result object describing what happened so server.js can broadcast
 * it. Shape:
 *   {
 *     valid:      boolean  // was this submission allowed at all
 *     correct:    boolean
 *     playerId:   string
 *     responseMs: number
 *     ropePosition: number // tug mode
 *     players:    object[] // updated public player list
 *     gameOver:   boolean
 *     winnerId:   string|null
 *     nextTurnId: string|null // turn mode: who plays next
 *   }
 */
function handleAnswer(room, socketId, submitted, clientResponseMs) {
  const player = getPlayer(room, socketId);
  if (!room.currentQuestion || !player || room.status !== 'playing') {
    return { valid: false };
  }

  // In turn-based mode, ignore answers from the player whose turn it isn't.
  if (room.mode === 'turn' && room.players[room.turnIndex]?.socketId !== socketId) {
    return { valid: false };
  }

  // Trust the server clock for timing; the client value is only a hint/fallback.
  const serverMs = Date.now() - (room.questionStartedAt || Date.now());
  const responseMs = Number.isFinite(clientResponseMs)
    ? Math.min(clientResponseMs, serverMs)
    : serverMs;

  // ---- Server-side validation (the ONLY place correctness is decided) ----
  const correct = validateAnswer(room.currentQuestion, submitted);

  player.answeredCount += 1;
  if (correct) {
    player.correctCount += 1;
    player.score += 1;
    player.totalResponseMs += responseMs;
    player.fastestMs =
      player.fastestMs === null ? responseMs : Math.min(player.fastestMs, responseMs);
  }

  touch(room);

  if (room.mode === 'tug') {
    return resolveTug(room, player, correct, responseMs);
  }
  return resolveTurn(room, player, correct, responseMs);
}

/** Tug-of-war resolution: move the rope and check for a winner. */
function resolveTug(room, player, correct, responseMs) {
  if (correct) {
    // The rope is pulled toward the player who answered (slot 0 = left/fox,
    // slot 1 = right/bear). 0 = fox fully wins, 100 = bear fully wins.
    const delta = pullAmount(responseMs);
    room.ropePosition += player.slot === 0 ? -delta : delta;
    room.ropePosition = Math.max(0, Math.min(100, room.ropePosition));
  }

  // Win when a player reaches the correct-answer target OR drags the rope fully.
  const ropeWin = room.ropePosition <= 0 || room.ropePosition >= 100;
  const scoreWin = player.correctCount >= WINNING_CORRECT;
  const gameOver = scoreWin || ropeWin;

  const result = {
    valid: true,
    correct,
    playerId: player.id,
    responseMs,
    ropePosition: room.ropePosition,
    players: publicPlayers(room),
    gameOver,
    winnerId: gameOver ? player.id : null,
    nextTurnId: null,
  };

  if (gameOver) {
    room.status = 'finished';
  } else if (correct) {
    // Only a CORRECT answer advances the shared question. A wrong answer simply
    // wastes time (no penalty) — the player may try the same question again.
    setNextQuestion(room);
    result.nextQuestion = publicQuestion(room.currentQuestion);
  }
  return result;
}

/** Turn-based resolution: score, hand off the turn, check for a winner. */
function resolveTurn(room, player, correct, responseMs) {
  const scoreWin = player.score >= WINNING_CORRECT;
  const gameOver = scoreWin;

  // Whether right or wrong, the turn passes to the other player.
  room.turnIndex = (room.turnIndex + 1) % room.players.length;
  const nextPlayer = room.players[room.turnIndex];

  const result = {
    valid: true,
    correct,
    playerId: player.id,
    responseMs,
    players: publicPlayers(room),
    gameOver,
    winnerId: gameOver ? player.id : null,
    nextTurnId: gameOver ? null : nextPlayer.id,
  };

  if (gameOver) {
    room.status = 'finished';
  } else {
    setNextQuestion(room);
    result.nextQuestion = publicQuestion(room.currentQuestion);
  }
  return result;
}

/**
 * Handle a turn-based timeout (the active player ran out of time). Counts as a
 * missed attempt and passes the turn. Returns the same shape as handleAnswer.
 */
function handleTimeout(room) {
  if (room.mode !== 'turn' || room.status !== 'playing') return { valid: false };
  const player = room.players[room.turnIndex];
  if (!player) return { valid: false };

  player.answeredCount += 1; // counts against accuracy
  return resolveTurn(room, player, false, TURN_SECONDS * 1000);
}

/** Compute end-of-game stats for the leaderboard screen. */
function buildGameOverPayload(room, winnerId) {
  const stats = room.players.map((p) => ({
    id: p.id,
    username: p.username,
    slot: p.slot,
    score: p.score,
    correctCount: p.correctCount,
    answeredCount: p.answeredCount,
    accuracy: p.answeredCount ? Math.round((p.correctCount / p.answeredCount) * 100) : 0,
    avgResponseMs: p.correctCount ? Math.round(p.totalResponseMs / p.correctCount) : 0,
    fastestMs: p.fastestMs,
    isWinner: p.id === winnerId,
  }));

  return {
    winnerId,
    mode: room.mode,
    difficulty: room.difficulty,
    ropePosition: room.ropePosition,
    stats,
  };
}

/** Start (or restart) a match: flip to playing and deal the first question. */
function startGame(room) {
  room.status = 'playing';
  room.ropePosition = ROPE_CENTER;
  room.turnIndex = 0;
  setNextQuestion(room);
  return room;
}

module.exports = {
  startGame,
  handleAnswer,
  handleTimeout,
  setNextQuestion,
  buildGameOverPayload,
  publicPlayers,
  publicQuestion,
  pullAmount,
  constants: { TURN_SECONDS, BASE_PULL, SPEED_BONUS_MAX, WINNING_CORRECT },
};
