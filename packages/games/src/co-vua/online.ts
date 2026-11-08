import type { RoomGame, RoomSim } from "@web-games/core/online";
import { type Action, type Match, type MatchEvent, PROMOS, type Promo, createMatch, matchScore, outcomeOf, setAway, stepMatch } from "./logic";
import { STRINGS } from "./strings";

// Cờ Vua 1-on-1 on the realtime server, run by logic.ts. Seat 0 plays White.
// A client only ever says "move from→to", "resign", "offer a draw", or
// "accept/decline the draw"; the room checks every move is legal and the
// player's own. There is no clock: a player away for 60 s forfeits.
// See docs/standards/online-multiplayer.md.

export const TICK_RATE = 10;

const isSquare = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 64;

/** One untrusted action list → the first well-formed action, or null. */
export function parseAction(actions: unknown[]): Action | null {
  for (const raw of actions) {
    if (typeof raw !== "object" || raw === null) continue;
    const a = raw as Record<string, unknown>;
    switch (a.type) {
      case "move": {
        if (!isSquare(a.from) || !isSquare(a.to) || a.from === a.to) continue;
        if (a.promo === undefined) return { type: "move", from: a.from, to: a.to };
        if (!PROMOS.includes(a.promo as Promo)) continue;
        return { type: "move", from: a.from, to: a.to, promo: a.promo as Promo };
      }
      case "resign":
      case "draw":
      case "accept":
      case "decline":
        return { type: a.type };
    }
  }
  return null;
}

/** What a client draws from: the match without its pending events, raw moves or repetition keys. */
export const snapshotOf = (m: Match): Match => ({ ...m, events: [], game: { ...m.game, history: [], keys: [] } });

export const coVuaOnline: RoomGame<Action> = {
  slug: "co-vua",
  mode: "versus",
  minPlayers: 2,
  maxPlayers: 2,
  tickRate: TICK_RATE,
  parseInput: ({ actions }) => parseAction(actions),
  create(_seed, seated): RoomSim<Action> {
    const match = createMatch(seated.map((s) => s.name));
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
        return match.seats.map((_, seat) => {
          const outcome = outcomeOf(match, seat);
          return {
            seat,
            score: matchScore(match, seat),
            detail: STRINGS.vi.matchDetail(outcome, match.reason ?? "resign", match.seats[1 - seat]?.name ?? ""),
            outcome,
          };
        });
      },
    };
  },
};
