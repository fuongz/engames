// The match rules of Nói Là Có: seats, the writing turns, matching typed text
// to a word, the end and the scores. The world itself (the sandbank and every
// word's event) is sim.ts; bots are ai.ts. Pure: same seed and inputs, same match.
import { clamp, nextRandom } from "@web-games/core/math";
import { botInput, botWord, randomWord } from "./ai";
import {
  COUNTDOWN,
  GAP_FIRST,
  GAP_LAST,
  GAP_WORDS,
  GRID,
  MAX_HEARTS,
  SCORE_PLACE,
  SCORE_WIN,
  SCORE_WORD,
  SEATS,
  STORM_AT,
  STORM_DRAIN,
  TREE,
  WORDS,
  WORD_IDS,
  WORD_MAX,
  WRITE_TIME,
  type WordId,
} from "./config";
import { type GameEvent, IDLE, type Input, type State, groundAt, living, makeHeights, movePlayer, rnd, spawnHazard, stepHazards, stepStorm, tileLevel } from "./sim";

export type { GameEvent, Input, Player, State } from "./sim";

// ---------------------------------------------------------------- matching what was typed

/** Lower case, no accents, no spaces or punctuation: "Sóng Thần!" and "song than" are the same. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

/** Every way to type each word, normalised, in table order. */
const LEXICON: { key: string; word: WordId }[] = WORD_IDS.flatMap((word) => {
  const def = WORDS[word];
  const keys = new Set([def.name.vi, def.name.en, word, ...def.aliases].map(normalize).filter((k) => k.length > 0));
  return [...keys].map((key) => ({ key, word }));
});

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/**
 * The word a typed text means: an exact name or alias, else one that starts
 * with it, a near-miss spelling, one that sits inside it, else the closest spelling. Only empty text (or
 * text with no letters) matches nothing.
 */
export function resolveWord(text: string): WordId | null {
  const key = normalize(text.slice(0, WORD_MAX));
  if (key.length === 0) return null;
  const exact = LEXICON.find((e) => e.key === key);
  if (exact) return exact.word;
  if (key.length >= 2) {
    const starts = LEXICON.find((e) => e.key.startsWith(key));
    if (starts) return starts.word;
  }
  let best = LEXICON[0];
  let bestCost = Number.POSITIVE_INFINITY;
  for (const e of LEXICON) {
    const cost = editDistance(key, e.key) / Math.max(key.length, e.key.length);
    if (cost < bestCost) {
      bestCost = cost;
      best = e;
    }
  }
  // A near miss is a typo: "tsunamy". Past that, the longest known word inside what was typed: "con rong to" is a dragon
  if (bestCost <= 0.34) return best.word;
  let inside: { key: string; word: WordId } | null = null;
  for (const e of LEXICON) if (e.key.length >= 3 && key.includes(e.key) && (!inside || e.key.length > inside.key.length)) inside = e;
  return (inside ?? best).word;
}

// ---------------------------------------------------------------- a new match

const BOT_NAMES = ["Tèo", "Tí", "Mận", "Sửu", "Na", "Bơ", "Cam", "Ổi"];

/** The open tile nearest (x, y), searching outwards: never inside a tree. */
function spawnPoint(s: State, x: number, y: number) {
  for (let r = 0; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = Math.floor(x) + dx + 0.5;
        const py = Math.floor(y) + dy + 0.5;
        if (px > 1 && py > 1 && px < GRID - 1 && py < GRID - 1 && tileLevel(s, px, py) !== TREE) return { x: px, y: py };
      }
    }
  }
  return { x, y };
}

/** Quiet seconds before the next writer once `words` have landed. */
export const gapFor = (words: number) => GAP_FIRST + (GAP_LAST - GAP_FIRST) * clamp(words / GAP_WORDS, 0, 1);

/** A fresh match: the humans take the first seats and bots fill the rest of the eight. */
export function createGame(seed: number, humans: { name: string }[]): State {
  const s: State = {
    seed,
    seed0: seed,
    h: makeHeights(seed),
    phase: "countdown",
    countdown: COUNTDOWN,
    time: 0,
    overT: 0,
    players: [],
    hazards: [],
    nextId: 1,
    order: [],
    orderI: 0,
    turn: null,
    gap: GAP_FIRST * 0.4,
    words: 0,
    last: null,
    storm: null,
    drain: STORM_DRAIN,
    events: [],
  };
  const seated = humans.slice(0, SEATS);
  for (let seat = 0; seat < SEATS; seat++) {
    const a = (seat / SEATS) * Math.PI * 2;
    const human = seated[seat];
    const at = spawnPoint(s, GRID / 2 + Math.cos(a) * 4.5, GRID / 2 + Math.sin(a) * 4.5);
    s.players.push({
      seat,
      name: human?.name ?? BOT_NAMES[seat % BOT_NAMES.length],
      bot: !human,
      auto: false,
      x: at.x,
      y: at.y,
      z: groundAt(s, at.x, at.y),
      vz: 0,
      grounded: true,
      vx: 0,
      vy: 0,
      kx: 0,
      ky: 0,
      face: 0,
      hearts: MAX_HEARTS,
      alive: true,
      outAt: null,
      inv: 0,
      stun: 0,
      dashT: 0,
      dashCd: 0,
      still: 0,
      asleep: false,
      survived: 0,
      skill: 0.35 + rnd(s) * 0.6,
      think: rnd(s) * 0.3,
      bx: 0,
      by: 0,
      wx: GRID / 2,
      wy: GRID / 2,
    });
  }
  // Writing order: every seat once, shuffled, then round again
  s.order = s.players.map((p) => p.seat);
  for (let i = s.order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(s) * (i + 1));
    [s.order[i], s.order[j]] = [s.order[j], s.order[i]];
  }
  return s;
}

