import { nextRandom } from "@web-games/core/math";
import {
  CARD_COUNT,
  CARD_R,
  CARD_TICKETS,
  CARD_WEIGHTS,
  COIN_DROP_GAP,
  COIN_R,
  CORE_COUNT,
  CORE_R,
  FIRE_INTERVAL,
  FLIGHT_DOWN,
  FLIGHT_UP,
  FRONT_TICKETS,
  GATE_AMP,
  GATE_PERIOD,
  GATE_WOBBLE,
  GATE_WOBBLE_PERIOD,
  HOLE_HALF,
  JAR_W,
  JAR_X,
  LAND_X,
  MAX_BODIES,
  MAX_STACK,
  MINI_PRIZES,
  MINI_WEIGHTS,
  PREFILL_CORES,
  PREFILL_FILL,
  PREFILL_STACK2,
  PREFILL_STACK3,
  PRIZE_HOLD,
  PRIZE_QUEUE_MAX,
  PRIZE_SPIN_TIME,
  type Prize,
  PUSH_MAX,
  PUSH_MIN,
  PUSH_PERIOD,
  RARE_TICKETS,
  SETTLE_TIME,
  SET_TICKETS,
  SHELF_D,
  SHELF_W,
  SPIN_TIME,
  SUPER_PRIZES,
  SUPER_WEIGHTS,
  type Segment,
  WEIGHTS,
  WHEEL,
  WHEEL_SPEED,
  WHEEL_WOBBLE,
  WOBBLE_PERIOD,
  isRare,
} from "./config";
import { type Body, stepShelf } from "./physics";

// The rules of the machine: spend a coin, it lands on the swinging gate under the
// wheel's hub; in the hole it starts a prize spin (a weighted pick of a wheel slot:
// tickets, a rain of coins, an energy capsule or a cat card), off the hole (or
// off its lid, shut while the prize stock is full) it bounces down onto the
// shelf. Anything dropped lands on the shelf, and the shelf pushes things off.
// Coins pushed off the front come back with a ticket, except in the middle,
// where the robot jar keeps them (the machine's drain). A card pushed off the
// front joins the card inventory (a count per cat, duplicates stack) and pays
// nothing until the player exchanges it for tickets (exchangeCard,
// exchangeSet). Pure and seeded:
// the random state is a number in the state, so a session replays exactly and the
// whole state (the card inventory included) can be saved as JSON (see save.ts).
//
// Six cores earn a Super spin (1.4.0): it waits in `superPending` and the
// shell plays it on a full-screen wheel, the machine frozen behind it. spinSuper
// picks and pays it the moment the player spins, so a reload mid-wheel neither
// loses nor doubles it.
//
// The machine never ends. Out of coins it settles and idles (`idle`); coins
// granted later (grantCoins: allowance, coupons) wake it up where it stood.
// Tickets are counted twice: `lifetimeTickets` (everything this machine ever
// paid, the leaderboard number) and `unpaid` (earned but not yet handed to the
// shell, which drains it with drainTickets into the wallet or the trial counter).

const TAU = Math.PI * 2;
/** Seconds a landed spin result stays on the reels before the next one starts. */
export const SPIN_HOLD = 0.9;

export interface Flight {
  id: number;
  /** Seconds into the current phase; negative = still waiting its turn (a coin rain). */
  t: number;
  /** "up": the chute to the gate. "down": from the gate onto the shelf. */
  phase: "up" | "down";
  /** Where on the shelf it lands (world x). */
  x: number;
  /** Where on the gate it lands (or bounced from), px from the gate's centre: always LAND_X for a shot. */
  aim: number;
  /** What lands: a coin, a capsule (`core` = its colour) or a card (`card` = its index). */
  kind: "coin" | "core" | "card";
  core: number;
  card: number;
}

export type SpinKind = "mini" | "super";

/** A Mini spin on the reels (Super spins never run there since 1.4.0: see spinSuper). */
export interface Spin {
  kind: SpinKind;
  /** Index into MINI_PRIZES. */
  idx: number;
  t: number;
  paid: boolean;
}

