/**
 * server.js
 * -----------------------------------------------------------------------------
 * Express + Socket.IO entry point for MathClash.
 *
 * Responsibilities:
 *   - serve a tiny health endpoint (and the built frontend in production)
 *   - wire up the real-time multiplayer protocol (see the socket events below)
 *   - drive the computer opponent (bot) via server-side timers
 *
 * Socket protocol (client -> server):
 *   create-room   { username, difficulty, mode, opponent, teamSize, botLevel }
 *                                                     -> ack { roomCode, playerId, ... }
 *   join-room     { username, roomCode }              -> ack { ok, playerId, ... } | { ok:false, error }
 *   submit-answer { answer, responseMs }
 *   turn-timeout  {}                                  (turn mode: active player ran out of time)
 *   play-again    {}
 *   leave-room    {}
 *
 * Socket protocol (server -> client):
 *   room-update          { code, players, difficulty, mode, opponent, teamSize, status }
 *   game-start           { question, players, mode, difficulty, opponent, turnId, turnSeconds }
 *   answer-result        { correct, playerId, winnerSide, ropePosition?, players, nextTurnId? }
 *   next-question        { question, turnId?, turnSeconds? }
 *   game-over            { winnerId, winnerSide, stats, mode, difficulty }
 *   player-disconnected  { message }
 * -----------------------------------------------------------------------------
 */

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const roomManager = require('./src/roomManager');
const gameLogic = require('./src/gameLogic');
const botStrategy = require('./src/botStrategy');

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Simple health check (useful for deploy platforms).
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: roomManager.rooms.size, uptime: process.uptime() });
});

// In production, serve the built React app from frontend/dist.
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res, next) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next();
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

const { TURN_SECONDS } = gameLogic.constants;

/** Emit the current room snapshot to everyone in the room. */
function broadcastRoom(room) {
  io.to(room.code).emit('room-update', {
    code: room.code,
    players: gameLogic.publicPlayers(room),
    difficulty: room.difficulty,
    mode: room.mode,
    opponent: room.opponent,
    teamSize: room.teamSize,
    botLevel: room.botLevel,
    status: room.status,
  });
}

/** Cancel any pending bot action for a room. */
function clearBot(room) {
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
}

/** Kick off a match once the required humans are present (adds a bot if vs-cpu). */
function beginGame(room) {
  roomManager.ensureBot(room); // no-op unless opponent === 'cpu'
  gameLogic.startGame(room);
  io.to(room.code).emit('game-start', {
    question: gameLogic.publicQuestion(room.currentQuestion),
    players: gameLogic.publicPlayers(room),
    mode: room.mode,
    difficulty: room.difficulty,
    opponent: room.opponent,
    turnId: room.mode === 'turn' ? gameLogic.currentTurnPlayer(room)?.id : null,
    turnSeconds: TURN_SECONDS,
  });
  scheduleBot(room, true); // arm the computer opponent for the first question
}

/** Start the game automatically once enough humans have joined. */
function maybeStart(room) {
  if (room.status !== 'waiting') return;
  if (roomManager.humanCount(room) < room.teamSize) return;
  // Brief pause so both clients can render the transition.
  const delay = room.opponent === 'cpu' && room.teamSize === 1 ? 700 : 1200;
  setTimeout(() => {
    if (room.status === 'waiting' && roomManager.humanCount(room) >= room.teamSize) beginGame(room);
  }, delay);
}

/** Shared end-of-game broadcast. */
function endGame(room, winnerId, winnerSide) {
  clearBot(room);
  io.to(room.code).emit('game-over', gameLogic.buildGameOverPayload(room, winnerId, winnerSide));
}

/**
 * Broadcast a turn/answer result and advance the shared state: emit the next
 * question (if any) and re-arm the bot. Used by both human submissions and the
 * bot's own moves so behaviour stays identical.
 */
