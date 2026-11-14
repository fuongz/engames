import type { RoomGame, RoomSim } from "@web-games/core/online";
import { DEFAULT_SKIN, RACE_MAX, RACE_MIN, RACE_TICK_RATE, SKINS, isSkinId } from "./config";
import { type Dir, type RaceEvent, type RaceInput, createRace, raceOutcome, raceSnapshot, raceStandings, score, stepRace } from "./logic";

const DIRS: readonly Dir[] = ["up", "down", "left", "right"];
const isDir = (v: unknown): v is Dir => typeof v === "string" && (DIRS as readonly string[]).includes(v);
const actionOf = (a: unknown): Record<string, unknown> | null => (a !== null && typeof a === "object" ? (a as Record<string, unknown>) : null);

/**
 * Qua Đường online: a 2–4 duck race on one shared world. Clients send hops (and
 * their skin once, in the countdown); the room runs logic.ts for every duck.
 * The furthest row wins when everyone is out or the clock runs down.
 */
export const quaDuongOnline: RoomGame<RaceInput> = {
  slug: "qua-duong",
  mode: "versus",
  minPlayers: RACE_MIN,
  maxPlayers: RACE_MAX,
  tickRate: RACE_TICK_RATE,
  parseInput({ actions }, context) {
    let dir: Dir | null = null;
    let skin: RaceInput["skin"] = null;
    for (const raw of actions.slice(0, 4)) {
      const a = actionOf(raw);
      if (!a) continue;
      if (a.type === "hop" && dir === null && isDir(a.dir)) dir = a.dir;
      else if (a.type === "skin" && skin === null && isSkinId(a.id)) {
        // A paid skin counts only when the signed join ticket says it is owned
        const free = SKINS.find((s) => s.id === a.id)?.price === 0;
        skin = free || context?.cosmetics.includes(a.id) ? a.id : DEFAULT_SKIN;
      }
    }
    return dir === null && skin === null ? null : { dir, skin };
  },
  create(seed, humans): RoomSim<RaceInput> {
    const race = createRace(
      seed,
      humans.map((h) => h.name),
    );
    let events: RaceEvent[] = [];
    return {
      step(inputs) {
        events.push(...stepRace(race, inputs, 1 / RACE_TICK_RATE));
      },
      // A dropped duck stands still; the ward officer takes it like anyone else.
      setAutopilot() {},
      snapshot: () => raceSnapshot(race),
      drainEvents() {
        const out = events;
        events = [];
        return out;
      },
      get over() {
        return race.phase === "over";
      },
      results() {
        const order = raceStandings(race);
        return race.racers.map((r, seat) => ({
          seat,
          score: score(r.duck),
          detail: `#${order.indexOf(seat) + 1}/${race.racers.length}, ${r.duck.coins}🪙`,
          outcome: raceOutcome(race, seat),
        }));
      },
    };
  },
};
