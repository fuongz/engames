import type { RoomSetting } from "@web-games/core/online";

// Tuning for Cờ Cá Ngựa (Ludo). Numbers and tables only; the rules are in logic.ts.

export const W = 540;
export const H = 960;

/** The board is GRID × GRID squares: a cross with four 6×6 bases in the corners. */
export const GRID = 15;
/** Squares on the shared loop around the cross. */
export const TRACK_LEN = 52;
/** Track squares between two colours' start squares. */
export const QUARTER = 13;
/** A token's progress: -1 in base, 0..LAST_TRACK on the loop, then the home column, HOME = finished. */
export const BASE = -1;
export const LAST_TRACK = 50;
/** Squares in a colour's own home column (the triangle in the middle is HOME). */
export const HOME_COLUMN = 5;
export const HOME = LAST_TRACK + HOME_COLUMN + 1;
export const TOKENS = 4;

/** Track squares (from the bottom-left start) that are safe: the four starts and the four stars. */
export const STARTS = [0, 13, 26, 39];
export const STARS = [8, 21, 34, 47];

/** Two dice a turn, each spent on its own; a die showing this brings a horse out. */
export const DICE = 2;
export const SIX = 6;
/** Doubles earn another roll; this many in a row and the turn is lost. */
export const MAX_DOUBLES = 3;

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

/** Seats at the table, by the menu's / host's choice. */
export const PLAYER_COUNTS = [2, 3, 4] as const;
export const DEFAULT_PLAYERS = 4;
/** Corners (0 bottom-left, then clockwise) for 2, 3 and 4 seats, in the order people are seated: spread out, so two friends sit opposite. */
export const SEAT_ORDER: Record<number, number[]> = {
  2: [0, 2],
  3: [0, 1, 2],
  4: [0, 2, 1, 3],
};

// ---------------------------------------------------------------- pacing (seconds)

/** The dice tumble this long before their faces show. */
export const ROLL_TIME = 0.6;
/** One square of a token's hop. */
export const HOP_TIME = 0.15;
/** A captured token flies back to its base. */
export const CAPTURE_TIME = 0.45;
/** A beat after a move lands before the next roll. */
export const SETTLE_TIME = 0.2;
/** "No move" / "three doubles" stays up this long before the turn passes. */
export const PASS_TIME = 0.75;
/** The computer waits before rolling and before moving, so you can follow it. */
export const BOT_ROLL_DELAY = 0.35;
export const BOT_MOVE_DELAY = 0.4;
/** Only one sensible move: a human's token moves on its own after this beat. */
export const AUTO_MOVE_DELAY = 0.35;
/** A match never runs longer than this many turns (safety net; real games take ~150). */
export const MAX_TURNS = 3000;

// ---------------------------------------------------------------- scoring

/** Offline score for finishing first against the computer: by level, times the table size. */
export const WIN_SCORE: Record<Difficulty, number> = {
  easy: 100,
  normal: 300,
  hard: 800,
};
export const TABLE_BONUS: Record<number, number> = { 2: 1, 3: 1.5, 4: 2 };

/** Online scores by finishing place and table size; only first (and second at a big table) score. */
export const ONLINE_SCORE: Record<number, number[]> = {
  2: [400, 0],
  3: [600, 150, 0],
  4: [800, 250, 0, 0],
};

// ---------------------------------------------------------------- online

/** A decision online; when it runs out the room rolls or moves for you (the Normal computer). */
export const TURN_SECONDS = 20;
/** Timed-out decisions in a row before the computer keeps playing your seat (any tap takes it back). */
export const MAX_TIMEOUTS = 3;

/** The host's lobby choice: how many seats the table has; the computer fills the empty ones. */
export const ROOM_SETTINGS: RoomSetting[] = [
  {
    key: "players",
    label: { vi: "Số người", en: "Players" },
    choices: PLAYER_COUNTS.map((n) => ({ value: String(n), label: { vi: `${n} người`, en: `${n} players` } })),
    default: String(DEFAULT_PLAYERS),
  },
];
