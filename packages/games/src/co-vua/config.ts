// Tuning for Cờ Vua. Numbers only; the rules are in logic.ts, the computer in ai.ts.

export const W = 540;
export const H = 960;

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

/** Which colour the human takes against the computer. */
export type ColorChoice = "white" | "random" | "black";
export const COLOR_CHOICES: ColorChoice[] = ["white", "random", "black"];

/** Solo score for beating the computer: base by level, plus a bonus for a quick win. */
export const WIN_SCORE: Record<Difficulty, number> = {
  easy: 100,
  normal: 400,
  hard: 1200,
};
/** Bonus per move under this many of your own moves. */
export const QUICK_WIN_MOVES = 60;
export const QUICK_WIN_BONUS: Record<Difficulty, number> = {
  easy: 1,
  normal: 4,
  hard: 12,
};
/** Take-backs per game against the computer (your move and its reply). */
export const UNDOS_PER_GAME = 3;
/** Seconds after your move before the computer starts thinking (lets the slide finish). */
export const AI_DELAY = 0.35;

/** How hard each level looks: max depth, time budget (ms) and root noise (centipawns). */
export const AI_LEVELS: Record<Difficulty, { depth: number; ms: number; noise: number; random: number }> = {
  // Shallow, very noisy, and now and then a plain random move: it blunders on purpose
  easy: { depth: 1, ms: 60, noise: 170, random: 0.12 },
  normal: { depth: 3, ms: 220, noise: 30, random: 0 },
  // Iterative deepening until the time runs out
  hard: { depth: 12, ms: 300, noise: 0, random: 0 },
};
/** A hard ceiling on searched positions per move, whatever the clock says. */
export const AI_MAX_NODES = 400_000;

// ---------------------------------------------------------------- online

/** Seconds a dropped player has to come back before the game is forfeited (there is no clock). */
export const AWAY_SECONDS = 60;
/** Plies a player must wait after offering a draw before offering again. */
export const OFFER_GAP = 2;
/** Online scores: a win, plus a bonus for a quick checkmate. A draw or a loss scores nothing. */
export const MATCH_WIN_SCORE = 1000;
export const MATCH_QUICK_MOVES = 60;
export const MATCH_QUICK_BONUS = 10;
