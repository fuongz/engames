import type { RoomGame, RoomSim } from "@web-games/core/online";
import { MIN_PLAYERS, SEATS, TICK_RATE, WORD_MAX } from "./config";
import { type GameEvent, type Input, createGame, outcomeOf, placeOf, scoreOf, snapshotOf, step } from "./logic";
import { STRINGS } from "./strings";

// Nói Là Có on the realtime server: the same logic.ts as solo, with 2–8 human
// seats and bots in the rest. A client only ever sends where its stick points,
// "dash", "jump", and the text it typed; the room decides whose turn it is to write and
// which word the text means. See docs/standards/online-multiplayer.md.

const axis = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);

export const noiLaCoOnline: RoomGame<Input> = {
  slug: "noi-la-co",
  mode: "versus",
  minPlayers: MIN_PLAYERS,
  maxPlayers: SEATS,
  tickRate: TICK_RATE,
  parseInput({ move, actions }) {
    const input: Input = { mx: axis(move?.x), my: axis(move?.y), dash: false, jump: false, word: null };
    for (const raw of actions.slice(0, 4)) {
      if (typeof raw !== "object" || raw === null) continue;
      const a = raw as Record<string, unknown>;
      if (a.type === "dash") input.dash = true;
      else if (a.type === "jump") input.jump = true;
      else if (a.type === "word" && input.word === null && typeof a.text === "string") {
        // Too long is not a word at all: nothing a client sends is ever cut to fit
        const text = a.text.trim();
        if (text.length > 0 && text.length <= WORD_MAX) input.word = text;
      }
    }
    return input.mx === 0 && input.my === 0 && !input.dash && !input.jump && input.word === null ? null : input;
  },
  create(seed, humans): RoomSim<Input> {
    const state = createGame(seed, humans);
    let events: GameEvent[] = [];
    return {
      step(inputs) {
        events.push(...step(state, inputs, 1 / TICK_RATE));
      },
      // A dropped player's seat is played by the bot brain until they come back
      setAutopilot(seat, on) {
        const p = state.players[seat];
        if (p && !p.bot) p.auto = on;
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
        return state.players
          .filter((p) => !p.bot)
          .map((p) => ({
            seat: p.seat,
            score: scoreOf(state, p.seat),
            // Stored on the board as text: in the default language
            detail: STRINGS.vi.detail(placeOf(state, p.seat), p.survived),
            outcome: outcomeOf(state, p.seat),
          }));
      },
    };
  },
};
