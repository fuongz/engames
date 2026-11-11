import type { SaveRules } from "../saves";
import {
  CARD_COUNT,
  CARD_R,
  COIN_R,
  CORE_COUNT,
  CORE_R,
  MAX_STACK,
  MINI_PRIZES,
  PRIZE_QUEUE_MAX,
  PUSH_PERIOD,
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

export const SCHEMA = 2;

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
  /** Bit i set: card i is owned. */
  album: number;
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
    album: s.album.reduce((m, owned, i) => (owned ? m | (1 << i) : m), 0),
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
    album: Array.from({ length: CARD_COUNT }, (_, i) => (p.album & (1 << i)) !== 0),
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
  1: (state) => pack(state as State),
};

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
  for (const k of ["nextId", "lifetimeTickets", "supers", "sets", "cardsWon", "shots", "returned", "gateShots", "gateHits", "capsules"] as const)
    if (!isInt(x[k], 0, COUNT)) return false;
  if (!isInt(x.seed, -(2 ** 31), 2 ** 32) || !isInt(x.coins, 0, 1e9) || !isInt(x.cores, 0, 1000)) return false;
  if (!isNum(x.t, 0, 1e10) || !isNum(x.wheel, -10, 10) || !isNum(x.gate, -10, 10) || !isNum(x.pusherT, 0, PUSH_PERIOD * 10)) return false;
  if (!isNum(x.cooldown, 0, 10) || !isNum(x.quiet, 0, 1e10) || typeof x.idle !== "boolean") return false;
  if (!isInt(x.stock, 0, PRIZE_QUEUE_MAX) || !isInt(x.album, 0, 2 ** CARD_COUNT - 1)) return false;
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
 * share, a card and a share of the set and Super bonuses. Coins pushed off the
 * front pay 1 each, and a shelf holds a few hundred.
 */
const TICKETS_PER_SHOT = 2000;
const TICKET_SLACK = 5000;

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
  return n.lifetimeTickets - p.lifetimeTickets <= (n.shots - p.shots) * TICKETS_PER_SHOT + TICKET_SLACK;
}

export const rules: SaveRules = {
  parse: parseSave,
  plausible: (prev, next) => plausible(prev as MachineSave | null, next as MachineSave),
  // The board ranks every ticket this machine paid, read from the save itself
  score: (save) => (save as MachineSave).state.lifetimeTickets,
};
