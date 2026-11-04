// Đào Vàng's rules: pure and deterministic given a seed, so logic.test.ts can
// play whole levels with a bot. game.ts turns taps into `Input` and the
// returned events into sound, particles and money pops.
import { clamp, mulberry32, nextRandom, type Rng } from "@web-games/core/math";
import {
  BOARD_BOTTOM,
  BOARD_MARGIN,
  BOARD_RATIO,
  BOARD_TOP,
  BOOK_BOOST,
  BOUNDS,
  CLAW_R,
  DEPTH,
  EMPTY_PULL,
  EXTEND_SPEED,
  ITEMS,
  type ItemKind,
  LEVEL_TIME,
  MAX_DYNAMITE,
  MOLE_DIAMOND_FROM,
  MOLE_SPEED,
  OFFERS,
  PIVOT,
  POLISH_BOOST,
  PRICE_SPREAD,
  PRICES,
  PULL,
  REST_LEN,
  SACK,
  SHOP_KINDS,
  type SackOutcome,
  type ShopKind,
  START_DYNAMITE,
  STRENGTH_BOOST,
  SWING_MAX,
  SWING_SPEED,
  W,
  goalFor,
  goalStep,
  molesFor,
  rocksFor,
  sacksFor,
  valuableWeights,
} from "./config";

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  r: number;
  /** Moles walk between minX and maxX; everything else has speed 0. */
  dir: number;
  speed: number;
  minX: number;
  maxX: number;
}

export type ClawMode = "swing" | "extend" | "retract";

export interface Claw {
  /** Pendulum phase; the angle is SWING_MAX · sin(phase). */
  phase: number;
  /** 0 = straight down, positive swings right. */
  angle: number;
  /** Distance from the pivot to the claw's tip. */
  len: number;
  mode: ClawMode;
  held: Item | null;
}

/** One-level effects: bought in the shop, or (strength) found in a sack. */
export interface Buffs {
  strength: boolean;
  lucky: boolean;
  polish: boolean;
  book: boolean;
}

export interface Offer {
  kind: ShopKind;
  price: number;
  sold: boolean;
}

export type Phase = "play" | "cleared" | "over" | "shop";

export interface State {
  /** Run seed: boards are generated from it and the level number. */
  seed: number;
  /** The run's dice for sacks and shop offers, as a plain number (serialisable). */
  rng: { seed: number };
  level: number;
  money: number;
  /** Money in the bank when this level started. */
  levelStart: number;
  goal: number;
  time: number;
  items: Item[];
  claw: Claw;
  dynamite: number;
  buffs: Buffs;
  /** What the shop sold for the level after this one. */
  next: Buffs;
  phase: Phase;
  offers: Offer[];
}

export interface Input {
  fire?: boolean;
  dynamite?: boolean;
}

export type GameEvent =
  | { type: "fire" }
  | { type: "grab"; item: Item }
  | { type: "miss" }
  | { type: "land"; item: Item; value: number; sack?: SackOutcome }
  | { type: "boom"; item: Item; x: number; y: number }
  | { type: "tick"; sec: number }
  | { type: "end"; won: boolean };

const noBuffs = (): Buffs => ({
  strength: false,
  lucky: false,
  polish: false,
  book: false,
});

// ---------------------------------------------------------------- geometry

export const direction = (angle: number) => ({
  x: Math.sin(angle),
  y: Math.cos(angle),
});

/** Where the claw's grabbing tip is now. */
export function tipOf(claw: Claw) {
  const d = direction(claw.angle);
  return { x: PIVOT.x + d.x * claw.len, y: PIVOT.y + d.y * claw.len };
}

/** A held load hangs just past the tip, along the rope. */
export function heldPos(claw: Claw, item: Item) {
  const d = direction(claw.angle);
  const t = tipOf(claw);
  return { x: t.x + d.x * item.r * 0.6, y: t.y + d.y * item.r * 0.6 };
}

const isValuable = (k: ItemKind) =>
  k === "goldS" ||
  k === "goldM" ||
  k === "goldL" ||
  k === "diamond" ||
  k === "moleDiamond";

/** Sum of what the gold and diamonds on a board are worth (sacks and rocks not counted). */
export const boardValue = (items: Item[]) =>
  items.reduce(
    (n, it) => n + (isValuable(it.kind) ? ITEMS[it.kind].value : 0),
    0,
  );

// ---------------------------------------------------------------- scoring

/** What an item pays when it lands, with this level's buffs. Sacks pay through their outcome. */
export function payout(kind: ItemKind, buffs: Buffs) {
  const base = ITEMS[kind].value;
  if (kind === "diamond")
    return Math.round(base * (buffs.polish ? POLISH_BOOST : 1));
  if (kind === "moleDiamond") {
    const gem = ITEMS.diamond.value;
    return base - gem + Math.round(gem * (buffs.polish ? POLISH_BOOST : 1));
  }
  if (kind === "rockS" || kind === "rockL")
    return base * (buffs.book ? BOOK_BOOST : 1);
  return base;
}

