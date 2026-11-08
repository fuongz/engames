// Tuning for Caro. Numbers only; the rules are in logic.ts.

export const W = 540;
export const H = 960;

/** The board is SIZE × SIZE squares of a school notebook. */
export const SIZE = 19;
export const CELLS = SIZE * SIZE;
/** Marks in a row that win (more also wins, unless both ends are blocked). */
export const WIN_LEN = 5;

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

/** Solo score for beating the computer: base by level, plus a bonus for a quick win. */
export const WIN_SCORE: Record<Difficulty, number> = {
  easy: 100,
  normal: 400,
  hard: 1200,
};
/** Bonus per move under this many of your own moves. */
export const QUICK_WIN_MOVES = 40;
export const QUICK_WIN_BONUS: Record<Difficulty, number> = {
  easy: 2,
  normal: 6,
  hard: 15,
};
/** Take-backs per game against the computer. */
export const UNDOS_PER_GAME = 3;
/** Seconds the computer "thinks" before its move appears (it is instant). */
export const AI_DELAY = 0.45;

// ---------------------------------------------------------------- online

/** A turn online; when it runs out the room plays a sensible move for you. */
export const TURN_SECONDS = 30;
/** Timed-out turns in a row that forfeit the match. */
export const MAX_TIMEOUTS = 3;
/** Seconds a dropped player has to come back before the match is forfeited. */
export const RECONNECT_SECONDS = 30;
/** Games to win the match (first to 2 = best of 3). */
export const MATCH_WINS = 2;
/** Draws can repeat; the match stops after this many games regardless. */
export const MAX_GAMES = 5;
/** Pause between games, showing who took the last one. */
export const BETWEEN_GAMES = 3.5;
/** Online scores: the match winner, plus a bonus for few moves; the loser gets a little per game won. */
export const MATCH_WIN_SCORE = 1000;
export const MATCH_QUICK_MOVES = 80;
export const MATCH_QUICK_BONUS = 5;
export const GAME_WIN_SCORE = 250;
