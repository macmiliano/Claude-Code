/**
 * stats.js
 * -----------------------------------------------------------------------------
 * Account + progression queries built on db.js. Handles Google-user upserts,
 * recording finished matches, and the profile/leaderboard reads.
 *
 * Points rule (chosen for this game):
 *   pointsEarned = (win ? WIN_BONUS : 0) + correctAnswers * PER_CORRECT
 * Cumulative `points` drive the global leaderboard.
 * -----------------------------------------------------------------------------
 */

const db = require('./db');

const WIN_BONUS = 25;
const PER_CORRECT = 1;

/** Compute the points earned for a single finished match. */
function pointsFor({ win, correct }) {
  return (win ? WIN_BONUS : 0) + (correct || 0) * PER_CORRECT;
}

/**
 * Insert or update a user from a verified Google profile. Returns the user row.
 */
async function upsertGoogleUser({ sub, email, name, picture }) {
  const { rows } = await db.query(
    `INSERT INTO users (google_id, email, name, picture)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE
       SET email = EXCLUDED.email, name = EXCLUDED.name, picture = EXCLUDED.picture
     RETURNING *`,
    [sub, email || null, name || 'Player', picture || null],
  );
  return rows[0];
}

/** Fetch a user by primary key (null if missing). */
async function getUserById(id) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Record one finished match for a registered player and roll the result into
 * their cumulative lifetime stats. `correct`/`answered` come from the match.
 */
async function recordMatch(userId, { mode, difficulty, opponent, win, correct, answered }) {
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const points = pointsFor({ win, correct });
  const result = win ? 'win' : 'loss';

  await db.query(
    `INSERT INTO matches (user_id, mode, difficulty, opponent, result, correct, answered, accuracy, points_earned)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [userId, mode, difficulty, opponent, result, correct, answered, accuracy, points],
  );

  await db.query(
    `UPDATE users SET
       points         = points + $2,
       games_played   = games_played + 1,
       wins           = wins + $3,
       losses         = losses + $4,
       total_correct  = total_correct + $5,
       total_answered = total_answered + $6
     WHERE id = $1`,
    [userId, points, win ? 1 : 0, win ? 0 : 1, correct, answered],
  );

  return { points, accuracy, result };
}

/**
 * Profile dashboard data: the user's lifetime stats, recent match history, and a
 * per-difficulty accuracy breakdown.
 */
async function getProfile(userId) {
  const user = await getUserById(userId);
  if (!user) return null;

  const history = await db.query(
    `SELECT mode, difficulty, opponent, result, correct, answered, accuracy, points_earned, played_at
     FROM matches WHERE user_id = $1 ORDER BY played_at DESC LIMIT 20`,
    [userId],
  );

  const byDifficulty = await db.query(
    `SELECT difficulty,
            COUNT(*)::int                                   AS games,
            COALESCE(SUM(CASE WHEN result='win' THEN 1 ELSE 0 END),0)::int AS wins,
            COALESCE(SUM(correct),0)::int                   AS correct,
            COALESCE(SUM(answered),0)::int                  AS answered
     FROM matches WHERE user_id = $1
     GROUP BY difficulty`,
    [userId],
  );

  const winRate = user.games_played ? Math.round((user.wins / user.games_played) * 100) : 0;
  const accuracy = user.total_answered
    ? Math.round((user.total_correct / user.total_answered) * 100)
    : 0;

  return {
    user: publicUser(user),
    winRate,
    accuracy,
    history: history.rows,
    byDifficulty: byDifficulty.rows.map((r) => ({
      ...r,
      accuracy: r.answered ? Math.round((r.correct / r.answered) * 100) : 0,
      winRate: r.games ? Math.round((r.wins / r.games) * 100) : 0,
    })),
  };
}

/** Top players by lifetime points (win-rate computed in JS for portability). */
async function getLeaderboard(limit = 20) {
  const { rows } = await db.query(
    `SELECT id, name, picture, points, games_played, wins
     FROM users ORDER BY points DESC, wins DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    name: r.name,
    picture: r.picture,
    points: r.points,
    gamesPlayed: r.games_played,
    wins: r.wins,
    winRate: r.games_played ? Math.round((r.wins / r.games_played) * 100) : 0,
  }));
}

/** Strip nothing sensitive (no passwords here) but shape a clean public object. */
function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    picture: u.picture,
    points: u.points,
    gamesPlayed: u.games_played,
    wins: u.wins,
    losses: u.losses,
    totalCorrect: u.total_correct,
    totalAnswered: u.total_answered,
  };
}

module.exports = {
  pointsFor,
  upsertGoogleUser,
  getUserById,
  recordMatch,
  getProfile,
  getLeaderboard,
  publicUser,
  constants: { WIN_BONUS, PER_CORRECT },
};
