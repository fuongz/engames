import { nextRandom } from "@web-games/core/math";
import {
  BEAST_DAMAGE,
  BEAST_DURATION,
  BEAST_GAIN_DEAL,
  BEAST_GAIN_TAKE,
  BEAST_MAX,
  BEAST_REGEN,
  BEAST_SPEED,
  BLOCKSTOP,
  BUFFER_FRAMES,
  CHIP,
  COMBO_SCALING,
  FINISH_FRAMES,
  FINISH_WINDOW,
  FLOOR_Y,
  type FighterId,
  GETUP_FRAMES,
  GRAVITY,
  HITSTOP,
  HURT,
  type Height,
  INPUT_HISTORY,
  INTRO_FRAMES,
  KNOCKDOWN_FRAMES,
  MAX_ROUNDS,
  MIN_SCALING,
  MOTION_WINDOW,
  type MoveId,
  type MoveSpec,
  OUTRO_FRAMES,
  PUSH_HALF,
  ROUND_FRAMES,
  ROUNDS_TO_WIN,
  SCORE,
  STATS,
  TRANSFORM_FRAMES,
  WALL_L,
  WALL_R,
  moveSpec,
} from "./config";

// Pure, deterministic fight simulation: one call to `update` is one 60 Hz
// frame, inputs are bitmasks, and the state is plain JSON. Same inputs → same
// fight, which is what rollback netcode will need. No DOM.

/** Input bits. Directions are screen directions; moves read them relative to facing. */
export const BTN = { L: 1, R: 2, U: 4, D: 8, P: 16, K: 32, S: 64, B: 128 } as const;
export type Input = number;

export type FighterState =
  | "idle"
  | "walk"
  | "crouch"
  | "jump"
  | "attack"
  | "hitstun"
  | "blockstun"
  | "juggle"
  | "knockdown"
  | "getup"
  | "transform"
  | "ko"
  | "dizzy"
  | "win";

export interface Fighter {
  side: 0 | 1;
  char: FighterId;
  x: number;
  /** Feet; FLOOR_Y on the ground. */
  y: number;
  vx: number;
  vy: number;
  /** Knockback that decays on its own. */
  push: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  /** 0..BEAST_MAX; full means the beast can be called. */
  beast: number;
  /** Frames of beast form left (0 = human). */
  beastLeft: number;
  state: FighterState;
  /** Frames spent in the current state. */
  frame: number;
  /** Frames left of hitstun / blockstun / knockdown. */
  stun: number;
  move: MoveId | null;
  /** The current move already connected (hit or blocked). */
  moveHit: boolean;
  armorUsed: boolean;
  /** An air move was used during this jump. */
  airUsed: boolean;
  invuln: number;
  /** Hits taken in the current combo (for scaling and the counter). */
  combo: number;
  history: Input[];
  prev: Input;
  /** Frames since each of Punch, Kick, Special, Beast was pressed (99 = not recently). */
  buffer: [number, number, number, number];
  wins: number;
}

export interface Projectile {
  owner: 0 | 1;
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  damage: number;
  frame: number;
}

export type Phase = "intro" | "fight" | "ko" | "finish" | "finisher" | "over";

export type GameEvent =
  | { type: "round"; n: number }
  | { type: "fight" }
  | { type: "hit"; side: 0 | 1; x: number; y: number; damage: number; heavy: boolean; combo: number }
  | { type: "block"; side: 0 | 1; x: number; y: number }
  | { type: "special"; side: 0 | 1; move: MoveId }
  | { type: "projectile"; side: 0 | 1 }
  | { type: "armor"; side: 0 | 1 }
  | { type: "transform"; side: 0 | 1 }
  | { type: "revert"; side: 0 | 1 }
  | { type: "jump"; side: 0 | 1 }
  | { type: "land"; side: 0 | 1; hard: boolean }
  | { type: "ko"; side: 0 | 1; timeUp: boolean }
  | { type: "finishPrompt"; side: 0 | 1 }
  | { type: "finisher"; side: 0 | 1 }
  | { type: "roundWin"; side: 0 | 1 | null; perfect: boolean }
  | { type: "matchWin"; side: 0 | 1 };

