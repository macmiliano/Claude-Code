/**
 * server.js
 * -----------------------------------------------------------------------------
 * Express + Socket.IO entry point for MathClash.
 *
 * Responsibilities:
 *   - REST API: health, config, Google auth, profile/history, leaderboard, live games
 *   - real-time multiplayer protocol (rooms, gameplay, bot, spectators)
 *   - serve the built frontend in production
 *
 * Socket protocol — client -> server:
 *   create-room   { username, difficulty, mode, opponent, teamSize, botLevel }
 *   join-room     { username, roomCode }
 *   submit-answer { answer, responseMs }
 *   turn-timeout  {}
 *   play-again    {}
 *   leave-room    {}
 *   spectate-room { roomCode }          -> ack { ok, error? }  (Watch-Live)
 *   stop-spectating {}
 *   list-live-games {}                  -> ack [ live games ]
 *
 * Socket protocol — server -> client:
 *   room-update, game-start, answer-result, next-question, game-over,
 *   player-disconnected, spectator-state, spectators-update
 * -----------------------------------------------------------------------------
 */

// Load backend/.env (if present) before anything reads process.env.
require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const roomManager = require('./src/roomManager');
const gameLogic = require('./src/gameLogic');
const botStrategy = require('./src/botStrategy');
const db = require('./src/db');
const stats = require('./src/stats');
const auth = require('./src/auth');

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// ---------------------------------------------------------------------------
// REST API (registered BEFORE the static/SPA catch-all)
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: roomManager.rooms.size, uptime: process.uptime() });
});

// Tells the frontend whether login/leaderboard are available + the Google client id.
app.get('/api/config', (_req, res) => {
  res.json({
    googleClientId: auth.googleClientId || null,
    accountsEnabled: db.enabled && auth.configured,
  });
});

// Exchange a Google ID-token ("credential") for our own session JWT.
app.post('/api/auth/google', async (req, res) => {
  if (!auth.configured || !db.enabled) {
    return res.status(503).json({ error: 'Accounts are not enabled on this server.' });
  }
  try {
    const profile = await auth.verifyGoogleCredential(req.body?.credential);
    const user = await stats.upsertGoogleUser(profile);
    const token = auth.signToken(user);
    res.json({ token, user: stats.publicUser(user) });
  } catch (err) {
    res.status(401).json({ error: 'Google sign-in failed.' });
  }
});

