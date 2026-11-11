import type { SaveRules } from "../saves";
import {
  CARD_COUNT,
  LAND_X,
  CARD_R,
  COIN_R,
  CORE_COUNT,
  CORE_R,
  MAX_STACK,
  MINI_PRIZES,
  PRIZE_QUEUE_MAX,
  PUSH_PERIOD,
  RARE_TICKETS,
  SHELF_D,
  SHELF_W,
  SUPER_PRIZES,
  VERSION,
  WHEEL,
} from "./config";
import type { Flight, PrizeSpin, Spin, SpinKind, State } from "./logic";
import type { Body } from "./physics";

// The machine as it is saved: on the account (ctx.cloud slot 0, checked by the
// server through `rules`) and for a guest's local trial. Pure: the portal's
// server imports it.
//
// A save is an envelope { v, schema, state }: `v` is the game version that wrote
// it, `schema` the shape of `state`. migrate() walks an older schema up one step
// at a time; a save from before 1.0.0 (the beta's runs, a bare State with a
// numeric `v`) is "legacy" and is discarded, never crashed on.
//
// Schemas:
//   1  `state` is the State object as is (the first 1.0.0 builds).
//   2  bodies and flights packed into number tuples, floats rounded, the
//      album as a bit mask, `unpaid` dropped (the shell drains it before saving).
//   3  (1.1.0) the 11-slot wheel and the card inventory: `prize.seg` indexes
//      the new WHEEL, shot coins land on LAND_X, and the album bit mask became
//      `cards` (a count per cat) plus `seen` (a bit mask of cats ever
//      collected). From schema 2 (1.0.0): each owned cat becomes a count of 1
//      and is seen; a prize spin still running, if it had not paid yet, goes
//      back into the stock (capped); coins in the air land on LAND_X. Coins,
//      lifetime tickets and the shelf are kept as they are.
//   4  (1.2.0) the robot jar and Prize Counter cards: `eaten` (coins the jar
//      kept) and `packCards` (cards bought, not won). From schema 3 (1.1.0):
//      both start at 0. Nothing else changes shape: the wheel keeps its 11
//      slots in the same order (three coin slots pay more, see config.ts), so a
//      prize spin saved mid-run stays on its slot. 1.1.0 had no pending card
//      exchanges to carry: an exchange was paid the moment it was made.

export const SCHEMA = 4;

/** The server refuses a save bigger than this (MAX_BYTES in apps/web/src/server/saves.ts). */
export const SAVE_MAX_BYTES = 64 * 1024;

/** A body on the shelf: [id, kind, x, y, vx, vy, stack, tag]; tag = capsule colour or card index, -1 for a coin. */
export type PackedBody = [number, number, number, number, number, number, number, number];
/** Something in the air: [id, t, phase, x, aim, kind, tag]; phase 0 = up, 1 = down. */
export type PackedFlight = [number, number, number, number, number, number, number];

export interface PackedState {
  seed: number;
  t: number;
  nextId: number;
  coins: number;
  lifetimeTickets: number;
  supers: number;
  sets: number;
  cardsWon: number;
  shots: number;
  returned: number;
  /** Coins the robot jar kept. */
  eaten: number;
  /** Cards from the Prize Counter. */
  packCards: number;
  wheel: number;
  gate: number;
  gateShots: number;
  gateHits: number;
  stock: number;
  prize: PrizeSpin | null;
  pusherT: number;
  bodies: PackedBody[];
  flights: PackedFlight[];
  cores: number;
  /** Cards in the inventory per cat (CARD_IDS order). */
  cards: number[];
  /** Bit i set: cat i was ever collected. */
  seen: number;
  queue: SpinKind[];
  spin: Spin | null;
  capsules: number;
  cooldown: number;
  quiet: number;
  idle: boolean;
}

export interface MachineSave {
  /** The game version that wrote it (manifest.version). */
  v: string;
  schema: number;
  state: PackedState;
}

