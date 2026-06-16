import React, { useEffect, useState } from 'react';
import TopNav from '../components/TopNav.jsx';
import Mascot from '../components/Mascot.jsx';
import { api } from '../api.js';
import { useGame } from '../context/GameContext.jsx';

const DIFF_LABEL = { elementary: 'Elementary', middle: 'Middle', high: 'High' };

/**
 * WatchLive — Clash-Royale-style "TV": a list of in-progress matches anyone can
 * watch. Polls /api/live-games every few seconds; click a game (or enter a code)
 * to start spectating.
 */
export default function WatchLive() {
  const { startSpectate } = useGame();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .liveGames()
        .then((d) => active && setGames(d.games || []))
        .catch(() => {})
        .finally(() => active && setLoading(false));
    load();
    const t = setInterval(load, 4000); // light polling keeps the list fresh
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  async function watch(roomCode) {
    setError('');
    const res = await startSpectate(roomCode);
    if (!res?.ok) setError(res?.error || 'Could not watch that game.');
  }

  async function watchByCode(e) {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError('Room codes are 6 characters.');
      return;
    }
    watch(code);
  }

  return (
    <div className="min-h-full">
      <TopNav />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 text-center font-display text-4xl font-bold">📺 Watch Live</h1>
        <p className="mb-5 text-center text-ink/60">Spectate other players' matches in real time.</p>

        {/* Watch by code */}
        <form onSubmit={watchByCode} className="card mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="font-display">Have a room code?</span>
          <input
            className="input-field flex-1 uppercase tracking-[0.3em]"
            placeholder="ABC123"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            aria-label="Room code to watch"
          />
          <button className="btn-secondary" type="submit">
            Watch
          </button>
        </form>

        {error && <p className="mb-4 text-center font-semibold text-coral">{error}</p>}

        {/* Live list */}
        {loading ? (
          <p className="text-center text-ink/50">Loading live games…</p>
        ) : games.length === 0 ? (
          <div className="card text-center">
            <p className="font-display text-lg">No live games right now.</p>
            <p className="mt-1 text-sm text-ink/60">Start a match yourself, or check back in a moment!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {games.map((g) => {
              const left = g.players.filter((p) => p.side === 0);
              const right = g.players.filter((p) => p.side === 1);
              const name = (team) => team.map((p) => p.username + (p.isBot ? ' 🤖' : '')).join(' & ') || '—';
              const score = (team) => team.reduce((n, p) => n + (p.correctCount || 0), 0);
              return (
                <button
                  key={g.code}
                  onClick={() => watch(g.code)}
                  className="card flex items-center gap-3 text-left transition-transform hover:scale-[1.01]"
                >
                  <Mascot type="fox" size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-bold">
                      {name(left)} <span className="text-ink/40">{score(left)} – {score(right)}</span>{' '}
                      {name(right)}
                    </div>
                    <div className="text-xs text-ink/50">
                      {g.mode === 'tug' ? '🪢 Tug-of-War' : '🔁 Turn-Based'} · {DIFF_LABEL[g.difficulty]} ·{' '}
                      👁 {g.spectators} watching
                    </div>
                  </div>
                  <Mascot type={right.some((p) => p.isBot) ? 'robot' : 'bear'} size={44} flip={!right.some((p) => p.isBot)} />
                  <span className="btn-grass !min-h-0 !px-4 !py-2">Watch ▶</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
