import type { RoomGame, RoomSim } from "@web-games/core/online";
import { DEFAULT_PLAYERS, PLAYER_COUNTS, ROOM_SETTINGS, TOKENS, TURN_SECONDS } from "./config";
import { type Input, type Match, type MatchEvent, createMatch, placeScore, setAway, stepMatch } from "./logic";
import { STRINGS } from "./strings";

// Ludo on the realtime server: 2–4 people at a table of the host's size, the
// computer (Normal) in the empty seats and in any seat whose player dropped.
// A client only ever says "roll" or "move horse N"; the room checks
// it is their turn and the move is legal. See docs/standards/online-multiplayer.md.

export const TICK_RATE = 10;

/** One untrusted action list → a roll, or the horse to move, or null. */
export function parseAction(actions: unknown[]): Input | null {
  for (const raw of actions) {
    if (typeof raw !== "object" || raw === null) continue;
    const a = raw as Record<string, unknown>;
    if (a.type === "roll") return { kind: "roll" };
    if (a.type === "move" && Number.isInteger(a.token) && (a.token as number) >= 0 && (a.token as number) < TOKENS)
      return { kind: "move", token: a.token as number };
  }
  return null;
}

/** The host's table size as a number (the room has already checked it is one of PLAYER_COUNTS). */
export const playersOf = (settings: Record<string, string> | undefined): number =>
  PLAYER_COUNTS.find((n) => String(n) === settings?.players) ?? DEFAULT_PLAYERS;

/** The match a room starts with these people and settings (the client builds the same one). */
export const roomMatch = (seed: number, names: string[], settings: Record<string, string> | undefined) =>
  createMatch(seed, { humans: names, total: playersOf(settings), level: "normal", turnSeconds: TURN_SECONDS });

/** What a client draws from: the match without its pending events. */
export const snapshotOf = (m: Match): Match => ({ ...m, events: [] });

export const coCaNguaOnline: RoomGame<Input> = {
  slug: "co-ca-ngua",
  mode: "versus",
  minPlayers: 2,
  maxPlayers: 4,
  tickRate: TICK_RATE,
  settings: ROOM_SETTINGS,
  parseInput: ({ actions }) => parseAction(actions),
  create(seed, seated, settings): RoomSim<Input> {
    const match = roomMatch(
      seed,
      seated.map((s) => s.name),
      settings,
    );
    let events: MatchEvent[] = [];
    return {
      step(inputs) {
        stepMatch(match, 1 / TICK_RATE, inputs);
        events.push(...match.events);
        match.events.length = 0;
      },
      setAutopilot: (seat, on) => setAway(match, seat, on),
      snapshot: () => snapshotOf(match),
      drainEvents() {
        const out = events;
        events = [];
        return out;
      },
      get over() {
        return match.phase === "over";
      },
      results() {
        const n = match.players.length;
        // Stored on the board as text: in the default language
        return match.players
          .filter((p) => p.seat !== null)
          .map((p) => {
            const place = p.place ?? n;
            return {
              seat: p.seat as number,
              score: placeScore(place, n),
              detail: STRINGS.vi.placeDetail(place, n),
              outcome: place === 1 ? ("win" as const) : ("loss" as const),
            };
          })
          .sort((a, b) => a.seat - b.seat);
      },
    };
  },
};
