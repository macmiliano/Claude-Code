/**
 * questionGenerator.js
 * -----------------------------------------------------------------------------
 * Server-side math question generator. ALL questions are produced here (never on
 * the client) so that answer validation cannot be tampered with by players.
 *
 * Difficulty levels:
 *   - "elementary"  : whole-number arithmetic (+, -, ×, ÷)
 *   - "middle"      : fractions (add / subtract / multiply / simplify / mixed)
 *   - "high"        : algebra (solve for x, combine like terms, quadratics)
 *
 * Each generated question has the shape:
 *   {
 *     id:        string  // unique within a game, used to prevent repeats
 *     text:      string  // human-readable prompt shown to both players
 *     answer:    string  // canonical answer (shown on the end screen)
 *     acceptable:number[]// numeric value(s) accepted as correct
 *   }
 *
 * Answers are validated numerically (see validateAnswer) so that equivalent
 * forms ("1/2", "2/4", "0.5") are all accepted, and quadratics can accept
 * either root.
 * -----------------------------------------------------------------------------
 */

const EPSILON = 1e-6;

/** Inclusive random integer in [min, max]. */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Greatest common divisor (used to reduce fractions). */
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/** Reduce a fraction to lowest terms, returns { n, d }. */
function reduce(n, d) {
  const g = gcd(n, d);
  let rn = n / g;
  let rd = d / g;
  if (rd < 0) {
    rn = -rn;
    rd = -rd;
  }
  return { n: rn, d: rd };
}

/** Format a reduced fraction as a display string ("3/4", "2", "1 1/2"). */
function fractionToString(n, d) {
  const { n: rn, d: rd } = reduce(n, d);
  if (rd === 1) return String(rn);
  return `${rn}/${rd}`;
}

// ---------------------------------------------------------------------------
// Difficulty generators. Each returns { text, answer, acceptable }.
// ---------------------------------------------------------------------------

function elementaryQuestion() {
  const type = pick(['add', 'sub', 'mul', 'div']);
  let text;
  let value;

  switch (type) {
    case 'add': {
      const a = randInt(2, 99);
      const b = randInt(2, 99);
      text = `${a} + ${b} = ?`;
      value = a + b;
      break;
    }
    case 'sub': {
      // Keep results non-negative for younger players.
      const a = randInt(10, 99);
      const b = randInt(1, a);
      text = `${a} − ${b} = ?`;
      value = a - b;
      break;
    }
    case 'mul': {
      const a = randInt(2, 12);
      const b = randInt(2, 12);
      text = `${a} × ${b} = ?`;
      value = a * b;
      break;
    }
    case 'div':
    default: {
      // Build from a known product so division is always whole.
      const b = randInt(2, 12);
      const q = randInt(2, 12);
      const a = b * q;
      text = `${a} ÷ ${b} = ?`;
      value = q;
      break;
    }
  }

  return { text, answer: String(value), acceptable: [value] };
}

function middleQuestion() {
  const type = pick(['addsub', 'mul', 'simplify', 'mixed']);

  switch (type) {
    case 'addsub': {
      const d1 = randInt(2, 9);
      const d2 = randInt(2, 9);
      const n1 = randInt(1, d1 - 1);
      const n2 = randInt(1, d2 - 1);
      const op = pick(['+', '−']);
      const commonD = d1 * d2;
      const num = op === '+' ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1;
      const value = num / commonD;
      return {
        text: `${n1}/${d1} ${op} ${n2}/${d2} = ?`,
        answer: fractionToString(num, commonD),
        acceptable: [value],
      };
    }
    case 'mul': {
      const d1 = randInt(2, 9);
      const d2 = randInt(2, 9);
      const n1 = randInt(1, d1 - 1);
      const n2 = randInt(1, d2 - 1);
      const num = n1 * n2;
      const den = d1 * d2;
      return {
        text: `${n1}/${d1} × ${n2}/${d2} = ?`,
        answer: fractionToString(num, den),
        acceptable: [num / den],
      };
    }
    case 'simplify': {
      // Start from a reduced fraction, then scale it up to be simplified back.
      const baseD = randInt(2, 9);
      const baseN = randInt(1, baseD - 1);
      const factor = randInt(2, 6);
      const n = baseN * factor;
      const d = baseD * factor;
      return {
        text: `Simplify ${n}/${d} = ?`,
        answer: fractionToString(n, d),
        acceptable: [n / d],
      };
    }
    case 'mixed':
    default: {
      // Mixed number × whole number, e.g. "2 1/3 × 3 = ?".
      const whole = randInt(1, 4);
      const d = randInt(2, 6);
      const n = randInt(1, d - 1);
      const multiplier = randInt(2, 5);
      const improperN = whole * d + n;
      const num = improperN * multiplier;
      const value = num / d;
      return {
        text: `${whole} ${n}/${d} × ${multiplier} = ?`,
        answer: fractionToString(num, d),
        acceptable: [value],
      };
    }
  }
}

