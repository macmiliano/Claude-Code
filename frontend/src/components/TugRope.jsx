import React from 'react';
import { motion } from 'framer-motion';
import Mascot from './Mascot.jsx';

/**
 * TugRope — the animated tug-of-war centrepiece.
 *
 * `position` is 0..100 from the server (0 = fox/left fully wins,
 * 50 = neutral, 100 = bear/right fully wins). The rope's centre flag and both
 * mascots slide based on that value, animated smoothly by Framer Motion so the
 * movement looks like a real rope being pulled in real time.
 */
export default function TugRope({ position = 50, foxName = 'Fox', bearName = 'Bear', foxPulling, bearPulling }) {
  // Map 0..100 -> horizontal offset percentage for the flag/marker.
  const markerLeft = `${position}%`;
  // Mascots lean toward the centre as they get pulled.
  const foxShift = (50 - position) * 0.4; // positive when fox is winning
  const bearShift = (position - 50) * 0.4;

  return (
    <div className="w-full select-none">
      <div className="mb-2 flex items-center justify-between font-display text-lg">
        <span className="text-coral">{foxName}</span>
        <span className="text-grape">{bearName}</span>
      </div>

      <div className="relative h-40 overflow-hidden rounded-3xl bg-gradient-to-b from-sky-200/60 to-grass/30 px-4">
        {/* Ground line */}
        <div className="absolute inset-x-0 bottom-8 h-1 bg-ink/20" />

        {/* Fox on the left */}
        <motion.div
          className="absolute bottom-6 left-2"
          animate={{ x: foxShift, y: foxPulling ? -6 : 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 12 }}
        >
          <Mascot type="fox" size={84} state={foxPulling ? 'happy' : 'idle'} />
        </motion.div>

        {/* Bear on the right (flipped to face the rope) */}
        <motion.div
          className="absolute bottom-6 right-2"
          animate={{ x: bearShift, y: bearPulling ? -6 : 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 12 }}
        >
          <Mascot type="bear" size={84} flip state={bearPulling ? 'happy' : 'idle'} />
        </motion.div>

        {/* The rope itself */}
        <div className="absolute left-24 right-24 top-1/2 h-2 -translate-y-1/2 rounded-full bg-amber-700" />

        {/* Centre flag/marker that slides with `position` */}
        <motion.div
          className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          animate={{ left: markerLeft }}
          transition={{ type: 'spring', stiffness: 90, damping: 14 }}
          style={{ left: markerLeft }}
        >
          <div className="flex flex-col items-center">
            <div className="h-10 w-1 bg-ink/60" />
            <div className="-mt-10 ml-1 h-6 w-8 rounded-sm bg-sunny shadow-pop" />
          </div>
        </motion.div>

        {/* Centre line reference */}
        <div className="absolute left-1/2 top-2 bottom-2 w-px bg-ink/15" />
      </div>
    </div>
  );
}