export interface SideStats {
  damage: number;
  rounds: number;
  perfects: number;
  timeBonus: number;
  finisher: boolean;
}

export interface GameState {
  phase: Phase;
  /** Frames in the current phase. */
  phaseFrame: number;
  round: number;
  /** Frames left in the round. */
  timer: number;
  /** Frozen frames after an impact (both fighters stop). */
  hitstop: number;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  /** Winner of the round being wrapped up (null = draw). */
  roundWinner: 0 | 1 | null;
  matchWinner: 0 | 1 | null;
  stats: [SideStats, SideStats];
  events: GameEvent[];
  seed: number;
}

// ---------------------------------------------------------------- setup

function fighter(side: 0 | 1, char: FighterId): Fighter {
  const hp = STATS[char].hp;
  return {
    side,
    char,
    x: side === 0 ? 300 : 660,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    push: 0,
    facing: side === 0 ? 1 : -1,
    hp,
    maxHp: hp,
    beast: 0,
    beastLeft: 0,
    state: "idle",
    frame: 0,
    stun: 0,
    move: null,
    moveHit: false,
    armorUsed: false,
    airUsed: false,
    invuln: 0,
    combo: 0,
    history: [],
    prev: 0,
    buffer: [99, 99, 99, 99],
    wins: 0,
  };
}

const emptyStats = (): SideStats => ({ damage: 0, rounds: 0, perfects: 0, timeBonus: 0, finisher: false });

export function createGame(p1: FighterId, p2: FighterId, seed = 1): GameState {
  return {
    phase: "intro",
    phaseFrame: 0,
    round: 1,
    timer: ROUND_FRAMES,
    hitstop: 0,
    fighters: [fighter(0, p1), fighter(1, p2)],
    projectiles: [],
    roundWinner: null,
    matchWinner: null,
    stats: [emptyStats(), emptyStats()],
    events: [{ type: "round", n: 1 }],
    seed,
  };
}

/** Back to the start positions for the next round; wins and beast meter carry over. */
function resetRound(s: GameState) {
  for (const f of s.fighters) {
    const fresh = fighter(f.side, f.char);
    Object.assign(f, { ...fresh, wins: f.wins, beast: f.beast });
  }
  s.projectiles = [];
  s.timer = ROUND_FRAMES;
  s.hitstop = 0;
  s.roundWinner = null;
  s.round++;
  s.phase = "intro";
  s.phaseFrame = 0;
  s.events.push({ type: "round", n: s.round });
}

// ---------------------------------------------------------------- input helpers

const has = (i: Input, b: number) => (i & b) !== 0;

const BUFFERED = [BTN.P, BTN.K, BTN.S, BTN.B] as const;

/** Buttons pressed within the buffer window and not yet used. */
const buffered = (f: Fighter): Input => BUFFERED.reduce((bits, b, i) => (f.buffer[i] <= BUFFER_FRAMES ? bits | b : bits), 0);

/** A move came out: the presses that asked for it are spent. */
const consume = (f: Fighter) => {
  f.buffer = [99, 99, 99, 99];
};

/** Record this frame's new presses; runs every frame, hitstop included, so no press is lost. */
function bufferInput(f: Fighter, input: Input) {
  const fresh = input & ~f.prev;
  BUFFERED.forEach((b, i) => {
    f.buffer[i] = has(fresh, b) ? 0 : Math.min(99, f.buffer[i] + 1);
  });
  f.prev = input;
}

/** Numpad direction relative to facing: 6 = toward the opponent, 4 = away, 2 = down, 5 = neutral. */
export function dirOf(i: Input, facing: 1 | -1) {
  const fwd = facing === 1 ? BTN.R : BTN.L;
  const back = facing === 1 ? BTN.L : BTN.R;
  const h = has(i, fwd) && !has(i, back) ? 1 : has(i, back) && !has(i, fwd) ? -1 : 0;
  const v = has(i, BTN.D) ? -1 : has(i, BTN.U) ? 1 : 0;
  return 5 + h + v * 3;
}