/** A prize spin on the wheel: the light chases round and stops on slot `seg`. */
export interface PrizeSpin {
  seg: number;
  t: number;
  paid: boolean;
}

export interface State {
  seed: number;
  t: number;
  nextId: number;
  coins: number;
  /** Every ticket this machine has paid out, ever. Never goes down. */
  lifetimeTickets: number;
  /** Tickets earned and not yet drained by the shell (drainTickets). */
  unpaid: number;
  supers: number;
  /** Full sets exchanged on this machine. */
  sets: number;
  /** Cards pushed off the front on this machine. */
  cardsWon: number;
  shots: number;
  /** Coins pushed off the front (and given back). */
  returned: number;
  /** Coins pushed off the front into the robot jar (kept by the machine). */
  eaten: number;
  /** Cards that came from the Prize Counter (grantCard), not off the shelf. */
  packCards: number;
  wheel: number;
  /** The gate's swing phase (radians); the hole is at GATE_AMP·sin(gate). */
  gate: number;
  /** Coins that reached the gate, and how many of them dropped in the hole. */
  gateShots: number;
  gateHits: number;
  /** Prize spins waiting their turn (0..PRIZE_QUEUE_MAX), and the one running. */
  stock: number;
  prize: PrizeSpin | null;
  pusherT: number;
  bodies: Body[];
  flights: Flight[];
  /** Capsules pushed off the front toward the next Super spin (can pass 6 while one waits). */
  cores: number;
  /**
   * Super spins earned and not spun yet: one for every CORE_COUNT cores. The
   * shell shows the full-screen Super wheel while it is above 0 and calls
   * spinSuper; the machine itself runs on as usual.
   */
  superPending: number;
  /** Cards in the inventory, per cat (CARD_IDS order): duplicates stack. */
  cards: number[];
  /** Which cats were ever collected (a cat exchanged down to 0 stays seen). */
  seen: boolean[];
  /** Mini spins waiting their turn on the reels. */
  queue: SpinKind[];
  spin: Spin | null;
  /** Capsules dropped so far, to colour the next one. */
  capsules: number;
  cooldown: number;
  /** Seconds since anything landed, fell or was shot. */
  quiet: number;
  /** Out of coins and settled: nothing moves until coins are granted. */
  idle: boolean;
}

export interface Input {
  shoot: boolean;
}

export type GameEvent =
  | { type: "shoot" }
  | { type: "dry" }
  /**
   * A coin reached the gate at `x` (px from its centre) with the hole at `hole`.
   * `lid`: it was over the hole, but the stock was full and the lid shut, so it
   * bounced off onto the shelf like a miss (`hit` false).
   */
  | { type: "gate"; hit: boolean; lid: boolean; x: number; hole: number }
  | { type: "prizeStart"; seg: number }
  | { type: "prizeWin"; seg: number; segment: Segment }
  | { type: "tickets"; amount: number; source: "wheel" | "front" | "mini" | "super" }
  | { type: "coinsWon"; amount: number }
  | { type: "land"; id: number; x: number; y: number; kind: Body["kind"]; stacked: boolean }
  /** Something left the shelf. `jar`: coins over the front into the robot jar (kept, nothing paid). */
  | { type: "fall"; x: number; y: number; edge: "front" | "side"; stack: number; kind: Body["kind"]; core: number; card: number; jar: boolean }
  /**
   * The robot jar kept `coins` coins (a pile counts each of its coins). Coins
   * only: a capsule or a card in the jar's section is never eaten. The shell
   * feeds the shared Lucky Jar with these (jackpot.ts, docs/standards/jackpot.md).
   */
  | { type: "eaten"; coins: number }
  | { type: "coreIn"; count: number }
  | { type: "spinStart"; kind: SpinKind; idx: number }
  | { type: "spinWin"; kind: SpinKind; idx: number; prize: Prize }
  | { type: "superReset" }
  /** A card pushed off the front joined the inventory: `fresh` the first ever of its cat, `count` how many now. */
  | { type: "card"; card: number; fresh: boolean; count: number }
  /** The machine ran out of coins and settled (once per time it happens). */
  | { type: "idle" };