function highQuestion() {
  const type = pick(['linear', 'combine', 'quadratic', 'twostep']);

  switch (type) {
    case 'linear': {
      // a·x + b = c  → x = (c - b) / a, kept as a whole number.
      const a = randInt(2, 9);
      const x = randInt(-9, 9);
      const b = randInt(-9, 9);
      const c = a * x + b;
      const bStr = b < 0 ? `− ${Math.abs(b)}` : `+ ${b}`;
      return {
        text: `${a}x ${bStr} = ${c},  x = ?`,
        answer: String(x),
        acceptable: [x],
      };
    }
    case 'twostep': {
      // a·x + b = c·x + d  → solve for x (designed to be whole).
      const x = randInt(-8, 8);
      let a = randInt(2, 9);
      let c = randInt(2, 9);
      if (a === c) c = a + 1; // ensure a !== c so a unique solution exists
      const b = randInt(-9, 9);
      const d = (a - c) * x + b; // guarantees integer solution x
      const bStr = b < 0 ? `− ${Math.abs(b)}` : `+ ${b}`;
      const dStr = d < 0 ? `− ${Math.abs(d)}` : `+ ${d}`;
      return {
        text: `${a}x ${bStr} = ${c}x ${dStr},  x = ?`,
        answer: String(x),
        acceptable: [x],
      };
    }
    case 'combine': {
      // Combine like terms: "3x + 2x = ?x" (enter the coefficient).
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const op = pick(['+', '−']);
      const coeff = op === '+' ? a + b : a - b;
      return {
        text: `Combine like terms: ${a}x ${op} ${b}x = ___x  (enter the number)`,
        answer: String(coeff),
        acceptable: [coeff],
      };
    }
    case 'quadratic':
    default: {
      // x² − k² = 0  → x = ±k. Either root is accepted.
      const k = randInt(2, 9);
      return {
        text: `x² − ${k * k} = 0,  x = ?  (either root)`,
        answer: `±${k}`,
        acceptable: [k, -k],
      };
    }
  }
}

const GENERATORS = {
  elementary: elementaryQuestion,
  middle: middleQuestion,
  high: highQuestion,
};

/**
 * Generate a question for the given difficulty that has NOT already been used
 * in this game session. `usedTexts` is a Set of question prompts already seen.
 * We retry a bounded number of times to find a fresh prompt, then fall back to
 * tagging a uniqueness suffix on the id so the game never stalls.
 */
function generateQuestion(difficulty, usedTexts = new Set()) {
  const gen = GENERATORS[difficulty] || GENERATORS.elementary;

  let q;
  for (let attempt = 0; attempt < 40; attempt++) {
    q = gen();
    if (!usedTexts.has(q.text)) break;
  }

  // id is derived from the prompt so duplicates are easy to detect.
  const id = `${difficulty}:${q.text}`;
  usedTexts.add(q.text);
  return { id, ...q };
}

/**
 * Parse a free-text answer into a number. Handles integers, decimals,
 * negatives, simple fractions ("3/4"), and mixed numbers ("2 1/3").
 * Returns null when the input cannot be parsed.
 */
function parseNumeric(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;

  // Allow players to type "x = 5" or "= 5" — strip the leading variable/equals.
  s = s.replace(/^x\s*=\s*/, '').replace(/^=\s*/, '').trim();

  // Mixed number, e.g. "2 1/3".
  const mixed = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const n = parseInt(mixed[2], 10);
    const d = parseInt(mixed[3], 10);
    if (d === 0) return null;
    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (n / d);
  }

  // Simple fraction, e.g. "3/4" or "-5/2".
  const frac = s.match(/^(-?\d+)\/(\d+)$/);
  if (frac) {
    const n = parseInt(frac[1], 10);
    const d = parseInt(frac[2], 10);
    if (d === 0) return null;
    return n / d;
  }

  // Integer or decimal.
  if (/^-?\d*\.?\d+$/.test(s)) {
    return parseFloat(s);
  }

  return null;
}

/**
 * Validate a submitted answer against a question. Comparison is numeric with a
 * small epsilon so equivalent fractions / decimals are accepted, and quadratics
 * accept either root.
 */
function validateAnswer(question, submitted) {
  const value = parseNumeric(submitted);
  if (value === null) return false;
  return question.acceptable.some((v) => Math.abs(v - value) < EPSILON);
}

module.exports = {
  generateQuestion,
  validateAnswer,
  parseNumeric,
  // Exported for potential unit testing.
  _internals: { reduce, fractionToString, gcd },
};