function emitResultAndAdvance(room, result) {
  io.to(room.code).emit('answer-result', {
    correct: result.correct,
    timedOut: result.timedOut || false,
    playerId: result.playerId,
    winnerSide: result.winnerSide,
    responseMs: result.responseMs,
    ropePosition: result.ropePosition,
    players: result.players,
    nextTurnId: result.nextTurnId,
  });

  if (result.gameOver) {
    endGame(room, result.winnerId, result.winnerSide);
    return;
  }
  if (result.nextQuestion) {
    io.to(room.code).emit('next-question', {
      question: result.nextQuestion,
      turnId: result.nextTurnId, // null in tug mode
      turnSeconds: TURN_SECONDS,
    });
    scheduleBot(room, true); // fresh question -> reset the bot's think timer
  } else {
    scheduleBot(room, false); // wrong tug answer -> keep the bot racing
  }
}

/** Validate + score a submission (from a human or the bot) and broadcast it. */
function processAnswer(room, competitorId, answer, responseMs) {
  const result = gameLogic.handleAnswer(room, competitorId, answer, responseMs);
  if (!result.valid) return result;
  emitResultAndAdvance(room, result);
  return result;
}

// ---------------------------------------------------------------------------
// Computer opponent (bot) orchestration. The bot knows the answer server-side
// but throttles itself with a human-like delay + accuracy cap (botStrategy.js).
// ---------------------------------------------------------------------------

/** Pick the bot's submission: the real answer when "correct", else a wrong token. */
function botSubmission(room, correct) {
  return correct ? String(room.currentQuestion.acceptable[0]) : 'wrong';
}

/** Tug mode: the bot attempts the current shared question, then keeps racing. */
function botActTug(room) {
  if (room.status !== 'playing' || !room.currentQuestion) return;
  const bot = room.players.find((p) => p.isBot);
  if (!bot) return;
  const correct = botStrategy.willAnswerCorrectly(room.botLevel);
  processAnswer(room, bot.id, botSubmission(room, correct), undefined);
}

/** Turn mode: the bot answers when it is its turn. */
function botActTurn(room) {
  if (room.status !== 'playing' || !room.currentQuestion) return;
  const bot = room.players.find((p) => p.isBot);
  if (!bot || gameLogic.currentTurnPlayer(room)?.id !== bot.id) return;
  const correct = botStrategy.willAnswerCorrectly(room.botLevel);
  processAnswer(room, bot.id, botSubmission(room, correct), undefined);
}

/**
 * (Re)arm the bot's next move. In tug mode the bot thinks continuously about the
 * current question (we don't reset its timer on every human keystroke unless the
 * question changed — `force`). In turn mode it only acts on its own turn.
 */
function scheduleBot(room, force = false) {
  const bot = room.players.find((p) => p.isBot);
  if (room.status !== 'playing' || !bot) {
    clearBot(room);
    return;
  }

  if (room.mode === 'tug') {
    if (room.botTimer && !force) return; // already thinking about this question
    clearBot(room);
    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      botActTug(room);
    }, botStrategy.nextDelay(room.botLevel));
  } else {
    clearBot(room);
    if (gameLogic.currentTurnPlayer(room)?.id === bot.id) {
      room.botTimer = setTimeout(() => {
        room.botTimer = null;
        botActTurn(room);
      }, botStrategy.nextDelay(room.botLevel));
    }
  }
}

