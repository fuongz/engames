// Tuning for Xu Vũ Trụ. Numbers and tables only; the rules are in logic.ts and
// the shelf physics in physics.ts.

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- economy

/**
 * Coins every run starts with. BETA value: generous on purpose so testers see a
 * few Bonus Spins and a Super Bonus; tune it down once the machine is balanced.
 */
export const BETA_START_COINS = 200;
/** Tickets for lighting all six energy cores. */
export const SUPER_TICKETS = 250;
/** Each coin (or each coin in a stack) pushed over the front edge comes back, plus this many tickets. */
export const FRONT_TICKETS = 1;

// ---------------------------------------------------------------- the wheel

export type Segment =
  | { kind: "tickets"; value: number }
  | { kind: "core" }
  | { kind: "bonus" };

const t = (value: number): Segment => ({ kind: "tickets", value });
/** The target wheel, clockwise from angle 0. One narrow core slot and one narrow BONUS slot: hitting them takes timing. */
export const WHEEL: Segment[] = [
  t(2), t(3), t(2), t(6), t(2), t(3), { kind: "core" }, t(2), t(3), t(12),
  t(2), t(3), t(6), t(2), { kind: "bonus" }, t(3), t(2), t(6), t(2), t(3),
];
/** Ticket slots are twice as wide as the core and BONUS slots. */
const widthOf = (s: Segment) => (s.kind === "tickets" ? 2 : 1);
const UNITS = WHEEL.reduce((a, s) => a + widthOf(s), 0);
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
/** Holding SHOOT fires this often (seconds). */
export const FIRE_INTERVAL = 0.24;

// ---------------------------------------------------------------- bonus

/** The Bonus Spin reel: prizes and their weights. */
export const SPIN_PRIZES = [10, 30, 65, 100] as const;
export const SPIN_WEIGHTS = [52, 30, 13, 5] as const;
/** Seconds a Bonus Spin reel runs before it lands. */
export const SPIN_TIME = 2.4;
/** Seconds of Super Bonus celebration before the cores reset. */
export const SUPER_TIME = 3.4;
/** Free coins showered onto the shelf by a Super Bonus. */
export const SUPER_SHOWER = 12;
/** Seconds between coins of the shower. */
export const SHOWER_GAP = 0.09;
export const CORE_COUNT = 6;
/** A capsule lost into a gutter comes back after this long (if its core is still dark). */
export const CORE_RESPAWN = 2.5;

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
