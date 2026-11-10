import { nextRandom } from "@web-games/core/math";
import {
  BETA_START_COINS,
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
  MAX_BODIES,
  MAX_STACK,
  MINI_PRIZES,
  MINI_WEIGHTS,
  POINTER_ANGLE,
  PREFILL_CORES,
  PREFILL_FILL,
  PREFILL_STACK2,
  PREFILL_STACK3,
  type Prize,
  PUSH_MAX,
  PUSH_MIN,
  PUSH_PERIOD,
  SEG_START,
  SETTLE_TIME,
  SET_TICKETS,
  SHELF_D,
  SHELF_W,
  SPIN_TIME,
  SUPER_PRIZES,
  SUPER_SPIN_TIME,
  SUPER_WEIGHTS,
  type Segment,
  WHEEL,
  WHEEL_SPEED,
  WHEEL_WOBBLE,
  WOBBLE_PERIOD,
} from "./config";
import { type Body, stepShelf } from "./physics";

// The rules of the machine: spend a coin, the wheel decides a prize when it
// arrives (tickets, a rain of coins, an energy capsule or a cat card), anything
// dropped lands on the shelf, and the shelf pushes things off. Pure and seeded:
// the random state is a number in the state, so a run replays exactly and the
// whole state (the card album included) can be saved as JSON.

const TAU = Math.PI * 2;
/** Seconds a landed spin result stays on the reels before the next one starts. */
export const SPIN_HOLD = 0.9;
/** Bumped when the State shape changes, so an old saved run is not resumed. */
export const RULES_VERSION = 2;

