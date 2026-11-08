import { nextRandom } from "@web-games/core/math";
import { botAction } from "./ai";
import { BOT_DELAY, IDLE_SECONDS } from "./config";
import { type Action, type Game, act, decider } from "./logic";

// The clock around the rules: computers think for a moment and then act,
// people get `turnSeconds` per decision online (then the computer decides
// for them), and a dropped player's seat is played by the computer. The same
// driver runs offline (game.ts) and in the online room (online.ts).

/** A random source over the game's own RNG state, so a snapshot stays plain data. */
export function gameRand(s: Game): () => number {
  return () => {
    const st = { seed: s.rng };
    const r = nextRandom(st);
    s.rng = st.seed;
    return r;
  };
}

/** The action that can't fail for whoever decides (a guard if a computer's pick is refused). */
function safeAction(s: Game): Action {
  switch (s.phase) {
    case "turn":
      return s.mustRoll ? { type: "roll" } : { type: "end" };
    case "buy":
      return { type: "decline" };
    case "auction":
      return { type: "pass" };
    case "trade":
      return { type: "reject" };
    default:
      return { type: "bankrupt" };
  }
}

/** Let the computer make `who`'s decision (as `level`); never stalls. */
export function autoDecide(s: Game, who: number, timeout: boolean) {
  const p = s.players[who];
  const a = botAction(s, who, p.bot ?? "normal", gameRand(s), timeout);
  if (!act(s, who, a)) act(s, who, safeAction(s));
}

/** Is `seat` played by the computer right now (a computer, or a person who dropped)? */
export const isAuto = (s: Game, seat: number) => {
  const p = s.players[seat];
  return !!p && (p.bot !== null || p.away);
};

/**
 * One step of `dt` seconds. `inputs[seat]` is an action from that person, or
 * null. Computers act after BOT_DELAY (and after the dice/token animation).
 */
export function stepGame(s: Game, dt: number, inputs: readonly (Action | null | undefined)[] = []) {
  if (s.phase === "over") return;
  s.elapsed += dt;
  for (let seat = 0; seat < inputs.length; seat++) {
    const a = inputs[seat];
    if (a && !isAuto(s, seat) && act(s, seat, a)) s.players[seat].idle = false;
  }
  if ((s.phase as string) === "over") return;
  s.hold = Math.max(0, s.hold - dt);
  const who = decider(s);
  if (who < 0) return;
  if (isAuto(s, who)) {
    s.botWait += dt;
    const wait = s.phase === "auction" ? BOT_DELAY * 0.6 : BOT_DELAY;
    if (s.hold <= 0 && s.botWait >= wait) autoDecide(s, who, false);
    return;
  }
  if (s.turnSeconds <= 0 || s.hold > 0) return;
  // Someone who let the clock run out once gets a short one until they act again
  if (s.players[who].idle) s.clock = Math.min(s.clock, IDLE_SECONDS);
  s.clock -= dt;
  if (s.clock <= 0) {
    s.players[who].idle = true;
    autoDecide(s, who, true);
  }
}

/** A dropped player's seat plays itself until they return. */
export function setAway(s: Game, seat: number, away: boolean) {
  const p = s.players[seat];
  if (!p || p.bot !== null) return;
  p.away = away;
}