const rand = (s: State) => nextRandom(s);

/** Tickets paid out: on the machine's lifetime count, and waiting for the shell. */
function earn(s: State, n: number) {
  s.lifetimeTickets += n;
  s.unpaid += n;
}

/** Hand the tickets earned since the last call to the shell (and forget them here). */
export function drainTickets(s: State): number {
  const n = s.unpaid;
  s.unpaid = 0;
  return n;
}

/** The pusher's front face, and its speed toward the front. */
export function pusherAt(t: number) {
  const k = (TAU * t) / PUSH_PERIOD;
  return {
    y: PUSH_MIN + ((PUSH_MAX - PUSH_MIN) * (1 - Math.cos(k))) / 2,
    v: ((PUSH_MAX - PUSH_MIN) * Math.PI * Math.sin(k)) / PUSH_PERIOD,
  };
}

/** The wheel's motor surges and eases a little (decoration only). */
export const wheelSpeed = (t: number) => WHEEL_SPEED * (1 + WHEEL_WOBBLE * Math.sin((TAU * t) / WOBBLE_PERIOD));

/** The gate's swing speed (radians of phase per second), drifting a little so a held button can't lock onto it. */
export const gateSpeed = (t: number) => (TAU / GATE_PERIOD) * (1 + GATE_WOBBLE * Math.sin((TAU * t) / GATE_WOBBLE_PERIOD));

/** The hole's centre, px from the gate's centre, at this swing phase. */
export const holeAt = (gate: number) => GATE_AMP * Math.sin(gate);

/** Whether a coin landing at `x` on the gate drops into a hole centred at `hole`. */
export const inHole = (x: number, hole: number) => Math.abs(x - hole) <= HOLE_HALF;

/** Whether the hole's lid is shut: every stock lamp lit, so a coin over the hole bounces off it. */
export const lidShut = (s: State) => s.stock >= PRIZE_QUEUE_MAX;

/** Whether a coin pushed off the front at world x drops into the robot jar. */
export const inJar = (x: number) => Math.abs(x - JAR_X) <= JAR_W / 2;

const PRIZE_TOTAL = PRIZE_SPIN_TIME + PRIZE_HOLD;

/**
 * A coin shot on the next step, as it reaches the gate (FLIGHT_UP later): where
 * the hole will be, and whether the lid will be shut then. Steps the swing, the
 * coins already in the air and the prize spins forward exactly as update() will
 * at steps of `dt` (the same order: the gate, then flights oldest first, then the
 * wheel), without touching `s`. A shot fired on step n reaches the gate on the
 * step its flight time first passes FLIGHT_UP, ceil(FLIGHT_UP / dt) steps on.
 */
export function onArrival(s: State, dt = 1 / 60) {
  const n = Math.ceil(FLIGHT_UP / dt - 1e-9);
  let g = s.gate;
  let t = s.t;
  let stock = s.stock;
  let prize = s.prize ? s.prize.t : -1;
  const ups: number[] = [];
  const aims: number[] = [];
  for (const f of s.flights)
    if (f.phase === "up") {
      ups.push(f.t);
      aims.push(f.aim);
    }
  for (let i = 0; i < n; i++) {
    t += dt;
    g += gateSpeed(t) * dt;
    if (i === n - 1) {
      // Older coins reach the gate first, in this same step
      for (let j = 0; j < ups.length; j++) if (ups[j] >= 0 && ups[j] + dt >= FLIGHT_UP && inHole(aims[j], holeAt(g)) && stock < PRIZE_QUEUE_MAX) stock++;
      return { hole: holeAt(g), lid: stock >= PRIZE_QUEUE_MAX };
    }
    for (let j = 0; j < ups.length; j++) {
      if (ups[j] < 0) continue;
      ups[j] += dt;
      if (ups[j] >= FLIGHT_UP) {
        if (inHole(aims[j], holeAt(g)) && stock < PRIZE_QUEUE_MAX) stock++;
        ups[j] = -1;
      }
    }
    if (prize < 0 && stock > 0) {
      stock--;
      prize = 0;
    }
    if (prize >= 0) {
      prize += dt;
      if (prize >= PRIZE_TOTAL) prize = -1;
    }
  }
  return { hole: holeAt(g), lid: stock >= PRIZE_QUEUE_MAX };
}

