/**
 * gameLogic.js
 * -----------------------------------------------------------------------------
 * Pure-ish helpers that mutate a room's authoritative state. Keeping the rules
 * here (separate from the socket wiring in server.js) makes the win conditions,
 * scoring, and rope physics easy to read and test.
 *
 * SIDES / TEAMS: competitors belong to side 0 (left/fox) or side 1 (right/bear).
 * A side may hold one or two humans, or a single bot. Win conditions aggregate
 * per SIDE, so two co-op humans pool their correct answers against the computer.
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

// ---------------------------------------------------------------------------
// Team / side helpers
// ---------------------------------------------------------------------------

/** Find a competitor by id (works for both humans and bots). */
function getPlayer(room, id) {
  return room.players.find((p) => p.id === id);
}

/** All competitors on a given side, in stable join order. */
function competitorsOnSide(room, side) {
  return room.players.filter((p) => p.side === side);
}

/** Combined correct answers for a side (tug win aggregates here). */
function sideCorrect(room, side) {
  return competitorsOnSide(room, side).reduce((sum, p) => sum + p.correctCount, 0);
}

/** Combined score for a side (turn-based win aggregates here). */
function sideScore(room, side) {
  return competitorsOnSide(room, side).reduce((sum, p) => sum + p.score, 0);
}

/** The competitor whose turn it currently is (turn-based mode). */
function currentTurnPlayer(room) {
  const members = competitorsOnSide(room, room.turnSide);
  if (members.length === 0) return null;
  const idx = room.sideMemberIdx[room.turnSide] % members.length;
  return members[idx];
}

/**
 * Advance the turn: rotate to the next member within the active side, then hand
 * off to the other side. For 1-v-1 this simply alternates the two players; for
 * co-op it cycles human1 -> bot -> human2 -> bot -> ...
 */
function advanceTurn(room) {
  const members = competitorsOnSide(room, room.turnSide);
  if (members.length > 0) {
    room.sideMemberIdx[room.turnSide] = (room.sideMemberIdx[room.turnSide] + 1) % members.length;
  }
  room.turnSide = room.turnSide === 0 ? 1 : 0;
}

/** Build the lightweight player view sent to clients (no internal fields). */
function publicPlayers(room) {
  return room.players.map((p) => ({
    id: p.id,
    username: p.username,
    slot: p.slot,
    side: p.side,
    isBot: p.isBot,
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
 * a full SPEED_BONUS_MAX at/under FAST_THRESHOLD_MS, decaying linearly to 0.
 */
function pullAmount(responseMs) {
  const span = FAST_THRESHOLD_MS * 2; // window over which the bonus decays
  const overBy = Math.max(0, responseMs - FAST_THRESHOLD_MS);
  const bonus = SPEED_BONUS_MAX * Math.max(0, 1 - overBy / span);
  return BASE_PULL + bonus;
}

/**
 * Process a submitted answer from a competitor (human or bot).
 *
 * Returns a result object describing what happened so server.js can broadcast
 * it (see the fields assigned below).
 */
function handleAnswer(room, competitorId, submitted, clientResponseMs) {
  const player = getPlayer(room, competitorId);
  if (!room.currentQuestion || !player || room.status !== 'playing') {
    return { valid: false };
  }

  // In turn-based mode, ignore answers from anyone but the active competitor.
  if (room.mode === 'turn' && currentTurnPlayer(room)?.id !== competitorId) {
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

/** Tug-of-war resolution: move the rope and check for a winning side. */
function resolveTug(room, player, correct, responseMs) {
  if (correct) {
    // The rope is pulled toward the answerer's side (side 0 = left/fox,
    // side 1 = right/bear). 0 = fox side fully wins, 100 = bear side fully wins.
    const delta = pullAmount(responseMs);
    room.ropePosition += player.side === 0 ? -delta : delta;
    room.ropePosition = Math.max(0, Math.min(100, room.ropePosition));
  }

  // Win when a SIDE reaches the combined correct-answer target OR drags the rope
  // fully to its edge.
  const ropeWin = room.ropePosition <= 0 || room.ropePosition >= 100;
  const scoreWin = sideCorrect(room, player.side) >= WINNING_CORRECT;
  const gameOver = scoreWin || ropeWin;
  const winnerSide = gameOver ? player.side : null;

  const result = {
    valid: true,
    correct,
    playerId: player.id,
    winnerSide,
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
    // wastes time (no penalty) — players may retry the same question.
    setNextQuestion(room);
    result.nextQuestion = publicQuestion(room.currentQuestion);
  }
  return result;
}

/** Turn-based resolution: score, hand off the turn, check for a winning side. */
function resolveTurn(room, player, correct, responseMs) {
  const scoreWin = sideScore(room, player.side) >= WINNING_CORRECT;
  const gameOver = scoreWin;
  const winnerSide = gameOver ? player.side : null;

  // Whether right or wrong, the turn passes on.
  if (!gameOver) advanceTurn(room);
  const nextPlayer = gameOver ? null : currentTurnPlayer(room);

  const result = {
    valid: true,
    correct,
    playerId: player.id,
    winnerSide,
    responseMs,
    players: publicPlayers(room),
    gameOver,
    winnerId: gameOver ? player.id : null,
    nextTurnId: nextPlayer ? nextPlayer.id : null,
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
  const player = currentTurnPlayer(room);
  if (!player) return { valid: false };

  player.answeredCount += 1; // counts against accuracy
  return resolveTurn(room, player, false, TURN_SECONDS * 1000);
}

/** Compute end-of-game stats for the leaderboard screen. */
function buildGameOverPayload(room, winnerId, winnerSide) {
  const stats = room.players.map((p) => ({
    id: p.id,
    username: p.username,
    slot: p.slot,
    side: p.side,
    isBot: p.isBot,
    score: p.score,
    correctCount: p.correctCount,
    answeredCount: p.answeredCount,
    accuracy: p.answeredCount ? Math.round((p.correctCount / p.answeredCount) * 100) : 0,
    avgResponseMs: p.correctCount ? Math.round(p.totalResponseMs / p.correctCount) : 0,
    fastestMs: p.fastestMs,
    isWinner: p.side === winnerSide,
  }));

  return {
    winnerId,
    winnerSide,
    mode: room.mode,
    difficulty: room.difficulty,
    opponent: room.opponent,
    ropePosition: room.ropePosition,
    stats,
  };
}

/** Start (or restart) a match: flip to playing and deal the first question. */
function startGame(room) {
  room.status = 'playing';
  room.ropePosition = ROPE_CENTER;
  room.turnSide = 0;
  room.sideMemberIdx = { 0: 0, 1: 0 };
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
  currentTurnPlayer,
  competitorsOnSide,
  sideCorrect,
  sideScore,
  constants: { TURN_SECONDS, BASE_PULL, SPEED_BONUS_MAX, WINNING_CORRECT },
};
