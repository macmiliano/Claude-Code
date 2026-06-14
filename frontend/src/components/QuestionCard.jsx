import React, { useEffect, useRef } from 'react';

/**
 * QuestionCard — displays the current question and the answer input.
 *
 * `feedback` drives the visual flash/shake effects:
 *   - "correct" -> green glow flash
 *   - "wrong"   -> red shake
 * The input auto-focuses on each new question so play stays keyboard-first.
 */
export default function QuestionCard({
  questionText,
  value,
  onChange,
  onSubmit,
  disabled,
  feedback, // "correct" | "wrong" | null
  waiting, // true when it's not your turn (turn mode)
  questionTick,
}) {
  const inputRef = useRef(null);

  // Refocus the input whenever a fresh question arrives.
  useEffect(() => {
    if (!disabled && inputRef.current) inputRef.current.focus();
  }, [questionTick, disabled]);

  function handleSubmit(e) {
    e.preventDefault();
    if (disabled || !value.trim()) return;
    onSubmit();
  }

  const flashClass =
    feedback === 'correct' ? 'animate-flash-green border-grass' : feedback === 'wrong' ? 'animate-shake border-coral' : '';

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className={`card border-4 border-transparent transition-colors ${flashClass}`}>
        <p className="mb-1 text-center text-sm font-semibold uppercase tracking-wide text-ink/40">
          {waiting ? "Opponent's turn" : 'Solve it!'}
        </p>
        <div className="mb-5 text-center font-display text-4xl font-bold text-ink sm:text-5xl">
          {questionText || '…'}
        </div>

        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          className="input-field"
          placeholder={waiting ? 'Wait for your turn…' : 'Your answer'}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Answer input"
        />

        <button type="submit" className="btn-primary mt-4 w-full" disabled={disabled || !value.trim()}>
          Submit Answer
        </button>
        <p className="mt-2 text-center text-xs text-ink/40">
          Tip: fractions like <code>3/4</code> and mixed numbers like <code>2 1/3</code> are accepted.
        </p>
      </div>
    </form>
  );
}