io.on('connection', (socket) => {
  // -------------------------------------------------------------------------
  // create-room: host opens a room. vs-cpu solo starts immediately; vs-friend
  // and co-op wait for the second human to join.
  // -------------------------------------------------------------------------
  socket.on('create-room', ({ username, difficulty, mode, opponent, teamSize, botLevel }, ack) => {
    const validDifficulty = ['elementary', 'middle', 'high'].includes(difficulty)
      ? difficulty
      : 'elementary';
    const validMode = ['tug', 'turn'].includes(mode) ? mode : 'tug';
    const validOpponent = opponent === 'cpu' ? 'cpu' : 'human';
    const validBotLevel = ['easy', 'medium', 'hard'].includes(botLevel) ? botLevel : 'medium';
    // Humans needed before starting: vs-human is always 2; vs-cpu can be 1 (solo)
    // or 2 (co-op).
    let validTeamSize = validOpponent === 'human' ? 2 : Number(teamSize) === 2 ? 2 : 1;

    const room = roomManager.createRoom({
      hostSocketId: socket.id,
      username,
      difficulty: validDifficulty,
      mode: validMode,
      opponent: validOpponent,
      teamSize: validTeamSize,
      botLevel: validBotLevel,
    });
    socket.join(room.code);

    if (typeof ack === 'function') {
      ack({
        ok: true,
        roomCode: room.code,
        playerId: socket.id,
        mode: room.mode,
        difficulty: room.difficulty,
        opponent: room.opponent,
        teamSize: room.teamSize,
        botLevel: room.botLevel,
      });
    }
    broadcastRoom(room);
    maybeStart(room); // solo-vs-cpu starts right away
  });

  // -------------------------------------------------------------------------
  // join-room: a second human joins by code; the game auto-starts when full.
  // -------------------------------------------------------------------------
  socket.on('join-room', ({ username, roomCode }, ack) => {
    const code = String(roomCode || '').toUpperCase().trim();
    const { room, player, error } = roomManager.joinRoom({ code, socketId: socket.id, username });

    if (error) {
      if (typeof ack === 'function') ack({ ok: false, error });
      return;
    }

    socket.join(room.code);
    if (typeof ack === 'function') {
      ack({
        ok: true,
        roomCode: room.code,
        playerId: player.id,
        mode: room.mode,
        difficulty: room.difficulty,
        opponent: room.opponent,
        teamSize: room.teamSize,
        botLevel: room.botLevel,
      });
    }
    broadcastRoom(room);
    maybeStart(room);
  });

  // -------------------------------------------------------------------------
  // submit-answer: validated entirely server-side (anti-cheat).
  // -------------------------------------------------------------------------
  socket.on('submit-answer', ({ answer, responseMs }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;
    processAnswer(room, socket.id, answer, responseMs); // human id === socket.id
  });

  // -------------------------------------------------------------------------
  // turn-timeout: turn-based active player ran out of time -> pass the turn.
  // -------------------------------------------------------------------------
  socket.on('turn-timeout', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.mode !== 'turn') return;
    // Only the player whose turn it currently is may trigger the timeout.
    if (gameLogic.currentTurnPlayer(room)?.id !== socket.id) return;

    const result = gameLogic.handleTimeout(room);
    if (!result.valid) return;
    result.timedOut = true;
    emitResultAndAdvance(room, result);
  });

  // -------------------------------------------------------------------------
  // play-again: reset the existing room and replay with the same line-up.
  // -------------------------------------------------------------------------
  socket.on('play-again', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;
    if (roomManager.humanCount(room) < room.teamSize) {
      broadcastRoom(room);
      return;
    }
    roomManager.resetRoom(room);
    broadcastRoom(room);
    beginGame(room);
  });

  // -------------------------------------------------------------------------
  // leave-room: voluntary exit (treated like a disconnect for the opponent).
  // -------------------------------------------------------------------------
  socket.on('leave-room', () => handleLeave(socket));

  socket.on('disconnect', () => handleLeave(socket));

  /** Shared disconnect/leave handler: notify remaining humans and clean up. */
  function handleLeave(sock) {
    const room = roomManager.getRoomBySocket(sock.id);
    if (!room) return;
    sock.leave(room.code);

    const wasActive = room.status === 'playing' || room.status === 'waiting';
    const remaining = roomManager.removePlayer(room, sock.id); // deletes room if no humans left

    if (remaining) {
      clearBot(room);
      io.to(room.code).emit('player-disconnected', {
        message: 'Your opponent left the game.',
      });
      room.status = 'finished';
      if (wasActive) broadcastRoom(room);
    }
  }
});

// Start the inactivity janitor (removes rooms idle > 30 min).
const janitor = roomManager.startJanitor();

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🎮 MathClash server listening on http://localhost:${PORT}`);
});

// Graceful shutdown for clean restarts in dev.
process.on('SIGINT', () => {
  clearInterval(janitor);
  server.close(() => process.exit(0));
});

module.exports = { app, server, io };