export type Migrated =
  | { ok: true; save: MachineSave }
  /**
   * empty: nothing saved. legacy: a pre-1.0 beta run (discard it, with a note).
   * future: written by a newer build. broken: not a save.
   */
  | { ok: false; reason: "empty" | "legacy" | "future" | "broken" };

const KINDS: Body["kind"][] = ["coin", "core", "card"];
// `+ 0` turns a rounded -0 into 0 (JSON writes both as 0, so a round trip must too)
const r2 = (x: number) => Math.round(x * 100) / 100 + 0;
const r4 = (x: number) => Math.round(x * 10_000) / 10_000 + 0;
const tagOf = (kind: Body["kind"], core: number, card: number) => (kind === "core" ? core : kind === "card" ? card : -1);

/** The machine in its compact saved form (the shell has drained `unpaid` already). */
export function pack(s: State): PackedState {
  return {
    seed: s.seed,
    t: r4(s.t),
    nextId: s.nextId,
    coins: s.coins,
    lifetimeTickets: s.lifetimeTickets,
    supers: s.supers,
    sets: s.sets,
    cardsWon: s.cardsWon,
    shots: s.shots,
    returned: s.returned,
    eaten: s.eaten,
    packCards: s.packCards,
    wheel: r4(s.wheel),
    gate: r4(s.gate),
    gateShots: s.gateShots,
    gateHits: s.gateHits,
    stock: s.stock,
    prize: s.prize && { seg: s.prize.seg, t: r4(s.prize.t), paid: s.prize.paid },
    pusherT: r4(s.pusherT),
    bodies: s.bodies.map((b) => [b.id, KINDS.indexOf(b.kind), r2(b.x), r2(b.y), r2(b.vx), r2(b.vy), b.stack, tagOf(b.kind, b.core, b.card)]),
    flights: s.flights.map((f) => [f.id, r4(f.t), f.phase === "up" ? 0 : 1, r2(f.x), r2(f.aim), KINDS.indexOf(f.kind), tagOf(f.kind, f.core, f.card)]),
    cores: s.cores,
    cards: [...s.cards],
    seen: s.seen.reduce((m, seen, i) => (seen ? m | (1 << i) : m), 0),
    queue: [...s.queue],
    spin: s.spin && { kind: s.spin.kind, idx: s.spin.idx, t: r4(s.spin.t), paid: s.spin.paid },
    capsules: s.capsules,
    cooldown: r4(s.cooldown),
    quiet: r4(s.quiet),
    idle: s.idle,
  };
}

/** The machine back from its saved form. */
export function unpack(p: PackedState): State {
  const radius = (kind: Body["kind"]) => (kind === "coin" ? COIN_R : kind === "core" ? CORE_R : CARD_R);
  return {
    seed: p.seed,
    t: p.t,
    nextId: p.nextId,
    coins: p.coins,
    lifetimeTickets: p.lifetimeTickets,
    unpaid: 0,
    supers: p.supers,
    sets: p.sets,
    cardsWon: p.cardsWon,
    shots: p.shots,
    returned: p.returned,
    eaten: p.eaten,
    packCards: p.packCards,
    wheel: p.wheel,
    gate: p.gate,
    gateShots: p.gateShots,
    gateHits: p.gateHits,
    stock: p.stock,
    prize: p.prize && { ...p.prize },
    pusherT: p.pusherT,
    bodies: p.bodies.map(([id, k, x, y, vx, vy, stack, tag]) => {
      const kind = KINDS[k];
      return { id, kind, core: kind === "core" ? tag : -1, card: kind === "card" ? tag : -1, stack, x, y, vx, vy, r: radius(kind) };
    }),
    flights: p.flights.map(([id, t, phase, x, aim, k, tag]): Flight => {
      const kind = KINDS[k];
      return { id, t, phase: phase === 0 ? "up" : "down", x, aim, kind, core: kind === "core" ? tag : -1, card: kind === "card" ? tag : -1 };
    }),
    cores: p.cores,
    cards: [...p.cards],
    seen: Array.from({ length: CARD_COUNT }, (_, i) => (p.seen & (1 << i)) !== 0),
    queue: [...p.queue],
    spin: p.spin && { ...p.spin },
    capsules: p.capsules,
    cooldown: p.cooldown,
    quiet: p.quiet,
    idle: p.idle,
  };
}