/** Where the hole will be when a coin shot on the next step lands (see onArrival). */
export const holeOnArrival = (s: State, dt = 1 / 60) => onArrival(s, dt).hole;

/** Px of slack the ready cue keeps inside the hole's edge, for frames that run a little long or short. */
export const READY_MARGIN = 2;

/**
 * Whether a shot fired now would drop into the hole (the gate's green ready
 * cue): over the hole on arrival, with the lid open then.
 */
export function readyToShoot(s: State, dt = 1 / 60) {
  const a = onArrival(s, dt);
  return !a.lid && Math.abs(a.hole - LAND_X) <= HOLE_HALF - READY_MARGIN;
}

/** The prize a spin of this kind pays at reel index `idx`. */
export function prizeOf(kind: SpinKind, idx: number): Prize {
  return kind === "mini" ? MINI_PRIZES[idx] : { kind: "tickets", value: SUPER_PRIZES[idx] };
}

/** Cats with at least one card in the inventory (a full set needs all ten). */
export const ownedCount = (cards: number[]) => cards.reduce((n, c) => n + (c > 0 ? 1 : 0), 0);

/** A clean album, or a copy of a saved one if it has the right shape. */
export function normalizeAlbum(album: unknown): boolean[] {
  const out = Array.from({ length: CARD_COUNT }, () => false);
  if (Array.isArray(album)) for (let i = 0; i < CARD_COUNT; i++) out[i] = album[i] === true;
  return out;
}

const body = (s: State, kind: Body["kind"], x: number, y: number, extra: Partial<Body> = {}): Body => ({
  id: s.nextId++,
  kind,
  core: -1,
  card: -1,
  stack: 1,
  x,
  y,
  vx: 0,
  vy: 0,
  r: kind === "coin" ? COIN_R : kind === "core" ? CORE_R : CARD_R,
  ...extra,
});

/**
 * A new machine: the shelf pre-filled with coins and a couple of capsules, then
 * left to settle. `coins` is the player's starting balance (0 for an account
 * machine, whose coins come from the allowance; TRIAL_COINS for a guest).
 */
