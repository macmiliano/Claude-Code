import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext.jsx';

const DIFFICULTIES = [
  { id: 'elementary', label: 'Elementary', sub: 'Add · Subtract · × · ÷', emoji: '🍎' },
  { id: 'middle', label: 'Middle School', sub: 'Fractions', emoji: '🍕' },
  { id: 'high', label: 'High School', sub: 'Algebra', emoji: '🧮' },
];

const MODES = [
  { id: 'tug', label: 'Tug-of-War', sub: 'Race to pull the rope!', emoji: '🪢' },
  { id: 'turn', label: 'Turn-Based', sub: 'Alternate turns, first to 10', emoji: '🔁' },
];

const OPPONENTS = [
  { id: 'human', label: 'vs Friend', sub: 'Play with another person', emoji: '🧑‍🤝‍🧑' },
  { id: 'cpu', label: 'vs Computer', sub: 'Play against a bot', emoji: '🤖' },
];

const TEAMS = [
  { id: 1, label: 'Solo', sub: 'Just you vs the bot', emoji: '🦊' },
  { id: 2, label: 'Co-op (2 players)', sub: 'You + a friend vs the bot', emoji: '🦊🦊' },
];

const BOT_LEVELS = [
  { id: 'easy', label: 'Easy', emoji: '🙂' },
  { id: 'medium', label: 'Medium', emoji: '😎' },
  { id: 'hard', label: 'Hard', emoji: '🤯' },
];

/**
 * Lobby — choose difficulty + mode + opponent, then start the appropriate game:
 *   - vs Friend          : create a room to share, or join one by code
 *   - vs Computer (Solo)  : starts immediately against the bot
 *   - vs Computer (Co-op) : create a room, a friend joins, then you both face the bot
 * Joining a friend's room by code always works regardless of these picks.
 */
