import { nextRandom } from "@web-games/core/math";
import {
  BETA_START_COINS,
  CORE_COUNT,
  CORE_R,
  CORE_RESPAWN,
  COIN_R,
  FIRE_INTERVAL,
  FLIGHT_DOWN,
  FLIGHT_UP,
  FRONT_TICKETS,
  MAX_BODIES,
  MAX_STACK,
  POINTER_ANGLE,
  PREFILL_FILL,
  PREFILL_STACK2,
  PREFILL_STACK3,
  PUSH_MAX,
  PUSH_MIN,
  PUSH_PERIOD,
  SEG_START,
  SETTLE_TIME,
  SHELF_D,
  SHELF_W,
  SHOWER_GAP,
  SPIN_PRIZES,
  SPIN_TIME,
  SPIN_WEIGHTS,
  SUPER_SHOWER,
  SUPER_TICKETS,
  SUPER_TIME,
  type Segment,
  WHEEL,
  WHEEL_SPEED,
  WHEEL_WOBBLE,
  WOBBLE_PERIOD,
} from "./config";
import { type Body, stepShelf } from "./physics";

// The rules of the machine: spend a coin, the wheel decides a prize when it
// arrives, the coin drops onto the shelf, the shelf pushes things off. Pure and
// seeded: the random state is a number in the state, so a run replays exactly
// and the whole state can be saved as JSON.

const TAU = Math.PI * 2;
/** Seconds a landed Bonus Spin result stays on the reels before the next one starts. */
export const SPIN_HOLD = 0.9;

export interface Flight {
  id: number;
  /** Seconds into the current phase; negative = still waiting its turn (a shower). */
  t: number;
  /** "up": the chute to the wheel. "down": from the wheel (or the top) onto the shelf. */
  phase: "up" | "down";
  /** Where it falls from: the chute's mouth (a shot coin), the wheel hub (a Super Bonus shower) or the top (a capsule). */
  from: "wheel" | "hub" | "top";
  /** Where on the shelf it lands (world x). */
  x: number;
  /** An energy capsule (0-5) or -1 for a coin. */
  core: number;
}

export interface Spin {
  t: number;
  prize: number;
  paid: boolean;
}

export interface State {
  seed: number;
  t: number;
  nextId: number;
  coins: number;
  tickets: number;
  supers: number;
  shots: number;
  /** Coins pushed off the front (and given back). */
  returned: number;
  wheel: number;
  pusherT: number;
  bodies: Body[];
  flights: Flight[];
  cores: boolean[];
  /** Bonus Spins waiting their turn on the reels. */
  queued: number;
  spin: Spin | null;
  /** Seconds left of a Super Bonus celebration; the cores reset when it ends. */
  superT: number;
  respawns: { core: number; t: number }[];
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
  | { type: "hit"; seg: number; segment: Segment; core: number }
  | { type: "tickets"; amount: number; source: "wheel" | "front" | "spin" | "super" }
  | { type: "land"; id: number; x: number; y: number; core: number; stacked: boolean }
  | { type: "fall"; x: number; y: number; edge: "front" | "side"; stack: number; core: number }
  | { type: "coreLit"; core: number; via: "wheel" | "capsule" }
  | { type: "spinStart"; prize: number }
  | { type: "spinWin"; prize: number }
  | { type: "super" }
  | { type: "reset" }
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

const coin = (s: State, x: number, y: number, stack = 1): Body => ({
  id: s.nextId++,
  kind: "coin",
  core: -1,
  stack,
  x,
  y,
  vx: 0,
  vy: 0,
  r: COIN_R,
});

const capsule = (s: State, core: number, x: number, y: number): Body => ({
  id: s.nextId++,
  kind: "core",
  core,
  stack: 1,
  x,
  y,
  vx: 0,
  vy: 0,
  r: CORE_R,
});

/** A fresh run: the shelf pre-filled with coins and six capsules, then left to settle. */
export function createRun(seed: number, startCoins = BETA_START_COINS): State {
  const s: State = {
    seed: seed | 0,
    t: 0,
    nextId: 1,
    coins: startCoins,
    tickets: 0,
    supers: 0,
    shots: 0,
    returned: 0,
    wheel: 0,
    pusherT: 0,
    bodies: [],
    flights: [],
    cores: Array.from({ length: CORE_COUNT }, () => false),
    queued: 0,
    spin: null,
    superT: 0,
    respawns: [],
    cooldown: 0,
    quiet: 0,
    over: false,
  };
  s.wheel = rand(s) * TAU;
  // Six capsules across the middle of the shelf, alternating rows
  const cores: Body[] = [];
  for (let i = 0; i < CORE_COUNT; i++) {
    const x = 44 + i * ((SHELF_W - 88) / (CORE_COUNT - 1)) + (rand(s) - 0.5) * 16;
    const y = (i % 2 === 0 ? 178 : 238) + (rand(s) - 0.5) * 20;
    cores.push(capsule(s, i, x, y));
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
      s.bodies.push(coin(s, jx, jy, stack));
    }
  }
  s.bodies.push(...cores);
  // Settle: a few pusher strokes with nothing counted
  for (let i = 0; i < 300; i++) {
    const p = pusherAt(s.pusherT);
    stepShelf(s.bodies, p.y, p.v, 1 / 60);
    s.pusherT += 1 / 60;
  }
  // Anything that left during settling would be a missing capsule: put it back
  for (let i = 0; i < CORE_COUNT; i++) {
    if (!s.bodies.some((b) => b.core === i)) s.respawns.push({ core: i, t: 0.3 + i * 0.2 });
  }
  return s;
}