export interface Flight {
  id: number;
  /** Seconds into the current phase; negative = still waiting its turn (a coin rain). */
  t: number;
  /** "up": the chute to the wheel. "down": from the wheel onto the shelf. */
  phase: "up" | "down";
  /** Where on the shelf it lands (world x). */
  x: number;
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

export interface State {
  v: number;
  seed: number;
  t: number;
  nextId: number;
  coins: number;
  tickets: number;
  supers: number;
  /** Albums completed this run. */
  sets: number;
  /** Cards pushed off the front this run. */
  cardsWon: number;
  shots: number;
  /** Coins pushed off the front (and given back). */
  returned: number;
  wheel: number;
  pusherT: number;
  bodies: Body[];
  flights: Flight[];
  /** Capsules pushed off the front toward the next Super spin (can pass 6 while one waits). */
  cores: number;
  /** Which of the ten cards the player owns (persists across runs through game.ts). */
  album: boolean[];
  /** Spins waiting their turn on the reels. */
  queue: SpinKind[];
  spin: Spin | null;
  /** Capsules dropped so far, to colour the next one. */
  capsules: number;
  cooldown: number;
  /** Seconds since anything landed, fell or was shot. */
  quiet: number;
  over: boolean;
}

export interface Input {
  shoot: boolean;
}

export type GameEvent =
  | { type: "shoot" }
  | { type: "dry" }
  | { type: "hit"; seg: number; segment: Segment }
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
  | { type: "over"; tickets: number; supers: number };

const rand = (s: State) => nextRandom(s);

/** The pusher's front face, and its speed toward the front. */
export function pusherAt(t: number) {
  const k = (TAU * t) / PUSH_PERIOD;
  return {
    y: PUSH_MIN + ((PUSH_MAX - PUSH_MIN) * (1 - Math.cos(k))) / 2,
    v: ((PUSH_MAX - PUSH_MIN) * Math.PI * Math.sin(k)) / PUSH_PERIOD,
  };
}

/** The wheel's motor surges and eases a little, so a held button can't lock onto a slot. */
export const wheelSpeed = (t: number) => WHEEL_SPEED * (1 + WHEEL_WOBBLE * Math.sin((TAU * t) / WOBBLE_PERIOD));

/** The wheel segment in front of the chute at this wheel angle. */
export function segmentAt(wheel: number) {
  const a = (((POINTER_ANGLE - wheel) % TAU) + TAU) % TAU;
  for (let i = WHEEL.length - 1; i > 0; i--) if (a >= SEG_START[i]) return i;
  return 0;
}

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

/** A fresh run: the shelf pre-filled with coins and a couple of capsules, then left to settle. */
export function createRun(seed: number, startCoins = BETA_START_COINS, album: unknown = null): State {
  const s: State = {
    v: RULES_VERSION,
    seed: seed | 0,
    t: 0,
    nextId: 1,
    coins: startCoins,
    tickets: 0,
    supers: 0,
    sets: 0,
    cardsWon: 0,
    shots: 0,
    returned: 0,
    wheel: 0,
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
    over: false,
  };
  s.wheel = rand(s) * TAU;
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

/** The shot coin meets the wheel. Returns true if the flight carries on down to the shelf (as a capsule or a card). */
function hitWheel(s: State, f: Flight, ev: GameEvent[]) {
  const seg = segmentAt(s.wheel);
  const segment = WHEEL[seg];
  ev.push({ type: "hit", seg, segment });
  if (segment.kind === "tickets") {
    s.tickets += segment.value;
    ev.push({ type: "tickets", amount: segment.value, source: "wheel" });
    return false;
  }
  if (segment.kind === "coins") {
    // Spread across the shelf: one coin per equal band, at a random spot in it
    const n = segment.value;
    const lo = COIN_R + 6;
    const band = (SHELF_W - 2 * lo) / n;
    for (let i = 0; i < n; i++) {
      s.flights.push({
        id: s.nextId++,
        t: -i * COIN_DROP_GAP,
        phase: "down",
        x: lo + (i + rand(s)) * band,
        kind: "coin",
        core: -1,
        card: -1,
      });
    }
    return false;
  }
  // A capsule or a card takes the shot coin's place on its way down
  f.phase = "down";
  if (segment.kind === "core") {
    f.kind = "core";
    f.core = s.capsules++ % CORE_COUNT;
    f.x = dropX(s, CORE_R);
    s.queue.push("mini");
  } else {
    f.kind = "card";
    f.card = Math.min(CARD_COUNT - 1, Math.floor(rand(s) * CARD_COUNT));
    f.x = dropX(s, CARD_R);
  }
  return true;
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
  s.tickets += CARD_TICKETS;
  ev.push({ type: "card", card, fresh, owned: ownedCount(s.album) });
  ev.push({ type: "tickets", amount: CARD_TICKETS, source: "card" });
  if (s.album.every(Boolean)) {
    s.sets++;
    s.tickets += SET_TICKETS;
    s.album = s.album.map(() => false);
    ev.push({ type: "setComplete" }, { type: "tickets", amount: SET_TICKETS, source: "set" });
  }
}

const spinTime = (kind: SpinKind) => (kind === "super" ? SUPER_SPIN_TIME : SPIN_TIME);

/** Whether the run can still change: something in the air, on the reels, or coins left. */
export const busy = (s: State) => s.coins > 0 || s.flights.length > 0 || s.spin !== null || s.queue.length > 0;

/**
 * Add coupon coins to a run still in play. Returns the coins added (0 when the
 * run is over or the amount is not a positive whole number). Tickets, the
 * leaderboard score, are never touched.
 */
export function grantCoins(s: State, n: number): number {
  if (s.over || !Number.isFinite(n)) return 0;
  const add = Math.floor(n);
  if (add <= 0) return 0;
  s.coins += add;
  return add;
}

export function update(s: State, input: Input, dt: number): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.over) return ev;
  s.t += dt;
  s.wheel = (s.wheel + wheelSpeed(s.t) * dt) % TAU;
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
      s.flights.push({ id: s.nextId++, t: 0, phase: "up", x: SHELF_W / 2, kind: "coin", core: -1, card: -1 });
      ev.push({ type: "shoot" });
    } else ev.push({ type: "dry" });
  }

  // Coins, capsules and cards in the air
  for (let i = 0; i < s.flights.length; i++) {
    const f = s.flights[i];
    f.t += dt;
    if (f.phase === "up" && f.t >= FLIGHT_UP) {
      s.quiet = 0;
      if (!hitWheel(s, f, ev)) {
        s.flights.splice(i--, 1);
        continue;
      }
      f.t -= FLIGHT_UP;
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
      s.tickets += b.stack * FRONT_TICKETS;
      ev.push({ type: "tickets", amount: b.stack * FRONT_TICKETS, source: "front" });
    } else if (b.kind === "core") collectCore(s, ev);
    else collectCard(s, b.card, ev);
  }
  capBodies(s);

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
        s.tickets += prize.value;
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

  if (!busy(s) && s.quiet >= SETTLE_TIME) {
    s.over = true;
    ev.push({ type: "over", tickets: s.tickets, supers: s.supers });
  }
  return ev;
}
