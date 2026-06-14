import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Mascot from '../components/Mascot.jsx';
import { useGame } from '../context/GameContext.jsx';

/**
 * WaitingRoom — animated "waiting for opponent" screen. Shows the room code to
 * share and a copy button. The game auto-starts (server emits `game-start`,
 * GameContext navigates to /game) as soon as the second player joins.
 */
export default function WaitingRoom() {
  const navigate = useNavigate();
  const { room, username, leaveRoom } = useGame();
  const [copied, setCopied] = useState(false);

  // Guard: if there's no room (e.g. refresh), go back to the lobby.
  useEffect(() => {
    if (!room?.code) navigate('/lobby');
  }, [room, navigate]);

  const players = room?.players || [];
  const ready = players.length >= 2;

  function copyCode() {
    if (!room?.code) return;
    navigator.clipboard?.writeText(room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const difficultyLabel = { elementary: 'Elementary', middle: 'Middle School', high: 'High School' }[
    room?.difficulty
  ];
  const modeLabel = { tug: 'Tug-of-War', turn: 'Turn-Based' }[room?.mode];

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="card w-full max-w-lg text-center">
        <h1 className="font-display text-3xl font-bold">Waiting for opponent…</h1>
        <p className="mt-1 text-ink/60">
          {modeLabel} · {difficultyLabel}
        </p>

        {/* Bouncing mascots while we wait */}
        <div className="my-6 flex items-center justify-center gap-8">
          <Mascot type="fox" size={96} state="happy" className="animate-bounce-slow" />
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="font-display text-2xl text-grape"
          >
            …
          </motion.div>
          <Mascot
            type="bear"
            size={96}
            flip
            state={ready ? 'happy' : 'sad'}
            className={ready ? 'animate-bounce-slow' : 'opacity-40'}
          />
        </div>

        {/* Shareable room code */}
        <p className="text-sm font-semibold uppercase tracking-wide text-ink/40">Room code</p>
        <button
          onClick={copyCode}
          className="mx-auto mt-1 block rounded-2xl bg-sunny px-8 py-3 font-display text-5xl font-bold tracking-[0.3em] text-ink shadow-pop active:translate-y-1 active:shadow-none"
          title="Click to copy"
        >
          {room?.code}
        </button>
        <p className="mt-2 h-5 text-sm text-grass">{copied ? 'Copied to clipboard!' : 'Tap the code to copy'}</p>

        {/* Player list */}
        <div className="mt-4 space-y-1 text-left">
          <PlayerRow index={1} name={players[0]?.username} you={players[0]?.username === username} />
          <PlayerRow index={2} name={players[1]?.username} you={players[1]?.username === username} />
        </div>

        {ready && (
          <motion.p
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="mt-4 font-display text-xl font-bold text-grass"
          >
            Both players ready — starting! 🚀
          </motion.p>
        )}

        <button className="mt-6 text-sm font-semibold text-ink/50 hover:text-coral" onClick={leaveRoom}>
          Leave room
        </button>
      </div>
    </div>
  );
}

function PlayerRow({ index, name, you }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/70 px-4 py-2">
      <span className="font-display">Player {index}</span>
      <span className={name ? 'font-bold' : 'italic text-ink/40'}>
        {name ? `${name}${you ? ' (you)' : ''}` : 'waiting…'}
      </span>
    </div>
  );
}
