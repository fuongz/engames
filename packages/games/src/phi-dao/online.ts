import type { RoomGame, RoomSim } from "@web-games/core/online";
import { isKnifeSkin } from "./config";
import { createRun, type Event, type ThrowInput, step } from "./logic";

export const phiDaoOnline: RoomGame<ThrowInput> = {
  slug: "phi-dao",
  mode: "coop",
  minPlayers: 1,
  maxPlayers: 2,
  tickRate: 30,
  parseInput({ actions }, context) {
    const action = actions.find(
      (a) =>
        a !== null &&
        typeof a === "object" &&
        "type" in a &&
        a.type === "throw",
    );
    if (!action || typeof action !== "object") return null;
    const skin = "skin" in action ? action.skin : "classic";
    if (!isKnifeSkin(skin)) return null;
    return {
      skin:
        skin === "dragon" && !context?.cosmetics.includes("dragon")
          ? "classic"
          : skin,
    };
  },
  create(seed, humans): RoomSim<ThrowInput> {
    const s = createRun(seed, humans.length);
    let events: Event[] = [];
    return {
      step(inputs) {
        events.push(...step(s, 1 / 30, inputs));
      },
      // A disconnected seat stops throwing; its partner can finish the shared target.
      setAutopilot() {},
      snapshot: () => structuredClone(s),
      drainEvents() {
        const out = events;
        events = [];
        return out;
      },
      get over() {
        return s.phase === "over";
      },
      results: () =>
        humans.map((_, seat) => ({
          seat,
          score: s.score,
          detail: `${s.stage}/15 · ${s.hits[seat]}`,
          outcome: s.won ? "win" : "loss",
        })),
    };
  },
};
