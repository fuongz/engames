import type { RoomSetting } from "@web-games/core/online";

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
/** Match lengths the host can pick in the lobby (best of N games). */
export const BEST_OF = [1, 3, 5] as const;
export type BestOf = (typeof BEST_OF)[number];
export const DEFAULT_BEST_OF: BestOf = 3;
/** Games to win the match: first to 1, 2 or 3. */
export const winsNeeded = (bestOf: number) => Math.ceil(bestOf / 2);
/** Draws can repeat; the match stops after this many games regardless. */
export const maxGames = (bestOf: number) => bestOf + 2;
/** The lobby setting the host picks the match length with (manifest and room adapter share it). */
export const ROOM_SETTINGS: RoomSetting[] = [
  {
    key: "bestOf",
    label: { vi: "Thể thức", en: "Match length" },
    choices: BEST_OF.map((n) => ({ value: String(n), label: { vi: `Bo${n}`, en: `Best of ${n}` } })),
    default: String(DEFAULT_BEST_OF),
  },
];
/** Pause between games, showing who took the last one. */
export const BETWEEN_GAMES = 3.5;
/** Online scores: the match winner, plus a bonus for few moves; the loser gets a little per game won. */
export const MATCH_WIN_SCORE = 1000;
export const MATCH_QUICK_MOVES = 80;
export const MATCH_QUICK_BONUS = 5;
export const GAME_WIN_SCORE = 250;
