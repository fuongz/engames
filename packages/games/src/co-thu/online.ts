import type { RoomGame, RoomSim } from "@web-games/core/online";
import { DEFAULT_TURN, RED_CHOICES, ROOM_SETTINGS, type RedChoice, TURN_CHOICES, type TurnSeconds } from "./config";
import { SQUARES } from "./logic";
import { type Action, type MatchEvent, createMatch, matchScore, outcomeOf, setAway, snapshotOf, stepMatch } from "./match";
import { STRINGS } from "./strings";

// Cờ Thú 1-on-1 on the realtime server, run by match.ts and logic.ts. A client
// only ever says "move from→to" or "I resign"; the room checks the move is the
// player's own and legal (logic.isLegal → legalMoves) before it plays it.
// See docs/standards/online-multiplayer.md.

export const TICK_RATE = 10;

const isSquare = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < SQUARES;

/** One untrusted action list → the first well-formed action, or null. */
export function parseAction(actions: unknown[]): Action | null {
  for (const raw of actions) {
    if (typeof raw !== "object" || raw === null) continue;
    const a = raw as Record<string, unknown>;
    if (a.type === "move" && isSquare(a.from) && isSquare(a.to) && a.from !== a.to) return { type: "move", from: a.from, to: a.to };
    if (a.type === "resign") return { type: "resign" };
  }
  return null;
}

/** The host's choices (the room has already checked each is allowed). */
export const redOf = (settings: Record<string, string> | undefined): RedChoice =>
  RED_CHOICES.find((c) => c === settings?.red) ?? "host";
export const turnOf = (settings: Record<string, string> | undefined): TurnSeconds =>
  TURN_CHOICES.find((n) => String(n) === settings?.turn) ?? DEFAULT_TURN;

export const coThuOnline: RoomGame<Action> = {
  slug: "co-thu",
  mode: "versus",
  minPlayers: 2,
  maxPlayers: 2,
  tickRate: TICK_RATE,
  settings: ROOM_SETTINGS,
  parseInput: ({ actions }) => parseAction(actions),
  create(seed, seated, settings): RoomSim<Action> {
    const match = createMatch(
      seed,
      seated.map((s) => s.name),
      redOf(settings),
      turnOf(settings),
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
          const outcome = outcomeOf(match, seat);
          return {
            seat,
            score: matchScore(match, seat),
            detail: STRINGS.vi.matchDetail(outcome, s.moves, match.seats[1 - seat]?.name ?? ""),
            outcome,
          };
        });
      },
    };
  },
};
