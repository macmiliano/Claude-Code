import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Mascot from '../components/Mascot.jsx';
import { useGame } from '../context/GameContext.jsx';

/**
 * Landing — colourful hero with the game title, two animated mascots, a guest
 * display-name entry, and "Play Now" / "Create Account (optional)" actions.
 */
export default function Landing() {
  const navigate = useNavigate();
  const { username, setUsername, connecting } = useGame();
  const [name, setName] = useState(username);
  const [showAccount, setShowAccount] = useState(false);
  const [error, setError] = useState('');

  function handlePlay(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a display name to play.');
      return;
    }
    setUsername(trimmed);
    navigate('/lobby');
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl text-center">
        {/* Mascots */}
        <div className="mb-2 flex items-end justify-center gap-6">
          <Mascot type="fox" size={120} state="happy" className="animate-bounce-slow" />
          <div className="pb-6 font-display text-3xl font-bold text-grape">VS</div>
          <Mascot type="bear" size={120} state="happy" className="animate-bounce-slow" flip />
        </div>

        {/* Title */}
        <motion.h1
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120 }}
          className="font-display text-6xl font-bold tracking-tight text-ink drop-shadow sm:text-7xl"
        >
          Math<span className="text-coral">Clash</span>
        </motion.h1>
        <p className="mx-auto mt-3 max-w-xl text-lg font-semibold text-ink/70">
          Battle a friend head-to-head in a real-time math tug-of-war. Bright, fast, and fun for all ages!
        </p>

        {/* Guest entry */}
        <form onSubmit={handlePlay} className="card mx-auto mt-8 max-w-md">
          <label htmlFor="name" className="mb-2 block text-left font-display text-lg">
            Pick a display name
          </label>
          <input
            id="name"
            className="input-field"
            placeholder="e.g. SpeedyFox"
            value={name}
            maxLength={16}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
          {error && <p className="mt-2 text-sm font-semibold text-coral">{error}</p>}

          <button type="submit" className="btn-primary mt-4 w-full text-2xl">
            ▶ Play Now
          </button>
          <button
            type="button"
            className="btn-secondary mt-3 w-full"
            onClick={() => setShowAccount((s) => !s)}
          >
            Create Account (Optional)
          </button>

          {showAccount && (
            <div className="mt-4 rounded-2xl bg-grape/10 p-4 text-left text-sm text-ink/70">
              <p className="font-bold">Optional accounts</p>
              <p className="mt-1">
                Guest play needs no sign-up. Registered players get a dashboard with win/loss records,
                accuracy per difficulty, and full game history. Account sign-up is an optional add-on
                (see the README for enabling the database).
              </p>
            </div>
          )}

          <p className="mt-3 text-xs text-ink/40">
            {connecting ? 'Connecting to game server…' : 'Connected ✓'}
          </p>
        </form>
      </div>
    </div>
  );
}