// Current signed-in user.
app.get('/api/me', auth.requireAuth, async (req, res) => {
  try {
    const user = await stats.getUserById(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: stats.publicUser(user) });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Profile dashboard: lifetime stats + history + per-difficulty breakdown.
app.get('/api/me/history', auth.requireAuth, async (req, res) => {
  try {
    const profile = await stats.getProfile(req.user.uid);
    res.json(profile || { error: 'not found' });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Global leaderboard (top players by lifetime points).
app.get('/api/leaderboard', async (_req, res) => {
  if (!db.enabled) return res.json({ enabled: false, leaderboard: [] });
  try {
    res.json({ enabled: true, leaderboard: await stats.getLeaderboard(25) });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Public list of in-progress games to watch.
app.get('/api/live-games', (_req, res) => {
  res.json({ games: roomManager.listLiveGames() });
});

// In production, serve the built React app from frontend/dist (after the API).
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

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

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

function broadcastSpectators(room) {
  io.to(room.code).emit('spectators-update', { count: room.spectators.size });
}

function clearBot(room) {
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
}

function beginGame(room) {
  roomManager.ensureBot(room);
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
  scheduleBot(room, true);
}

function maybeStart(room) {
  if (room.status !== 'waiting') return;
  if (roomManager.humanCount(room) < room.teamSize) return;
  const delay = room.opponent === 'cpu' && room.teamSize === 1 ? 700 : 1200;
  setTimeout(() => {
    if (room.status === 'waiting' && roomManager.humanCount(room) >= room.teamSize) beginGame(room);
  }, delay);
}

/** Persist match results for any signed-in human players (fire-and-forget). */
function persistResults(room, winnerSide) {
  if (!db.enabled) return;
  for (const p of room.players) {
    if (p.isBot || !p.userId) continue;
    stats
      .recordMatch(p.userId, {
        mode: room.mode,
        difficulty: room.difficulty,
        opponent: room.opponent,
        win: p.side === winnerSide,
        correct: p.correctCount,
        answered: p.answeredCount,
      })
      .catch((err) => console.error('recordMatch failed:', err.message));
  }
}

function endGame(room, winnerId, winnerSide) {
  clearBot(room);
  persistResults(room, winnerSide);
  io.to(room.code).emit('game-over', gameLogic.buildGameOverPayload(room, winnerId, winnerSide));
}

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
      turnId: result.nextTurnId,
      turnSeconds: TURN_SECONDS,
    });
    scheduleBot(room, true);
  } else {
    scheduleBot(room, false);
  }
}

function processAnswer(room, competitorId, answer, responseMs) {
  const result = gameLogic.handleAnswer(room, competitorId, answer, responseMs);
  if (!result.valid) return result;
  emitResultAndAdvance(room, result);
  return result;
}

// --- Computer opponent ----------------------------------------------------

function botSubmission(room, correct) {
  return correct ? String(room.currentQuestion.acceptable[0]) : 'wrong';
}

function botActTug(room) {
  if (room.status !== 'playing' || !room.currentQuestion) return;
  const bot = room.players.find((p) => p.isBot);
  if (!bot) return;
  processAnswer(room, bot.id, botSubmission(room, botStrategy.willAnswerCorrectly(room.botLevel)), undefined);
}

function botActTurn(room) {
  if (room.status !== 'playing' || !room.currentQuestion) return;
  const bot = room.players.find((p) => p.isBot);
  if (!bot || gameLogic.currentTurnPlayer(room)?.id !== bot.id) return;
  processAnswer(room, bot.id, botSubmission(room, botStrategy.willAnswerCorrectly(room.botLevel)), undefined);
}

function scheduleBot(room, force = false) {
  const bot = room.players.find((p) => p.isBot);
  if (room.status !== 'playing' || !bot) {
    clearBot(room);
    return;
  }
  if (room.mode === 'tug') {
    if (room.botTimer && !force) return;
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

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------

// Identify signed-in sockets from the handshake auth token (optional).
io.use((socket, next) => {
  socket.data.user = auth.verifyToken(socket.handshake.auth?.token);
  next();
});

io.on('connection', (socket) => {
  const userId = () => socket.data.user?.uid || null;

  socket.on('create-room', ({ username, difficulty, mode, opponent, teamSize, botLevel }, ack) => {
    const validDifficulty = ['elementary', 'middle', 'high'].includes(difficulty) ? difficulty : 'elementary';
    const validMode = ['tug', 'turn'].includes(mode) ? mode : 'tug';
    const validOpponent = opponent === 'cpu' ? 'cpu' : 'human';
    const validBotLevel = ['easy', 'medium', 'hard'].includes(botLevel) ? botLevel : 'medium';
    const validTeamSize = validOpponent === 'human' ? 2 : Number(teamSize) === 2 ? 2 : 1;

    const room = roomManager.createRoom({
      hostSocketId: socket.id,
      username,
      difficulty: validDifficulty,
      mode: validMode,
      opponent: validOpponent,
      teamSize: validTeamSize,
      botLevel: validBotLevel,
      userId: userId(),
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
    maybeStart(room);
  });

  socket.on('join-room', ({ username, roomCode }, ack) => {
    const code = String(roomCode || '').toUpperCase().trim();
    const { room, player, error } = roomManager.joinRoom({
      code,
      socketId: socket.id,
      username,
      userId: userId(),
    });

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

  socket.on('submit-answer', ({ answer, responseMs }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return; // spectators / unknown sockets are ignored (anti-cheat)
    processAnswer(room, socket.id, answer, responseMs);
  });

  socket.on('turn-timeout', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.mode !== 'turn') return;
    if (gameLogic.currentTurnPlayer(room)?.id !== socket.id) return;
    const result = gameLogic.handleTimeout(room);
    if (!result.valid) return;
    result.timedOut = true;
    emitResultAndAdvance(room, result);
  });

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

  // ---- Spectating (Watch-Live) -------------------------------------------

  socket.on('list-live-games', (ack) => {
    if (typeof ack === 'function') ack({ games: roomManager.listLiveGames() });
  });

  socket.on('spectate-room', ({ roomCode }, ack) => {
    const code = String(roomCode || '').toUpperCase().trim();
    const room = roomManager.getRoom(code);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'That game was not found.' });
      return;
    }
    roomManager.addSpectator(code, socket.id);
    socket.join(code); // receive all live game broadcasts
    if (typeof ack === 'function') ack({ ok: true });
    // Send the full current snapshot just to this spectator, then update counts.
    socket.emit('spectator-state', gameLogic.buildSpectatorState(room));
    broadcastSpectators(room);
  });

  socket.on('stop-spectating', ({ roomCode } = {}) => {
    const code = String(roomCode || '').toUpperCase().trim();
    const room = roomManager.getRoom(code);
    roomManager.removeSpectator(code, socket.id);
    socket.leave(code);
    if (room) broadcastSpectators(room);
  });

  socket.on('leave-room', () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));

  /** Shared disconnect/leave handler for both players and spectators. */
  function handleLeave(sock) {
    // Spectator path: just drop them and update the watch count.
    const specRoom = roomManager.removeSpectatorEverywhere(sock.id);
    if (specRoom) {
      sock.leave(specRoom.code);
      broadcastSpectators(specRoom);
    }

    // Player path: end the match for the remaining humans.
    const room = roomManager.getRoomBySocket(sock.id);
    if (!room) return;
    sock.leave(room.code);
    const wasActive = room.status === 'playing' || room.status === 'waiting';
    const remaining = roomManager.removePlayer(room, sock.id);
    if (remaining) {
      clearBot(room);
      io.to(room.code).emit('player-disconnected', { message: 'Your opponent left the game.' });
      room.status = 'finished';
      if (wasActive) broadcastRoom(room);
    }
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const janitor = roomManager.startJanitor();

db.init()
  .catch((err) => console.error('DB init failed:', err.message))
  .finally(() => {
    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`🎮 MathClash server listening on http://localhost:${PORT}`);
    });
  });

process.on('SIGINT', () => {
  clearInterval(janitor);
  server.close(() => process.exit(0));
});

module.exports = { app, server, io };
