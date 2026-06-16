import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserBadge } from './AuthControls.jsx';

/**
 * TopNav — shared header for the non-gameplay pages: brand + quick links
 * (Watch Live, Leaderboard) and the sign-in / user badge on the right.
 */
export default function TopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const link = (to, label) => (
    <button
      onClick={() => navigate(to)}
      className={`rounded-xl px-3 py-1.5 font-display text-sm font-bold transition-colors ${
        pathname === to ? 'bg-grape text-white' : 'text-ink/70 hover:bg-white/70'
      }`}
    >
      {label}
    </button>
  );

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3">
      <button onClick={() => navigate('/')} className="font-display text-2xl font-bold">
        Math<span className="text-coral">Clash</span>
      </button>
      <nav className="flex items-center gap-1 sm:gap-2">
        {link('/watch', '📺 Watch')}
        {link('/leaderboard', '🏆 Leaders')}
        <UserBadge />
      </nav>
    </header>
  );
}