/** The machine as a save envelope, ready for storage or the cloud. */
export function toSave(s: State): MachineSave {
  return { v: VERSION, schema: SCHEMA, state: pack(s) };
}

export const fromSave = (save: MachineSave): State => unpack(save.state);

// ---------------------------------------------------------------- migrate

/** One step up per schema: STEPS[n] turns a schema-n `state` into a schema-(n+1) one. */
const STEPS: Record<number, (state: unknown) => unknown> = {
  // 1 → 2: pack the plain State (a broken one throws, and migrate calls it broken)
  1: (state) => packV1(state as State & { album: boolean[] }),
  // 2 → 3: off the 1.0.0 wheel and onto the card inventory (see the schema notes above)
  2: (state) => toV3(state as PackedV2),
  // 3 → 4: the jar's and the Prize Counter's counters, from 0
  3: (state) => toV4(state as PackedV3),
};

/** Schema 3 (1.1.0): today's packed shape without the jar's and the Prize Counter's counters. */
export type PackedV3 = Omit<PackedState, "eaten" | "packCards">;

/** Schema 2 (1.0.0): schema 3's packed shape with the album as an owned-cats bit mask. */
export type PackedV2 = Omit<PackedV3, "cards" | "seen"> & { album: number };

/** Schema 1's plain 1.0.0 State packed as schema 2. */
function packV1(st: State & { album: boolean[] }): PackedV2 {
  if (!isObj(st) || !Array.isArray(st.album)) throw new Error("not a schema-1 state");
  const { cards: _c, seen: _s, eaten: _e, packCards: _p, ...rest } = pack({ ...st, cards: [], seen: [], eaten: 0, packCards: 0 });
  return { ...rest, album: st.album.reduce((m, owned, i) => (owned === true ? m | (1 << i) : m), 0) };
}

/**
 * A 1.0.0 machine moved onto 1.1.0. Its prize slot index meant a slot of the old
 * 24-slot wheel, so a spin still running is dropped: unpaid, it goes back into
 * the stock to be spun again on the new wheel (when a lamp is free); paid, it is
 * already on the counters. Coins on their way up land on LAND_X like any 1.1.0
 * shot. The album's owned cats become one card each in the inventory, and seen.
 * Everything else carries over unchanged.
 */
export function toV3(p: PackedV2): PackedV3 {
  if (!isObj(p) || !Array.isArray(p.flights) || !isInt(p.album, 0, 2 ** CARD_COUNT - 1)) throw new Error("not a schema-2 state");
  const { album, ...rest } = p;
  const refund = p.prize && !p.prize.paid ? 1 : 0;
  return {
    ...rest,
    prize: null,
    stock: Math.min(PRIZE_QUEUE_MAX, (Number.isInteger(p.stock) ? p.stock : 0) + refund),
    flights: p.flights.map((f) => (Array.isArray(f) && f[2] === 0 ? ([f[0], f[1], f[2], f[3], LAND_X, f[5], f[6]] as PackedFlight) : f)),
    cards: Array.from({ length: CARD_COUNT }, (_, i) => ((album & (1 << i)) !== 0 ? 1 : 0)),
    seen: album,
  };
}

/**
 * A 1.1.0 machine moved onto 1.2.0: the jar has kept nothing and no card was
 * bought yet. Card exchanges in 1.1.0 paid at once (tickets or coins), so there
 * is nothing waiting to convert; the inventory carries over as it is.
 */
