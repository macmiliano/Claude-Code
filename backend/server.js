/**
 * server.js
 * -----------------------------------------------------------------------------
 * Express + Socket.IO entry point for MathClash.
 *
 * Responsibilities:
 *   - serve a tiny health endpoint (and the built frontend in production)
 *   - wire up the real-time multiplayer protocol (see the socket events below)
 *
 * Socket protocol (client -> server):
 *   create-room   { username, difficulty, mode }      -> ack { roomCode, playerId, mode, difficulty }
 *   join-room     { username, roomCode }              -> ack { ok, playerId, ... } | { ok:false, error }
 *   submit-answer { answer, responseMs }
 *   turn-timeout  {}                                  (turn mode: active player ran out of time)
 *   play-again    {}
 *   leave-room    {}
 *
 * Socket protocol (server -> client):
 *   room-update          { code, players, difficulty, mode, status }
 *   game-start           { question, players, mode, difficulty, turnId, turnSeconds }
 *   answer-result        { correct, playerId, responseMs, ropePosition?, players, nextTurnId? }
 *   next-question        { question, turnId?, turnSeconds? }
 *   game-over            { winnerId, stats, mode, difficulty }
 *   player-disconnected  { message }
 *   error-message        { message }
 * -----------------------------------------------------------------------------
 */

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const roomManager = require('./src/roomManager');
const gameLogic = require('./src/gameLogic');

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
    status: room.status,
  });
}

/** Kick off a match once two players are present. */
function beginGame(room) {
  gameLogic.startGame(room);
  io.to(room.code).emit('game-start', {
    question: gameLogic.publicQuestion(room.currentQuestion),
    players: gameLogic.publicPlayers(room),
    mode: room.mode,
    difficulty: room.difficulty,
    turnId: room.mode === 'turn' ? room.players[room.turnIndex].id : null,
    turnSeconds: TURN_SECONDS,
  });
}

/** Shared end-of-game broadcast. */
function endGame(room, winnerId) {
  const payload = gameLogic.buildGameOverPayload(room, winnerId);
  io.to(room.code).emit('game-over', payload);
}

io.on('connection', (socket) => {
  // -------------------------------------------------------------------------
  // create-room: host opens a room and waits for a friend.
  // -------------------------------------------------------------------------
  socket.on('create-room', ({ username, difficulty, mode }, ack) => {
    const validDifficulty = ['elementary', 'middle', 'high'].includes(difficulty)
      ? difficulty
      : 'elementary';
    const validMode = ['tug', 'turn'].includes(mode) ? mode : 'tug';

    const room = roomManager.createRoom({
      hostSocketId: socket.id,
      username,
      difficulty: validDifficulty,
      mode: validMode,
    });
    socket.join(room.code);

    if (typeof ack === 'function') {
      ack({
        ok: true,
        roomCode: room.code,
        playerId: socket.id,
        mode: room.mode,
        difficulty: room.difficulty,
      });
    }
    broadcastRoom(room);
  });

  // -------------------------------------------------------------------------
  // join-room: a second player joins by code; the game auto-starts when full.
  // -------------------------------------------------------------------------
  socket.on('join-room', ({ username, roomCode }, ack) => {
    const code = String(roomCode || '').toUpperCase().trim();
    const { room, player, error } = roomManager.joinRoom({
      code,
      socketId: socket.id,
      username,
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
      });
    }
    broadcastRoom(room);

    // Two players present -> start automatically after a short beat so both
    // clients have time to render the waiting room transition.
    if (room.players.length === 2) {
      setTimeout(() => {
        if (room.players.length === 2 && room.status === 'waiting') beginGame(room);
      }, 1200);
    }
  });

  // -------------------------------------------------------------------------
  // submit-answer: validated entirely server-side (anti-cheat).
  // -------------------------------------------------------------------------
  socket.on('submit-answer', ({ answer, responseMs }) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;

    const result = gameLogic.handleAnswer(room, socket.id, answer, responseMs);
    if (!result.valid) return;

    io.to(room.code).emit('answer-result', {
      correct: result.correct,
      playerId: result.playerId,
      responseMs: result.responseMs,
      ropePosition: result.ropePosition,
      players: result.players,
      nextTurnId: result.nextTurnId,
    });

    if (result.gameOver) {
      endGame(room, result.winnerId);
    } else if (result.nextQuestion) {
      io.to(room.code).emit('next-question', {
        question: result.nextQuestion,
        turnId: result.nextTurnId, // null in tug mode
        turnSeconds: TURN_SECONDS,
      });
    }
  });

  // -------------------------------------------------------------------------
  // turn-timeout: turn-based active player ran out of time -> pass the turn.
  // -------------------------------------------------------------------------
  socket.on('turn-timeout', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room || room.mode !== 'turn') return;
    // Only the player whose turn it currently is may trigger the timeout.
    if (room.players[room.turnIndex]?.socketId !== socket.id) return;

    const result = gameLogic.handleTimeout(room);
    if (!result.valid) return;

    io.to(room.code).emit('answer-result', {
      correct: false,
      timedOut: true,
      playerId: result.playerId,
      players: result.players,
      nextTurnId: result.nextTurnId,
    });

    if (result.gameOver) {
      endGame(room, result.winnerId);
    } else if (result.nextQuestion) {
      io.to(room.code).emit('next-question', {
        question: result.nextQuestion,
        turnId: result.nextTurnId,
        turnSeconds: TURN_SECONDS,
      });
    }
  });

  // -------------------------------------------------------------------------
  // play-again: reset the existing room and replay with the same opponent.
  // -------------------------------------------------------------------------
  socket.on('play-again', () => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;
    if (room.players.length < 2) {
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

  /** Shared disconnect/leave handler: notify the opponent and clean up. */
  function handleLeave(sock) {
    const room = roomManager.getRoomBySocket(sock.id);
    if (!room) return;
    sock.leave(room.code);

    const wasPlaying = room.status === 'playing' || room.status === 'waiting';
    const remaining = roomManager.removePlayer(room, sock.id);

    if (remaining) {
      // Tell the surviving player their opponent vanished.
      io.to(room.code).emit('player-disconnected', {
        message: 'Your opponent left the game.',
      });
      room.status = 'finished';
      if (wasPlaying) broadcastRoom(room);
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