export default function Lobby() {
  const navigate = useNavigate();
  const { username, createRoom, joinRoom } = useGame();

  const [difficulty, setDifficulty] = useState('elementary');
  const [mode, setMode] = useState('tug');
  const [opponent, setOpponent] = useState('human');
  const [teamSize, setTeamSize] = useState(1);
  const [botLevel, setBotLevel] = useState('medium');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // If a player lands here without a name, send them back to set one.
  useEffect(() => {
    if (!username) navigate('/');
  }, [username, navigate]);

  async function handleCreate() {
    setBusy(true);
    setError('');
    const res = await createRoom({
      difficulty,
      mode,
      opponent,
      teamSize: opponent === 'cpu' ? teamSize : 2,
      botLevel,
    });
    setBusy(false);
    if (res?.ok) navigate('/waiting');
    else setError(res?.error || 'Could not create a room. Try again.');
  }

  async function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('Room codes are 6 characters.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await joinRoom(code);
    setBusy(false);
    if (res?.ok) navigate('/waiting');
    else setError(res?.error || 'Could not join that room.');
  }

  // Label for the primary create button depends on the chosen opponent/team.
  const createLabel =
    opponent === 'human'
      ? 'Create Room'
      : teamSize === 1
      ? '▶ Start vs Computer'
      : 'Create Co-op Room';

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <button className="font-display text-ink/60 hover:text-ink" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1 className="font-display text-3xl font-bold">Game Lobby</h1>
        <span className="font-display text-grape">Hi, {username}!</span>
      </header>

      {/* Difficulty picker */}
      <section className="mb-6">
        <h2 className="mb-3 font-display text-xl">1. Choose a difficulty</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DIFFICULTIES.map((d) => (
            <Pickable key={d.id} active={difficulty === d.id} ring="coral" onClick={() => setDifficulty(d.id)}>
              <div className="text-3xl">{d.emoji}</div>
              <div className="font-display text-lg font-bold">{d.label}</div>
              <div className="text-sm text-ink/60">{d.sub}</div>
            </Pickable>
          ))}
        </div>
      </section>

      {/* Mode picker */}
      <section className="mb-6">
        <h2 className="mb-3 font-display text-xl">2. Choose a game mode</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODES.map((m) => (
            <Pickable key={m.id} active={mode === m.id} ring="grape" onClick={() => setMode(m.id)}>
              <div className="text-3xl">{m.emoji}</div>
              <div className="font-display text-lg font-bold">{m.label}</div>
              <div className="text-sm text-ink/60">{m.sub}</div>
            </Pickable>
          ))}
        </div>
      </section>

      {/* Opponent picker */}
      <section className="mb-6">
        <h2 className="mb-3 font-display text-xl">3. Choose your opponent</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {OPPONENTS.map((o) => (
            <Pickable key={o.id} active={opponent === o.id} ring="grass" onClick={() => setOpponent(o.id)}>
              <div className="text-3xl">{o.emoji}</div>
              <div className="font-display text-lg font-bold">{o.label}</div>
              <div className="text-sm text-ink/60">{o.sub}</div>
            </Pickable>
          ))}
        </div>

        {/* Computer-only options */}
        {opponent === 'cpu' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="card">
              <h3 className="mb-2 font-display text-lg">Players</h3>
              <div className="grid grid-cols-2 gap-2">
                {TEAMS.map((t) => (
                  <Pickable key={t.id} active={teamSize === t.id} ring="coral" small onClick={() => setTeamSize(t.id)}>
                    <div className="text-xl">{t.emoji}</div>
                    <div className="font-display text-sm font-bold">{t.label}</div>
                    <div className="text-xs text-ink/50">{t.sub}</div>
                  </Pickable>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="mb-2 font-display text-lg">Bot difficulty</h3>
              <div className="grid grid-cols-3 gap-2">
                {BOT_LEVELS.map((b) => (
                  <Pickable key={b.id} active={botLevel === b.id} ring="grape" small onClick={() => setBotLevel(b.id)}>
                    <div className="text-xl">{b.emoji}</div>
                    <div className="font-display text-sm font-bold">{b.label}</div>
                  </Pickable>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Primary action: create / start */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex flex-col">
          <h3 className="font-display text-xl font-bold">
            {opponent === 'cpu' && teamSize === 1 ? 'Play now' : 'Create a room'}
          </h3>
          <p className="mb-4 mt-1 text-sm text-ink/60">
            {opponent === 'human'
              ? "You'll get a 6-character code to share with a friend."
              : teamSize === 1
              ? 'Jump straight into a match against the computer.'
              : "Create a room, share the code with a friend, then team up vs the bot."}
          </p>
          <button className="btn-grass mt-auto" onClick={handleCreate} disabled={busy}>
            {busy ? 'Starting…' : createLabel}
          </button>
        </div>

        {/* Join is always available (inherits the host's settings). */}
        <form className="card flex flex-col" onSubmit={handleJoin}>
          <h3 className="font-display text-xl font-bold">Join a friend's room</h3>
          <p className="mb-3 mt-1 text-sm text-ink/60">Enter a friend's room code.</p>
          <input
            className="input-field mb-3 uppercase tracking-[0.3em]"
            placeholder="ABC123"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            aria-label="Room code"
          />
          <button className="btn-secondary mt-auto" type="submit" disabled={busy}>
            {busy ? 'Joining…' : 'Join Room'}
          </button>
        </form>
      </section>

      {error && <p className="mt-4 text-center font-semibold text-coral">{error}</p>}
    </div>
  );
}

/** Small reusable selectable card with a coloured active ring. */
function Pickable({ active, ring, onClick, small, children }) {
  const ringClass = { coral: 'ring-coral', grape: 'ring-grape', grass: 'ring-grass' }[ring] || 'ring-grape';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${small ? 'rounded-2xl bg-white/90 p-3' : 'card'} text-left transition-all ${
        active ? `ring-4 ${ringClass} scale-[1.02]` : 'opacity-90 hover:opacity-100'
      }`}
    >
      {children}
    </button>
  );
}