/** Reel speed, px/s: the heavier the load, the slower; strength speeds every load up. */
export function pullSpeed(item: Item | null, strength: boolean) {
  if (!item) return EMPTY_PULL;
  return Math.min(
    EMPTY_PULL,
    (PULL * (strength ? STRENGTH_BOOST : 1)) / ITEMS[item.kind].weight,
  );
}

/** What a sack holds, rolled when it lands. The lucky clover pays more. */
export function rollSack(rnd: Rng, lucky: boolean): SackOutcome {
  const t = lucky ? SACK.lucky : SACK.plain;
  const r = rnd();
  if (r < t.money) {
    const amount = Math.round((t.min + rnd() * (t.max - t.min)) / 5) * 5;
    return { kind: "money", amount };
  }
  if (r < t.money + t.dynamite) return { kind: "dynamite" };
  return { kind: "strength" };
}

// ---------------------------------------------------------------- boards

function pick<T>(rnd: Rng, table: [T, number][]): T {
  const total = table.reduce((n, [, w]) => n + w, 0);
  let r = rnd() * total;
  for (const [v, w] of table) {
    r -= w;
    if (r < 0) return v;
  }
  return table[table.length - 1][0];
}

/** The board for a level: the same run seed and level always give the same board. */
export function generateLevel(level: number, seed: number): Item[] {
  const rnd = mulberry32((seed ^ Math.imul(level, 0x9e3779b1)) >>> 0);
  const items: Item[] = [];
  let id = 1;
  const shift = Math.min(0.18, 0.025 * (level - 1));

  const place = (kind: ItemKind, moving = false) => {
    const { r } = ITEMS[kind];
    for (let tries = 0; tries < 80; tries++) {
      const bias = DEPTH[kind] + (isValuable(kind) ? shift : 0);
      const frac = clamp(bias + (rnd() - 0.5) * 0.6, 0, 1);
      const y = BOARD_TOP + r + frac * (BOARD_BOTTOM - BOARD_TOP - 2 * r);
      const x = BOARD_MARGIN + r + rnd() * (W - 2 * (BOARD_MARGIN + r));
      // Moles walk across their lane, so they only keep clear of other moles' lanes
      const clash = items.some((o) =>
        moving || o.speed > 0
          ? o.speed > 0 && moving && Math.abs(o.y - y) < o.r + r + 6
          : Math.hypot(o.x - x, o.y - y) < o.r + r + 8,
      );
      if (clash) continue;
      const speed = moving
        ? MOLE_SPEED[0] + rnd() * (MOLE_SPEED[1] - MOLE_SPEED[0])
        : 0;
      const item: Item = {
        id: id++,
        kind,
        x,
        y,
        r,
        dir: rnd() < 0.5 ? -1 : 1,
        speed,
        minX: BOARD_MARGIN + r,
        maxX: W - BOARD_MARGIN - r,
      };
      items.push(item);
      return true;
    }
    return false;
  };

  // Valuables first, so they get the room; then the rest fills around them
  const budget = BOARD_RATIO * goalStep(level);
  const weights = valuableWeights(level);
  for (let value = 0, guard = 0; value < budget && guard < 80; guard++) {
    const kind = pick(rnd, weights);
    if (place(kind)) value += ITEMS[kind].value;
  }
  for (let i = 0; i < sacksFor(level); i++) place("sack");
  for (let i = 0; i < rocksFor(level); i++)
    place(rnd() < 0.45 ? "rockL" : "rockS");
  for (let i = 0; i < molesFor(level); i++) {
    place(
      level >= MOLE_DIAMOND_FROM && rnd() < 0.35 ? "moleDiamond" : "mole",
      true,
    );
  }
  return items;
}

// ---------------------------------------------------------------- the run

function restClaw(): Claw {
  return { phase: 0, angle: 0, len: REST_LEN, mode: "swing", held: null };
}

export function createRun(seed: number): State {
  const s: State = {
    seed: seed >>> 0,
    rng: { seed: seed ^ 0x5bd1e995 },
    level: 1,
    money: 0,
    levelStart: 0,
    goal: goalFor(1),
    time: LEVEL_TIME,
    items: [],
    claw: restClaw(),
    dynamite: START_DYNAMITE,
    buffs: noBuffs(),
    next: noBuffs(),
    phase: "play",
    offers: [],
  };
  startLevel(s);
  return s;
}

/** Lay out `s.level` and start its clock; what the shop sold becomes active. */
export function startLevel(s: State) {
  s.items = generateLevel(s.level, s.seed);
  s.goal = goalFor(s.level);
  s.time = LEVEL_TIME;
  s.levelStart = s.money;
  s.claw = restClaw();
  s.buffs = s.next;
  s.next = noBuffs();
  s.offers = [];
  s.phase = "play";
}

function end(s: State, events: GameEvent[]) {
  const won = s.money >= s.goal;
  s.phase = won ? "cleared" : "over";
  s.claw.held = null;
  events.push({ type: "end", won });
}