/**
 * Was `sequence` (numpad groups, in order) entered within the last
 * MOTION_WINDOW frames? Each group lists acceptable directions, so 3 counts as
 * both "down" and "forward" the way fighting-game players expect.
 */
export function motion(history: Input[], facing: 1 | -1, sequence: number[][]) {
  let want = sequence.length - 1;
  const start = Math.max(0, history.length - MOTION_WINDOW);
  for (let i = history.length - 1; i >= start && want >= 0; i--) {
    if (sequence[want].includes(dirOf(history[i], facing))) want--;
  }
  return want < 0;
}

const QCF = [[2, 1, 3], [3, 6]]; // ↓ ↘ →
const DP = [[6], [2, 3], [3, 6]]; // → ↓ ↘
const QCB = [[2, 3, 1], [1, 4]]; // ↓ ↙ ←

/** Two separate presses of ↓ in the recent past (the finisher input). */
export function doubleDown(history: Input[]) {
  let presses = 0;
  for (let i = Math.max(1, history.length - 24); i < history.length; i++)
    if (has(history[i], BTN.D) && !has(history[i - 1], BTN.D)) presses++;
  return presses >= 2;
}

// ---------------------------------------------------------------- geometry

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const grounded = (f: Fighter) => f.y >= FLOOR_Y;

export function hurtbox(f: Fighter): Box {
  const lastInput = f.history[f.history.length - 1] ?? 0;
  const crouched =
    f.state === "crouch" ||
    (f.state === "attack" && (f.move === "lowJab" || f.move === "sweep" || (f.move === "third" && moveSpec(f.char, f.move).height === "low"))) ||
    ((f.state === "blockstun" || f.state === "hitstun") && has(lastInput, BTN.D));
  const base = !grounded(f) ? HURT.air : crouched ? HURT.crouch : HURT.stand;
  return { x: f.x + base.x, y: f.y + base.y, w: base.w, h: base.h };
}

export function hitbox(f: Fighter, spec: MoveSpec): Box {
  const b = spec.box;
  const x = f.facing === 1 ? f.x + b.x : f.x - b.x - b.w;
  return { x, y: f.y + b.y, w: b.w, h: b.h };
}

export const spec = (f: Fighter) => (f.move ? moveSpec(f.char, f.move) : null);

/** Where an attack is in its timeline. */
export function moveStage(f: Fighter): "startup" | "active" | "recovery" | null {
  const m = spec(f);
  if (!m || f.state !== "attack") return null;
  if (f.frame < m.startup) return "startup";
  if (f.frame < m.startup + m.active) return "active";
  return "recovery";
}

// ---------------------------------------------------------------- frame

/** One 60 Hz frame. `inputs[side]` is that side's held buttons this frame. */
export function update(s: GameState, inputs: [Input, Input]) {
  if (s.phase === "over") return;
  for (const f of s.fighters) {
    f.history.push(inputs[f.side]);
    if (f.history.length > INPUT_HISTORY) f.history.shift();
    bufferInput(f, inputs[f.side]);
  }
  if (s.hitstop > 0) {
    s.hitstop--;
    return;
  }
  s.phaseFrame++;

  switch (s.phase) {
    case "intro":
      for (const f of s.fighters) idleIn(f, inputs[f.side]);
      if (s.phaseFrame >= INTRO_FRAMES) {
        s.phase = "fight";
        s.phaseFrame = 0;
        s.events.push({ type: "fight" });
      }
      break;
    case "fight":
      s.timer--;
      fightFrame(s, inputs);
      if (s.phase === "fight" && s.timer <= 0) timeUp(s);
      break;
    case "ko":
      // Slow motion: the world moves every other frame
      if (s.phaseFrame % 2 === 0) fightFrame(s, [0, 0], true);
      if (s.phaseFrame >= OUTRO_FRAMES) nextRound(s);
      break;
    case "finish": {
      const w = s.matchWinner === null ? null : s.fighters[s.matchWinner];
      if (w) {
        if (has(buffered(w), BTN.B) && doubleDown(w.history)) {
          consume(w);
          s.phase = "finisher";
          s.phaseFrame = 0;
          w.state = "transform";
          w.frame = 0;
          s.stats[w.side].finisher = true;
          s.events.push({ type: "finisher", side: w.side });
        }
      }
      for (const f of s.fighters) f.frame++;
      if (s.phase === "finish" && s.phaseFrame >= FINISH_WINDOW) endMatch(s, false);
      break;
    }
    case "finisher":
      for (const f of s.fighters) f.frame++;
      if (s.phaseFrame >= FINISH_FRAMES) endMatch(s, true);
      break;
  }
}

