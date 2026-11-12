import {
  COLLISION_ANGLE,
  COOLDOWN,
  FLIGHT_TIME,
  MAX_STAGE,
  RUN_SECONDS,
  type KnifeSkin,
} from "./config";

export type ThrowInput = boolean | { skin: KnifeSkin };

export interface Knife {
  skin?: KnifeSkin;
  angle: number;
  seat: number;
}
export interface Flight {
  skin: KnifeSkin;
  seat: number;
  time: number;
}
export type Event = {
  type: "throw" | "hit" | "miss" | "clear" | "over";
  seat: number;
  skin?: KnifeSkin;
  /** Local angle on the target, valid across subsequent rotation/snapshots. */
  angle?: number;
  stage?: number;
};
export interface Run {
  seed: number;
  players: number;
  stage: number;
  angle: number;
  elapsed: number;
  lives: number;
  score: number;
  hits: number[];
  remaining: number;
  knives: Knife[];
  flights: Flight[];
  cooldowns: number[];
  transition: number;
  phase: "play" | "over";
  won: boolean;
}
const TAU = Math.PI * 2;
export const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
export const distance = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export const speed = (s: Run) =>
  (s.stage % 2 ? 1 : -1) *
  (1.25 +
    s.stage * 0.14 +
    Math.sin(s.elapsed * ((s.stage % 3) + 1) + (s.seed % 19)) *
      Math.min(0.75, s.stage * 0.07));
export function createRun(seed: number, players = 1): Run {
  const s: Run = {
    seed,
    players: Math.max(1, Math.min(2, players)),
    stage: 1,
    angle: 0,
    elapsed: 0,
    lives: 3,
    score: 0,
    hits: [0, 0],
    remaining: 0,
    knives: [],
    flights: [],
    cooldowns: [0, 0],
    transition: 0,
    phase: "play",
    won: false,
  };
  prepare(s);
  return s;
}
function prepare(s: Run) {
  s.remaining = 5 + Math.min(7, Math.floor(s.stage / 2));
  s.angle = wrap(s.seed * 0.17 + s.stage);
  s.knives = Array.from(
    { length: Math.min(5, Math.floor(s.stage / 3)) },
    (_, i) => ({ angle: wrap(i * 1.33 + s.stage * 0.71), seat: -1 }),
  );
  s.flights = [];
}
export function step(
  s: Run,
  dt: number,
  inputs: (ThrowInput | null)[] = [],
): Event[] {
  const events: Event[] = [];
  if (s.phase === "over") return events;
  s.elapsed += dt;
  s.angle = wrap(s.angle + speed(s) * dt);
  s.cooldowns = s.cooldowns.map((t) => Math.max(0, t - dt));
  if (s.elapsed >= RUN_SECONDS) {
    s.phase = "over";
    return [{ type: "over", seat: -1 }];
  }
  if (s.transition > 0) {
    s.transition -= dt;
    if (s.transition <= 0) {
      s.stage++;
      prepare(s);
    }
    return events;
  }
  for (let seat = 0; seat < s.players; seat++) {
    if (
      inputs[seat] &&
      s.cooldowns[seat] === 0 &&
      s.remaining > s.flights.length
    ) {
      const input = inputs[seat];
      const skin = typeof input === "object" && input ? input.skin : "classic";
      s.flights.push({ seat, time: 0, skin });
      events.push({ type: "throw", seat, skin, stage: s.stage });
      s.cooldowns[seat] = COOLDOWN;
    }
  }
  for (const f of s.flights) {
    f.time += dt;
    if (f.time < FLIGHT_TIME) continue;
    const angle = wrap(Math.PI / 2 - s.angle);
    if (s.knives.some((k) => distance(k.angle, angle) < COLLISION_ANGLE)) {
      s.lives--;
      events.push({
        type: "miss",
        seat: f.seat,
        skin: f.skin,
        angle,
        stage: s.stage,
      });
      if (s.lives <= 0) {
        s.phase = "over";
        break;
      }
    } else {
      s.knives.push({ angle, seat: f.seat, skin: f.skin });
      s.remaining--;
      s.hits[f.seat]++;
      s.score += 10;
      events.push({
        type: "hit",
        seat: f.seat,
        skin: f.skin,
        angle,
        stage: s.stage,
      });
    }
  }
  s.flights = s.flights.filter((f) => f.time < FLIGHT_TIME);
  if (s.remaining === 0 && s.phase === "play") {
    s.score += s.stage % 5 === 0 ? 150 : 50;
    events.push({ type: "clear", seat: -1 });
    if (s.stage === MAX_STAGE) {
      s.won = true;
      s.phase = "over";
    } else s.transition = 0.85;
  }
  if (s.phase === "over") events.push({ type: "over", seat: -1 });
  return events;
}
