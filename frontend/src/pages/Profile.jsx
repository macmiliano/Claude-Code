import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { GoogleLoginButton } from '../components/AuthControls.jsx';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const DIFF_LABEL = { elementary: 'Elementary', middle: 'Middle School', high: 'High School' };

/**
 * Profile — personal dashboard for a signed-in user: lifetime points, win/loss
 * record, accuracy per difficulty, and recent match history. Prompts sign-in
 * when signed out.
 */
export default function Profile() {
  const { user, accountsEnabled, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .history()
      .then((d) => !cancelled && setData(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) return <Shell><p className="text-center text-ink/50">Loading…</p></Shell>;

  if (!user) {
    return (
      <Shell>
        <div className="card mx-auto max-w-md text-center">
          <h1 className="font-display text-3xl font-bold">Your Profile</h1>
          <p className="mt-2 text-ink/60">
            {accountsEnabled
              ? 'Sign in with Google to track your points, win/loss record, accuracy, and game history.'
              : "Accounts aren't enabled on this server, so profiles aren't available."}
          </p>
          {accountsEnabled && (
            <div className="mt-5 flex justify-center">
              <GoogleLoginButton />
            </div>
          )}
          <button className="btn-secondary mt-5 w-full" onClick={() => navigate('/lobby')}>
            Play as guest
          </button>
        </div>
      </Shell>
    );
  }

  const u = data?.user || user;
  const stat = (label, value) => (
    <div className="card text-center">
      <div className="font-display text-3xl font-bold text-coral">{value}</div>
      <div className="text-xs uppercase tracking-wide text-ink/50">{label}</div>
    </div>
  );

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        {/* Identity */}
        <div className="card mb-5 flex items-center gap-4">
          {u.picture ? (
            <img src={u.picture} alt="" className="h-16 w-16 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-grape text-2xl text-white">
              {u.name?.[0] || '?'}
            </span>
          )}
          <div>
            <h1 className="font-display text-3xl font-bold">{u.name}</h1>
            <div className="font-display text-sunny">★ {u.points} points</div>
          </div>
        </div>

        {/* Lifetime stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stat('Games', u.gamesPlayed)}
          {stat('Wins', u.wins)}
          {stat('Win rate', `${data?.winRate ?? 0}%`)}
          {stat('Accuracy', `${data?.accuracy ?? 0}%`)}
        </div>

        {/* Per-difficulty breakdown */}
        <h2 className="mb-2 font-display text-xl">By difficulty</h2>
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(data?.byDifficulty || []).length === 0 ? (
            <p className="text-ink/50">No games yet.</p>
          ) : (
            data.byDifficulty.map((d) => (
              <div key={d.difficulty} className="card">
                <div className="font-display text-lg font-bold">{DIFF_LABEL[d.difficulty] || d.difficulty}</div>
                <div className="text-sm text-ink/60">{d.games} games · {d.wins} wins</div>
                <div className="mt-1 text-sm">Accuracy: <b>{d.accuracy}%</b> · Win rate: <b>{d.winRate}%</b></div>
              </div>
            ))
          )}
        </div>

        {/* Recent history */}
        <h2 className="mb-2 font-display text-xl">Recent games</h2>
        {loading ? (
          <p className="text-ink/50">Loading…</p>
        ) : (data?.history || []).length === 0 ? (
          <p className="text-ink/50">No games played yet — jump into a match!</p>
        ) : (
          <div className="card divide-y divide-ink/10 p-0">
            {data.history.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className={`font-display font-bold ${m.result === 'win' ? 'text-grass' : 'text-coral'}`}>
                    {m.result === 'win' ? 'WIN' : 'LOSS'}
                  </span>
                  <span className="ml-2 text-sm text-ink/60">
                    {m.mode === 'tug' ? 'Tug' : 'Turn'} · {DIFF_LABEL[m.difficulty]} ·{' '}
                    {m.opponent === 'cpu' ? 'vs CPU' : 'vs Player'}
                  </span>
                </div>
                <div className="text-sm">
                  {m.accuracy}% acc · <span className="font-bold text-sunny">+{m.points_earned}★</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-full">
      <TopNav />
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
    </div>
  );
}
