import { nextRandom } from "@web-games/core/math";
import {
  AIM_SPREAD,
  CARD_COUNT,
  CARD_R,
  CARD_TICKETS,
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
  SETTLE_TIME,
  SET_TICKETS,
  SHELF_D,
  SHELF_W,
  SPIN_TIME,
  SUPER_PRIZES,
  SUPER_SPIN_TIME,
  SUPER_WEIGHTS,
  type Segment,
  WEIGHTS,
  WHEEL,
  WHEEL_SPEED,
  WHEEL_WOBBLE,
  WOBBLE_PERIOD,
} from "./config";
import { type Body, stepShelf } from "./physics";

// The rules of the machine: spend a coin, it lands on the swinging gate under the
// wheel's hub; in the hole it starts a prize spin (a weighted pick of a wheel slot:
// tickets, a rain of coins, an energy capsule or a cat card), off the hole it
// bounces down onto the shelf. Anything dropped lands on the shelf, and the shelf
// pushes things off. Pure and seeded:
// the random state is a number in the state, so a session replays exactly and the
// whole state (the card album included) can be saved as JSON (see save.ts).
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
  /** Where on the gate it lands (or bounced from), px from the gate's centre; seeded when shot. */
  aim: number;
  /** What lands: a coin, a capsule (`core` = its colour) or a card (`card` = its index). */
  kind: "coin" | "core" | "card";
  core: number;
  card: number;
}

export type SpinKind = "mini" | "super";

export interface Spin {
  kind: SpinKind;
  /** Index into MINI_PRIZES or SUPER_PRIZES. */
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
  /** Albums completed on this machine. */
  sets: number;
  /** Cards pushed off the front on this machine. */
  cardsWon: number;
  shots: number;
  /** Coins pushed off the front (and given back). */
  returned: number;
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
  /** Which of the ten cards the player owns. */
  album: boolean[];
  /** Spins waiting their turn on the reels. */
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
  /** A coin reached the gate at `x` (px from its centre) with the hole at `hole`. `full`: in the hole, but the stock was full. */
  | { type: "gate"; hit: boolean; full: boolean; x: number; hole: number }
  | { type: "prizeStart"; seg: number }
  | { type: "prizeWin"; seg: number; segment: Segment }
  | { type: "tickets"; amount: number; source: "wheel" | "front" | "mini" | "super" | "card" | "set" }
  | { type: "coinsWon"; amount: number }
  | { type: "land"; id: number; x: number; y: number; kind: Body["kind"]; stacked: boolean }
  | { type: "fall"; x: number; y: number; edge: "front" | "side"; stack: number; kind: Body["kind"]; core: number; card: number }
  | { type: "coreIn"; count: number }
  | { type: "spinStart"; kind: SpinKind; idx: number }
  | { type: "spinWin"; kind: SpinKind; idx: number; prize: Prize }
  | { type: "superReset" }
  | { type: "card"; card: number; fresh: boolean; owned: number }
  | { type: "setComplete" }
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

/** The prize a spin of this kind pays at reel index `idx`. */
export function prizeOf(kind: SpinKind, idx: number): Prize {
  return kind === "mini" ? MINI_PRIZES[idx] : { kind: "tickets", value: SUPER_PRIZES[idx] };
}

export const ownedCount = (album: boolean[]) => album.reduce((n, o) => n + (o ? 1 : 0), 0);

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
    album: normalizeAlbum(album),
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
 * spin in the stock (none if the stock is full). Off the hole: it bounces and
 * falls onto the shelf as one coin at a seeded spot.
 */
function hitGate(s: State, f: Flight, ev: GameEvent[]) {
  const hole = holeAt(s.gate);
  const hit = inHole(f.aim, hole);
  const full = hit && s.stock >= PRIZE_QUEUE_MAX;
  s.gateShots++;
  if (hit) {
    s.gateHits++;
    if (!full) s.stock++;
  } else drop(s, "coin", dropX(s, COIN_R), 0, { aim: f.aim });
  ev.push({ type: "gate", hit, full, x: f.aim, hole });
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
    const card = Math.min(CARD_COUNT - 1, Math.floor(rand(s) * CARD_COUNT));
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

/** A capsule over the front edge: one more core toward the Super spin. */
function collectCore(s: State, ev: GameEvent[]) {
  s.cores++;
  ev.push({ type: "coreIn", count: s.cores });
  // Queue the Super spin the moment the sixth arrives (a second one only after the first resets the meter)
  if (s.cores === CORE_COUNT) s.queue.unshift("super");
}

/** A card over the front edge: its tickets, the album, and the set bonus. */
function collectCard(s: State, card: number, ev: GameEvent[]) {
  const fresh = !s.album[card];
  s.album[card] = true;
  s.cardsWon++;
  earn(s, CARD_TICKETS);
  ev.push({ type: "card", card, fresh, owned: ownedCount(s.album) });
  ev.push({ type: "tickets", amount: CARD_TICKETS, source: "card" });
  if (s.album.every(Boolean)) {
    s.sets++;
    earn(s, SET_TICKETS);
    s.album = s.album.map(() => false);
    ev.push({ type: "setComplete" }, { type: "tickets", amount: SET_TICKETS, source: "set" });
  }
}

const spinTime = (kind: SpinKind) => (kind === "super" ? SUPER_SPIN_TIME : SPIN_TIME);

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
      const aim = (rand(s) * 2 - 1) * AIM_SPREAD;
      s.flights.push({ id: s.nextId++, t: 0, phase: "up", x: SHELF_W / 2, aim, kind: "coin", core: -1, card: -1 });
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
    ev.push({ type: "fall", x: b.x, y: b.y, edge: x.edge, stack: b.stack, kind: b.kind, core: b.core, card: b.card });
    if (x.edge !== "front") continue;
    if (b.kind === "coin") {
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

  // The reels: Mini and Super spins, one at a time
  if (!s.spin && s.queue.length > 0) {
    const kind = s.queue.shift() as SpinKind;
    s.spin = { kind, idx: pick(s, kind === "mini" ? MINI_WEIGHTS : SUPER_WEIGHTS), t: 0, paid: false };
    ev.push({ type: "spinStart", kind, idx: s.spin.idx });
  }
  if (s.spin) {
    const sp = s.spin;
    sp.t += dt;
    const time = spinTime(sp.kind);
    if (!sp.paid && sp.t >= time) {
      sp.paid = true;
      const prize = prizeOf(sp.kind, sp.idx);
      ev.push({ type: "spinWin", kind: sp.kind, idx: sp.idx, prize });
      if (prize.kind === "tickets") {
        earn(s, prize.value);
        ev.push({ type: "tickets", amount: prize.value, source: sp.kind });
      } else {
        s.coins += prize.value;
        ev.push({ type: "coinsWon", amount: prize.value });
      }
      if (sp.kind === "super") {
        s.supers++;
        s.cores = Math.max(0, s.cores - CORE_COUNT);
        ev.push({ type: "superReset" });
        if (s.cores >= CORE_COUNT) s.queue.unshift("super");
      }
    }
    if (sp.t >= time + SPIN_HOLD) s.spin = null;
  }

  // Out of coins and settled: idle (once), until coins come back from anywhere
  if (s.idle && s.coins > 0) s.idle = false;
  else if (!s.idle && !busy(s) && s.quiet >= SETTLE_TIME) {
    s.idle = true;
    ev.push({ type: "idle" });
  }
  return ev;
}
