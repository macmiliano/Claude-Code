import React from 'react';

/**
 * Mascot — lightweight inline SVG cartoon animals so the app needs no image
 * assets. `type` selects the character: "fox" (player 1 / left) or
 * "bear" (player 2 / right). `state` tweaks the expression for feedback.
 */
export default function Mascot({ type = 'fox', size = 96, state = 'idle', flip = false, className = '' }) {
  // Robot variant represents the computer opponent.
  if (type === 'robot') {
    return <RobotMascot size={size} state={state} flip={flip} className={className} />;
  }

  const isFox = type === 'fox';
  const fur = isFox ? '#FF8C42' : '#9C6B3F';
  const furDark = isFox ? '#E8732C' : '#7E5430';
  const belly = isFox ? '#FFE8D6' : '#E8D7C3';
  const ear = isFox ? '#E8732C' : '#7E5430';

  // Mouth path changes with feedback state.
  const mouth =
    state === 'happy'
      ? 'M40 64 Q50 76 60 64'
      : state === 'sad'
      ? 'M40 72 Q50 62 60 72'
      : 'M42 66 Q50 72 58 66';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ transform: flip ? 'scaleX(-1)' : 'none' }}
      role="img"
      aria-label={isFox ? 'Fox mascot' : 'Bear mascot'}
    >
      {/* Ears */}
      {isFox ? (
        <>
          <polygon points="20,30 30,8 44,28" fill={ear} />
          <polygon points="80,30 70,8 56,28" fill={ear} />
        </>
      ) : (
        <>
          <circle cx="26" cy="22" r="13" fill={ear} />
          <circle cx="74" cy="22" r="13" fill={ear} />
          <circle cx="26" cy="22" r="6" fill={belly} />
          <circle cx="74" cy="22" r="6" fill={belly} />
        </>
      )}

      {/* Head */}
      <circle cx="50" cy="52" r="34" fill={fur} stroke={furDark} strokeWidth="3" />
      {/* Snout / belly patch */}
      <ellipse cx="50" cy="62" rx="20" ry="16" fill={belly} />

      {/* Eyes */}
      <circle cx="38" cy="46" r="5" fill="#2B2D42" />
      <circle cx="62" cy="46" r="5" fill="#2B2D42" />
      <circle cx="39.5" cy="44.5" r="1.6" fill="#fff" />
      <circle cx="63.5" cy="44.5" r="1.6" fill="#fff" />

      {/* Nose */}
      <ellipse cx="50" cy="58" rx="4.5" ry="3.5" fill="#2B2D42" />

      {/* Mouth */}
      <path d={mouth} stroke="#2B2D42" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* Cheeks */}
      <circle cx="30" cy="58" r="4" fill="#FF6B6B" opacity="0.5" />
      <circle cx="70" cy="58" r="4" fill="#FF6B6B" opacity="0.5" />
    </svg>
  );
}

/** The computer opponent: a friendly cartoon robot. */
function RobotMascot({ size = 96, state = 'idle', flip = false, className = '' }) {
  const eye = state === 'sad' ? '#FF6B6B' : '#38bdf8';
  const mouth =
    state === 'happy' ? 'M38 70 Q50 80 62 70' : state === 'sad' ? 'M38 76 Q50 68 62 76' : 'M40 72 h20';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ transform: flip ? 'scaleX(-1)' : 'none' }}
      role="img"
      aria-label="Computer robot opponent"
    >
      {/* Antenna */}
      <line x1="50" y1="18" x2="50" y2="6" stroke="#7E5430" strokeWidth="3" />
      <circle cx="50" cy="5" r="4" fill="#FFD43B" />
      {/* Head */}
      <rect x="20" y="20" width="60" height="56" rx="14" fill="#B0BEC5" stroke="#607D8B" strokeWidth="3" />
      {/* Face screen */}
      <rect x="28" y="30" width="44" height="30" rx="8" fill="#2B2D42" />
      {/* Eyes */}
      <circle cx="40" cy="44" r="5" fill={eye} />
      <circle cx="60" cy="44" r="5" fill={eye} />
      {/* Mouth */}
      <path d={mouth} stroke="#51CF66" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Ears / bolts */}
      <rect x="14" y="40" width="6" height="16" rx="3" fill="#607D8B" />
      <rect x="80" y="40" width="6" height="16" rx="3" fill="#607D8B" />
      {/* Body hint */}
      <rect x="34" y="76" width="32" height="10" rx="4" fill="#90A4AE" stroke="#607D8B" strokeWidth="2" />
    </svg>
  );
}