/** During the intro: stand facing each other, no control. */
function idleIn(f: Fighter, _input: Input) {
  f.frame++;
}

function fightFrame(s: GameState, inputs: [Input, Input], frozenInput = false) {
  const [a, b] = s.fighters;
  for (const f of s.fighters) {
    const other = s.fighters[1 - f.side] as Fighter;
    stepFighter(s, f, other, frozenInput ? 0 : inputs[f.side]);
  }
  separate(a, b);
  for (const f of s.fighters) checkHit(s, f, s.fighters[1 - f.side] as Fighter);
  stepProjectiles(s);
}

// ---------------------------------------------------------------- fighters

const speedOf = (f: Fighter) => (f.beastLeft > 0 ? BEAST_SPEED : 1);

function setState(f: Fighter, state: FighterState) {
  f.state = state;
  f.frame = 0;
}

function startMove(s: GameState, f: Fighter, move: MoveId) {
  const m = moveSpec(f.char, move);
  f.move = move;
  f.moveHit = false;
  f.armorUsed = false;
  consume(f);
  setState(f, "attack");
  if (m.invuln) f.invuln = m.invuln;
  if (m.rise && grounded(f)) {
    f.vy = m.rise;
    f.y = FLOOR_Y - 1;
  }
  if (!m.air) f.vx = 0;
  if (m.special) s.events.push({ type: "special", side: f.side, move });
}

/** A special the input asks for this frame, if any (motion inputs or the Special button). */
function specialFor(f: Fighter, input: Input): MoveId | null {
  const pressed = buffered(f);
  if (has(pressed, BTN.B) && f.beastLeft > 0) return "frenzy";
  if (has(pressed, BTN.S)) {
    const d = dirOf(input, f.facing);
    return d === 6 || d === 3 || d === 9 ? "rising" : d === 4 || d === 1 || d === 7 ? "third" : "rush";
  }
  if (has(pressed, BTN.P)) {
    if (motion(f.history, f.facing, DP)) return "rising";
    if (motion(f.history, f.facing, QCF)) return "rush";
  }
  if (has(pressed, BTN.K) && motion(f.history, f.facing, QCB)) return "third";
  return null;
}

