import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';

/**
 * GameContext centralises all multiplayer state and the Socket.IO wiring so the
 * individual pages stay focused on presentation. It owns:
 *   - the player's display name + assigned player id
 *   - the current room (code, mode, difficulty, players, status)
 *   - live gameplay state (question, rope position, whose turn, last result)
 *   - the end-of-game payload
 * and exposes action helpers (createRoom, joinRoom, submitAnswer, ...).
 */
const GameContext = createContext(null);

export function GameProvider({ children }) {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [playerId, setPlayerId] = useState(socket.id || null);
  const [room, setRoom] = useState(null); // { code, mode, difficulty, status, players }
  const [question, setQuestion] = useState(null);
  const [ropePosition, setRopePosition] = useState(50);
  const [turnId, setTurnId] = useState(null);
  const [turnSeconds, setTurnSeconds] = useState(30);
  const [lastResult, setLastResult] = useState(null); // { correct, playerId, timedOut }
  const [gameOver, setGameOver] = useState(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [connecting, setConnecting] = useState(!socket.connected);

  // A monotonically increasing tick so pages can react to each new question
  // (e.g. reset the input and restart the turn timer) even if text repeats.
  const [questionTick, setQuestionTick] = useState(0);

  // Keep a ref to the latest room so socket handlers (registered once) can read
  // current values without stale closures.
  const roomRef = useRef(room);
  roomRef.current = room;

  // -------------------------------------------------------------------------
  // Register socket listeners exactly once.
  // -------------------------------------------------------------------------
  useEffect(() => {
    function onConnect() {
      setPlayerId(socket.id);
      setConnecting(false);
    }
    function onDisconnect() {
      setConnecting(true);
    }

    function onRoomUpdate(data) {
      setRoom((prev) => ({ ...prev, ...data }));
    }

    function onGameStart(data) {
      setRoom((prev) => ({
        ...prev,
        players: data.players,
        mode: data.mode,
        difficulty: data.difficulty,
        status: 'playing',
      }));
      setQuestion(data.question);
      setTurnId(data.turnId);
      setTurnSeconds(data.turnSeconds || 30);
      setRopePosition(50);
      setLastResult(null);
      setGameOver(null);
      setOpponentLeft(false);
      setQuestionTick((t) => t + 1);
      navigate('/game');
    }

    function onAnswerResult(data) {
      if (data.players) {
        setRoom((prev) => ({ ...prev, players: data.players }));
      }
      if (typeof data.ropePosition === 'number') setRopePosition(data.ropePosition);
      setLastResult({
        correct: data.correct,
        playerId: data.playerId,
        timedOut: data.timedOut || false,
        at: Date.now(),
      });
    }

    function onNextQuestion(data) {
      setQuestion(data.question);
      if (data.turnId !== undefined) setTurnId(data.turnId);
      if (data.turnSeconds) setTurnSeconds(data.turnSeconds);
      setQuestionTick((t) => t + 1);
    }

    function onGameOver(data) {
      setGameOver(data);
      setRoom((prev) => ({ ...prev, status: 'finished' }));
      navigate('/results');
    }

    function onPlayerDisconnected(data) {
      setOpponentLeft(true);
      setLastResult(null);
      // If we were mid-game, surface the result screen with the disconnect note.
      setGameOver((prev) => prev || { disconnected: true, message: data.message, stats: [] });
      navigate('/results');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-update', onRoomUpdate);
    socket.on('game-start', onGameStart);
    socket.on('answer-result', onAnswerResult);
    socket.on('next-question', onNextQuestion);
    socket.on('game-over', onGameOver);
    socket.on('player-disconnected', onPlayerDisconnected);

    if (socket.connected) setPlayerId(socket.id);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-update', onRoomUpdate);
      socket.off('game-start', onGameStart);
      socket.off('answer-result', onAnswerResult);
      socket.off('next-question', onNextQuestion);
      socket.off('game-over', onGameOver);
      socket.off('player-disconnected', onPlayerDisconnected);
    };
  }, [navigate]);

  // -------------------------------------------------------------------------
  // Action helpers (wrap socket emits with acknowledgements where useful).
  // -------------------------------------------------------------------------
  const createRoom = useCallback(
    (difficulty, mode) =>
      new Promise((resolve) => {
        socket.emit('create-room', { username, difficulty, mode }, (res) => {
          if (res?.ok) {
            setPlayerId(res.playerId);
            setRoom({
              code: res.roomCode,
              mode: res.mode,
              difficulty: res.difficulty,
              status: 'waiting',
              players: [],
            });
          }
          resolve(res);
        });
      }),
    [username],
  );

  const joinRoom = useCallback(
    (roomCode) =>
      new Promise((resolve) => {
        socket.emit('join-room', { username, roomCode }, (res) => {
          if (res?.ok) {
            setPlayerId(res.playerId);
            setRoom({
              code: res.roomCode,
              mode: res.mode,
              difficulty: res.difficulty,
              status: 'waiting',
              players: [],
            });
          }
          resolve(res);
        });
      }),
    [username],
  );

  const submitAnswer = useCallback((answer, responseMs) => {
    socket.emit('submit-answer', { answer, responseMs });
  }, []);

  const sendTimeout = useCallback(() => {
    socket.emit('turn-timeout');
  }, []);

  const playAgain = useCallback(() => {
    setGameOver(null);
    setOpponentLeft(false);
    socket.emit('play-again');
  }, []);

  const leaveRoom = useCallback(() => {
    socket.emit('leave-room');
    setRoom(null);
    setQuestion(null);
    setGameOver(null);
    setOpponentLeft(false);
    setRopePosition(50);
    navigate('/lobby');
  }, [navigate]);

  const value = {
    // state
    username,
    playerId,
    room,
    question,
    ropePosition,
    turnId,
    turnSeconds,
    lastResult,
    gameOver,
    opponentLeft,
    connecting,
    questionTick,
    // setters / actions
    setUsername,
    createRoom,
    joinRoom,
    submitAnswer,
    sendTimeout,
    playAgain,
    leaveRoom,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}
