// The computer players of Nói Là Có. One brain for every word: a bot looks at
// how dangerous the ground is a little way off in each direction (sim.dangerAt)
// and walks towards the least bad, with enough noise to make mistakes. Pure;
// it draws its randomness from the state's own seed.
import { GRID, JUMP_H, SPEED, STEP_UP, WORDS, WORD_IDS, type WordId } from "./config";
import { type Input, type Player, type State, active, dangerAt, groundAt, medkitNear, rnd } from "./sim";

const DIRS = 12;
const inside = (v: number) => Math.min(Math.max(v, 0.4), GRID - 0.4);

/** What a bot (or a dropped player's seat) does this step. */
export function botInput(s: State, p: Player, dt: number): Input {
  p.think -= dt;
  if (p.think > 0) return { mx: p.bx, my: p.by, dash: false, jump: needsJump(s, p, p.bx, p.by), word: null };
  const dark = active(s, "toi") !== undefined;
  // Now and then a bot's mind wanders and it just keeps doing what it was doing
  if (rnd(s) < (1 - p.skill) * (dark ? 0.2 : 0.1)) {
    p.think = 0.5 + rnd(s) * 0.8;
    return { mx: p.bx, my: p.by, dash: false, jump: false, word: null };
  }
  p.think = 0.12 + rnd(s) * 0.2 + (dark ? 0.15 : 0);
  /** Seconds before this bot notices something new falling on it. */
  const lag = (0.2 + (1 - p.skill) * 0.55) * (dark ? 1.6 : 1);

  // Somewhere to stroll to when nothing is happening: medicine first, else a fresh spot now and then
  const medkit = medkitNear(s, p);
  if (medkit) {
    p.wx = medkit.x;
    p.wy = medkit.y;
  } else if (rnd(s) < 0.08 || Math.hypot(p.wx - p.x, p.wy - p.y) < 0.6) {
    p.wx = 2 + rnd(s) * (GRID - 4);
    p.wy = 2 + rnd(s) * (GRID - 4);
  }

  const noise = (0.25 + (1 - p.skill) * 0.9) * (dark ? 2.5 : 1);
  const here = dangerAt(s, p.x, p.y, lag);
  const sleepy = active(s, "ngu") !== undefined;
  // Standing still: fine when it is quiet and the stroll is done
  let best = here * 1.6 + (sleepy ? 1.2 : 0) + (Math.hypot(p.wx - p.x, p.wy - p.y) > 1 ? 0.25 : 0) + rnd(s) * noise;
  let bx = 0;
  let by = 0;
  for (let i = 0; i < DIRS; i++) {
    const a = (i / DIRS) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const x0 = inside(p.x + dx * SPEED * 0.15);
    const y0 = inside(p.y + dy * SPEED * 0.15);
    const x1 = inside(p.x + dx * SPEED * 0.35);
    const y1 = inside(p.y + dy * SPEED * 0.35);
    const x2 = inside(p.x + dx * SPEED * 0.8);
    const y2 = inside(p.y + dy * SPEED * 0.8);
    let cost = dangerAt(s, x0, y0, lag) * 1.2 + dangerAt(s, x1, y1, lag) + dangerAt(s, x2, y2, lag) * 0.4;
    // Too high to jump (a tree, a hilltop from the shore) is a wall
    if (groundAt(s, x0, y0) > p.z + JUMP_H * 0.9) cost += 6;
    cost += Math.hypot(p.wx - x1, p.wy - y1) * 0.05;
    // Keep going the way it was going rather than dithering
    if (dx * p.bx + dy * p.by > 0.7) cost -= 0.1;
    cost += rnd(s) * noise;
    if (cost < best) {
      best = cost;
      bx = dx;
      by = dy;
    }
  }
  // Under the reverse word a sharper bot pushes the stick the other way
  const flip = active(s, "nguoc") && rnd(s) < 0.45 + p.skill * 0.5 ? -1 : 1;
  p.bx = bx * flip;
  p.by = by * flip;
  const dash = here >= 2 && p.dashCd <= 0 && (bx !== 0 || by !== 0) && rnd(s) < p.skill;
  // Up a step that needs it, or over trouble underfoot (lava, a charging buffalo)
  const jump = needsJump(s, p, p.bx, p.by) || (here >= 2 && p.grounded && rnd(s) < p.skill * 0.5);
  return { mx: p.bx, my: p.by, dash, jump, word: null };
}

/** The ground just ahead is a step too high to walk up. */
function needsJump(s: State, p: Player, dx: number, dy: number) {
  if (!p.grounded || (dx === 0 && dy === 0)) return false;
  const ahead = groundAt(s, inside(p.x + dx * 0.55), inside(p.y + dy * 0.55));
  return ahead > p.z + STEP_UP && ahead <= p.z + JUMP_H;
}

const pick = (s: State, kind: "harm" | "help" | "twist"): WordId => {
  const pool = WORD_IDS.filter((w) => WORDS[w].kind === kind);
  return pool[Math.floor(rnd(s) * pool.length)];
};

/** The word a bot writes: trouble mostly, help when it is hurt and still alive. */
export function botWord(s: State, p: Player): WordId {
  if (p.alive && p.hearts <= 1 && rnd(s) < 0.6) return pick(s, "help");
  const roll = rnd(s);
  if (roll < (p.alive ? 0.6 : 0.8)) return pick(s, "harm");
  return roll < 0.92 ? pick(s, "twist") : pick(s, "help");
}

/** A word drawn by the room when the writer runs out of time. */
export const randomWord = (s: State): WordId => WORD_IDS[Math.floor(rnd(s) * WORD_IDS.length)];
