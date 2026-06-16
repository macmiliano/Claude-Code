import React, { useEffect, useState } from 'react';
import TopNav from '../components/TopNav.jsx';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Leaderboard — global ranking of registered players by lifetime points
 * (+25 per win, +1 per correct answer). Visible to everyone; shows a friendly
 * note when accounts aren't enabled on the server.
 */
export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .leaderboard()
      .then((data) => {
        if (cancelled) return;
        setEnabled(data.enabled);
        setRows(data.leaderboard || []);
      })
      .catch(() => setEnabled(false))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);

  return (
    <div className="min-h-full">
      <TopNav />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-center font-display text-4xl font-bold">🏆 Leaderboard</h1>

        {loading ? (
          <p className="text-center text-ink/50">Loading…</p>
        ) : !enabled ? (
          <div className="card text-center">
            <p className="font-display text-lg">Leaderboard isn't enabled on this server yet.</p>
            <p className="mt-1 text-sm text-ink/60">
              Accounts/leaderboards require a database + Google login to be configured (see the README).
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="card text-center">
            <p className="font-display text-lg">No games recorded yet — be the first!</p>
          </div>
        ) : (
          <div className="card divide-y divide-ink/10 p-0">
            {rows.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 px-4 py-3 ${user?.id === r.id ? 'bg-sunny/20' : ''}`}
              >
                <span className="w-10 text-center font-display text-xl font-bold">{medal(r.rank)}</span>
                {r.picture ? (
                  <img src={r.picture} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-grape text-white">
                    {r.name?.[0] || '?'}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-bold">
                    {r.name} {user?.id === r.id && <span className="text-grape">(you)</span>}
                  </div>
                  <div className="text-xs text-ink/50">
                    {r.gamesPlayed} games · {r.winRate}% win rate
                  </div>
                </div>
                <div className="font-display text-xl font-bold text-coral">★ {r.points}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
