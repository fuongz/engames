import type { RoomGame, RoomSim } from "@web-games/core/online";
import { DEFAULT_PLAYERS, DEFAULT_TIME_LIMIT, MAX_PLAYERS, MIN_PLAYERS, ONLINE_SECOND, ONLINE_WIN, ROOM_SETTINGS, SQUARES, TICK_RATE, TIME_LIMITS, TURN_SECONDS } from "./config";
import { type Action, type Bundle, type Game, type GameEvent, type SeatSpec, createGame, netWorth, placings } from "./logic";
import { setAway, stepGame } from "./sim";
import { STRINGS } from "./strings";

// Cờ Tỷ Phú on the realtime server: 2–4 seats, people first, the computer
// (Normal) in the empty ones. A client only ever names a decision ("roll",
// "bid 120", "mortgage square 6"...); the room checks it against the rules in
// logic.ts and owns every đồng. See docs/standards/online-multiplayer.md.

/** Bot names for the empty seats online (same in both languages). */
export const BOT_NAMES = ["Bác Ba", "Cô Tư", "Anh Năm", "Chị Sáu"];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

function parseBundle(v: unknown): Bundle | null {
  if (!isObj(v) || !int(v.cash, 0, 1_000_000) || !int(v.cards, 0, 2) || !Array.isArray(v.sqs) || v.sqs.length > 28) return null;
  const sqs = v.sqs;
  if (!sqs.every((q) => int(q, 0, SQUARES - 1)) || new Set(sqs).size !== sqs.length) return null;
  return { cash: v.cash, sqs: sqs as number[], cards: v.cards };
}

/** One untrusted action → a well-formed Action, or null. The rules still decide if it is allowed now. */
export function parseAction(raw: unknown): Action | null {
  if (!isObj(raw)) return null;
  switch (raw.type) {
    case "roll":
    case "end":
    case "buy":
    case "decline":
    case "pass":
    case "payJail":
    case "useCard":
    case "accept":
    case "reject":
    case "bankrupt":
      return { type: raw.type };
    case "bid":
      return int(raw.amount, 1, 1_000_000) ? { type: "bid", amount: raw.amount } : null;
    case "build":
    case "sell":
    case "mortgage":
    case "unmortgage":
      return int(raw.sq, 0, SQUARES - 1) ? { type: raw.type, sq: raw.sq } : null;
    case "offer": {
      if (!int(raw.to, 0, MAX_PLAYERS - 1)) return null;
      const give = parseBundle(raw.give);
      const get = parseBundle(raw.get);
      return give && get ? { type: "offer", to: raw.to, give, get } : null;
    }
    default:
      return null;
  }
}

/** The first valid action of a tick's list (the room applies one input per seat per tick). */
export function parseActions(actions: unknown[]): Action | null {
  for (const a of actions) {
    const ok = parseAction(a);
    if (ok) return ok;
  }
  return null;
}

/** The host's choices (the room has already checked they are among the choices). */
export function settingsOf(settings: Record<string, string> | undefined, humans: number) {
  const n = Number(settings?.players ?? DEFAULT_PLAYERS);
  const players = Math.max(MIN_PLAYERS, humans, Math.min(MAX_PLAYERS, Number.isInteger(n) ? n : DEFAULT_PLAYERS));
  const t = Number(settings?.time ?? DEFAULT_TIME_LIMIT);
  const limitMin = (TIME_LIMITS as readonly number[]).includes(t) ? t : DEFAULT_TIME_LIMIT;
  return { players: Math.min(MAX_PLAYERS, players), limitMin };
}

/** Seats for an online match: the people in join order, then computers. */
export function onlineSeats(humans: string[], players: number): SeatSpec[] {
  return Array.from({ length: Math.max(players, humans.length) }, (_, i) =>
    i < humans.length ? { name: humans[i], bot: null } : { name: BOT_NAMES[i % BOT_NAMES.length], bot: "normal" as const },
  );
}

/** What a client draws from: the game without its RNG, deck order or pending events (no peeking). */
export const snapshotOf = (s: Game): Game => ({ ...s, rng: 0, decks: { chance: [], chest: [] }, events: [] });

/** Online result for one seat: placing, score and outcome. */
export function seatResult(s: Game, seat: number) {
  const order = placings(s);
  const place = order.indexOf(seat);
  const worth = netWorth(s, seat);
  const n = s.players.length;
  // A time-limit finish with the top two level on net worth is a draw for both
  const tie = s.endReason !== "last" && order.length > 1 && netWorth(s, order[0]) === netWorth(s, order[1]);
  const outcome: "win" | "loss" | "draw" = tie && place <= 1 ? "draw" : place === 0 ? "win" : "loss";
  const score = place === 0 ? ONLINE_WIN + Math.floor(worth / 10) : place === 1 && n >= 3 ? ONLINE_SECOND : 0;
  return { seat, score, detail: STRINGS.vi.onlineDetail(place + 1, n, worth), outcome };
}

export const coTyPhuOnline: RoomGame<Action> = {
  slug: "co-ty-phu",
  mode: "versus",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  tickRate: TICK_RATE,
  settings: ROOM_SETTINGS,
  parseInput: ({ actions }) => parseActions(actions),
  create(seed, seated, settings): RoomSim<Action> {
    const { players, limitMin } = settingsOf(settings, seated.length);
    const game = createGame(
      seed,
      onlineSeats(
        seated.map((s) => s.name),
        players,
      ),
      { limitMin, turnSeconds: TURN_SECONDS },
    );
    const humans = seated.length;
    let events: GameEvent[] = [];
    const drain = () => {
      events.push(...game.events);
      game.events.length = 0;
    };
    drain();
    return {
      step(inputs) {
        stepGame(game, 1 / TICK_RATE, inputs.slice(0, humans));
        drain();
      },
      setAutopilot: (seat, on) => setAway(game, seat, on),
      snapshot: () => snapshotOf(game),
      drainEvents() {
        const out = events;
        events = [];
        return out;
      },
      get over() {
        return game.phase === "over";
      },
      results: () => Array.from({ length: humans }, (_, seat) => seatResult(game, seat)),
    };
  },
};
