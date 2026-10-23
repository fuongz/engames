// Every timing is in frames of a fixed 60 Hz step (the game runs with
// defineGame's fixedStep), so the same inputs always replay the same fight —
// the ground rule for rollback netcode later. Tuning is checked by logic.test.ts.

export const W = 960;
export const H = 540;
export const FPS = 60;

export const FLOOR_Y = 452;
export const WALL_L = 60;
export const WALL_R = W - 60;
export const PUSH_HALF = 26; // half-width of the box fighters can't overlap
export const GRAVITY = 0.62;

export const ROUND_FRAMES = 60 * FPS;
export const ROUNDS_TO_WIN = 2;
export const MAX_ROUNDS = 5;
export const INTRO_FRAMES = 110; // "Round 1" … "Fight!"
export const OUTRO_FRAMES = 150; // K.O. slow-down and the winner's pose
export const FINISH_WINDOW = 120; // ↓↓ + Beast after the deciding K.O.
export const FINISH_FRAMES = 110;

export const HITSTOP = 7;
export const BLOCKSTOP = 4;
export const KNOCKDOWN_FRAMES = 42;
export const GETUP_FRAMES = 22; // invulnerable while standing back up
export const COMBO_SCALING = 0.88; // each extra hit in a combo deals less
export const MIN_SCALING = 0.35;
export const CHIP = 0.12; // share of a special's damage that goes through a block
export const INPUT_HISTORY = 30;
export const MOTION_WINDOW = 20; // frames a motion input may take
/**
 * A button pressed up to this many frames before the fighter can act still
 * comes out (pressed during hitstop, a recovery or a landing). Without it,
 * presses a hair early are simply lost and the game feels unresponsive.
 */
export const BUFFER_FRAMES = 8;

export const BEAST_MAX = 100;
export const BEAST_GAIN_DEAL = 0.13; // meter per point of damage dealt
export const BEAST_GAIN_TAKE = 0.09; // … and taken
export const BEAST_DURATION = 10 * FPS;
export const BEAST_DRAIN_ON_HIT = 0.08; // extra drain per point of damage taken in beast form
export const TRANSFORM_FRAMES = 40;
export const BEAST_DAMAGE = 1.25;
export const BEAST_SPEED = 1.15;
export const BEAST_REGEN = 0.22; // health per frame in beast form

export type FighterId = "ho" | "soi" | "gau";
export const FIGHTERS: FighterId[] = ["ho", "soi", "gau"];

export interface FighterStats {
  hp: number;
  walk: number;
  jumpVy: number;
  jumpVx: number;
  /** Multiplies every move's damage. */
  power: number;
  /** Fur/outfit colours for the chibi rig. */
  palette: { skin: string; hair: string; gi: string; belt: string; fur: string; stripe: string; eye: string };
}

export const STATS: Record<FighterId, FighterStats> = {
  ho: {
    hp: 1000,
    walk: 3.1,
    jumpVy: -13.2,
    jumpVx: 4.2,
    power: 1,
    palette: { skin: "#f6c9a0", hair: "#3a2416", gi: "#e86a1c", belt: "#2a1a10", fur: "#f29a2e", stripe: "#2a1606", eye: "#ffe14a" },
  },
  soi: {
    hp: 960,
    walk: 3.7,
    jumpVy: -13.8,
    jumpVx: 4.8,
    power: 1,
    palette: { skin: "#f3d2b4", hair: "#d8dce8", gi: "#3a6fd8", belt: "#121a33", fur: "#9aa4b8", stripe: "#4a5266", eye: "#7ae8ff" },
  },
  gau: {
    hp: 1100,
    walk: 2.5,
    jumpVy: -12.2,
    jumpVx: 3.6,
    power: 1.04,
    palette: { skin: "#e8b48a", hair: "#2a1a12", gi: "#4c8a3a", belt: "#1e2a14", fur: "#7a4a28", stripe: "#3a2010", eye: "#ffb03a" },
  },
};

// ---------------------------------------------------------------- moves

export type MoveId =
  | "jab"
  | "kick"
  | "lowJab"
  | "sweep"
  | "airPunch"
  | "airKick"
  | "rush" // special 1: ↓→ + P, or Special
  | "rising" // special 2: →↓→ + P, or → + Special (anti-air launcher)
  | "third" // special 3: ↓← + K, or ← + Special
  | "frenzy"; // beast only: Beast button while transformed