export function createMachine(seed: number, coins = 0, album: unknown = null): State {
  // A beta album (owned flags) carries over as one card of each owned cat
  const owned = normalizeAlbum(album);
  const s: State = {
    seed: seed | 0,
    t: 0,
    nextId: 1,
    coins: Math.max(0, Math.floor(coins)),
    lifetimeTickets: 0,
    unpaid: 0,
    supers: 0,
    sets: 0,
    cardsWon: 0,
    shots: 0,
    returned: 0,
    eaten: 0,
    packCards: 0,
    wheel: 0,
    gate: 0,
    gateShots: 0,
    gateHits: 0,
    stock: 0,
    prize: null,
    pusherT: 0,
    bodies: [],
    flights: [],
    cores: 0,
    superPending: 0,
    cards: owned.map((o) => (o ? 1 : 0)),
    seen: [...owned],
    queue: [],
    spin: null,
    capsules: 0,
    cooldown: 0,
    quiet: 0,
    idle: false,
  };
  s.wheel = rand(s) * TAU;
  s.gate = rand(s) * TAU;
  // A couple of capsules in the middle of the shelf
  const cores: Body[] = [];
  for (let i = 0; i < PREFILL_CORES; i++) {
    const x = SHELF_W * ((i + 1) / (PREFILL_CORES + 1)) + (rand(s) - 0.5) * 40;
    const y = 200 + (rand(s) - 0.5) * 40;
    cores.push(body(s, "core", x, y, { core: s.capsules++ % CORE_COUNT }));
  }
  // A hex layer of coins from the pusher to the front edge, some of them piles
  const gap = COIN_R * 2 + 2;
  const row = gap * 0.88;
  let ri = 0;
  for (let y = PUSH_MAX + COIN_R + 3; y <= SHELF_D - 8; y += row, ri++) {
    for (let x = COIN_R + 3 + (ri % 2) * (gap / 2); x <= SHELF_W - COIN_R - 3; x += gap) {
      if (rand(s) > PREFILL_FILL) continue;
      const jx = x + (rand(s) - 0.5) * 4;
      const jy = y + (rand(s) - 0.5) * 4;
      if (cores.some((c) => Math.hypot(c.x - jx, c.y - jy) < c.r + COIN_R - 2)) continue;
      const roll = rand(s);
      const stack = roll < PREFILL_STACK3 ? 3 : roll < PREFILL_STACK3 + PREFILL_STACK2 ? 2 : 1;
      s.bodies.push(body(s, "coin", jx, jy, { stack }));
    }
  }
  s.bodies.push(...cores);
  // Settle: a few pusher strokes with nothing counted
  for (let i = 0; i < 300; i++) {
    const p = pusherAt(s.pusherT);
    stepShelf(s.bodies, p.y, p.v, 1 / 60);
    s.pusherT += 1 / 60;
  }
  return s;
}

const dropX = (s: State, r: number) => r + 6 + rand(s) * (SHELF_W - 2 * r - 12);

/** Something falling from the gate onto the shelf at world x (a coin, a capsule or a card). */
function drop(s: State, kind: Flight["kind"], x: number, t = 0, extra: Partial<Flight> = {}) {
  s.flights.push({ id: s.nextId++, t, phase: "down", x, aim: 0, kind, core: -1, card: -1, ...extra });
}

/**
 * The shot coin lands on the gate. In the hole: swallowed, and one more prize
 * spin in the stock. Off the hole, or on the lid (shut while the stock is full):
 * it bounces and falls onto the shelf as one coin at a seeded spot. Nothing is
 * ever swallowed for nothing.
 */
function hitGate(s: State, f: Flight, ev: GameEvent[]) {
  const hole = holeAt(s.gate);
  const over = inHole(f.aim, hole);
  const lid = over && lidShut(s);
  const hit = over && !lid;
  s.gateShots++;
  if (hit) {
    s.gateHits++;
    s.stock++;
  } else drop(s, "coin", dropX(s, COIN_R), 0, { aim: f.aim });
  ev.push({ type: "gate", hit, lid, x: f.aim, hole });
}

/** A prize spin stopped on slot `seg`: pay it by the slot's rules. */
function payPrize(s: State, seg: number, ev: GameEvent[]) {
  const segment = WHEEL[seg];
  ev.push({ type: "prizeWin", seg, segment });
  if (segment.kind === "tickets") {
    earn(s, segment.value);
    ev.push({ type: "tickets", amount: segment.value, source: "wheel" });
  } else if (segment.kind === "coins") {
    // Spread across the shelf: one coin per equal band, at a random spot in it
    const n = segment.value;
    const lo = COIN_R + 6;
    const band = (SHELF_W - 2 * lo) / n;
    for (let i = 0; i < n; i++) drop(s, "coin", lo + (i + rand(s)) * band, -i * COIN_DROP_GAP);
  } else if (segment.kind === "core") {
    drop(s, "core", dropX(s, CORE_R), 0, { core: s.capsules++ % CORE_COUNT });
    s.queue.push("mini");
  } else {
    // Weighted: the rare Ragdoll a quarter as likely as each other cat (CARD_WEIGHTS)
    const card = pick(s, CARD_WEIGHTS);
    drop(s, "card", dropX(s, CARD_R), 0, { card });
  }
}

