import React from 'react';
import { motion } from 'framer-motion';
import Mascot from './Mascot.jsx';

/**
 * TugRope — the animated tug-of-war centrepiece.
 *
 * `position` is 0..100 from the server (0 = left/fox side fully wins,
 * 50 = neutral, 100 = right side fully wins). The rope's centre flag and both
 * mascots slide based on that value. The right side shows a robot when the
 * opponent is the computer (`rightType="robot"`). Co-op teams pass a combined
 * label like "Ann & Bob".
 */
export default function TugRope({
  position = 50,
  leftLabel = 'Fox',
  rightLabel = 'Bear',
  rightType = 'bear',
  leftPulling,
  rightPulling,
}) {
  const markerLeft = `${position}%`;
  // Mascots lean toward the centre as they get pulled.
  const leftShift = (50 - position) * 0.4; // positive when left side is winning
  const rightShift = (position - 50) * 0.4;

  return (
    <div className="w-full select-none">
      <div className="mb-2 flex items-center justify-between font-display text-lg">
        <span className="truncate text-coral">{leftLabel}</span>
        <span className="truncate text-grape">{rightLabel}</span>
      </div>

      <div className="relative h-40 overflow-hidden rounded-3xl bg-gradient-to-b from-sky-200/60 to-grass/30 px-4">
        {/* Ground line */}
        <div className="absolute inset-x-0 bottom-8 h-1 bg-ink/20" />

        {/* Left side (fox) */}
        <motion.div
          className="absolute bottom-6 left-2"
          animate={{ x: leftShift, y: leftPulling ? -6 : 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 12 }}
        >
          <Mascot type="fox" size={84} state={leftPulling ? 'happy' : 'idle'} />
        </motion.div>

        {/* Right side (bear or robot), flipped to face the rope */}
        <motion.div
          className="absolute bottom-6 right-2"
          animate={{ x: rightShift, y: rightPulling ? -6 : 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 12 }}
        >
          <Mascot type={rightType} size={84} flip state={rightPulling ? 'happy' : 'idle'} />
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
