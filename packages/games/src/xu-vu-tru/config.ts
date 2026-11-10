// Tuning for Xu Vũ Trụ. Numbers and tables only; the rules are in logic.ts and
// the shelf physics in physics.ts.

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- economy

/**
 * Coins every run starts with. BETA value: generous on purpose so testers see a
 * few Super spins; tune it down once the machine is balanced.
 */
export const BETA_START_COINS = 200;
/** Each coin (or each coin in a stack) pushed over the front edge comes back, plus this many tickets. */
export const FRONT_TICKETS = 1;

// ---------------------------------------------------------------- the wheel

/** What a wheel slot pays. Expected values per shot are worked out in RE_NOTES.md. */
export type Segment =
  /** Tickets straight to the counter; the shot coin stays in the wheel. */
  | { kind: "tickets"; value: number }
  /** This many coins rain onto the shelf instead of the shot coin. */
  | { kind: "coins"; value: number }
  /** An energy capsule drops onto the shelf, and a Mini spin starts. */
  | { kind: "core" }
  /** A cat card (one of CARD_IDS, picked at random) drops onto the shelf. */
  | { kind: "card" };

const t = (value: number): Segment => ({ kind: "tickets", value });
const c = (value: number): Segment => ({ kind: "coins", value });
const CORE: Segment = { kind: "core" };
const CARD: Segment = { kind: "card" };
/**
 * The target wheel, clockwise from angle 0: 12 ticket slots, 10 coin slots, one
 * energy-core slot and one card slot. Big prizes sit on narrow slots, so
 * hitting them takes timing.
 */
export const WHEEL: Segment[] = [
  t(2), c(1), t(3), c(2), t(5), CORE, t(2), c(1), t(3), c(8),
  t(2), c(4), t(5), c(1), t(10), c(2), t(2), CARD, t(3), c(6),
  t(2), c(1), t(3), c(2),
];
/**
 * Slot widths in units (a unit is 1/UNITS of the turn). The coin meets the wheel
 * at an effectively random angle, so a slot's chance is its width over UNITS.
 */
export function widthOf(s: Segment) {
  if (s.kind === "tickets") return 2;
  if (s.kind === "coins") return s.value === 1 ? 2 : s.value === 2 ? 1.5 : s.value === 4 ? 1 : 0.75;
  return s.kind === "core" ? 1.25 : 0.75;
}
export const UNITS = WHEEL.reduce((a, s) => a + widthOf(s), 0);
/** Where each segment starts and how wide it is, in radians from the wheel's zero mark. */
export const SEG_START: number[] = [];
export const SEG_SIZE: number[] = [];
{
  let at = 0;
  for (const s of WHEEL) {
    SEG_START.push(at);
    SEG_SIZE.push((widthOf(s) / UNITS) * Math.PI * 2);
    at += SEG_SIZE[SEG_SIZE.length - 1];
  }
}
/** Wheel speed, radians per second (clockwise on screen). */
export const WHEEL_SPEED = Math.PI * 2 * 0.2;
/** The speed swings ±this share over WOBBLE_PERIOD seconds. */
export const WHEEL_WOBBLE = 0.22;
export const WOBBLE_PERIOD = 7.3;
/** Where the chute meets the wheel: angle 0 is 3 o'clock (canvas convention). */
export const POINTER_ANGLE = 0;

/** Seconds from pressing SHOOT to the coin striking the wheel (the lead to aim with). */
export const FLIGHT_UP = 0.42;
/** Seconds from the wheel down onto the shelf. */
export const FLIGHT_DOWN = 0.4;
/** Seconds between the coins of a coin slot's drop. */
export const COIN_DROP_GAP = 0.06;
/** Holding SHOOT fires this often (seconds). */
export const FIRE_INTERVAL = 0.24;

// ---------------------------------------------------------------- spins

export interface Prize {
  kind: "tickets" | "coins";
  value: number;
}
/** The Mini spin (an energy-core slot): mostly tickets, sometimes a pile of coins. */
export const MINI_PRIZES: Prize[] = [
  { kind: "tickets", value: 20 },
  { kind: "coins", value: 20 },
  { kind: "tickets", value: 30 },
  { kind: "coins", value: 25 },
  { kind: "tickets", value: 40 },
  { kind: "coins", value: 30 },
  { kind: "tickets", value: 50 },
  { kind: "coins", value: 35 },
];
export const MINI_WEIGHTS = [30, 14, 22, 9, 12, 5, 6, 2];
/** The Super spin (six cores collected): tickets only. */
export const SUPER_PRIZES = [80, 100, 150, 200, 250, 300, 500];
export const SUPER_WEIGHTS = [26, 26, 20, 13, 8, 5, 2];
/** Seconds a spin's reel runs before it lands. */
export const SPIN_TIME = 2.4;
/** The Super spin runs longer, for the drama. */
export const SUPER_SPIN_TIME = 3.4;
/** Capsules pushed off the front needed for a Super spin. */
export const CORE_COUNT = 6;

// ---------------------------------------------------------------- cards

/** The album: ten cat cards (art in img/cards/<id>.webp, names in strings.ts). */
export const CARD_IDS = [
  "persian",
  "british",
  "siamese",
  "maine-coon",
  "scottish-fold",
  "ragdoll",
  "bengal",
  "sphynx",
  "munchkin",
  "tabby",
] as const;
export type CardId = (typeof CARD_IDS)[number];
export const CARD_COUNT = CARD_IDS.length;
/** Tickets for every card pushed off the front (new or a duplicate). */
export const CARD_TICKETS = 60;
/** Tickets for owning all ten; the album then starts over. */
export const SET_TICKETS = 1000;
/** Seconds of set-complete celebration (display only). */
export const SET_TIME = 3.6;

// ---------------------------------------------------------------- the shelf (physics.ts)

/** Shelf size in world units (x across, y from the back wall to the front edge). */
export const SHELF_W = 440;
export const SHELF_D = 330;
/** Side walls run from the back to this depth; past it the sides are open gutters. */
export const SIDE_WALL_D = 200;
export const COIN_R = 15;
export const CORE_R = 24;
/** A capsule weighs as much as this many coins. */
export const CORE_MASS = 6;
/** A card's footprint (a disc for the physics; drawn as a small tilted card). */
export const CARD_R = 19;
export const CARD_MASS = 2;
/** Capsules already on the shelf when a run starts. */
export const PREFILL_CORES = 2;
/** Coins per pile at most (a dropped coin landing on a coin stacks on it). */
export const MAX_STACK = 3;
/** Bodies on the shelf at most; past it the oldest coin is merged into a neighbour's stack. */
export const MAX_BODIES = 170;
/** The pusher's front face sweeps between these depths. */
export const PUSH_MIN = 34;
export const PUSH_MAX = 100;
export const PUSH_PERIOD = 2.6;
/** Sliding friction, world units per second² (Coulomb: same for every body). */
export const FRICTION = 520;
/** Velocity lost per second on top of friction. */
export const DAMPING = 1.5;
export const MAX_SPEED = 520;
export const RESTITUTION = 0.08;
/** Collision passes per step, and how much of an overlap each pass removes. */
export const ITERATIONS = 5;
export const RELAX = 0.55;
/** Seconds with nothing moving off the shelf, after the last coin, before the run ends. */
export const SETTLE_TIME = PUSH_PERIOD * 2.2;
/** The shelf at the start: coin rows, and the share of them that are stacks of 2 or 3. */
export const PREFILL_FILL = 0.92;
export const PREFILL_STACK2 = 0.2;
export const PREFILL_STACK3 = 0.07;