function land(s: State, f: Flight, ev: GameEvent[]) {
  const p = pusherAt(s.pusherT);
  s.quiet = 0;
  if (f.kind !== "coin") {
    const r = f.kind === "core" ? CORE_R : CARD_R;
    const b = body(s, f.kind, f.x, p.y + r + 2, { core: f.core, card: f.card, vy: 40 });
    s.bodies.push(b);
    ev.push({ type: "land", id: b.id, x: b.x, y: b.y, kind: b.kind, stacked: false });
    return;
  }
  const y = p.y + COIN_R + rand(s) * 26;
  // Landing on a coin stacks onto it
  let onto: Body | null = null;
  let best = COIN_R * 0.85;
  for (const b of s.bodies) {
    if (b.kind !== "coin" || b.stack >= MAX_STACK) continue;
    const d = Math.hypot(b.x - f.x, b.y - y);
    if (d < best) {
      best = d;
      onto = b;
    }
  }
  if (onto) {
    onto.stack++;
    ev.push({ type: "land", id: onto.id, x: onto.x, y: onto.y, kind: "coin", stacked: true });
    return;
  }
  const b = body(s, "coin", f.x, y, { vy: 60 });
  s.bodies.push(b);
  ev.push({ type: "land", id: b.id, x: b.x, y: b.y, kind: "coin", stacked: false });
}

/** Over the body cap: fold the oldest single coins into their nearest neighbour's pile. */
function capBodies(s: State) {
  while (s.bodies.length > MAX_BODIES) {
    let oldest = -1;
    for (let i = 0; i < s.bodies.length; i++) {
      const b = s.bodies[i];
      if (b.kind === "coin" && (oldest < 0 || b.id < s.bodies[oldest].id)) oldest = i;
    }
    if (oldest < 0) return;
    const o = s.bodies[oldest];
    let into: Body | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const b of s.bodies) {
      if (b === o || b.kind !== "coin" || b.stack + o.stack > MAX_STACK) continue;
      const d = Math.hypot(b.x - o.x, b.y - o.y);
      if (d < best) {
        best = d;
        into = b;
      }
    }
    if (!into) return;
    into.stack += o.stack;
    s.bodies.splice(oldest, 1);
  }
}

function pick(s: State, weights: readonly number[]) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand(s) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return 0;
}

/** One more Super spin waiting if the cores cover it: every CORE_COUNT cores earn one. */
function earnSupers(s: State) {
  while (s.cores >= CORE_COUNT * (s.superPending + 1)) s.superPending++;
}

/** A capsule over the front edge: one more core toward the Super spin. */
function collectCore(s: State, ev: GameEvent[]) {
  s.cores++;
  ev.push({ type: "coreIn", count: s.cores });
  // The sixth (and the twelfth...) earns a Super spin: the shell spins it full screen (spinSuper)
  earnSupers(s);
}

/**
 * Spin one waiting Super spin: pick its prize (SUPER_WEIGHTS, seeded) and pay
 * it at once, use up CORE_COUNT cores, and count it. Returns its events in the
 * order the reels used to send them (spinStart, spinWin, tickets, superReset),
 * so jackpot.ts and the stats read them as before; the shell holds them back
 * until its wheel stops on the prize (spinStart's `idx`). Paid here, at the
 * pick, so a reload before the wheel stops neither loses nor repeats it. Does
 * nothing (no events) when no Super spin is waiting.
 */