function stepFighter(s: GameState, f: Fighter, other: Fighter, input: Input) {
  f.frame++;
  if (f.invuln > 0) f.invuln--;

  // Beast form runs down on its own; health regrows while it lasts
  if (f.beastLeft > 0) {
    f.beastLeft--;
    f.beast = (BEAST_MAX * f.beastLeft) / BEAST_DURATION;
    if (f.state !== "ko" && f.state !== "dizzy") f.hp = Math.min(f.maxHp, f.hp + BEAST_REGEN);
    if (f.beastLeft === 0) s.events.push({ type: "revert", side: f.side });
  }

  const pressed = buffered(f);
  const neutralStates: FighterState[] = ["idle", "walk", "crouch"];

  switch (f.state) {
    case "hitstun":
    case "blockstun":
      if (--f.stun <= 0) setState(f, has(input, BTN.D) ? "crouch" : "idle");
      break;
    case "knockdown":
      if (--f.stun <= 0) {
        setState(f, "getup");
        f.invuln = GETUP_FRAMES + 4;
      }
      break;
    case "getup":
      if (f.frame >= GETUP_FRAMES) setState(f, "idle");
      break;
    case "transform":
      if (f.frame >= TRANSFORM_FRAMES) setState(f, "idle");
      break;
    case "attack": {
      const m = moveSpec(f.char, f.move as MoveId);
      // A connected normal cancels into a special, and a light one chains into another normal
      if (m.cancel && f.moveHit && !m.special) {
        const sp = specialFor(f, input);
        if (sp) {
          startMove(s, f, sp);
          break;
        }
        const light = f.move === "jab" || f.move === "lowJab";
        if (light && f.frame >= m.startup + 1 && (has(pressed, BTN.P) || has(pressed, BTN.K))) {
          const down = has(input, BTN.D);
          startMove(s, f, has(pressed, BTN.K) ? (down ? "sweep" : "kick") : down ? "lowJab" : "jab");
          break;
        }
      }
      if (m.dash && f.frame < m.startup + m.active) f.vx = f.facing * m.dash * speedOf(f);
      else if (!m.air && grounded(f)) f.vx = 0;
      if (m.projectile && f.frame === m.startup) {
        const p = m.projectile;
        s.projectiles.push({ owner: f.side, x: f.x + f.facing * 40, y: f.y - 82, vx: f.facing * p.speed, w: p.w, h: p.h, damage: p.damage * STATS[f.char].power * (f.beastLeft > 0 ? BEAST_DAMAGE : 1), frame: 0 });
        s.events.push({ type: "projectile", side: f.side });
      }
      const done = m.air ? false : f.frame >= m.startup + m.active + m.recovery;
      if (done && grounded(f)) setState(f, "idle");
      break;
    }
    case "jump":
      if (!f.airUsed && (has(pressed, BTN.P) || has(pressed, BTN.K))) {
        const keepVx = f.vx;
        startMove(s, f, has(pressed, BTN.K) ? "airKick" : "airPunch");
        f.vx = keepVx;
        f.airUsed = true;
      }
      break;
    default:
      if (neutralStates.includes(f.state)) neutral(s, f, other, input, pressed);
  }

  physics(s, f);
  if (f.push !== 0) {
    f.x += f.push;
    f.push *= 0.8;
    if (Math.abs(f.push) < 0.2) f.push = 0;
  }
  f.x = Math.min(WALL_R, Math.max(WALL_L, f.x));
  if (f.combo > 0 && (f.state === "idle" || f.state === "walk" || f.state === "crouch" || f.state === "attack" || f.state === "jump")) f.combo = 0;
}

function neutral(s: GameState, f: Fighter, other: Fighter, input: Input, pressed: Input) {
  // Always face the opponent while free
  f.facing = other.x >= f.x ? 1 : -1;
  if (has(pressed, BTN.B) && f.beastLeft === 0 && f.beast >= BEAST_MAX) {
    consume(f);
    setState(f, "transform");
    f.beastLeft = BEAST_DURATION;
    f.invuln = TRANSFORM_FRAMES;
    f.vx = 0;
    other.push += f.facing * 9; // the roar pushes them away
    s.events.push({ type: "transform", side: f.side });
    return;
  }
  const sp = specialFor(f, input);
  if (sp) return startMove(s, f, sp);
  const down = has(input, BTN.D);
  if (has(pressed, BTN.P)) return startMove(s, f, down ? "lowJab" : "jab");
  if (has(pressed, BTN.K)) return startMove(s, f, down ? "sweep" : "kick");
  const d = dirOf(input, f.facing);
  if (has(input, BTN.U)) {
    const st = STATS[f.char];
    setState(f, "jump");
    f.airUsed = false;
    f.vy = st.jumpVy;
    f.y = FLOOR_Y - 1;
    f.vx = (d === 9 ? 1 : d === 7 ? -1 : 0) * f.facing * st.jumpVx * speedOf(f);
    s.events.push({ type: "jump", side: f.side });
    return;
  }
  if (down) {
    if (f.state !== "crouch") setState(f, "crouch");
    f.vx = 0;
    return;
  }
  const h = d === 6 ? 1 : d === 4 ? -1 : 0;
  if (h !== 0) {
    if (f.state !== "walk") setState(f, "walk");
    // Walking back is a little slower, as in most fighters
    f.vx = h * f.facing * STATS[f.char].walk * speedOf(f) * (h < 0 ? 0.8 : 1);
  } else {
    if (f.state !== "idle") setState(f, "idle");
    f.vx = 0;
  }
}

