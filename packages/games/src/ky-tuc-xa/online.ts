import type { RoomGame, RoomSim } from "../online/room-game";
import { BUILDS, type BuildKind, COLS, ROWS } from "./config";
import { type Action, type GameEvent, type GameState, type Inputs, type SeatInput, createGame, humans, scoreOf, update } from "./logic";
import { STRINGS } from "./strings";

// Night Dorm co-op on the realtime server: the same logic.ts as solo, with up
// to six human seats. See docs/standards/online-multiplayer.md §7.

export const TICK_RATE = 20;
const MAX_ACTIONS = 4;
const TILES = COLS * ROWS;

const clampAxis = (v: number) => Math.max(-1, Math.min(1, v));
const isTile = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < TILES;
const isKind = (v: unknown): v is BuildKind => typeof v === "string" && Object.hasOwn(BUILDS, v);

/** One untrusted action → a valid Action, or null. */
export function parseAction(raw: unknown): Action | null {
  if (typeof raw !== "object" || raw === null) return null;
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case "sleep":
    case "upgradeBed":
    case "upgradeDoor":
    case "repair":
      return { type: a.type };
    case "upgradeTurret":
      return isTile(a.tile) ? { type: "upgradeTurret", tile: a.tile } : null;
    case "build":
      return isTile(a.tile) && isKind(a.kind) ? { type: "build", tile: a.tile, kind: a.kind } : null;
    default:
      return null;
  }
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * What a client draws from: the whole state, with walking paths cut to their
 * next point (only "is it walking" is rendered) and events sent separately.
 */
export function snapshotOf(s: GameState): GameState {
  return {
    ...s,
    events: [],
    occupants: s.occupants.map((o) => ({ ...o, path: o.path.slice(0, 1) })),
    hunter: s.hunter && { ...s.hunter, path: s.hunter.path.slice(0, 1) },
  };
}

export const kyTucXaOnline: RoomGame<SeatInput> = {
  slug: "ky-tuc-xa",
  minPlayers: 1,
  maxPlayers: 6,
  tickRate: TICK_RATE,
  parseInput({ move, actions }) {
    return {
      move: { x: clampAxis(move.x), y: clampAxis(move.y) },
      actions: actions
        .slice(0, MAX_ACTIONS)
        .map(parseAction)
        .filter((a): a is Action => a !== null),
    };
  },
  create(seed, seated): RoomSim<SeatInput> {
    const state = createGame(seed, seated);
    let events: GameEvent[] = [];
    return {
      step(inputs) {
        const keyed: Inputs = {};
        inputs.forEach((input, seat) => {
          keyed[seat] = input;
        });
        update(state, 1 / TICK_RATE, keyed);
        events.push(...state.events);
        state.events.length = 0;
      },
      setAutopilot(seat, on) {
        const o = state.occupants[seat];
        if (o && !o.bot) o.autopilot = on;
      },
      snapshot: () => snapshotOf(state),
      drainEvents() {
        const out = events;
        events = [];
        return out;
      },
      get over() {
        return state.phase === "over";
      },
      results() {
        // Stored on the board as text: in the default language
        const detail = STRINGS.vi.detail(state.result?.won ?? false, fmtTime(state.nightTime), state.hunter?.level ?? 1);
        return humans(state).map((o) => ({ seat: o.id, score: scoreOf(state, o.id), detail }));
      },
    };
  },
};