export function spinSuper(s: State): GameEvent[] {
  if (s.superPending <= 0) return [];
  const ev: GameEvent[] = [];
  const idx = pick(s, SUPER_WEIGHTS);
  const prize = prizeOf("super", idx);
  ev.push({ type: "spinStart", kind: "super", idx });
  ev.push({ type: "spinWin", kind: "super", idx, prize });
  if (prize.kind === "tickets") {
    earn(s, prize.value);
    ev.push({ type: "tickets", amount: prize.value, source: "super" });
  } else {
    s.coins += prize.value;
    s.idle = false;
    ev.push({ type: "coinsWon", amount: prize.value });
  }
  s.supers++;
  s.cores = Math.max(0, s.cores - CORE_COUNT);
  s.superPending--;
  // Cores past the meter carry over, and may already cover the next one
  earnSupers(s);
  ev.push({ type: "superReset" });
  return ev;
}

/** A card over the front edge: into the inventory, nothing paid until it is exchanged. */
function collectCard(s: State, card: number, ev: GameEvent[]) {
  const fresh = !s.seen[card];
  s.seen[card] = true;
  s.cards[card]++;
  s.cardsWon++;
  ev.push({ type: "card", card, fresh, count: s.cards[card] });
}

/** What exchanging one card of this cat pays, in tickets. */
export const cardRate = (card: number) => (isRare(card) ? RARE_TICKETS : CARD_TICKETS);
/** What exchanging a full set (one of each cat) pays, in tickets. */
export const setRate = () => SET_TICKETS;

/** Whether the inventory holds a full set: at least one card of every cat. */
export const hasSet = (s: State) => s.cards.length === CARD_COUNT && s.cards.every((c) => c > 0);

/**
 * Exchange one card of cat `card` for tickets (cardRate): they join the lifetime
 * count and wait for the shell (drainTickets). Returns what it paid, or 0 (and
 * changes nothing) when there is no such card.
 */
export function exchangeCard(s: State, card: number): number {
  if (!Number.isInteger(card) || card < 0 || card >= CARD_COUNT || !(s.cards[card] > 0)) return 0;
  const n = cardRate(card);
  s.cards[card]--;
  earn(s, n);
  return n;
}

/**
 * Exchange a full set, one card of each of the ten cats, for the set bonus in
 * tickets (setRate). Returns what it paid, or 0 without a full set.
 */
export function exchangeSet(s: State): number {
  if (!hasSet(s)) return 0;
  for (let i = 0; i < CARD_COUNT; i++) s.cards[i]--;
  s.sets++;
  const n = setRate();
  earn(s, n);
  return n;
}

/**
 * A card from the Prize Counter (a `card-pack` grant): a cat rolled by
 * CARD_WEIGHTS on the machine's own seeded random, straight into the inventory
 * (it never touches the shelf). Returns the cat's index.
 */
export function grantCard(s: State): number {
  const card = pick(s, CARD_WEIGHTS);
  s.seen[card] = true;
  s.cards[card]++;
  s.packCards++;
  return card;
}

/** Whether the machine can still change: something in the air, on the wheel or the reels, or coins left. */
export const busy = (s: State) =>
  s.coins > 0 || s.flights.length > 0 || s.spin !== null || s.queue.length > 0 || s.prize !== null || s.stock > 0;

/**
 * Add granted coins (allowance, coupons) to the machine, waking it if it idled
 * at zero. Returns the coins added (0 when the amount is not a positive whole
 * number). Tickets, the leaderboard number, are never touched.
 */
export function grantCoins(s: State, n: number): number {
  if (!Number.isFinite(n)) return 0;
  const add = Math.floor(n);
  if (add <= 0) return 0;
  s.coins += add;
  s.idle = false;
  return add;
}