function physics(s: GameState, f: Fighter) {
  if (grounded(f) && f.vy >= 0) {
    f.x += f.vx;
    return;
  }
  f.x += f.vx;
  f.vy += GRAVITY;
  f.y += f.vy;
  if (f.y >= FLOOR_Y) {
    f.y = FLOOR_Y;
    f.vy = 0;
    f.vx = 0;
    if (f.state === "juggle" || f.state === "ko") {
      if (f.state === "juggle") {
        setState(f, "knockdown");
        f.stun = KNOCKDOWN_FRAMES;
      }
      s.events.push({ type: "land", side: f.side, hard: true });
    } else if (f.state === "jump" || (f.state === "attack" && moveSpec(f.char, f.move as MoveId).air)) {
      setState(f, "idle");
      f.move = null;
      s.events.push({ type: "land", side: f.side, hard: false });
    } else if (f.state === "attack") {
      // A rising special lands and still owes its recovery (a whiffed one is punishable)
      s.events.push({ type: "land", side: f.side, hard: false });
    }
  }
}

/** Fighters never overlap: push both apart, the one at a wall stays put. */
function separate(a: Fighter, b: Fighter) {
  const dx = b.x - a.x;
  const gap = PUSH_HALF * 2 - Math.abs(dx);
  const sameHeight = Math.abs(a.y - b.y) < 90;
  if (gap <= 0 || !sameHeight) return;
  const dir = dx === 0 ? (a.facing === 1 ? 1 : -1) : Math.sign(dx);
  a.x -= (dir * gap) / 2;
  b.x += (dir * gap) / 2;
  for (const f of [a, b]) f.x = Math.min(WALL_R, Math.max(WALL_L, f.x));
  // Pinned at a wall: the other one takes the whole push
  const still = PUSH_HALF * 2 - Math.abs(b.x - a.x);
  if (still > 0) {
    if (a.x <= WALL_L || a.x >= WALL_R) b.x += dir * still;
    else a.x -= dir * still;
  }
}

// ---------------------------------------------------------------- hits

function checkHit(s: GameState, att: Fighter, def: Fighter) {
  if (att.state !== "attack" || att.moveHit || s.phase !== "fight") return;
  const m = moveSpec(att.char, att.move as MoveId);
  if (moveStage(att) !== "active" || m.projectile) return;
  if (def.invuln > 0 || def.state === "knockdown" || def.state === "getup" || def.state === "ko") return;
  if (!overlap(hitbox(att, m), hurtbox(def))) return;
  att.moveHit = true;
  resolveHit(s, att, def, m, m.damage * STATS[att.char].power * (att.beastLeft > 0 ? BEAST_DAMAGE : 1), att.facing);
}

function stepProjectiles(s: GameState) {
  const live: Projectile[] = [];
  for (const p of s.projectiles) {
    p.x += p.vx;
    p.frame++;
    const def = s.fighters[1 - p.owner] as Fighter;
    const att = s.fighters[p.owner];
    const box = { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
    if (def.invuln === 0 && def.state !== "knockdown" && def.state !== "ko" && overlap(box, hurtbox(def)) && s.phase === "fight") {
      const m: MoveSpec = { startup: 0, active: 1, recovery: 0, damage: p.damage, hitstun: 22, blockstun: 14, box: { x: 0, y: 0, w: 0, h: 0 }, height: "mid", push: 6, knockdown: false, special: true };
      resolveHit(s, att, def, m, p.damage, p.vx > 0 ? 1 : -1);
      continue;
    }
    if (p.x > WALL_L - 80 && p.x < WALL_R + 80 && p.frame < 240) live.push(p);
  }
  // Two projectiles that meet cancel out
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++)
      if (live[i].owner !== live[j].owner && Math.abs(live[i].x - live[j].x) < (live[i].w + live[j].w) / 2) {
        live[i].frame = 999;
        live[j].frame = 999;
      }
  s.projectiles = live.filter((p) => p.frame < 999);
}