export function toV4(p: PackedV3): PackedState {
  if (!isObj(p) || !Array.isArray(p.cards)) throw new Error("not a schema-3 state");
  return { ...p, eaten: 0, packCards: 0 };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown, lo: number, hi: number): x is number => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const isNum = (x: unknown, lo: number, hi: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;

/** A count that only ever grows. */
const COUNT = 1e12;
/** Bodies and flights a real shelf never comes near (MAX_BODIES is 170, and only coins merge). */
const MAX_SAVED_BODIES = 400;
const MAX_SAVED_FLIGHTS = 300;

function validBody(b: unknown) {
  if (!Array.isArray(b) || b.length !== 8) return false;
  const [id, k, x, y, vx, vy, stack, tag] = b as unknown[];
  if (!isInt(id, 0, COUNT) || !isInt(k, 0, 2)) return false;
  if (!isNum(x, -200, SHELF_W + 200) || !isNum(y, -200, SHELF_D + 400) || !isNum(vx, -5000, 5000) || !isNum(vy, -5000, 5000)) return false;
  if (k === 0) return isInt(stack, 1, MAX_STACK) && tag === -1;
  return stack === 1 && (k === 1 ? isInt(tag, 0, CORE_COUNT - 1) : isInt(tag, 0, CARD_COUNT - 1));
}

function validFlight(f: unknown) {
  if (!Array.isArray(f) || f.length !== 7) return false;
  const [id, t, phase, x, aim, k, tag] = f as unknown[];
  if (!isInt(id, 0, COUNT) || !isNum(t, -60, 60) || !isInt(phase, 0, 1) || !isInt(k, 0, 2)) return false;
  if (!isNum(x, -200, SHELF_W + 200) || !isNum(aim, -500, 500)) return false;
  return k === 0 ? tag === -1 : k === 1 ? isInt(tag, 0, CORE_COUNT - 1) : isInt(tag, 0, CARD_COUNT - 1);
}

/** The current schema's `state`, if every field has the right type and a sane range. */
export function validState(x: unknown): x is PackedState {
  if (!isObj(x)) return false;
  for (const k of ["nextId", "lifetimeTickets", "supers", "sets", "cardsWon", "shots", "returned", "eaten", "packCards", "gateShots", "gateHits", "capsules"] as const)
    if (!isInt(x[k], 0, COUNT)) return false;
  if (!isInt(x.seed, -(2 ** 31), 2 ** 32) || !isInt(x.coins, 0, 1e9) || !isInt(x.cores, 0, 1000)) return false;
  if (!isNum(x.t, 0, 1e10) || !isNum(x.wheel, -10, 10) || !isNum(x.gate, -10, 10) || !isNum(x.pusherT, 0, PUSH_PERIOD * 10)) return false;
  if (!isNum(x.cooldown, 0, 10) || !isNum(x.quiet, 0, 1e10) || typeof x.idle !== "boolean") return false;
  if (!isInt(x.stock, 0, PRIZE_QUEUE_MAX) || !isInt(x.seen, 0, 2 ** CARD_COUNT - 1)) return false;
  // A count per cat, and a cat with cards in hand was collected
  if (!Array.isArray(x.cards) || x.cards.length !== CARD_COUNT || !x.cards.every((c) => isInt(c, 0, 1e6))) return false;
  if (!x.cards.every((c, i) => c === 0 || ((x.seen as number) & (1 << i)) !== 0)) return false;
  const pz = x.prize;
  if (pz !== null && !(isObj(pz) && isInt(pz.seg, 0, WHEEL.length - 1) && isNum(pz.t, 0, 100) && typeof pz.paid === "boolean")) return false;
  const sp = x.spin;
  if (
    sp !== null &&
    !(
      isObj(sp) &&
      (sp.kind === "mini" || sp.kind === "super") &&
      isInt(sp.idx, 0, (sp.kind === "mini" ? MINI_PRIZES : SUPER_PRIZES).length - 1) &&
      isNum(sp.t, 0, 100) &&
      typeof sp.paid === "boolean"
    )
  )
    return false;
  if (!Array.isArray(x.queue) || x.queue.length > 100 || !x.queue.every((q) => q === "mini" || q === "super")) return false;
  if (!Array.isArray(x.bodies) || x.bodies.length > MAX_SAVED_BODIES || !x.bodies.every(validBody)) return false;
  if (!Array.isArray(x.flights) || x.flights.length > MAX_SAVED_FLIGHTS || !x.flights.every(validFlight)) return false;
  // Every id was handed out before nextId
  const ids = [...x.bodies.map((b) => b[0]), ...x.flights.map((f) => f[0])];
  return ids.every((id) => id < (x.nextId as number)) && new Set(ids).size === ids.length;
}

/** Any stored save, walked up to the current schema; never throws. */
export function migrate(raw: unknown): Migrated {
  if (raw === null || raw === undefined) return { ok: false, reason: "empty" };
  if (!isObj(raw)) return { ok: false, reason: "broken" };
  // Before 1.0.0 the beta stored its run as a bare State stamped with RULES_VERSION
  if (!("schema" in raw)) return { ok: false, reason: typeof raw.v === "number" ? "legacy" : "broken" };
  let schema = raw.schema;
  if (!isInt(schema, 1, 1e6)) return { ok: false, reason: "broken" };
  if (schema > SCHEMA) return { ok: false, reason: "future" };
  let state = raw.state;
  try {
    while (schema < SCHEMA) {
      state = STEPS[schema](state);
      schema++;
    }
  } catch {
    return { ok: false, reason: "broken" };
  }
  if (!validState(state)) return { ok: false, reason: "broken" };
  return { ok: true, save: { v: typeof raw.v === "string" ? raw.v.slice(0, 32) : VERSION, schema, state } };
}

export function parseSave(raw: unknown): MachineSave | null {
  const m = migrate(raw);
  return m.ok ? m.save : null;
}

// ---------------------------------------------------------------- server rules

/**
 * Generously more than one coin can ever pay: a 100-ticket slot, a Mini spin's
 * share and a share of the Super bonus. Coins pushed off the front pay 1 each,
 * and a shelf holds a few hundred. Cards pay when exchanged, maybe long after
 * the shots that won them: each card gone from the inventory may bring up to
 * TICKETS_PER_CARD (a Ragdoll's 300; a set's 1000 is 100 a card).
 */
const TICKETS_PER_SHOT = 2000;
const TICKET_SLACK = 5000;
const TICKETS_PER_CARD = RARE_TICKETS;

/**
 * Could `next` follow `prev` (null: the first save) in real play? The machine
 * only counts up, and its tickets need shots to earn them. Coins are not
 * bounded: they arrive from the allowance and coupons, which the server grants.
 */
export function plausible(prev: MachineSave | null, next: MachineSave) {
  const n = next.state;
  if (n.gateShots > n.shots || n.gateHits > n.gateShots) return false;
  if (!prev) return n.lifetimeTickets <= n.shots * TICKETS_PER_SHOT + TICKET_SLACK;
  const p = prev.state;
  if (n.lifetimeTickets < p.lifetimeTickets || n.shots < p.shots || n.supers < p.supers || n.cardsWon < p.cardsWon) return false;
  // Cards that left the inventory (exchanged) since the last save
  const spent = n.cards.reduce((a, c, i) => a + Math.max(0, (p.cards[i] ?? 0) - c), 0);
  return n.lifetimeTickets - p.lifetimeTickets <= (n.shots - p.shots) * TICKETS_PER_SHOT + TICKET_SLACK + spent * TICKETS_PER_CARD;
}

export const rules: SaveRules = {
  parse: parseSave,
  plausible: (prev, next) => plausible(prev as MachineSave | null, next as MachineSave),
  // The board ranks every ticket this machine paid, read from the save itself
  score: (save) => (save as MachineSave).state.lifetimeTickets,
};
