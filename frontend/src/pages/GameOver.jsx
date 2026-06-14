import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Confetti from '../components/Confetti.jsx';
import Mascot from '../components/Mascot.jsx';
import { useGame } from '../context/GameContext.jsx';

/**
 * GameOver — end-of-game leaderboard. Announces the winning SIDE with confetti
 * and shows per-competitor stats. "You Win" is shown when your side won (so co-op
 * teammates both celebrate). Offers "Play Again" (same line-up) / "Return to Lobby".
 */
export default function GameOver() {
  const navigate = useNavigate();
  const { gameOver, playerId, opponentLeft, playAgain, leaveRoom } = useGame();

  // If we arrived with no result (e.g. refresh), bounce to the lobby.
  useEffect(() => {
    if (!gameOver) navigate('/lobby');
  }, [gameOver, navigate]);

  if (!gameOver) return null;

  // Disconnect case: opponent/teammate bailed mid-game.
  if (gameOver.disconnected || opponentLeft) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-10 text-center">
        <div className="card max-w-md">
          <Mascot type="bear" size={96} state="sad" className="mx-auto" />
          <h1 className="mt-3 font-display text-3xl font-bold">Player left</h1>
          <p className="mt-2 text-ink/60">
            {gameOver.message || 'A player disconnected, so the match ended.'}
          </p>
          <button className="btn-secondary mt-6 w-full" onClick={leaveRoom}>
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  const stats = [...(gameOver.stats || [])].sort((a, b) => a.slot - b.slot);
  const myStat = stats.find((s) => s.id === playerId);
  const mySide = myStat?.side;
  const youWon = mySide != null && mySide === gameOver.winnerSide;

  const winnerTeam = stats.filter((s) => s.side === gameOver.winnerSide);
  const winnerName = winnerTeam.map((s) => s.username).join(' & ');
  const winnerType = winnerTeam.some((s) => s.isBot)
    ? 'robot'
    : gameOver.winnerSide === 0
    ? 'fox'
    : 'bear';

  const avatarType = (s) => (s.isBot ? 'robot' : s.side === 0 ? 'fox' : 'bear');

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-4 py-10">
      {youWon && <Confetti />}

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120 }}
        className="w-full max-w-2xl text-center"
      >
        <Mascot type={winnerType} size={120} flip={winnerType === 'bear'} state="happy" className="mx-auto animate-bounce-slow" />
        <h1 className="mt-2 font-display text-5xl font-bold">
          {youWon ? '🎉 You Win! 🎉' : `${winnerName} Wins!`}
        </h1>
        <p className="mt-1 text-lg font-semibold text-ink/60">
          {gameOver.mode === 'tug' ? 'Tug-of-War' : 'Turn-Based'} ·{' '}
          {{ elementary: 'Elementary', middle: 'Middle School', high: 'High School' }[gameOver.difficulty]}
          {gameOver.opponent === 'cpu' && ' · vs Computer'}
        </p>

        {/* Stat cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stats.map((s) => (
            <div key={s.id} className={`card text-left ${s.isWinner ? 'ring-4 ring-sunny' : ''}`}>
              <div className="flex items-center gap-3">
                <Mascot type={avatarType(s)} size={48} flip={avatarType(s) === 'bear'} />
                <div>
                  <div className="font-display text-xl font-bold">
                    {s.username} {s.id === playerId && <span className="text-grape">(you)</span>}
                    {s.isBot && ' 🤖'}
                  </div>
                  {s.isWinner && <div className="text-sm font-bold text-grass">WINNER 🏆</div>}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Stat label="Score" value={s.score} />
                <Stat label="Correct" value={s.correctCount} />
                <Stat label="Answered" value={s.answeredCount} />
                <Stat label="Accuracy" value={`${s.accuracy}%`} />
                <Stat label="Avg time" value={s.avgResponseMs ? `${(s.avgResponseMs / 1000).toFixed(1)}s` : '—'} />
                <Stat label="Fastest" value={s.fastestMs ? `${(s.fastestMs / 1000).toFixed(1)}s` : '—'} />
              </dl>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button className="btn-grass" onClick={playAgain}>
            🔁 Play Again
          </button>
          <button className="btn-secondary" onClick={leaveRoom}>
            Return to Lobby
          </button>
        </div>
        <p className="mt-3 text-xs text-ink/40">"Play Again" replays with the same line-up in this room.</p>
      </motion.div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-ink/40">{label}</dt>
      <dd className="font-display text-lg font-bold">{value}</dd>
    </div>
  );
}