/** Holding away from the attacker, free to act, on the ground; crouching blocks low, standing blocks overhead. */
function blocks(def: Fighter, attackerFacing: 1 | -1, height: Height) {
  if (!grounded(def)) return false;
  if (def.state !== "idle" && def.state !== "walk" && def.state !== "crouch" && def.state !== "blockstun") return false;
  const input = def.history[def.history.length - 1] ?? 0;
  const away = attackerFacing === 1 ? BTN.R : BTN.L;
  if (!has(input, away)) return false;
  const crouching = has(input, BTN.D);
  if (height === "low") return crouching;
  if (height === "overhead") return !crouching;
  return true;
}

function resolveHit(s: GameState, att: Fighter, def: Fighter, m: MoveSpec, raw: number, dir: 1 | -1) {
  const cx = def.x - dir * 6;
  const cy = def.y - 80;

  // Bear's armour soaks one hit and keeps going
  if (def.state === "attack" && !def.armorUsed && moveSpec(def.char, def.move as MoveId).armor && moveStage(def) !== "recovery") {
    def.armorUsed = true;
    const taken = raw * 0.5;
    def.hp = Math.max(1, def.hp - taken);
    s.stats[att.side].damage += taken;
    s.hitstop = BLOCKSTOP;
    s.events.push({ type: "armor", side: def.side });
    return;
  }

  if (blocks(def, dir, m.height)) {
    const chip = m.special ? raw * CHIP : 0;
    def.hp = Math.max(1, def.hp - chip);
    s.stats[att.side].damage += chip;
    setState(def, "blockstun");
    def.stun = m.blockstun;
    def.push = dir * m.push * 0.9;
    if (def.x <= WALL_L + 2 || def.x >= WALL_R - 2) att.push = -dir * m.push * 0.7;
    s.hitstop = BLOCKSTOP;
    s.events.push({ type: "block", side: def.side, x: cx, y: cy });
    return;
  }

  const scale = Math.max(MIN_SCALING, COMBO_SCALING ** def.combo);
  const damage = Math.min(def.hp, raw * scale);
  def.hp -= damage;
  def.combo++;
  s.stats[att.side].damage += damage;
  if (att.beastLeft === 0) att.beast = Math.min(BEAST_MAX, att.beast + damage * BEAST_GAIN_DEAL);
  if (def.beastLeft === 0) def.beast = Math.min(BEAST_MAX, def.beast + damage * BEAST_GAIN_TAKE);
  else def.beastLeft = Math.max(1, def.beastLeft - Math.round(damage * 0.6));

  const airborne = !grounded(def) || def.state === "juggle";
  if (m.launch || airborne || m.knockdown) {
    setState(def, "juggle");
    def.vy = m.launch ?? (airborne ? -5 : -6);
    def.vx = dir * (m.knockdown ? 3.2 : 2);
    def.y = Math.min(def.y, FLOOR_Y - 1);
  } else {
    setState(def, "hitstun");
    def.stun = m.hitstun;
    def.push = dir * m.push;
    if (def.x <= WALL_L + 2 || def.x >= WALL_R - 2) att.push = -dir * m.push * 0.8;
  }
  def.move = null;
  const heavy = damage >= 90;
  s.hitstop = HITSTOP + (heavy ? 3 : 0);
  s.events.push({ type: "hit", side: def.side, x: cx, y: cy, damage, heavy, combo: def.combo });

  if (def.hp <= 0) knockOut(s, def, false);
}