export function update(s: State, input: Input, dt: number): GameEvent[] {
  const ev: GameEvent[] = [];
  s.t += dt;
  s.wheel = (s.wheel + wheelSpeed(s.t) * dt) % TAU;
  s.gate = (s.gate + gateSpeed(s.t) * dt) % TAU;
  s.pusherT = (s.pusherT + dt) % PUSH_PERIOD;
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.quiet += dt;

  // SHOOT
  if (input.shoot && s.cooldown <= 0) {
    s.cooldown = FIRE_INTERVAL;
    if (s.coins > 0) {
      s.coins--;
      s.shots++;
      s.quiet = 0;
      // Every shot lands on the same spot: only the timing decides
      s.flights.push({ id: s.nextId++, t: 0, phase: "up", x: SHELF_W / 2, aim: LAND_X, kind: "coin", core: -1, card: -1 });
      ev.push({ type: "shoot" });
    } else ev.push({ type: "dry" });
  }

  // Coins, capsules and cards in the air
  for (let i = 0; i < s.flights.length; i++) {
    const f = s.flights[i];
    f.t += dt;
    if (f.phase === "up" && f.t >= FLIGHT_UP) {
      s.quiet = 0;
      hitGate(s, f, ev);
      s.flights.splice(i--, 1);
      continue;
    }
    if (f.phase === "down" && f.t >= FLIGHT_DOWN) {
      land(s, f, ev);
      s.flights.splice(i--, 1);
    }
  }

  // The shelf
  const p = pusherAt(s.pusherT);
  for (const x of stepShelf(s.bodies, p.y, p.v, dt)) {
    const b = x.body;
    s.quiet = 0;
    // Only coins go in the jar: a capsule or a card in its section counts as usual
    const jar = x.edge === "front" && b.kind === "coin" && inJar(b.x);
    ev.push({ type: "fall", x: b.x, y: b.y, edge: x.edge, stack: b.stack, kind: b.kind, core: b.core, card: b.card, jar });
    if (x.edge !== "front") continue;
    if (jar) {
      s.eaten += b.stack;
      ev.push({ type: "eaten", coins: b.stack });
    } else if (b.kind === "coin") {
      s.coins += b.stack;
      s.returned += b.stack;
      earn(s, b.stack * FRONT_TICKETS);
      ev.push({ type: "tickets", amount: b.stack * FRONT_TICKETS, source: "front" });
    } else if (b.kind === "core") collectCore(s, ev);
    else collectCard(s, b.card, ev);
  }
  capBodies(s);

  // The wheel: prize spins, one at a time from the stock
  if (!s.prize && s.stock > 0) {
    s.stock--;
    s.prize = { seg: pick(s, WEIGHTS), t: 0, paid: false };
    ev.push({ type: "prizeStart", seg: s.prize.seg });
  }
  if (s.prize) {
    const pz = s.prize;
    pz.t += dt;
    if (!pz.paid && pz.t >= PRIZE_SPIN_TIME) {
      pz.paid = true;
      payPrize(s, pz.seg, ev);
    }
    if (pz.t >= PRIZE_SPIN_TIME + PRIZE_HOLD) s.prize = null;
  }

  // The reels: Mini spins, one at a time (Super spins are the shell's full-screen wheel: spinSuper)
  if (!s.spin && s.queue.length > 0) {
    s.queue.shift();
    s.spin = { kind: "mini", idx: pick(s, MINI_WEIGHTS), t: 0, paid: false };
    ev.push({ type: "spinStart", kind: "mini", idx: s.spin.idx });
  }
  if (s.spin) {
    const sp = s.spin;
    sp.t += dt;
    if (!sp.paid && sp.t >= SPIN_TIME) {
      sp.paid = true;
      const prize = prizeOf("mini", sp.idx);
      ev.push({ type: "spinWin", kind: "mini", idx: sp.idx, prize });
      if (prize.kind === "tickets") {
        earn(s, prize.value);
        ev.push({ type: "tickets", amount: prize.value, source: "mini" });
      } else {
        s.coins += prize.value;
        ev.push({ type: "coinsWon", amount: prize.value });
      }
    }
    if (sp.t >= SPIN_TIME + SPIN_HOLD) s.spin = null;
  }

  // Out of coins and settled: idle (once), until coins come back from anywhere
  if (s.idle && s.coins > 0) s.idle = false;
  else if (!s.idle && !busy(s) && s.quiet >= SETTLE_TIME) {
    s.idle = true;
    ev.push({ type: "idle" });
  }
  return ev;
}
