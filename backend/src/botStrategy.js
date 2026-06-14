/**
 * botStrategy.js
 * -----------------------------------------------------------------------------
 * Pure decision helpers for the computer opponent. This module only decides
 * *when* the bot acts and *whether* it answers correctly — the actual answer
 * submission and broadcasting live in server.js (which owns the timers and the
 * Socket.IO instance). Keeping the strategy isolated makes it easy to tune/test.
 *
 * The bot is intentionally fair: it knows the question (server-side) but throttles
 * itself with a human-like thinking delay and an accuracy cap so matches feel
 * competitive rather than unbeatable.
 * -----------------------------------------------------------------------------
 */

// Per-level tuning: accuracy = chance of answering correctly on an attempt;
// minMs..maxMs = range of "thinking time" before each attempt.
const LEVELS = {
  easy: { accuracy: 0.6, minMs: 4500, maxMs: 9000, label: 'Easy' },
  medium: { accuracy: 0.8, minMs: 3000, maxMs: 6000, label: 'Medium' },
  hard: { accuracy: 0.95, minMs: 1800, maxMs: 3800, label: 'Hard' },
};

/** Resolve a level config, defaulting to medium. */
function botConfig(level) {
  return LEVELS[level] || LEVELS.medium;
}

/** Sample a randomized thinking delay (ms) for the bot's next attempt. */
function nextDelay(level) {
  const { minMs, maxMs } = botConfig(level);
  return Math.round(minMs + Math.random() * (maxMs - minMs));
}

/** Decide whether this particular attempt is correct, per the level's accuracy. */
function willAnswerCorrectly(level) {
  return Math.random() < botConfig(level).accuracy;
}

module.exports = { botConfig, nextDelay, willAnswerCorrectly, LEVELS };
