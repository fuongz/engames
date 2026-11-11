// Tuning for Xu Vũ Trụ. Numbers and tables only; the rules are in logic.ts and
// the shelf physics in physics.ts.

export const W = 540;
export const H = 960;

// ---------------------------------------------------------------- economy

/** The game's version (manifest.version, the save envelope's `v`). */
export const VERSION = "1.2.0";
/** Coins a guest's local trial machine starts with (no daily coins, no deposits). */
export const TRIAL_COINS = 100;
/** The signed-in allowance (manifest.allowance): a welcome once, then a daily. */
export const WELCOME_COINS = 100;
export const DAILY_COINS = 50;
/**
 * The login streak (manifest.allowance.streak): day n of an unbroken run of
 * dailies pays STREAK[(n - 1) % 7]. The server picks the amount; this is what
 * the manifest declares and the strip shows.
 */
export const STREAK = [50, 60, 70, 80, 90, 100, 150];
/** Prize Counter items (manifest.shop): `coins` go on the balance, a `card-pack` rolls cards by CARD_WEIGHTS (kinds are lowercase-kebab: conventions.test.ts). */
export const SHOP = {
  coins10: { kind: "coins", amount: 10, price: 300, dailyLimit: 3 },
  card1: { kind: "card-pack", amount: 1, price: 400, dailyLimit: 2 },
} as const;
/** Each coin (or each coin in a stack) pushed over the front edge comes back, plus this many tickets. */
export const FRONT_TICKETS = 1;
/**
 * The robot jar on the middle of the front lip: a coin pushed off the front
 * with its centre within JAR_W / 2 of JAR_X (world units across the shelf) drops
 * into the jar and is kept by the machine: no coin back, no ticket. It is the
 * machine's drain: every shot ends up as about one coin on the shelf (a miss, a
 * bounce off the lid, or a prize spin's coins), so about JAR_W / SHELF_W of
 * every shot is kept whatever the aim. Capsules and cards are never eaten: in
 * the jar's section they count like anywhere else on the front. Tuned by
 * simulation, see RE_NOTES.md "Economy".
 */
export const JAR_W = 44;
export const JAR_X = 220;

// ---------------------------------------------------------------- the gate

/**
 * Under the wheel's hub a gate swings left and right with a hole (a cup) in it.
 * A shot coin always lands on the same spot, the gate's centre (LAND_X, drawn
 * as a target ring at the end of a dotted guide), FLIGHT_UP seconds after the
 * press. If the hole's centre is within ±HOLE_HALF of it then, the coin drops in
 * and starts a prize spin; otherwise it bounces off and falls onto the shelf.
 *
 * All are screen px across the gate (drawn 1:1). The hole is over the landing
 * spot for asin(HOLE_HALF / GATE_AMP) / (π/2) of the time, so random fire times
 * hit ≈ 30%; a shot fired while the ready cue shows always lands in it. Measured
 * in logic.test.ts "gate difficulty".
 */
export const GATE_AMP = 40;
export const HOLE_HALF = 18;
/** Where every shot coin lands, px from the gate's centre. */
export const LAND_X = 0;
/** One full left-right-left swing, seconds. */
export const GATE_PERIOD = 1.7;
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
 * The prize wheel, clockwise from angle 0, and each slot's weight: its chance in
 * percent (the weights add up to 100). It turns as decoration; what it pays is a
 * weighted pick, and every slot is drawn exactly as wide as its weight, so the
 * wheel reads honestly: a slot's share of the circle is its chance. Eleven
 * slots, none under MIN_SLOT_WEIGHT, so every tile fits its wedge whole. Tuned
 * by simulation, see RE_NOTES.md.
 */
export const SLOTS: { segment: Segment; weight: number }[] = [
  { segment: t(10), weight: 10 },
  { segment: c(2), weight: 10 },
  { segment: t(5), weight: 9.5 },
  { segment: c(4), weight: 10 },
  { segment: CORE, weight: 8 },
  { segment: t(20), weight: 10 },
  { segment: c(2), weight: 10 },
  { segment: t(100), weight: 7.5 },
  { segment: c(2), weight: 8.5 },
  { segment: CARD, weight: 7.5 },
  { segment: t(50), weight: 9 },
];
/**
 * The narrowest a slot may be, in percent of the circle. At 7.5% (27°) a tile
 * still fits its wedge whole at about 80% of the ring's depth (art.ts tileFit).
 */
export const MIN_SLOT_WEIGHT = 7.5;
export const WHEEL: Segment[] = SLOTS.map((s) => s.segment);
export const WEIGHTS = SLOTS.map((s) => s.weight);
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
 * Prize spins waiting their turn, at most (the lamps under the gate). While all
 * of them are lit the hole's lid is shut: a coin that reaches it bounces off onto
 * the shelf like a miss, so a full stock never wastes a coin. Four keeps the wait
 * once the coins run out under ~9 s.
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
/** Coins 2% of the time (0.5 each): the wheel's coin slots now carry the coin prizes. */
export const MINI_WEIGHTS = [40, 0.5, 30, 0.5, 15, 0.5, 8, 0.5];
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

/** The album: ten cat cards (art in img/cards-v3/<id>.webp, names in strings.ts), in CARD_WEIGHTS order. */
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
/** The rare card: a quarter as likely as each other cat, with a Rare badge wherever it shows. */
export const RARE_CARD: CardId = "ragdoll";
/**
 * When a card slot pays, the cat is picked by these weights (CARD_IDS order):
 * 4 for each common cat, 1 for the Ragdoll. Out of 37: each common cat 4/37 ≈
 * 10.81%, the Ragdoll 1/37 ≈ 2.70%. The set bonus still needs all ten.
 */
export const CARD_WEIGHTS: readonly number[] = CARD_IDS.map((id) => (id === RARE_CARD ? 1 : 4));
export const isRare = (card: number) => CARD_IDS[card] === RARE_CARD;
/**
 * Cards pushed off the front stack up in the inventory (a count per cat) and pay
 * nothing by themselves: the player exchanges them for tickets when they choose.
 * One card of a common cat, one Ragdoll, or a full set (one of each of the ten,
 * consuming one of each). Tickets only: cards never turn back into coins, so
 * they can never feed the coin balance (RE_NOTES.md "Card exchange").
 */
export const CARD_TICKETS = 60;
export const RARE_TICKETS = 300;
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
