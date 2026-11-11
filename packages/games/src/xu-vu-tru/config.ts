// Tuning for Xu Vũ Trụ. Numbers and tables only; the rules are in logic.ts and
// the shelf physics in physics.ts.

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- economy

/** The game's version (manifest.version, the save envelope's `v`). */
export const VERSION = "1.0.0";
/** Coins a guest's local trial machine starts with (no daily coins, no deposits). */
export const TRIAL_COINS = 100;
/** The signed-in allowance (manifest.allowance): a welcome once, then a daily. */
export const WELCOME_COINS = 100;
export const DAILY_COINS = 50;
/** Each coin (or each coin in a stack) pushed over the front edge comes back, plus this many tickets. */
export const FRONT_TICKETS = 1;

// ---------------------------------------------------------------- the gate

/**
 * Under the wheel's hub a gate swings left and right with a hole (a cup) in it.
 * The shot coin lands on the gate FLIGHT_UP seconds after the press, somewhere in
 * a band ±AIM_SPREAD around the gate's centre (it rattles out of the chute). If
 * its centre is within ±HOLE_HALF of the hole's centre it drops in and starts a
 * prize spin; otherwise it bounces off and falls onto the shelf.
 *
 * All three are screen px across the gate (drawn 1:1). Measured in logic.test.ts:
 * random fire times hit ≈ 25%, a perfectly timed shot (hole centred under the
 * band when the coin arrives) ≈ HOLE_HALF / AIM_SPREAD ≈ 45%.
 */
export const GATE_AMP = 45;
export const HOLE_HALF = 15;
export const AIM_SPREAD = 33;
/** One full left-right-left swing, seconds. */
export const GATE_PERIOD = 1.45;
/** The swing speed drifts ±this share over GATE_WOBBLE_PERIOD, so a held button can't lock onto it. */
export const GATE_WOBBLE = 0.1;
export const GATE_WOBBLE_PERIOD = 5.9;

// ---------------------------------------------------------------- the wheel

/** What a wheel slot pays when a prize spin stops on it. Expected values are in RE_NOTES.md. */
export type Segment =
  /** Tickets straight to the counter. */
  | { kind: "tickets"; value: number }
  /** This many coins rain onto the shelf. */
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
 * The prize wheel, clockwise from angle 0. It turns as decoration; what it pays is
 * a weighted pick (see weightOf), and every slot is drawn exactly as wide as its
 * weight, so the wheel reads honestly: a slot's share of the circle is its chance.
 */
export const WHEEL: Segment[] = [
  t(10), t(5), c(1), t(20), t(10), t(50), t(5), CORE, t(10), t(30),
  c(8), t(5), t(20), t(10), c(4), t(100), t(5), t(30), c(2), t(10),
  CARD, t(20), c(6), t(50),
];
/**
 * A slot's weight: its chance in percent (the weights add up to 100), and so its
 * share of the wheel's circle. Tuned by simulation, see RE_NOTES.md.
 */
export function weightOf(s: Segment) {
  if (s.kind === "tickets") return TICKET_WEIGHT[s.value] ?? 1;
  if (s.kind === "coins") return COIN_WEIGHT[s.value] ?? 1;
  return s.kind === "core" ? CORE_WEIGHT : CARD_WEIGHT;
}
const TICKET_WEIGHT: Record<number, number> = { 5: 3.6, 10: 5.3, 20: 6, 30: 5.5, 50: 3.4, 100: 3.9 };
const COIN_WEIGHT: Record<number, number> = { 1: 1.5, 2: 1.2, 4: 1, 6: 0.9, 8: 0.8 };
const CORE_WEIGHT = 8;
const CARD_WEIGHT = 6;
export const WEIGHTS = WHEEL.map(weightOf);
export const UNITS = WEIGHTS.reduce((a, w) => a + w, 0);
/** Where each segment starts and how wide it is, in radians from the wheel's zero mark. */
export const SEG_START: number[] = [];
export const SEG_SIZE: number[] = [];
{
  let at = 0;
  for (const w of WEIGHTS) {
    SEG_START.push(at);
    SEG_SIZE.push((w / UNITS) * Math.PI * 2);
    at += SEG_SIZE[SEG_SIZE.length - 1];
  }
}
/** Wheel speed, radians per second (clockwise on screen). Decoration only. */
export const WHEEL_SPEED = Math.PI * 2 * 0.12;
/** The speed swings ±this share over WOBBLE_PERIOD seconds. */
export const WHEEL_WOBBLE = 0.22;
export const WOBBLE_PERIOD = 7.3;

/** Seconds from pressing SHOOT to the coin landing on the gate (the lead to aim with). */
export const FLIGHT_UP = 0.42;
/** Seconds from the gate down onto the shelf. */
export const FLIGHT_DOWN = 0.4;
/** Seconds between the coins of a coin slot's drop. */
export const COIN_DROP_GAP = 0.06;
/** Holding SHOOT fires this often (seconds). */
export const FIRE_INTERVAL = 0.24;

/** Seconds the light chases round the wheel, slowing, before it stops on the picked slot. */
export const PRIZE_SPIN_TIME = 1.7;
/** Seconds the stopped slot stays lit before the next prize spin starts. */
export const PRIZE_HOLD = 0.45;
/**
 * Prize spins waiting their turn, at most (the lamps under the gate). A coin that
 * drops in the hole while all of them are lit is still swallowed but adds no spin
 * (as with a pachinko stock). With the button held, coins reach the hole about once
 * a second while a spin takes ~2.15 s, so the stock fills and stays full: pacing
 * shots to the lamps pays. Four keeps the wait once the coins run out under ~9 s.
 */
export const PRIZE_QUEUE_MAX = 4;

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
export const MINI_WEIGHTS = [40, 1, 30, 1, 15, 1, 8, 1];
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
/** Side walls run from the back to this depth. The full shelf: nothing falls off the sides, only the front. */
export const SIDE_WALL_D = SHELF_D;
export const COIN_R = 15;
export const CORE_R = 24;
/** A capsule weighs as much as this many coins. */
export const CORE_MASS = 6;
/** A card's footprint (a disc for the physics; drawn as a small tilted card). */
export const CARD_R = 19;
export const CARD_MASS = 2;
/** Capsules already on the shelf when a machine is new. */
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
/** Seconds with nothing moving off the shelf, after the last coin, before the machine idles at zero coins. */
export const SETTLE_TIME = PUSH_PERIOD * 2.2;
/** A new machine's shelf: coin rows, and the share of them that are stacks of 2 or 3. */
export const PREFILL_FILL = 0.92;
export const PREFILL_STACK2 = 0.2;
export const PREFILL_STACK3 = 0.07;
