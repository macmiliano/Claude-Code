/**
 * db.js
 * -----------------------------------------------------------------------------
 * PostgreSQL connection + schema bootstrap for the optional account system.
 *
 * Accounts are entirely optional: if DATABASE_URL is not set, `enabled` is false
 * and every helper becomes a no-op so guest play keeps working with zero config.
 * When DATABASE_URL is present (e.g. Neon / Supabase / Render Postgres), the
 * schema is created on startup and stats are persisted.
 *
 * Tables:
 *   users   — one row per Google account, with cumulative lifetime stats
 *   matches — one row per finished game per registered player (history feed)
 * -----------------------------------------------------------------------------
 */

const { Pool } = require('pg');

let pool = null;
let enabled = false;

if (process.env.DATABASE_URL) {
  // Hosted Postgres (Neon/Supabase/Render) needs SSL; local Postgres does not.
  const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  enabled = true;
}

/** Allow tests to inject an in-memory pool (e.g. pg-mem) without a real DB. */
function _setPoolForTest(testPool) {
  pool = testPool;
  enabled = true;
}

/** Thin query wrapper (throws if accounts are disabled / pool missing). */
function query(text, params) {
  if (!pool) throw new Error('Database not configured');
  return pool.query(text, params);
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    google_id     TEXT UNIQUE NOT NULL,
    email         TEXT,
    name          TEXT,
    picture       TEXT,
    points        INTEGER NOT NULL DEFAULT 0,
    games_played  INTEGER NOT NULL DEFAULT 0,
    wins          INTEGER NOT NULL DEFAULT 0,
    losses        INTEGER NOT NULL DEFAULT 0,
    total_correct  INTEGER NOT NULL DEFAULT 0,
    total_answered INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS matches (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode          TEXT,
    difficulty    TEXT,
    opponent      TEXT,
    result        TEXT,           -- 'win' | 'loss'
    correct       INTEGER NOT NULL DEFAULT 0,
    answered      INTEGER NOT NULL DEFAULT 0,
    accuracy      INTEGER NOT NULL DEFAULT 0,
    points_earned INTEGER NOT NULL DEFAULT 0,
    played_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_matches_user ON matches(user_id);
`;

/** Create tables if they don't exist. Safe to call on every boot. */
async function init() {
  if (!enabled) {
    // eslint-disable-next-line no-console
    console.log('ℹ️  No DATABASE_URL set — accounts/leaderboard disabled (guest play only).');
    return false;
  }
  await pool.query(SCHEMA);
  // eslint-disable-next-line no-console
  console.log('🗄️  Database ready (accounts + leaderboard enabled).');
  return true;
}

module.exports = {
  get enabled() {
    return enabled;
  },
  init,
  query,
  _setPoolForTest,
  SCHEMA,
};