export function update(s: State, input: Input, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (s.phase !== "play") return events;
  const rnd: Rng = () => nextRandom(s.rng);

  const before = Math.ceil(s.time);
  s.time = Math.max(0, s.time - dt);
  const after = Math.ceil(s.time);
  if (after < before && after <= 10 && after > 0)
    events.push({ type: "tick", sec: after });

  for (const m of s.items) {
    if (m.speed <= 0) continue;
    m.x += m.dir * m.speed * dt;
    if (m.x < m.minX) {
      m.x = m.minX;
      m.dir = 1;
    }
    if (m.x > m.maxX) {
      m.x = m.maxX;
      m.dir = -1;
    }
  }

  const c = s.claw;
  if (c.mode === "swing") {
    c.phase += SWING_SPEED * dt;
    c.angle = SWING_MAX * Math.sin(c.phase);
    if (input.fire) {
      c.mode = "extend";
      events.push({ type: "fire" });
    }
  } else if (c.mode === "extend") {
    c.len += EXTEND_SPEED * dt;
    const t = tipOf(c);
    let hit: Item | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const it of s.items) {
      const d = Math.hypot(it.x - t.x, it.y - t.y) - it.r;
      if (d <= CLAW_R && d < best) {
        best = d;
        hit = it;
      }
    }
    if (hit) {
      s.items = s.items.filter((it) => it !== hit);
      c.held = hit;
      c.mode = "retract";
      events.push({ type: "grab", item: hit });
    } else if (t.x < BOUNDS.left || t.x > BOUNDS.right || t.y > BOUNDS.bottom) {
      c.mode = "retract";
      events.push({ type: "miss" });
    }
  } else {
    if (input.dynamite && c.held && s.dynamite > 0) {
      s.dynamite--;
      const p = heldPos(c, c.held);
      events.push({ type: "boom", item: c.held, x: p.x, y: p.y });
      c.held = null;
    }
    c.len -= pullSpeed(c.held, s.buffs.strength) * dt;
    if (c.held) {
      const p = heldPos(c, c.held);
      c.held.x = p.x;
      c.held.y = p.y;
    }
    if (c.len <= REST_LEN) {
      c.len = REST_LEN;
      c.mode = "swing";
      const it = c.held;
      c.held = null;
      if (it) events.push(land(s, it, rnd));
    }
  }

  // The clock ran out, or nothing is left to dig
  if (s.time <= 0 || (s.items.length === 0 && c.mode === "swing"))
    end(s, events);
  return events;
}

function land(s: State, item: Item, rnd: Rng): GameEvent {
  if (item.kind === "sack") {
    const sack = rollSack(rnd, s.buffs.lucky);
    let value = 0;
    if (sack.kind === "money") value = sack.amount;
    else if (sack.kind === "dynamite")
      s.dynamite = Math.min(MAX_DYNAMITE, s.dynamite + 1);
    else s.buffs.strength = true;
    s.money += value;
    return { type: "land", item, value, sack };
  }
  const value = payout(item.kind, s.buffs);
  s.money += value;
  return { type: "land", item, value };
}

// ---------------------------------------------------------------- the shop

/** After a cleared level: roll 3–4 offers with prices that vary. */
export function openShop(s: State) {
  if (s.phase !== "cleared") return;
  const rnd: Rng = () => nextRandom(s.rng);
  const kinds = [...SHOP_KINDS];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const n = OFFERS[0] + Math.floor(rnd() * (OFFERS[1] - OFFERS[0] + 1));
  s.offers = kinds.slice(0, n).map((kind) => {
    const p = PRICES[kind];
    const base = p.base + p.perLevel * (s.level - 1);
    const price = Math.max(
      5,
      Math.round((base * (1 + PRICE_SPREAD * (2 * rnd() - 1))) / 5) * 5,
    );
    return { kind, price, sold: false };
  });
  s.phase = "shop";
}

export function canBuy(s: State, i: number) {
  const o = s.offers[i];
  if (s.phase !== "shop" || !o || o.sold || s.money < o.price) return false;
  return o.kind !== "dynamite" || s.dynamite < MAX_DYNAMITE;
}

export function buy(s: State, i: number) {
  if (!canBuy(s, i)) return false;
  const o = s.offers[i];
  s.money -= o.price;
  o.sold = true;
  if (o.kind === "dynamite") s.dynamite++;
  else if (o.kind === "strength") s.next.strength = true;
  else if (o.kind === "clover") s.next.lucky = true;
  else if (o.kind === "polish") s.next.polish = true;
  else s.next.book = true;
  return true;
}

/** Leave the shop (bought or not) for the next level. */
export function leaveShop(s: State) {
  if (s.phase !== "shop" && s.phase !== "cleared") return;
  s.level++;
  startLevel(s);
}

/** The item the claw would hit first if fired now (for hints and tests). */
export function firstHit(s: State): Item | null {
  const d = direction(s.claw.angle);
  let hit: Item | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const it of s.items) {
    const rx = it.x - PIVOT.x;
    const ry = it.y - PIVOT.y;
    const along = rx * d.x + ry * d.y;
    if (along <= 0) continue;
    const off = Math.abs(rx * d.y - ry * d.x);
    if (off <= it.r + CLAW_R && along < best) {
      best = along;
      hit = it;
    }
  }
  return hit;
}
