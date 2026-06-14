import React from 'react';
import Mascot from './Mascot.jsx';

/**
 * Scoreboard — side-by-side score panel used in Turn-Based mode (and as a
 * compact readout in Tug mode). Highlights whose turn it currently is.
 */
export default function Scoreboard({ players = [], target = 10, turnId, youId }) {
  // Ensure stable left/right ordering by slot.
  const ordered = [...players].sort((a, b) => a.slot - b.slot);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6">
      {ordered.map((p) => {
        const active = turnId && p.id === turnId;
        const isYou = p.id === youId;
        return (
          <div
            key={p.id}
            className={`card flex flex-col items-center transition-all ${
              active ? 'ring-4 ring-sunny scale-[1.02]' : 'opacity-90'
            }`}
          >
            <Mascot
              type={p.slot === 0 ? 'fox' : 'bear'}
              size={64}
              flip={p.slot === 1}
              state={active ? 'happy' : 'idle'}
              className={active ? 'animate-bounce-slow' : ''}
            />
            <div className="mt-1 max-w-full truncate font-display text-lg">
              {p.username} {isYou && <span className="text-grape">(you)</span>}
            </div>
            <div className="font-display text-4xl font-bold text-coral">
              {p.score}
              <span className="text-xl text-ink/40"> / {target}</span>
            </div>
            {active && <div className="mt-1 text-sm font-semibold text-grass">● your turn</div>}
          </div>
        );
      })}
    </div>
  );
}
