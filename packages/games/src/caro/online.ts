import type { RoomGame, RoomSim } from "@web-games/core/online";
import { BEST_OF, type BestOf, CELLS, DEFAULT_BEST_OF, ROOM_SETTINGS } from "./config";
import { type Match, type MatchEvent, createMatch, matchScore, outcomeOf, setAway, stepMatch } from "./logic";
import { STRINGS } from "./strings";

// Caro 1-on-1 on the realtime server: a best-of-1/3/5 match (the host picks) run by logic.ts. A
// client only ever says "I play square N"; the room checks it is their turn
// and the square is empty. See docs/standards/online-multiplayer.md.

export const TICK_RATE = 10;

/** One untrusted action list → the square to play, or null. */
export function parsePlace(actions: unknown[]): number | null {
  for (const raw of actions) {
    if (typeof raw !== "object" || raw === null) continue;
    const a = raw as Record<string, unknown>;
    if (a.type === "place" && Number.isInteger(a.at) && (a.at as number) >= 0 && (a.at as number) < CELLS) return a.at as number;
  }
  return null;
}

/** The host's best-of choice as a number (the room has already checked it is one of BEST_OF). */
export const bestOfOf = (settings: Record<string, string> | undefined): BestOf =>
  BEST_OF.find((n) => String(n) === settings?.bestOf) ?? DEFAULT_BEST_OF;

/** What a client draws from: the match without its pending events. */
export const snapshotOf = (m: Match): Match => ({ ...m, events: [] });

export const caroOnline: RoomGame<number> = {
  slug: "caro",
  mode: "versus",
  minPlayers: 2,
  maxPlayers: 2,
  tickRate: TICK_RATE,
  settings: ROOM_SETTINGS,
  parseInput: ({ actions }) => parsePlace(actions),
  create(seed, seated, settings): RoomSim<number> {
    const match = createMatch(
      seed,
      seated.map((s) => s.name),
      bestOfOf(settings),
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
        // Stored on the board as text: in the default language
        return match.seats.map((s, seat) => {
          const them = match.seats[1 - seat];
          return {
            seat,
            score: matchScore(match, seat),
            detail: STRINGS.vi.matchDetail(match.winner === seat, s.wins, them?.wins ?? 0, them?.name ?? ""),
            outcome: outcomeOf(match, seat),
          };
        });
      },
    };
  },
};