// ---------------------------------------------------------------- one step

function land(s: State, word: WordId, by: number, auto: boolean) {
  spawnHazard(s, word, by);
  s.words += 1;
  for (const p of living(s)) p.survived += 1;
  s.last = { word, by, at: s.time };
  s.turn = null;
  s.gap = gapFor(s.words);
  s.events.push({ type: "word", word, by, auto });
}

function stepTurn(s: State, inputs: readonly (Input | null)[], dt: number) {
  if (!s.turn) {
    s.gap -= dt;
    if (s.gap > 0) return;
    const writer = s.order[s.orderI % s.order.length];
    s.orderI += 1;
    s.turn = { writer, left: WRITE_TIME, botAt: WRITE_TIME - 1.2 - rnd(s) * 2.6 };
    s.events.push({ type: "writer", seat: writer });
    return;
  }
  const turn = s.turn;
  const p = s.players[turn.writer];
  turn.left -= dt;
  if (p.bot || p.auto) {
    if (turn.left <= turn.botAt) land(s, botWord(s, p), p.seat, false);
    return;
  }
  const typed = inputs[p.seat]?.word;
  const word = typed ? resolveWord(typed) : null;
  if (word) land(s, word, p.seat, false);
  else if (turn.left <= 0) land(s, randomWord(s), p.seat, true);
}

/**
 * Advance the match by `dt` with one input (or none) per seat. Returns the
 * events of this step, for sound and effects.
 */
export function step(s: State, inputs: readonly (Input | null)[], dt: number): GameEvent[] {
  if (s.phase === "over") {
    s.overT += dt;
    return [];
  }
  if (s.phase === "countdown") {
    s.countdown -= dt;
    if (s.countdown <= 0) {
      s.phase = "play";
      s.events.push({ type: "go" });
    }
  } else s.time += dt;

  for (const p of s.players) {
    if (!p.alive) continue;
    movePlayer(s, p, p.bot || p.auto ? botInput(s, p, dt) : (inputs[p.seat] ?? IDLE), dt);
  }
  if (s.phase === "play") {
    stepTurn(s, inputs, dt);
    stepHazards(s, dt);
    if (!s.storm && s.time >= STORM_AT) {
      s.storm = { id: 0, word: "sam-set", by: -1, t: 0, dur: 1e6, salt: 0, a: 0, b: 0, ents: [] };
      s.events.push({ type: "storm" });
    }
    stepStorm(s, dt);
    if (living(s).length <= 1) {
      s.phase = "over";
      s.turn = null;
      s.events.push({ type: "end" });
    }
  }
  const out = s.events;
  s.events = [];
  return out;
}

// ---------------------------------------------------------------- places and scores

/** 1 for the last one standing; players who fell in the same step share a place. Final once you are out. */
export function placeOf(s: State, seat: number): number {
  const me = s.players[seat];
  if (!me || me.alive) return 1;
  const at = me.outAt ?? 0;
  return 1 + s.players.filter((p) => p.alive || (p.outAt ?? 0) > at).length;
}

export function scoreOf(s: State, seat: number): number {
  const p = s.players[seat];
  if (!p) return 0;
  const place = placeOf(s, seat);
  return p.survived * SCORE_WORD + (SEATS - place) * SCORE_PLACE + (s.phase === "over" && p.alive ? SCORE_WIN : 0);
}

/** How the match went for a seat: the survivor wins; if the last ones fell together, they draw. */
export function outcomeOf(s: State, seat: number): "win" | "loss" | "draw" {
  const p = s.players[seat];
  if (p?.alive) return "win";
  return placeOf(s, seat) === 1 ? "draw" : "loss";
}

// ---------------------------------------------------------------- snapshots (online)

/** What the room sends: the whole state without the tile heights, which a client rebuilds from the seed. */
export type Snapshot = Omit<State, "h" | "events">;

export function snapshotOf(s: State): Snapshot {
  const { h: _h, events: _events, ...rest } = s;
  return rest;
}

const heightCache = new Map<number, number[]>();

/** A drawable state from a snapshot. */
export function fromSnapshot(snap: Snapshot): State {
  let h = heightCache.get(snap.seed0);
  if (!h) {
    h = makeHeights(snap.seed0);
    heightCache.clear();
    heightCache.set(snap.seed0, h);
  }
  return { ...snap, h, events: [] };
}

/** Four words to offer the writer as quick picks: two that hurt, one twist, one that helps. */
export function suggestions(seed: number): WordId[] {
  const r = { seed };
  const take = (kind: "harm" | "help" | "twist", n: number) => {
    const pool = WORD_IDS.filter((w) => WORDS[w].kind === kind);
    const out: WordId[] = [];
    while (out.length < n && pool.length > 0) out.push(...pool.splice(Math.floor(nextRandom(r) * pool.length), 1));
    return out;
  };
  return [...take("harm", 2), ...take("twist", 1), ...take("help", 1)];
}

/** Best score kept in storage, tolerant of whatever is there. */
export const parseBest = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
