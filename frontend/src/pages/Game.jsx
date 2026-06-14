import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TugRope from '../components/TugRope.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import { useGame } from '../context/GameContext.jsx';

const WIN_TARGET = 10;

/**
 * Game — the live gameplay screen for both modes, supporting teams:
 * a side may hold one or two humans, or the computer bot. Progress and the rope
 * aggregate per SIDE (so co-op teammates' correct answers pool together).
 *
 * Tug-of-War: everyone races on the SAME question; correct answers move the rope.
 * Turn-Based: competitors alternate (server-authoritative); a countdown runs on
 * the active human's turn.
 */
export default function Game() {
  const navigate = useNavigate();
  const {
    room,
    playerId,
    question,
    ropePosition,
    turnId,
    turnSeconds,
    lastResult,
    questionTick,
    submitAnswer,
    sendTimeout,
    leaveRoom,
  } = useGame();

  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong"
  const [secondsLeft, setSecondsLeft] = useState(turnSeconds);

  // Track when the current question appeared, to measure response time.
  const questionStartRef = useRef(Date.now());

  const mode = room?.mode;
  const players = room?.players || [];
  const me = players.find((p) => p.id === playerId);
  const mySide = me?.side ?? 0;
  const oppSide = mySide === 0 ? 1 : 0;

  // Team rosters and aggregate scores.
  const myTeam = players.filter((p) => p.side === mySide);
  const oppTeam = players.filter((p) => p.side === oppSide);
  const sum = (team, key) => team.reduce((n, p) => n + (p[key] || 0), 0);
  const myCorrect = sum(myTeam, 'correctCount');
  const oppCorrect = sum(oppTeam, 'correctCount');

  const myTurn = mode === 'turn' ? turnId === playerId : true; // tug: always active
  const inputDisabled = !question || (mode === 'turn' && !myTurn);

  // Guard against direct navigation without a game in progress.
  useEffect(() => {
    if (!room?.code) navigate('/lobby');
  }, [room, navigate]);

  // Reset the input + response timer each time a new question arrives.
  useEffect(() => {
    setAnswer('');
    questionStartRef.current = Date.now();
    setSecondsLeft(turnSeconds);
  }, [questionTick, turnSeconds]);

  // Show flash/shake feedback when a result that involves ME arrives.
  useEffect(() => {
    if (!lastResult) return;
    if (lastResult.playerId !== playerId) return;
    setFeedback(lastResult.correct ? 'correct' : 'wrong');
    const t = setTimeout(() => setFeedback(null), 600);
    if (lastResult.correct) setAnswer('');
    return () => clearTimeout(t);
  }, [lastResult, playerId]);

  // Turn-Based countdown timer (only ticks on the active player's turn).
  useEffect(() => {
    if (mode !== 'turn' || !myTurn || !question) return;
    if (secondsLeft <= 0) {
      sendTimeout(); // only the active player reports the timeout
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, myTurn, question, secondsLeft, sendTimeout]);

  function handleSubmit() {
    if (inputDisabled || !answer.trim()) return;
    const responseMs = Date.now() - questionStartRef.current;
    submitAnswer(answer, responseMs);
    if (mode === 'turn') setAnswer('');
  }

  // Which side just answered correctly (for rope/mascot pull animation)?
  const lastSide = lastResult?.correct
    ? players.find((p) => p.id === lastResult.playerId)?.side
    : null;

  // Build side labels/types for the rope (side 0 = fox/left, side 1 = right).
  const leftTeam = players.filter((p) => p.side === 0);
  const rightTeam = players.filter((p) => p.side === 1);
  const rightIsBot = rightTeam.some((p) => p.isBot);
  const teamLabel = (team) => team.map((p) => p.username).join(' & ') || '—';

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-6">
      {/* Header: room + mode */}
      <header className="mb-4 flex items-center justify-between">
        <span className="font-display text-ink/50">Room {room?.code}</span>
        <span className="font-display text-lg font-bold">
          {mode === 'tug' ? '🪢 Tug-of-War' : '🔁 Turn-Based'}
        </span>
        <button className="text-sm font-semibold text-ink/50 hover:text-coral" onClick={leaveRoom}>
          Quit
        </button>
      </header>

      {/* Progress toward the win target (per side / team) */}
      <div className="mb-4 flex items-center justify-between gap-4 text-center">
        <ProgressPill name={`${teamLabel(myTeam)} (you)`} value={myCorrect} color="coral" />
        <span className="font-display text-ink/40">first to {WIN_TARGET}</span>
        <ProgressPill name={teamLabel(oppTeam)} value={oppCorrect} color="grape" />
      </div>

      {/* Mode-specific visual */}
      {mode === 'tug' ? (
        <div className="mb-5">
          <TugRope
            position={ropePosition}
            leftLabel={teamLabel(leftTeam)}
            rightLabel={teamLabel(rightTeam)}
            rightType={rightIsBot ? 'robot' : 'bear'}
            leftPulling={lastSide === 0}
            rightPulling={lastSide === 1}
          />
        </div>
      ) : (
        <div className="mb-5">
          <Scoreboard players={players} target={WIN_TARGET} turnId={turnId} youId={playerId} />
          {myTurn && (
            <div className="mt-3 text-center">
              <TimerBar secondsLeft={secondsLeft} total={turnSeconds} />
            </div>
          )}
        </div>
      )}

      {/* Question + input */}
      <QuestionCard
        questionText={question?.text}
        value={answer}
        onChange={setAnswer}
        onSubmit={handleSubmit}
        disabled={inputDisabled}
        feedback={feedback}
        waiting={mode === 'turn' && !myTurn}
        questionTick={questionTick}
      />
    </div>
  );
}

function ProgressPill({ name, value, color }) {
  const bg = color === 'coral' ? 'bg-coral' : 'bg-grape';
  return (
    <div className="flex-1">
      <div className="truncate font-display text-sm font-bold">{name}</div>
      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-full ${bg} transition-all`}
          style={{ width: `${Math.min(100, (value / WIN_TARGET) * 100)}%` }}
        />
      </div>
      <div className="mt-0.5 font-display text-lg font-bold">{value}</div>
    </div>
  );
}

function TimerBar({ secondsLeft, total }) {
  const pct = Math.max(0, (secondsLeft / total) * 100);
  const danger = secondsLeft <= 5;
  return (
    <div>
      <div className={`font-display text-2xl font-bold ${danger ? 'text-coral' : 'text-ink'}`}>
        ⏱ {secondsLeft}s
      </div>
      <div className="mx-auto mt-1 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-full transition-all ${danger ? 'bg-coral' : 'bg-grass'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
