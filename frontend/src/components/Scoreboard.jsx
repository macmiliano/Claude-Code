import React from 'react';
import Mascot from './Mascot.jsx';

/**
 * Scoreboard — side-by-side team panel for Turn-Based mode. Each SIDE shows its
 * combined score toward the target plus its member(s). Supports 1 or 2 humans
 * per side and a computer bot, and highlights whose turn it is.
 */
export default function Scoreboard({ players = [], target = 10, turnId, youId }) {
  const sides = [0, 1].map((side) => {
    const members = players.filter((p) => p.side === side);
    const score = members.reduce((n, p) => n + (p.score || 0), 0);
    const active = members.some((m) => m.id === turnId);
    return { side, members, score, active };
  });

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6">
      {sides.map(({ side, members, score, active }) => (
        <div
          key={side}
          className={`card flex flex-col items-center transition-all ${
            active ? 'ring-4 ring-sunny scale-[1.02]' : 'opacity-90'
          }`}
        >
          {/* Member avatars + names */}
          <div className="flex items-end justify-center gap-1">
            {members.map((m) => {
              const type = m.isBot ? 'robot' : side === 0 ? 'fox' : 'bear';
              const isActive = m.id === turnId;
              return (
                <Mascot
                  key={m.id}
                  type={type}
                  size={members.length > 1 ? 48 : 64}
                  flip={side === 1 && !m.isBot}
                  state={isActive ? 'happy' : 'idle'}
                  className={isActive ? 'animate-bounce-slow' : ''}
                />
              );
            })}
          </div>
          <div className="mt-1 max-w-full truncate text-center font-display text-base">
            {members.map((m) => (
              <span key={m.id}>
                {m.username}
                {m.id === youId && <span className="text-grape"> (you)</span>}
                {m.isBot && ' 🤖'}{' '}
              </span>
            ))}
          </div>
          <div className="font-display text-4xl font-bold text-coral">
            {score}
            <span className="text-xl text-ink/40"> / {target}</span>
          </div>
          {active && (
            <div className="mt-1 text-sm font-semibold text-grass">
              ● {members.find((m) => m.id === turnId)?.id === youId ? 'your turn' : 'their turn'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