/** Light a core; all six lit starts the Super Bonus. */
function lightCore(s: State, core: number, via: "wheel" | "capsule", ev: GameEvent[]) {
  if (!s.cores[core]) {
    s.cores[core] = true;
    ev.push({ type: "coreLit", core, via });
  }
  if (s.superT <= 0 && s.cores.every(Boolean)) {
    s.superT = SUPER_TIME;
    s.supers++;
    s.tickets += SUPER_TICKETS;
    ev.push({ type: "super" }, { type: "tickets", amount: SUPER_TICKETS, source: "super" });
    for (let i = 0; i < SUPER_SHOWER; i++) {
      s.flights.push({
        id: s.nextId++,
        t: -0.6 - i * SHOWER_GAP,
        phase: "down",
        from: "hub",
        x: COIN_R + 20 + rand(s) * (SHELF_W - 2 * COIN_R - 40),
        core: -1,
      });
    }
  }
}

function hitWheel(s: State, ev: GameEvent[]) {
  const seg = segmentAt(s.wheel);
  const segment = WHEEL[seg];
  let core = -1;
  if (segment.kind === "tickets") {
    s.tickets += segment.value;
    ev.push({ type: "hit", seg, segment, core });
    ev.push({ type: "tickets", amount: segment.value, source: "wheel" });
  } else if (segment.kind === "core") {
    core = s.cores.indexOf(false);
    ev.push({ type: "hit", seg, segment, core });
    if (core >= 0) lightCore(s, core, "wheel", ev);
    else {
      // Every core already lit (the Super Bonus is playing): a consolation prize
      s.tickets += 6;
      ev.push({ type: "tickets", amount: 6, source: "wheel" });
    }
  } else {
    s.queued++;
    ev.push({ type: "hit", seg, segment, core });
  }
}