export type Height = "high" | "mid" | "low" | "overhead";

export interface MoveSpec {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  hitstun: number;
  blockstun: number;
  /** Hitbox relative to the fighter's feet, x toward where they face. */
  box: { x: number; y: number; w: number; h: number };
  height: Height;
  /** Horizontal push on hit/block, px per frame decaying. */
  push: number;
  /** Ground speed while the move runs (dashes). */
  dash?: number;
  /** Sends a hit opponent into the air (juggle). */
  launch?: number;
  knockdown?: boolean;
  /** Frames from the start that ignore hits (reversals). */
  invuln?: number;
  /** Absorbs one hit while active (Bear's charge). */
  armor?: boolean;
  /** Spawns a projectile on the first active frame. */
  projectile?: { speed: number; damage: number; w: number; h: number };
  /** Can be cancelled into a special on hit or block. */
  cancel?: boolean;
  /** Is a jump move (ends on landing). */
  air?: boolean;
  /** Vertical lift at the start (rising moves). */
  rise?: number;
  special?: boolean;
}

const BASE: Record<"jab" | "kick" | "lowJab" | "sweep" | "airPunch" | "airKick", MoveSpec> = {
  jab: { startup: 4, active: 3, recovery: 8, damage: 38, hitstun: 15, blockstun: 9, box: { x: 18, y: -98, w: 52, h: 22 }, height: "high", push: 4, cancel: true },
  kick: { startup: 7, active: 4, recovery: 15, damage: 66, hitstun: 19, blockstun: 12, box: { x: 22, y: -74, w: 66, h: 26 }, height: "mid", push: 7, cancel: true },
  lowJab: { startup: 5, active: 3, recovery: 9, damage: 30, hitstun: 13, blockstun: 8, box: { x: 18, y: -58, w: 50, h: 20 }, height: "mid", push: 3, cancel: true },
  sweep: { startup: 9, active: 4, recovery: 22, damage: 58, hitstun: 22, blockstun: 12, box: { x: 18, y: -24, w: 74, h: 22 }, height: "low", push: 5, knockdown: true },
  airPunch: { startup: 4, active: 10, recovery: 4, damage: 44, hitstun: 16, blockstun: 10, box: { x: 10, y: -96, w: 50, h: 34 }, height: "overhead", push: 3, air: true },
  airKick: { startup: 6, active: 12, recovery: 4, damage: 62, hitstun: 18, blockstun: 11, box: { x: 8, y: -60, w: 60, h: 34 }, height: "overhead", push: 5, air: true },
};

