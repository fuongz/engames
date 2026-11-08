import { CPU, type Difficulty, moveSpec } from "./config";
import { BTN, type Fighter, type GameState, type Input, moveStage, random } from "./logic";

// The computer opponent: reads the fight and returns the buttons it holds this
// frame, like a player would. Pure and deterministic — its randomness lives in
// `brain.seed` — so a CPU fight replays exactly (logic.test.ts relies on it).

export interface Brain {
  seed: number;
  difficulty: Difficulty;
  /** Buttons held for the rest of the plan, and the button pressed on its first frame. */
  plan: { hold: Input; press: Input; frames: number; age: number } | null;
  /** Frame when a threat was first seen (reaction delay counts from here). */
  threatAt: number | null;
  /** Decided to block the current threat. */
  guarding: boolean;
  clock: number;
}

export const createBrain = (difficulty: Difficulty, seed: number): Brain => ({
  seed,
  difficulty,
  plan: null,
  threatAt: null,
  guarding: false,
  clock: 0,
});

const roll = (b: Brain) => random(b);

/** Direction bits toward (+1) or away from (-1) the opponent. */
const toward = (me: Fighter, dir: 1 | -1) => ((me.facing * dir === 1 ? BTN.R : BTN.L) as Input);

function plan(b: Brain, hold: Input, press: Input, frames: number) {
  b.plan = { hold, press, frames, age: 0 };
}

/** Is the opponent doing something that will hurt soon? */
function threat(s: GameState, me: Fighter, them: Fighter) {
  const dist = Math.abs(them.x - me.x);
  if (them.state === "attack") {
    const stage = moveStage(them);
    const m = moveSpec(them.char, them.move ?? "jab");
    const reach = m.box.x + m.box.w + (m.dash ? m.dash * (m.startup + m.active) : 0) + 30;
    if (stage !== "recovery" && dist < reach) return m.height;
  }
  for (const p of s.projectiles)
    if (p.owner === them.side && Math.sign(me.x - p.x) === Math.sign(p.vx) && Math.abs(me.x - p.x) < 260) return "mid" as const;
  if (them.state === "jump" && dist < 170) return "overhead" as const;
  return null;
}

export function cpuInput(s: GameState, side: 0 | 1, b: Brain): Input {
  b.clock++;
  const me = s.fighters[side];
  const them = s.fighters[1 - side] as Fighter;
  const skill = CPU[b.difficulty];

  // The finisher: only a confident CPU goes for it
  if (s.phase === "finish" && s.matchWinner === side) {
    if (b.difficulty < 2 || s.phaseFrame < 30) return 0;
    const t = s.phaseFrame - 30;
    return t === 0 || t === 6 ? BTN.D : t === 12 ? BTN.B : 0;
  }
  if (s.phase !== "fight") {
    b.plan = null;
    return 0;
  }

  const free = me.state === "idle" || me.state === "walk" || me.state === "crouch";
  const dist = Math.abs(them.x - me.x);

  // Combo: a connected normal goes into a special
  if (me.state === "attack" && me.moveHit && !moveSpec(me.char, me.move ?? "jab").special) {
    if (roll(b) < skill.combo * 0.25) return BTN.S;
  }

  // React to threats after the reaction delay
  const danger = threat(s, me, them);
  if (danger) {
    if (b.threatAt === null) {
      b.threatAt = b.clock;
      b.guarding = roll(b) < skill.block;
    }
    if (b.clock - b.threatAt >= skill.reaction && free) {
      if (danger === "overhead" && them.state === "jump" && roll(b) < skill.antiAir / 6) {
        b.plan = null;
        return toward(me, 1) | BTN.S; // anti-air rising special
      }
      if (b.guarding) {
        b.plan = null;
        return toward(me, -1) | (danger === "low" ? BTN.D : 0);
      }
    }
  } else {
    b.threatAt = null;
  }

  // Follow the current plan
  if (b.plan) {
    const p = b.plan;
    const out = p.hold | (p.age === 0 ? p.press : 0);
    p.age++;
    if (p.age >= p.frames) b.plan = null;
    return out;
  }
  if (!free) return 0;

  // Beast form as soon as it is ready; frenzy up close
  if (me.beast >= 100 && me.beastLeft === 0 && roll(b) < 0.5) return BTN.B;
  if (me.beastLeft > 0 && dist < 150 && roll(b) < skill.special * 0.4) return BTN.B;

  // Punish a whiffed move in recovery
  if (them.state === "attack" && moveStage(them) === "recovery" && dist < 120 && roll(b) < skill.combo) {
    plan(b, 0, roll(b) < 0.5 ? BTN.K : BTN.S, 1);
    return 0;
  }

  const r = roll(b);
  if (dist > 230) {
    // Out of range: approach, sometimes a projectile or a jump in
    if (me.char === "soi" && r < skill.special) plan(b, 0, BTN.S, 1);
    else if (r < 0.06) plan(b, toward(me, 1) | BTN.U, 0, 2);
    else plan(b, toward(me, 1), 0, 10 + Math.floor(roll(b) * 14));
  } else if (dist > 110) {
    if (r < skill.special) plan(b, 0, BTN.S, 1);
    else if (r < skill.special + 0.08) plan(b, toward(me, 1) | BTN.U, 0, 2);
    else if (r < 0.75) plan(b, toward(me, 1), 0, 8 + Math.floor(roll(b) * 10));
    else plan(b, toward(me, -1), 0, 8);
  } else {
    // Close: pick a normal, sometimes back off
    if (r < 0.28) plan(b, 0, BTN.P, 1);
    else if (r < 0.5) plan(b, 0, BTN.K, 1);
    else if (r < 0.62) plan(b, BTN.D, BTN.P, 4);
    else if (r < 0.74) plan(b, BTN.D, BTN.K, 4);
    else if (r < 0.74 + skill.special) plan(b, toward(me, -1), BTN.S, 1);
    else plan(b, toward(me, -1), 0, 10);
  }
  return 0;
}