// ---------------------------------------------------------------- rounds

function knockOut(s: GameState, loser: Fighter, timeUp: boolean) {
  const winner = s.fighters[1 - loser.side] as Fighter;
  s.roundWinner = winner.side;
  winner.wins++;
  const st = s.stats[winner.side];
  st.rounds++;
  const perfect = winner.hp >= winner.maxHp;
  if (perfect) st.perfects++;
  if (!timeUp) st.timeBonus += Math.floor(s.timer / 60);
  s.events.push({ type: "ko", side: loser.side, timeUp });
  s.events.push({ type: "roundWin", side: winner.side, perfect });
  s.projectiles = [];
  s.hitstop = 18;

  if (winner.wins >= ROUNDS_TO_WIN) {
    // The deciding K.O.: the loser stays up, dazed, for the finisher window
    s.matchWinner = winner.side;
    s.phase = "finish";
    s.phaseFrame = 0;
    loser.hp = 0;
    loser.y = FLOOR_Y;
    loser.vx = 0;
    loser.vy = 0;
    setState(loser, "dizzy");
    setState(winner, "win");
    winner.y = FLOOR_Y;
    winner.vy = 0;
    winner.vx = 0;
    s.events.push({ type: "finishPrompt", side: winner.side });
    return;
  }
  s.phase = "ko";
  s.phaseFrame = 0;
  if (loser.state !== "juggle") {
    setState(loser, "juggle");
    loser.vy = -6;
    loser.vx = -loser.facing * 3;
    loser.y = Math.min(loser.y, FLOOR_Y - 1);
  }
  loser.state = "ko";
  setState(winner, "win");
}

function timeUp(s: GameState) {
  const [a, b] = s.fighters;
  const ra = a.hp / a.maxHp;
  const rb = b.hp / b.maxHp;
  if (ra === rb) {
    s.roundWinner = null;
    s.events.push({ type: "roundWin", side: null, perfect: false });
    s.phase = "ko";
    s.phaseFrame = 0;
    return;
  }
  knockOut(s, ra > rb ? b : a, true);
}

function nextRound(s: GameState) {
  if (s.round >= MAX_ROUNDS) {
    // Out of rounds: whoever has more wins (or more health) takes it
    const [a, b] = s.fighters;
    const side = a.wins !== b.wins ? (a.wins > b.wins ? 0 : 1) : a.hp >= b.hp ? 0 : 1;
    s.matchWinner = side;
    endMatch(s, false);
    return;
  }
  resetRound(s);
}

function endMatch(s: GameState, finisher: boolean) {
  if (s.phase === "over") return;
  const w = s.matchWinner;
  s.phase = "over";
  s.phaseFrame = 0;
  if (w !== null) {
    s.events.push({ type: "matchWin", side: w });
    const loser = s.fighters[1 - w] as Fighter;
    if (!finisher) setState(loser, "ko");
  }
}

// ---------------------------------------------------------------- score

/** A side's score for this fight. */
export function scoreOf(s: GameState, side: 0 | 1) {
  const st = s.stats[side];
  return Math.round(
    st.damage * SCORE.damage +
      st.rounds * SCORE.roundWin +
      st.perfects * SCORE.perfect +
      st.timeBonus * SCORE.timeLeft +
      (st.finisher ? SCORE.finisher : 0) +
      (s.matchWinner === side ? SCORE.fightWin : 0),
  );
}

/** For tests and replays: a compact fingerprint of everything that matters. */
export function fingerprint(s: GameState) {
  return JSON.stringify([s.phase, s.round, s.timer, s.fighters.map((f) => [f.x.toFixed(3), f.y.toFixed(3), f.hp.toFixed(3), f.state, f.beast.toFixed(3)]), s.projectiles.length]);
}

/** Deterministic randomness for anything inside the sim (the CPU uses it). */
export const random = (s: { seed: number }) => nextRandom(s);