/** Each fighter's three specials and beast frenzy; base moves are shared and scaled by `power`. */
const SPECIALS: Record<FighterId, Record<"rush" | "rising" | "third" | "frenzy", MoveSpec>> = {
  ho: {
    // Hổ Trảo: a clawing dash
    rush: { startup: 10, active: 10, recovery: 20, damage: 110, hitstun: 22, blockstun: 16, box: { x: 10, y: -96, w: 66, h: 70 }, height: "mid", push: 8, dash: 7.5, knockdown: true, special: true },
    // Thăng Long Trảo: rising claw, invulnerable start, launches
    rising: { startup: 4, active: 12, recovery: 26, damage: 120, hitstun: 30, blockstun: 16, box: { x: 4, y: -130, w: 54, h: 110 }, height: "mid", push: 3, launch: -11, invuln: 8, rise: -10, special: true },
    // Hổ Vồ: a leaping overhead pounce
    third: { startup: 14, active: 10, recovery: 18, damage: 96, hitstun: 22, blockstun: 14, box: { x: 6, y: -70, w: 70, h: 60 }, height: "overhead", push: 6, dash: 5, rise: -9, knockdown: true, special: true },
    frenzy: { startup: 6, active: 26, recovery: 24, damage: 210, hitstun: 36, blockstun: 20, box: { x: 6, y: -120, w: 84, h: 110 }, height: "mid", push: 10, dash: 9, launch: -9, knockdown: true, invuln: 6, special: true },
  },
  soi: {
    // Sói Tru: a howling shock wave
    rush: { startup: 12, active: 2, recovery: 26, damage: 0, hitstun: 0, blockstun: 0, box: { x: 0, y: 0, w: 0, h: 0 }, height: "mid", push: 0, projectile: { speed: 7.5, damage: 86, w: 40, h: 48 }, special: true },
    // Nguyệt Trảo: a flipping rising kick
    rising: { startup: 3, active: 10, recovery: 24, damage: 104, hitstun: 30, blockstun: 15, box: { x: 0, y: -128, w: 58, h: 104 }, height: "mid", push: 3, launch: -12, invuln: 7, rise: -11, special: true },
    // Phong Cước: a low sliding kick
    third: { startup: 8, active: 14, recovery: 18, damage: 80, hitstun: 22, blockstun: 12, box: { x: 10, y: -26, w: 72, h: 24 }, height: "low", push: 6, dash: 8.5, knockdown: true, special: true },
    frenzy: { startup: 5, active: 28, recovery: 22, damage: 190, hitstun: 36, blockstun: 20, box: { x: 6, y: -110, w: 90, h: 104 }, height: "mid", push: 10, dash: 11, launch: -10, knockdown: true, invuln: 6, special: true },
  },
  gau: {
    // Gấu Húc: an armoured shoulder charge
    // (Long recovery: blocked, it is a free punish — the price of the armour)
    rush: { startup: 14, active: 12, recovery: 32, damage: 96, hitstun: 24, blockstun: 12, box: { x: 8, y: -100, w: 62, h: 84 }, height: "mid", push: 9, dash: 6, armor: true, knockdown: true, special: true },
    // Gấu Hất: a rising swipe
    rising: { startup: 6, active: 10, recovery: 30, damage: 130, hitstun: 32, blockstun: 18, box: { x: 6, y: -134, w: 60, h: 112 }, height: "mid", push: 4, launch: -10, invuln: 9, rise: -8, special: true },
    // Địa Chấn: a ground slam, hits low
    third: { startup: 18, active: 6, recovery: 26, damage: 112, hitstun: 26, blockstun: 16, box: { x: -10, y: -20, w: 130, h: 22 }, height: "low", push: 8, knockdown: true, special: true },
    frenzy: { startup: 8, active: 24, recovery: 26, damage: 240, hitstun: 38, blockstun: 22, box: { x: 4, y: -124, w: 92, h: 116 }, height: "mid", push: 12, dash: 8, launch: -8, knockdown: true, armor: true, special: true },
  },
};

export function moveSpec(fighter: FighterId, move: MoveId): MoveSpec {
  if (move === "rush" || move === "rising" || move === "third" || move === "frenzy") return SPECIALS[fighter][move];
  return BASE[move];
}

/** Hurtboxes relative to the feet (standing, crouching, airborne). */
export const HURT = {
  stand: { x: -24, y: -118, w: 48, h: 118 },
  crouch: { x: -26, y: -74, w: 52, h: 74 },
  air: { x: -22, y: -104, w: 44, h: 86 },
};

// ---------------------------------------------------------------- CPU

export type Difficulty = 0 | 1 | 2;

export interface CpuSkill {
  /** Frames before the CPU reacts to what it sees. */
  reaction: number;
  /** Chance to block an attack it has noticed. */
  block: number;
  /** Chance to answer a jump-in with its anti-air special. */
  antiAir: number;
  /** Chance per decision to go for a special. */
  special: number;
  /** Chance to continue a combo after a hit. */
  combo: number;
}

export const CPU: Record<Difficulty, CpuSkill> = {
  0: { reaction: 22, block: 0.25, antiAir: 0.1, special: 0.08, combo: 0.2 },
  1: { reaction: 13, block: 0.55, antiAir: 0.35, special: 0.16, combo: 0.5 },
  2: { reaction: 7, block: 0.82, antiAir: 0.7, special: 0.24, combo: 0.85 },
};

// ---------------------------------------------------------------- scoring

export const SCORE = {
  damage: 1, // per point dealt
  roundWin: 500,
  perfect: 1500,
  timeLeft: 10, // per second left on a K.O.
  finisher: 3000,
  fightWin: 2000,
};