function land(s: State, f: Flight, ev: GameEvent[]) {
  const p = pusherAt(s.pusherT);
  s.quiet = 0;
  if (f.core >= 0) {
    const b = capsule(s, f.core, f.x, p.y + CORE_R + 2);
    b.vy = 40;
    s.bodies.push(b);
    ev.push({ type: "land", id: b.id, x: b.x, y: b.y, core: f.core, stacked: false });
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
    ev.push({ type: "land", id: onto.id, x: onto.x, y: onto.y, core: -1, stacked: true });
    return;
  }
  const b = coin(s, f.x, y);
  b.vy = 60;
  s.bodies.push(b);
  ev.push({ type: "land", id: b.id, x: b.x, y: b.y, core: -1, stacked: false });
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

const capsulePresent = (s: State, core: number) =>
  s.bodies.some((b) => b.core === core) ||
  s.flights.some((f) => f.core === core) ||
  s.respawns.some((r) => r.core === core);

function dropCapsule(s: State, core: number, delay: number) {
  s.flights.push({
    id: s.nextId++,
    t: -delay,
    phase: "down",
    from: "top",
    x: CORE_R + 10 + rand(s) * (SHELF_W - 2 * CORE_R - 20),
    core,
  });
}

function pickPrize(s: State) {
  const total = SPIN_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rand(s) * total;
  for (let i = 0; i < SPIN_PRIZES.length; i++) {
    r -= SPIN_WEIGHTS[i];
    if (r < 0) return SPIN_PRIZES[i];
  }
  return SPIN_PRIZES[0];
}

/** Whether the run can still change: something in the air, on the reels, or coins left. */
export const busy = (s: State) =>
  s.coins > 0 || s.flights.length > 0 || s.spin !== null || s.queued > 0 || s.superT > 0;

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
      s.flights.push({
        id: s.nextId++,
        t: 0,
        phase: "up",
        from: "wheel",
        x: COIN_R + 6 + rand(s) * (SHELF_W - 2 * COIN_R - 12),
        core: -1,
      });
      ev.push({ type: "shoot" });
    } else ev.push({ type: "dry" });
  }

  // Coins and capsules in the air
  for (let i = 0; i < s.flights.length; i++) {
    const f = s.flights[i];
    f.t += dt;
    if (f.phase === "up" && f.t >= FLIGHT_UP) {
      hitWheel(s, ev);
      f.phase = "down";
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
    ev.push({ type: "fall", x: b.x, y: b.y, edge: x.edge, stack: b.stack, core: b.core });
    if (b.kind === "coin") {
      if (x.edge === "front") {
        s.coins += b.stack;
        s.returned += b.stack;
        s.tickets += b.stack * FRONT_TICKETS;
        ev.push({ type: "tickets", amount: b.stack * FRONT_TICKETS, source: "front" });
      }
    } else if (x.edge === "front") {
      s.queued++;
      lightCore(s, b.core, "capsule", ev);
    } else if (!s.cores[b.core]) {
      s.respawns.push({ core: b.core, t: CORE_RESPAWN });
    }
  }
  capBodies(s);

  // Bonus Spin reels
  if (!s.spin && s.queued > 0) {
    s.queued--;
    s.spin = { t: 0, prize: pickPrize(s), paid: false };
    ev.push({ type: "spinStart", prize: s.spin.prize });
  }
  if (s.spin) {
    s.spin.t += dt;
    if (!s.spin.paid && s.spin.t >= SPIN_TIME) {
      s.spin.paid = true;
      s.tickets += s.spin.prize;
      ev.push({ type: "spinWin", prize: s.spin.prize }, { type: "tickets", amount: s.spin.prize, source: "spin" });
    }
    if (s.spin.t >= SPIN_TIME + SPIN_HOLD) s.spin = null;
  }

  // Super Bonus: when the celebration ends the cores go dark and fresh capsules drop in
  if (s.superT > 0) {
    s.superT -= dt;
    if (s.superT <= 0) {
      s.superT = 0;
      s.cores = s.cores.map(() => false);
      s.respawns = [];
      ev.push({ type: "reset" });
      let n = 0;
      for (let c = 0; c < CORE_COUNT; c++) if (!capsulePresent(s, c)) dropCapsule(s, c, 0.3 * n++);
    }
  }
  for (let i = 0; i < s.respawns.length; i++) {
    const r = s.respawns[i];
    r.t -= dt;
    if (r.t <= 0) {
      s.respawns.splice(i--, 1);
      if (!capsulePresent(s, r.core)) dropCapsule(s, r.core, 0);
    }
  }

  if (!busy(s) && s.quiet >= SETTLE_TIME) {
    s.over = true;
    ev.push({ type: "over", tickets: s.tickets, supers: s.supers });
  }
  return ev;
}
