import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Mascot from '../components/Mascot.jsx';
import TopNav from '../components/TopNav.jsx';
import { GoogleLoginButton } from '../components/AuthControls.jsx';
import { useGame } from '../context/GameContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Landing — colourful hero with the game title, two animated mascots, a guest
 * display-name entry, optional Google sign-in, and quick links (Watch / Leaders).
 */
export default function Landing() {
  const navigate = useNavigate();
  const { username, setUsername, connecting } = useGame();
  const { user, accountsEnabled } = useAuth();
  const [name, setName] = useState(username);
  const [error, setError] = useState('');

  // Prefill the display name from a signed-in account.
  useEffect(() => {
    if (user?.name && !name) setName(user.name);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="min-h-full">
      <TopNav />
      <div className="flex flex-col items-center justify-center px-4 py-6">
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
            Battle a friend — or the computer — in a real-time math tug-of-war. Bright, fast, and fun for all ages!
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

            {/* Optional Google sign-in (hidden when accounts aren't configured) */}
            {accountsEnabled && !user && (
              <div className="mt-4 border-t border-ink/10 pt-4">
                <p className="mb-2 text-sm text-ink/60">
                  Sign in to save your points, stats & game history:
                </p>
                <div className="flex justify-center">
                  <GoogleLoginButton />
                </div>
              </div>
            )}
            {user && (
              <p className="mt-3 font-display text-sm text-grass">
                Signed in as {user.name} · ★ {user.points} points
              </p>
            )}

            <p className="mt-3 text-xs text-ink/40">
              {connecting ? 'Connecting to game server…' : 'Connected ✓'}
            </p>
          </form>

          <div className="mt-5 flex justify-center gap-3">
            <button className="btn-grass" onClick={() => navigate('/watch')}>
              📺 Watch Live Games
            </button>
            <button className="btn-sun" onClick={() => navigate('/leaderboard')}>
              🏆 Leaderboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
