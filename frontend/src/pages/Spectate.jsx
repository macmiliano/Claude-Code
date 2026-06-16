import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import TugRope from '../components/TugRope.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import Mascot from '../components/Mascot.jsx';
import { useGame } from '../context/GameContext.jsx';

const WIN_TARGET = 10;
const DIFF_LABEL = { elementary: 'Elementary', middle: 'Middle School', high: 'High School' };

/**
 * Spectate — read-only live view of someone else's match (no answer input).
 * Mirrors the gameplay screen using the same rope/scoreboard components, driven
 * by the spectator-state snapshot + the normal game broadcasts. Shows a result
 * overlay when the watched match ends.
 */
export default function Spectate() {
  const navigate = useNavigate();
  const { room, question, ropePosition, turnId, players, spectating, spectatorCount, gameOver, stopSpectate } =
    useGame();

  // If we aren't actually spectating (e.g. refresh), go back to the list.
  useEffect(() => {
    if (!spectating || !room?.code) navigate('/watch');
  }, [spectating, room, navigate]);

  if (!room) return null;

  const mode = room.mode;
  const list = players || [];
  const leftTeam = list.filter((p) => p.side === 0);
  const rightTeam = list.filter((p) => p.side === 1);
  const rightIsBot = rightTeam.some((p) => p.isBot);
  const teamLabel = (team) => team.map((p) => p.username).join(' & ') || '—';
  const sumCorrect = (team) => team.reduce((n, p) => n + (p.correctCount || 0), 0);

  return (
    <div className="relative mx-auto flex min-h-full max-w-3xl flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <span className="font-display text-grape">👁 Spectating · {spectatorCount} watching</span>
        <span className="font-display text-lg font-bold">{mode === 'tug' ? '🪢 Tug-of-War' : '🔁 Turn-Based'}</span>
        <button className="text-sm font-semibold text-ink/50 hover:text-coral" onClick={stopSpectate}>
          Stop watching
        </button>
      </header>

      {/* Team progress */}
      <div className="mb-4 flex items-center justify-between gap-4 text-center">
        <Pill name={teamLabel(leftTeam)} value={sumCorrect(leftTeam)} color="coral" />
        <span className="font-display text-ink/40">first to {WIN_TARGET}</span>
        <Pill name={teamLabel(rightTeam)} value={sumCorrect(rightTeam)} color="grape" />
      </div>

      {mode === 'tug' ? (
        <div className="mb-5">
          <TugRope
            position={ropePosition}
            leftLabel={teamLabel(leftTeam)}
            rightLabel={teamLabel(rightTeam)}
            rightType={rightIsBot ? 'robot' : 'bear'}
          />
        </div>
      ) : (
        <div className="mb-5">
          <Scoreboard players={list} target={WIN_TARGET} turnId={turnId} youId={null} />
        </div>
      )}

      {/* Read-only question */}
      <div className="card text-center">
        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink/40">Current question</p>
        <div className="font-display text-4xl font-bold sm:text-5xl">{question?.text || '…'}</div>
        <p className="mt-3 text-xs text-ink/40">You're watching live — answers are entered by the players.</p>
      </div>

      {/* Result overlay */}
      {gameOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-ink/40 p-4"
        >
          <div className="card max-w-sm text-center">
            <Mascot type="fox" size={80} state="happy" className="mx-auto" />
            <h2 className="mt-2 font-display text-3xl font-bold">Match over!</h2>
            <p className="mt-1 text-ink/60">
              {gameOver.disconnected
                ? gameOver.message || 'A player left the match.'
                : `${winnerName(gameOver)} won the ${DIFF_LABEL[gameOver.difficulty] || ''} match.`}
            </p>
            <button className="btn-grass mt-5 w-full" onClick={stopSpectate}>
              Back to Watch Live
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function winnerName(gameOver) {
  const team = (gameOver.stats || []).filter((s) => s.side === gameOver.winnerSide);
  return team.map((s) => s.username).join(' & ') || 'Someone';
}

function Pill({ name, value, color }) {
  const bg = color === 'coral' ? 'bg-coral' : 'bg-grape';
  return (
    <div className="flex-1">
      <div className="truncate font-display text-sm font-bold">{name}</div>
      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-white/70">
        <div className={`h-full ${bg} transition-all`} style={{ width: `${Math.min(100, (value / WIN_TARGET) * 100)}%` }} />
      </div>
      <div className="mt-0.5 font-display text-lg font-bold">{value}</div>
    </div>
  );
}
