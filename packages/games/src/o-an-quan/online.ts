import type { RoomGame, RoomSim } from "@web-games/core/online";
import { BEST_OF, type BestOf, DEFAULT_BEST_OF, PITS, ROOM_SETTINGS } from "./config";
import { type Match, type MatchEvent, type Move, createMatch, matchScore, outcomeOf, setAway, stepMatch } from "./logic";
import { STRINGS } from "./strings";

// Ô Ăn Quan 1-on-1 on the realtime server: a best-of-1/3/5 match (the host
// picks, and whether a young quan can be taken) run by logic.ts. A client
// only ever says "sow pit N this way"; the room checks it is their turn and
// their pit. See docs/standards/online-multiplayer.md.

export const TICK_RATE = 10;

/** One untrusted action list → a move, or null. */
export function parseMove(actions: unknown[]): Move | null {
  for (const raw of actions) {
    if (typeof raw !== "object" || raw === null) continue;
    const a = raw as Record<string, unknown>;
    if (a.type !== "sow" || !Number.isInteger(a.pit) || (a.dir !== 1 && a.dir !== -1)) continue;
    const pit = a.pit as number;
    if (pit >= 0 && pit < PITS) return { pit, dir: a.dir };
  }
  return null;
}

/** The host's best-of choice as a number (the room has already checked it is one of BEST_OF). */
export const bestOfOf = (settings: Record<string, string> | undefined): BestOf =>
  BEST_OF.find((n) => String(n) === settings?.bestOf) ?? DEFAULT_BEST_OF;
export const quanNonOf = (settings: Record<string, string> | undefined) => settings?.quanNon === "forbid";

/** What a client draws from: the match without its pending events. */
export const snapshotOf = (m: Match): Match => ({ ...m, events: [] });

export const oAnQuanOnline: RoomGame<Move> = {
  slug: "o-an-quan",
  mode: "versus",
  minPlayers: 2,
  maxPlayers: 2,
  tickRate: TICK_RATE,
  settings: ROOM_SETTINGS,
  parseInput: ({ actions }) => parseMove(actions),
  create(seed, seated, settings): RoomSim<Move> {
    const match = createMatch(
      seed,
      seated.map((s) => s.name),
      bestOfOf(settings),
      quanNonOf(settings),
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
