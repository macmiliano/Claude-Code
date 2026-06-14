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

/**
 * Lobby — choose difficulty + mode, then either create a room (and get a code to
 * share) or join a friend's room by code.
 */
export default function Lobby() {
  const navigate = useNavigate();
  const { username, createRoom, joinRoom } = useGame();

  const [difficulty, setDifficulty] = useState('elementary');
  const [mode, setMode] = useState('tug');
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
    const res = await createRoom(difficulty, mode);
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
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              className={`card text-left transition-all ${
                difficulty === d.id ? 'ring-4 ring-coral scale-[1.02]' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div className="text-3xl">{d.emoji}</div>
              <div className="font-display text-lg font-bold">{d.label}</div>
              <div className="text-sm text-ink/60">{d.sub}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Mode picker */}
      <section className="mb-6">
        <h2 className="mb-3 font-display text-xl">2. Choose a game mode</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`card text-left transition-all ${
                mode === m.id ? 'ring-4 ring-grape scale-[1.02]' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div className="text-3xl">{m.emoji}</div>
              <div className="font-display text-lg font-bold">{m.label}</div>
              <div className="text-sm text-ink/60">{m.sub}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Create / Join */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card flex flex-col">
          <h3 className="font-display text-xl font-bold">Create a room</h3>
          <p className="mb-4 mt-1 text-sm text-ink/60">
            You'll get a 6-character code to share with a friend.
          </p>
          <button className="btn-grass mt-auto" onClick={handleCreate} disabled={busy}>
            {busy ? 'Creating…' : 'Create Room'}
          </button>
        </div>

        <form className="card flex flex-col" onSubmit={handleJoin}>
          <h3 className="font-display text-xl font-bold">Join a room</h3>
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
