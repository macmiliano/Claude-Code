import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Confetti — a pure-CSS/Framer confetti burst for the winner screen. Generates
 * `count` colourful pieces that fall and tumble from the top of the viewport.
 */
const COLORS = ['#FFD43B', '#51CF66', '#FF6B6B', '#845EF7', '#38bdf8'];

export default function Confetti({ count = 120 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.4 + Math.random() * 1.8,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 360,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -40, opacity: 1, rotate: p.rotate }}
          animate={{ y: '110vh', rotate: p.rotate + 360, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn', repeat: Infinity }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
