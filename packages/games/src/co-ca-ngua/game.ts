import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/800.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, inRect } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import {
  AVATARS,
  AVATAR_R,
  type Button,
  CELL,
  COLORS,
  DARK,
  DIE,
  DIE_HIT,
  FONT,
  INK,
  INK_SOFT,
  LIGHT,
  ROLL,
  ROUND_R,
  type RoundIcon,
  STATUS_Y,
  TOP_Y,
  baseSlot,
  drawAvatar,
  drawBackground,
  drawBoard,
  drawButton,
  drawDie,
  drawPanel,
  drawPointer,
  drawRollButton,
  drawRoundButton,
  drawTag,
  drawTarget,
  drawTitle,
  drawToken,
  fitSize,
  homeSpot,
  outlined,
  roundRect,
  text,
  toScreen,
  wrap,
} from "./art";
import { destination, distinctOptions, isBonusRoll, rollTotal, rotate, squareOf } from "./board";
import {
  BASE,
  CAPTURE_TIME,
  DIFFICULTIES,
  type Difficulty,
  HOME,
  HOP_TIME,
  MAX_BONUS,
  PLAYER_COUNTS,
  ROLL_TIME,
  TABLE_BONUS,
  TOKENS,
  W,
  WIN_SCORE,
} from "./config";
import avatarsUrl from "./img/avatars.webp";
import propsUrl from "./img/props.webp";
import tokensUrl from "./img/tokens.webp";
import { type Anim, type Input, type Match, type MatchEvent, type Phase, clockLeft, createMatch, isAuto, stepMatch } from "./logic";
import { roomMatch } from "./online";
import { STRINGS } from "./strings";

// The imperative shell for Cờ Cá Ngựa: the menu (table size, people on this
// phone, the computer's level), the game against the computer and/or friends
// on one phone, and the online branch, which only sends "roll" / "move token
// N" and draws what the room sends back (docs/standards/online-multiplayer.md).
// Offline and online share one renderer: it draws a `Match` and its phase
// clock, so the die tumble and the hops look the same either way.

const RESULT_DELAY = 1.3;
const NOTICE_TIME = 1.8;
const PICK_RADIUS = 58;

interface Setup {
  total: number;
  people: number;
  level: Difficulty;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  spin: number;
}

interface Drawn {
  pi: number;
  t: number;
  x: number;
  y: number;
  scale: number;
  lift: number;
  alpha: number;
}

const PHASES: Phase[] = ["roll", "rolling", "move", "moving", "pass", "over"];

/** A saved offline game: the whole match is plain data. */
function parseRun(raw: unknown): { match: Match; setup: Setup } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { match?: Match; setup?: Setup };
  const m = r.match;
  const s = r.setup;
  if (!m || !s || !Array.isArray(m.players) || m.players.length < 2 || m.players.length > 4) return null;
  if (!PHASES.includes(m.phase) || m.phase === "over" || !Number.isInteger(m.turn) || !m.players[m.turn]) return null;
  // A game saved under the old rules (each die spent on its own) doesn't carry on
  if (!Number.isInteger(m.bonus) || !Array.isArray(m.moves) || m.moves.some((x) => "die" in x)) return null;
  for (const p of m.players)
    if (!Array.isArray(p.tokens) || p.tokens.length !== TOKENS || !p.tokens.every((x) => Number.isInteger(x) && x >= BASE && x <= HOME)) return null;
  if (!PLAYER_COUNTS.includes(s.total as 2) || !DIFFICULTIES.includes(s.level)) return null;
  m.events = [];
  return { match: m, setup: s };
}

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const online = rt.game.online ?? null;
  const load = (src: string) => {
    const img = new Image();
    img.src = src;
    return img;
  };
  const tokenImg = load(tokensUrl);
  const propsImg = load(propsUrl);
  const avatarImg = load(avatarsUrl);

  // ---------------------------------------------------------------- state

  const savedSetup = storage.get<Partial<Setup>>("setup", {});
  const choice: Setup = {
    total: PLAYER_COUNTS.includes(savedSetup.total as 2) ? (savedSetup.total as number) : 4,
    people: clamp(Number(savedSetup.people) || 1, 1, 4),
    level: DIFFICULTIES.includes(savedSetup.level as Difficulty) ? (savedSetup.level as Difficulty) : "normal",
  };
  choice.people = Math.min(choice.people, choice.total);
  /** The setup of the game on the board (the menu edits `choice`). */
  let played: Setup = { ...choice };
  const wins: Record<Difficulty, number> = { easy: 0, normal: 0, hard: 0, ...storage.get<Partial<Record<Difficulty, number>>>("wins", {}) };

  const newMatch = (s: Setup) =>
    createMatch((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0, {
      humans: Array.from({ length: s.people }, () => ""),
      total: s.total,
      level: s.level,
      turnSeconds: 0,
    });

  const me = online ? online.seat : -1;
  let match: Match;
  let overlay: "menu" | "rules" | null = null;
  let rulesFrom: "menu" | null = null;
  const saved = online ? null : parseRun(storage.get<unknown>("run", null));
  if (online) {
    match = roomMatch(
      online.seed,
      online.seats.map((s) => s.name),
      online.settings,
    );
  } else if (saved) {
    match = saved.match;
    played = saved.setup;
  } else {
    match = newMatch(choice);
    overlay = "menu";
  }
  /** Nothing on the board yet: the menu has no game to return to. */
  let fresh = !online && !saved;
  let reported = false;
  let results: SeatResult[] | null = null;
  let queued: Input | null = null;
  let seq = 0;
  let sentFor = -1;

  let now = 0;
  let notice: { text: string; color: string; at: number } | null = null;
  let overAt = -1;
  let landedAt = -10;
  const particles: Particle[] = [];
  /** What the previous frame saw, to fire sounds and effects as the phase clock passes them. */
  let seen = { phaseId: match.phaseId, phase: match.phase, t: match.t, anim: match.anim, dice: match.dice, bonus: match.bonus };

  const save = () => {
    if (online) return;
    storage.set("run", match.phase === "over" || fresh ? null : { match: { ...match, events: [] }, setup: played });
  };

  // ---------------------------------------------------------------- who is who

  const myCorner = online && me >= 0 ? (match.players.find((p) => p.seat === me)?.corner ?? 0) : 0;
  /** Online, the board turns so your colour sits bottom-left. */
  const rot = myCorner;
  const vcOf = (corner: number) => (corner - rot + 4) % 4;
  const myIndex = () => match.players.findIndex((p) => p.seat === me);

  function nameOf(pi: number): string {
    const t = tr();
    const p = match.players[pi];
    if (!p) return "";
    // The computer goes by its colour (its card says "CPU" underneath)
    if (p.seat === null) return t.color[p.corner];
    if (online) return p.seat === me ? t.you : p.name;
    return played.people === 1 ? t.you : t.color[p.corner];
  }

  function subOf(pi: number): string {
    const t = tr();
    const p = match.players[pi];
    if (p.seat === null) return online ? t.cpu : `${t.cpu} (${t.level[p.level]})`;
    if (online) return t.color[p.corner];
    return played.people === 1 ? t.color[p.corner] : t.person(p.seat + 1);
  }

  /** Is it a person on this device who decides right now? */
  function localTurn() {
    const p = match.players[match.turn];
    if (!p || p.seat === null || match.phase === "over") return false;
    if (online) return p.seat === me;
    return !isAuto(p);
  }

  /** Horses the current player can move with this roll. */
  const movable = () => match.moves.map((m) => m.token);

  const canRoll = () => !overlay && localTurn() && match.phase === "roll" && sentFor !== match.phaseId;
  const canMove = () => !overlay && localTurn() && match.phase === "move" && sentFor !== match.phaseId && !match.players[match.turn].idle;

  // ---------------------------------------------------------------- sound

  const sfx = {
    tap: () => audio.tone({ freq: 880, dur: 0.03, type: "triangle", vol: 0.04 }),
    roll: () => {
      for (let i = 0; i < 7; i++)
        audio.tone({ freq: 300 + Math.random() * 500, dur: 0.035, type: "square", vol: 0.025, delay: i * 0.075 + Math.random() * 0.02 });
    },
    land: () => {
      audio.tone({ freq: 220, to: 140, dur: 0.09, type: "triangle", vol: 0.12 });
      audio.tone({ freq: 1600, dur: 0.02, type: "square", vol: 0.015 });
    },
    six: () => {
      for (const [i, f] of [784, 1175].entries()) audio.tone({ freq: f, dur: 0.12, type: "triangle", vol: 0.08, delay: i * 0.08 });
    },
    hop: (k: number) => audio.tone({ freq: 520 + k * 30, to: 600 + k * 30, dur: 0.05, type: "sine", vol: 0.07 }),
    capture: () => {
      audio.tone({ freq: 700, to: 160, dur: 0.3, type: "sawtooth", vol: 0.05 });
      audio.tone({ freq: 140, dur: 0.12, type: "square", vol: 0.06, delay: 0.05 });
    },
    home: () => {
      for (const [i, f] of [659, 784, 988, 1319].entries()) audio.tone({ freq: f, dur: 0.12, type: "triangle", vol: 0.08, delay: i * 0.07 });
    },
    finish: () => {
      for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) audio.tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.1, delay: i * 0.1 });
    },
    pass: () => audio.tone({ freq: 260, to: 170, dur: 0.22, type: "sine", vol: 0.07 }),
    yourTurn: () => audio.tone({ freq: 990, to: 1320, dur: 0.08, type: "sine", vol: 0.05 }),
    tick: () => audio.tone({ freq: 1200, dur: 0.02, type: "square", vol: 0.02 }),
    nope: () => audio.tone({ freq: 180, dur: 0.08, type: "square", vol: 0.03 }),
  };

  const say = (str: string, color = INK) => {
    notice = { text: str, color, at: now };
  };

  // ---------------------------------------------------------------- positions (screen)

  /** Screen centre of a board square, turned to this player's view. */
  function squarePoint(corner: number, pos: number) {
    const cell = squareOf(corner, pos);
    if (!cell) return null;
    const [x, y] = rotate(cell, 4 - rot);
    return toScreen(x + 0.5, y + 0.5);
  }
  const basePoint = (corner: number, t: number) => {
    const s = baseSlot(vcOf(corner), t);
    return toScreen(s.x, s.y);
  };
  const homePoint = (corner: number, t: number) => {
    const s = homeSpot(vcOf(corner), t);
    return toScreen(s.x, s.y);
  };
  /** Where a token at `pos` stands (its foot), ignoring stacking. */
  function standPoint(corner: number, pos: number, t: number) {
    if (pos < 0) return basePoint(corner, t);
    if (pos >= HOME) return homePoint(corner, t);
    return squarePoint(corner, pos) ?? basePoint(corner, t);
  }
  /** Tokens stand slightly below a square's centre so the horse sits in it. */
  const FOOT = CELL * 0.3;

  const hopsOf = (a: Anim) => (a.from < 0 ? 1 : a.to - a.from);

  function layout(m: Match): Drawn[] {
    const out: Drawn[] = [];
    const anim = m.phase === "moving" ? m.anim : null;
    const e = m.t;
    const stacks = new Map<string, { pi: number; t: number; x: number; y: number }[]>();
    m.players.forEach((p, pi) => {
      p.tokens.forEach((pos, t) => {
        if (anim && pi === m.turn && t === anim.token) {
          const n = hopsOf(anim);
          const path = anim.from < 0 ? [basePoint(p.corner, t), standPoint(p.corner, 0, t)] : Array.from({ length: n + 1 }, (_, k) => standPoint(p.corner, anim.from + k, t));
          const i = Math.min(n - 1, Math.floor(e / HOP_TIME));
          const f = clamp((e - i * HOP_TIME) / HOP_TIME, 0, 1);
          if (e >= n * HOP_TIME && anim.to < HOME) {
            // Landed: join the square's stack
            const end = path[n];
            const key = `${Math.round(end.x)},${Math.round(end.y)}`;
            stacks.set(key, [...(stacks.get(key) ?? []), { pi, t, x: end.x, y: end.y }]);
            return;
          }
          const a = path[i];
          const b = path[i + 1] ?? a;
          const k = f * f * (3 - 2 * f);
          const done = e >= n * HOP_TIME;
          out.push({
            pi,
            t,
            x: a.x + (b.x - a.x) * (done ? 1 : k),
            y: a.y + (b.y - a.y) * (done ? 1 : k) + (pos >= HOME ? 0 : FOOT),
            scale: pos >= HOME && done ? 0.55 : 1,
            lift: done ? 0 : Math.sin(Math.PI * f) * CELL * 0.6,
            alpha: 1,
          });
          return;
        }
        const hit = anim?.captured.find((c) => c.player === pi && c.token === t);
        if (anim && hit) {
          const land = hopsOf(anim) * HOP_TIME;
          const from = standPoint(p.corner, hit.from, t);
          const to = basePoint(p.corner, t);
          const k = clamp((e - land) / CAPTURE_TIME, 0, 1);
          out.push({
            pi,
            t,
            x: from.x + (to.x - from.x) * k,
            y: from.y + (to.y - from.y) * k + FOOT * (1 - k),
            scale: 1,
            lift: Math.sin(Math.PI * k) * CELL * 2.2,
            alpha: 1,
          });
          return;
        }
        if (pos < 0) {
          const b = basePoint(p.corner, t);
          out.push({ pi, t, x: b.x, y: b.y + CELL * 0.32, scale: 0.95, lift: 0, alpha: 1 });
        } else if (pos >= HOME) {
          const h = homePoint(p.corner, t);
          out.push({ pi, t, x: h.x, y: h.y + CELL * 0.2, scale: 0.55, lift: 0, alpha: 1 });
        } else {
          const s = squarePoint(p.corner, pos);
          if (!s) return;
          const key = `${Math.round(s.x)},${Math.round(s.y)}`;
          stacks.set(key, [...(stacks.get(key) ?? []), { pi, t, x: s.x, y: s.y }]);
        }
      });
    });
    for (const list of stacks.values()) {
      const n = list.length;
      for (const [i, d] of list.entries()) {
        if (n === 1) {
          out.push({ pi: d.pi, t: d.t, x: d.x, y: d.y + FOOT, scale: 1, lift: 0, alpha: 1 });
          continue;
        }
        const ox = n === 2 ? (i === 0 ? -0.22 : 0.22) : i % 2 === 0 ? -0.22 : 0.22;
        const oy = n === 2 ? 0 : i < 2 ? -0.16 : 0.16;
        out.push({ pi: d.pi, t: d.t, x: d.x + ox * CELL, y: d.y + oy * CELL + FOOT * 0.8, scale: 0.72, lift: 0, alpha: 1 });
      }
    }
    out.sort((a, b) => a.y - b.y);
    return out;
  }

  // ---------------------------------------------------------------- effects

  function burst(x: number, y: number, colors: string[], n: number, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.5,
        life: 0,
        max: 0.7 + Math.random() * 0.6,
        color: colors[i % colors.length],
        size: 5 + Math.random() * 6,
        spin: Math.random() * 6,
      });
    }
  }

  /** Fire what the phase clock passed between t0 and t1 (t0 < 0 = the phase just began). */
  function crossed(s: { phase: Phase; anim: Anim | null; dice: number[]; bonus: number }, t0: number, t1: number, current: boolean) {
    const t = tr();
    const p = match.players[match.turn];
    switch (s.phase) {
      case "rolling":
        if (t0 < 0) sfx.roll();
        if (t0 < ROLL_TIME && t1 >= ROLL_TIME) {
          sfx.land();
          landedAt = now;
          if (isBonusRoll(s.dice) && s.bonus < MAX_BONUS) {
            sfx.six();
            // The roll usually ends between frames, so this fires for the phase just left too
            say(t.bonus(s.dice[0] === s.dice[1]), COLORS[p?.corner ?? 0]);
          }
        }
        return;
      case "moving": {
        const a = s.anim;
        if (!a) return;
        const n = hopsOf(a);
        for (let k = 1; k <= n; k++) {
          if (!(t0 < k * HOP_TIME && t1 >= k * HOP_TIME)) continue;
          sfx.hop(k);
          if (k < n) continue;
          const mover = match.players.find((q) => q.tokens[a.token] === a.to) ?? p;
          const end = standPoint(mover?.corner ?? 0, a.to, a.token);
          if (a.captured.length) {
            sfx.capture();
            burst(end.x, end.y, ["#ffffff", "#ffd54a", COLORS[mover?.corner ?? 0]], 22);
            const victim = match.players[a.captured[0].player];
            if (victim) {
              const mine = online ? victim.seat === me : played.people === 1 && victim.seat === 0;
              say(mine ? t.capturedYou(nameOf(match.players.indexOf(mover))) : t.captured(t.color[victim.corner]), COLORS[mover?.corner ?? 0]);
            }
          }
          if (a.to === HOME) {
            sfx.home();
            burst(end.x, end.y, COLORS, 26, 180);
            if (!notice || now - notice.at > 0.5) say(t.home, COLORS[mover?.corner ?? 0]);
          }
        }
        return;
      }
      case "pass":
        if (t0 < 0 && current) {
          sfx.pass();
          say(match.passReason === "three" ? t.threeBonus : isBonusRoll(match.dice) ? t.noMoveBonus : t.noMove, INK_SOFT);
        }
        return;
      case "move":
        if (t0 < 0 && current && localTurn()) sfx.tap();
        return;
      case "roll":
        return;
      case "over":
        if (t0 < 0 && current) overAt = now;
        return;
    }
  }

  /** Compare what this frame shows with the last one. */
  function watch() {
    if (match.phaseId !== seen.phaseId) {
      // Finish the phase we were in (its end may have come between frames), then start the new one
      crossed(seen, seen.t, Number.POSITIVE_INFINITY, false);
      crossed(match, -1, match.t, true);
    } else if (match.t > seen.t) crossed(match, seen.t, match.t, true);
    seen = { phaseId: match.phaseId, phase: match.phase, t: match.t, anim: match.anim, dice: match.dice, bonus: match.bonus };
  }

  function onEvent(e: MatchEvent) {
    const t = tr();
    switch (e.type) {
      case "turn": {
        const p = match.players[e.player];
        if (match.turns === 0 && p) say(t.firstTurn(nameOf(e.player)), COLORS[p.corner]);
        if (p && p.seat !== null && (online ? p.seat === me : !isAuto(p))) sfx.yourTurn();
        break;
      }
      case "roll":
      case "move":
        if (e.auto && online && match.players[e.player]?.seat === me && !match.players[e.player]?.idle && !match.players[e.player]?.away) say(t.timedOut, INK_SOFT);
        break;
      case "finish": {
        const p = match.players[e.player];
        if (!p) break;
        sfx.finish();
        say(t.finished(nameOf(e.player), e.place), COLORS[p.corner]);
        const c = toScreen(7.5, 7.5);
        burst(c.x, c.y, COLORS, 50, 300);
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- online

  const stopListening = online?.onMessage((msg) => {
    if (msg.t === "snap" && msg.state) {
      const next = msg.state as Match;
      // Same phase: keep our smoothly running clock unless it drifted
      if (next.phaseId === match.phaseId && Math.abs(next.t - match.t) < 0.35) next.t = Math.max(match.t, next.t);
      match = next;
    } else if (msg.t === "ev") {
      for (const e of msg.events as MatchEvent[]) onEvent(e);
    } else if (msg.t === "end") {
      results = msg.results;
    }
  });

  function act(input: Input) {
    if (online) {
      sentFor = match.phaseId;
      online.send({
        seq: ++seq,
        move: { x: 0, y: 0 },
        actions: [input.kind === "roll" ? { type: "roll" } : { type: "move", token: input.token }],
      });
    } else queued = input;
  }

  // ---------------------------------------------------------------- offline flow

  function startGame() {
    played = { ...choice };
    storage.set("setup", played);
    match = newMatch(played);
    fresh = false;
    reported = false;
    results = null;
    queued = null;
    overAt = -1;
    particles.length = 0;
    notice = null;
    overlay = null;
    seen = { phaseId: match.phaseId, phase: match.phase, t: match.t, anim: match.anim, dice: match.dice, bonus: match.bonus };
    for (const e of match.events.splice(0)) onEvent(e);
    save();
  }

  function finishedOffline() {
    if (online || reported) return;
    reported = true;
    if (played.people !== 1) return;
    const mine = match.players.find((p) => p.seat === 0);
    if (mine?.place !== 1) return;
    wins[played.level]++;
    storage.set("wins", wins);
    const score = Math.round(WIN_SCORE[played.level] * (TABLE_BONUS[played.total] ?? 1));
    reportScore?.({ score, detail: tr().detail(played.level, played.total) });
    const best = [...DIFFICULTIES].reverse().find((d) => wins[d] > 0) ?? played.level;
    storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(best, wins[best]), en: STRINGS.en.summary(best, wins[best]) });
  }

  const offlineScore = () => Math.round(WIN_SCORE[played.level] * (TABLE_BONUS[played.total] ?? 1));

  // ---------------------------------------------------------------- input

  function tapBoard(p: { x: number; y: number }) {
    if (!canMove()) return false;
    const pi = match.turn;
    let best: Drawn | null = null;
    let dist = PICK_RADIUS;
    for (const d of layout(match)) {
      if (d.pi !== pi || !match.moves.some((m) => m.token === d.t)) continue;
      // The horse's body, not its foot
      const dd = Math.hypot(p.x - d.x, p.y - (d.y - CELL * 0.55 * d.scale));
      if (dd < dist) {
        dist = dd;
        best = d;
      }
    }
    if (!best) return false;
    sfx.tap();
    act({ kind: "move", token: best.t });
    return true;
  }

  function roll() {
    if (!canRoll()) return;
    act({ kind: "roll" });
  }

  /** The round buttons along the top (no menu online: the portal has its own). */
  function buttons(): { id: RoundIcon; label: string; x: number; y: number; rect: Rect }[] {
    const t = tr();
    const list: { id: RoundIcon; label: string; x: number }[] = online
      ? [{ id: "rules", label: t.rulesShort, x: W - 44 }]
      : [
          { id: "menu", label: t.menu, x: 44 },
          { id: "new", label: t.newShort, x: W - 116 },
          { id: "rules", label: t.rulesShort, x: W - 44 },
        ];
    return list.map((b) => ({ ...b, y: TOP_Y, rect: { x: b.x - 34, y: TOP_Y - 34, w: 68, h: 86 } }));
  }

  // Menu layout (shared by draw and tap)
  const MENU: Rect = { x: 26, y: 96, w: W - 52, h: 790 };
  function menuButtons(): Button[] {
    const t = tr();
    const x = MENU.x + 28;
    const w = MENU.w - 56;
    const list: Button[] = [];
    const seg = (n: number, gap = 12) => (w - gap * (n - 1)) / n;
    PLAYER_COUNTS.forEach((n, i) => {
      const sw = seg(3);
      list.push({
        id: `total:${n}`,
        rect: { x: x + i * (sw + 12), y: MENU.y + 214, w: sw, h: 62 },
        label: String(n),
        on: choice.total === n,
        fill: choice.total === n ? "#ff8f3c" : "#ffe2bd",
        edge: choice.total === n ? "#cf5f17" : "#e3b27a",
        ink: choice.total === n ? "#fff" : INK,
      });
    });
    for (let n = 1; n <= 4; n++) {
      const sw = seg(4);
      const off = n > choice.total;
      list.push({
        id: `people:${n}`,
        rect: { x: x + (n - 1) * (sw + 12), y: MENU.y + 334, w: sw, h: 62 },
        label: String(n),
        on: choice.people === n,
        disabled: off,
        fill: choice.people === n ? COLORS[[0, 2, 1, 3][n - 1]] : "#ffe2bd",
        edge: choice.people === n ? DARK[[0, 2, 1, 3][n - 1]] : "#e3b27a",
        ink: choice.people === n ? "#fff" : INK,
      });
    }
    const noCpu = choice.people >= choice.total;
    DIFFICULTIES.forEach((d, i) => {
      const sw = seg(3);
      const on = choice.level === d && !noCpu;
      list.push({
        id: `level:${d}`,
        rect: { x: x + i * (sw + 12), y: MENU.y + 480, w: sw, h: 62 },
        label: t.level[d],
        on,
        disabled: noCpu,
        fill: on ? (d === "easy" ? "#5fbf55" : d === "normal" ? "#f2a72a" : "#e5523f") : "#ffe2bd",
        edge: on ? (d === "easy" ? "#3c8f35" : d === "normal" ? "#c07a0c" : "#ac2c1f") : "#e3b27a",
        ink: on ? "#fff" : INK,
      });
    });
    list.push({ id: "start", rect: { x, y: MENU.y + 580, w, h: 78 }, label: t.start, fill: "#ff7a2f", edge: "#c94f10" });
    const half = (w - 14) / 2;
    if (canResume()) {
      list.push({ id: "resume", rect: { x, y: MENU.y + 682, w: half, h: 64 }, label: t.resume, fill: "#5aa9f0", edge: "#2f78c4" });
      list.push({ id: "rules", rect: { x: x + half + 14, y: MENU.y + 682, w: half, h: 64 }, label: t.rules, fill: "#8fd06a", edge: "#5c9d3c" });
    } else list.push({ id: "rules", rect: { x: x + w / 2 - half / 2, y: MENU.y + 682, w: half, h: 64 }, label: t.rules, fill: "#8fd06a", edge: "#5c9d3c" });
    return list;
  }
  const canResume = () => !online && !fresh && match.phase !== "over";

  const RULES: Rect = { x: 18, y: 100, w: W - 36, h: 760 };
  const rulesClose = (): Button => ({
    id: "close",
    rect: { x: W / 2 - 110, y: RULES.y + RULES.h - 92, w: 220, h: 66 },
    label: tr().close,
    fill: "#ff8f3c",
    edge: "#cf5f17",
  });

  const RESULT: Rect = { x: 34, y: 196, w: W - 68, h: 520 };
  function resultButtons(): Button[] {
    const t = tr();
    const y = RESULT.y + RESULT.h - 96;
    if (online) return [{ id: "lobby", rect: { x: W / 2 - 120, y, w: 240, h: 68 }, label: t.backToLobby, fill: "#ff7a2f", edge: "#c94f10" }];
    const w = (RESULT.w - 76) / 2;
    return [
      { id: "again", rect: { x: RESULT.x + 28, y, w, h: 68 }, label: t.again, fill: "#ff7a2f", edge: "#c94f10" },
      { id: "menu", rect: { x: RESULT.x + 48 + w, y, w, h: 68 }, label: t.menu, fill: "#5aa9f0", edge: "#2f78c4" },
    ];
  }
  const showResult = () => match.phase === "over" && overAt >= 0 && now - overAt > RESULT_DELAY && overlay === null;

  function tap(p: { x: number; y: number }) {
    if (overlay === "rules") {
      if (inRect(p, rulesClose().rect) || !inRect(p, RULES)) {
        sfx.tap();
        overlay = rulesFrom;
      }
      return;
    }
    if (overlay === "menu") {
      const b = menuButtons().find((b) => inRect(p, b.rect));
      if (!b) return;
      if (b.disabled) return sfx.nope();
      sfx.tap();
      const [kind, value] = b.id.split(":");
      if (kind === "total") {
        choice.total = Number(value);
        choice.people = Math.min(choice.people, choice.total);
      } else if (kind === "people") choice.people = Number(value);
      else if (kind === "level") choice.level = value as Difficulty;
      else if (kind === "start") startGame();
      else if (kind === "resume") overlay = null;
      else if (kind === "rules") {
        rulesFrom = "menu";
        overlay = "rules";
      }
      return;
    }
    if (showResult()) {
      const b = resultButtons().find((b) => inRect(p, b.rect));
      if (b) {
        sfx.tap();
        if (b.id === "lobby") online?.backToLobby();
        else if (b.id === "again") startGame();
        else overlay = "menu";
      }
      return;
    }
    const b = buttons().find((b) => inRect(p, b.rect));
    if (b) {
      sfx.tap();
      if (b.id === "menu") overlay = "menu";
      else if (b.id === "new") startGame();
      else {
        rulesFrom = null;
        overlay = "rules";
      }
      return;
    }
    if (inRect(p, DIE_HIT)) {
      if (canRoll()) return roll();
      // Online, a tap while the computer covers for you takes your seat back
      if (online && localTurn() && match.players[match.turn]?.idle) return act({ kind: "roll" });
    }
    if (tapBoard(p)) return;
    // Tapping the active player's own card rolls too
    const mine = match.players[match.turn];
    if (mine && canRoll()) {
      const a = AVATARS[vcOf(mine.corner)];
      if (Math.hypot(p.x - a.x, p.y - a.y) < AVATAR_R + 14) return roll();
    }
  }

  // ---------------------------------------------------------------- update

  function update(dt: number) {
    now += dt;
    for (const q of particles) {
      q.life += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 520 * dt;
      q.vx *= 1 - dt * 1.5;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life >= particles[i].max) particles.splice(i, 1);

    if (online) {
      // The room's phase clock, run on locally between snapshots (drawing only)
      if (match.phase !== "over") {
        const before = clockLeft(match);
        match.t += dt;
        const after = clockLeft(match);
        if (localTurn() && before !== null && after !== null && Math.ceil(after) !== Math.ceil(before) && after <= 5 && after > 0) sfx.tick();
      }
      watch();
      return;
    }
    if (overlay || fresh) return;
    if (match.phase !== "over") {
      const p = match.players[match.turn];
      const inputs: (Input | null)[] = [];
      if (queued && p && p.seat !== null) inputs[p.seat] = queued;
      queued = null;
      const turn = match.turns;
      stepMatch(match, dt, inputs);
      for (const e of match.events.splice(0)) onEvent(e);
      if (match.turns !== turn) save();
    }
    watch();
    if (match.phase === "over" && !reported) {
      finishedOffline();
      save();
    }
  }

  // ---------------------------------------------------------------- render

  /** Portrait index: people by their colour, the computer with its own faces. */
  const faceOf = (pi: number) => {
    const p = match.players[pi];
    return p.seat === null ? 4 + p.corner : p.corner;
  };

  function drawPlayers() {
    const t = tr();
    const clock = clockLeft(match);
    const pulse = (Math.sin(now * 5) + 1) / 2;
    match.players.forEach((p, pi) => {
      const vc = vcOf(p.corner);
      const a = AVATARS[vc];
      const active = pi === match.turn && match.phase !== "over";
      drawAvatar(ctx, avatarImg, faceOf(pi), p.corner, a.x, a.y, AVATAR_R, {
        glow: active ? pulse : undefined,
        clock: active && clock !== null ? clock / match.turnSeconds : null,
        dim: p.away,
      });
      // Name, tag and horses home beside the portrait, toward the middle
      const left = vc === 0 || vc === 1;
      const tx = left ? a.x + AVATAR_R + 12 : a.x - AVATAR_R - 12;
      const align = left ? "left" : "right";
      // Bottom names stop short of the roll button
      const maxW = vc === 0 ? ROLL.x - 14 - tx : vc === 3 ? tx - (ROLL.x + ROLL.w + 14) : 170;
      const name = nameOf(pi);
      outlined(ctx, name, tx, a.y - 20, fitSize(ctx, name, 22, maxW), align);
      const sub = p.away ? t.away : subOf(pi);
      drawTag(ctx, sub, tx, a.y + 6, fitSize(ctx, sub, 14, maxW - 14), p.away ? "#c0392b" : p.seat === null ? "rgba(10,30,70,0.7)" : DARK[p.corner], align);
      const home = p.tokens.filter((x) => x >= HOME).length;
      for (let k = 0; k < TOKENS; k++) {
        const cx = left ? tx + 8 + k * 18 : tx - 8 - k * 18;
        ctx.beginPath();
        ctx.arc(cx, a.y + 30, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = k < home ? COLORS[p.corner] : "rgba(5,20,50,0.45)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (active && clock !== null && clock <= 10) outlined(ctx, String(Math.ceil(clock)), a.x, a.y + AVATAR_R + 16, 18, "center", clock <= 5 ? "#ff8a80" : "#ffffff");
      if (p.place !== null) {
        // A medal with the place
        const mx = a.x + AVATAR_R * 0.72;
        const my = a.y - AVATAR_R * 0.72;
        ctx.beginPath();
        ctx.arc(mx, my, 15, 0, Math.PI * 2);
        ctx.fillStyle = p.place === 1 ? "#f6c22e" : p.place === 2 ? "#cfd6dd" : p.place === 3 ? "#e0a165" : "#e9dccb";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
        text(ctx, String(p.place), mx, my + 1, 18, INK);
      }
    });
  }

  function drawDieArea() {
    const p = match.players[match.turn];
    const color = p ? p.corner : 0;
    const waiting = canRoll() || (online && localTurn() && match.phase === "roll" && !!match.players[match.turn]?.idle);
    const k = (Math.sin(now * 5) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = match.phase === "over" ? 0.5 : 1;
    const lift = drawRollButton(ctx, ROLL, color, waiting ? k : 0, match.phase === "rolling");
    const rolling = match.phase === "rolling" && match.t < ROLL_TIME;
    // The roll is spent once a horse sets off
    const spent = match.phase === "moving";
    const pop = now - landedAt;
    for (let i = 0; i < 2; i++) {
      const dx = DIE.x + (i === 0 ? -DIE.gap : DIE.gap);
      let y = DIE.y - lift;
      let value = match.dice[i] || 6;
      let spin = 0;
      let scale = 1;
      if (rolling) {
        const e = match.t / ROLL_TIME;
        value = 1 + ((Math.floor(match.t / 0.07) * 7 + 3 + i * 4) % 6);
        spin = (i === 0 ? 1 : -1) * ((1 - e) * (1 - e) * 9 + Math.sin(match.t * 30 + i) * 0.08);
        y -= Math.abs(Math.sin(e * Math.PI * (2.5 + i * 0.5))) * 22 * (1 - e);
      } else if (waiting) {
        y -= Math.abs(Math.sin(now * 3 + i * 0.8)) * 4;
      }
      if (pop >= 0 && pop < 0.25) scale = 1 + 0.18 * Math.sin((pop / 0.25) * Math.PI);
      ctx.save();
      ctx.globalAlpha *= spent ? 0.45 : 1;
      ctx.fillStyle = "rgba(40,15,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(dx, DIE.y - lift + 24, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      drawDie(ctx, dx, y - 4, DIE.size * scale, value, spin);
      ctx.restore();
    }
    ctx.restore();
    if (waiting) drawTag(ctx, tr().roll, DIE.x, ROLL.y + ROLL.h + 4, 16, DARK[color]);
  }

  function drawTokens() {
    const list = layout(match);
    const picking = canMove();
    const pulse = (Math.sin(now * 6) + 1) / 2;
    if (picking) {
      // Where each choice would land, under the horses
      const p = match.players[match.turn];
      for (const { token: tk } of distinctOptions(p.tokens, match.moves)) {
        const to = destination(match.players, match.turn, tk, match.dice);
        if (to === null) continue;
        const at = to >= HOME ? toScreen(7.5, 7.5) : squarePoint(p.corner, to);
        if (at) drawTarget(ctx, at.x, at.y, p.corner, pulse);
      }
    }
    for (const d of list) {
      const p = match.players[d.pi];
      const glow = picking && d.pi === match.turn && movable().includes(d.t);
      drawToken(ctx, tokenImg, p.corner, d.x, d.y, d.scale, {
        // A little hop on the spot for the horses you can move
        lift: d.lift + (glow ? 2 + Math.abs(Math.sin(now * 5 + d.t)) * 9 : 0),
        glow: glow ? 0.15 + 0.85 * pulse : 0,
        alpha: d.alpha,
      });
    }
    // A bobbing arrow over each horse you can move
    if (picking)
      for (const d of list) {
        if (d.pi !== match.turn || !movable().includes(d.t)) continue;
        drawPointer(ctx, d.x, d.y - CELL * 1.45 * d.scale - 8 - pulse * 6, COLORS[match.players[d.pi].corner]);
      }
  }

  function drawParticles() {
    for (const q of particles) {
      const k = 1 - q.life / q.max;
      ctx.save();
      ctx.globalAlpha = clamp(k * 1.5, 0, 1);
      ctx.translate(q.x, q.y);
      ctx.rotate(q.spin * q.life * 3);
      ctx.fillStyle = q.color;
      ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
      ctx.restore();
    }
  }

  function statusLine(): { str: string; color: string } {
    const t = tr();
    const p = match.players[match.turn];
    if (match.phase === "over" || !p) return { str: "", color: "#ffffff" };
    if (online && me < 0) return { str: t.watching, color: "#ffffff" };
    if (online && p.seat === me && p.idle) return { str: t.idle, color: "#ffb3ad" };
    const name = nameOf(match.turn);
    if (localTurn()) {
      const hot = !online && played.people > 1;
      if (match.phase === "roll") return { str: hot ? `${t.turnOf(name)}: ${t.roll}!` : t.yourRoll, color: LIGHT[p.corner] };
      if (match.phase === "move") {
        // Bring one out, walk the total, or either
        const out = movable().some((tk) => p.tokens[tk] < 0);
        const walk = movable().some((tk) => p.tokens[tk] >= 0);
        const str = t.pickHorse(walk ? rollTotal(match.dice) : null, out);
        return { str: hot ? `${name}: ${str}` : str, color: LIGHT[p.corner] };
      }
      // Your die is tumbling or your horse is hopping: the board says it all
      if (!hot) return { str: "", color: "#ffffff" };
    }
    return { str: t.turnOf(name), color: "#ffffff" };
  }

  function drawStatus() {
    if (notice && now - notice.at < NOTICE_TIME) {
      const k = clamp((now - notice.at) / 0.18, 0, 1);
      const out = clamp((NOTICE_TIME - (now - notice.at)) / 0.3, 0, 1);
      const size = fitSize(ctx, notice.text, 26, W - 60);
      ctx.font = `800 ${size}px ${FONT}`;
      const w = Math.min(W - 24, ctx.measureText(notice.text).width + 40);
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(W / 2, STATUS_Y);
      ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, { x: -w / 2, y: -20, w, h: 40 }, 20);
      ctx.fill();
      ctx.strokeStyle = notice.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      text(ctx, notice.text, 0, 2, size, notice.color === INK_SOFT ? INK : notice.color);
      ctx.restore();
      return;
    }
    const s = statusLine();
    if (s.str) outlined(ctx, s.str, W / 2, STATUS_Y, fitSize(ctx, s.str, 22, W - 30), "center", s.color);
  }

  function dim() {
    const v = stage.view;
    ctx.fillStyle = "rgba(8,22,52,0.6)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function drawMenu() {
    dim();
    const t = tr();
    drawPanel(ctx, MENU);
    drawTitle(ctx, t.title, W / 2, MENU.y + 70, fitSize(ctx, t.title, 66, MENU.w - 60));
    // A row of horses under the title
    for (let c = 0; c < 4; c++) drawToken(ctx, tokenImg, c, W / 2 + (c - 1.5) * 52, MENU.y + 150 + (c % 2) * 2, 1.1);
    text(ctx, t.subtitle, W / 2, MENU.y + 172, fitSize(ctx, t.subtitle, 19, MENU.w - 50, 600), INK_SOFT, "center", 600);
    text(ctx, t.players, MENU.x + 30, MENU.y + 196, 21, INK, "left");
    text(ctx, t.people, MENU.x + 30, MENU.y + 316, 21, INK, "left");
    const hint = t.peopleHint(choice.people, choice.total);
    text(ctx, hint, W / 2, MENU.y + 420, fitSize(ctx, hint, 18, MENU.w - 60, 600), INK_SOFT, "center", 600);
    ctx.save();
    if (choice.people >= choice.total) ctx.globalAlpha = 0.45;
    text(ctx, t.computer, MENU.x + 30, MENU.y + 462, 21, INK, "left");
    ctx.restore();
    const list = menuButtons();
    for (const b of list) drawButton(ctx, b);
    for (const d of DIFFICULTIES) {
      const b = list.find((x) => x.id === `level:${d}`);
      if (b && wins[d] > 0 && !b.disabled) text(ctx, `🏆 ${wins[d]}`, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h + 14, 15, INK_SOFT, "center", 600);
    }
  }

  function drawRules() {
    dim();
    const t = tr();
    drawPanel(ctx, RULES);
    text(ctx, t.rules, W / 2, RULES.y + 50, 34, INK);
    ctx.font = `600 19px ${FONT}`;
    let y = RULES.y + 102;
    t.rulesLines.forEach((line, i) => {
      ctx.font = `600 19px ${FONT}`;
      const lines = wrap(ctx, line, RULES.w - 86);
      ctx.beginPath();
      ctx.arc(RULES.x + 34, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[i % 4];
      ctx.fill();
      for (const l of lines) {
        text(ctx, l, RULES.x + 52, y + 1, 19, INK, "left", 600);
        y += 25;
      }
      y += 9;
    });
    drawButton(ctx, rulesClose());
  }

  function drawResult() {
    const t = tr();
    const k = clamp((now - overAt - RESULT_DELAY) / 0.3, 0, 1);
    dim();
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 30);
    drawPanel(ctx, RESULT);
    const winner = match.players.findIndex((p) => p.place === 1);
    const mine = online ? myIndex() : played.people === 1 ? match.players.findIndex((p) => p.seat === 0) : -1;
    const title = mine >= 0 ? t.youPlaced(match.players[mine].place ?? match.players.length) : t.wins(nameOf(winner));
    const color = mine >= 0 && match.players[mine].place !== 1 ? INK : COLORS[match.players[winner]?.corner ?? 0];
    text(ctx, title, W / 2, RESULT.y + 52, fitSize(ctx, title, 40, RESULT.w - 40), color);
    let line = "";
    if (online) {
      const r = results?.find((x) => x.seat === me);
      if (r && r.score > 0) line = t.score(r.score);
    } else if (mine >= 0) line = match.players[mine].place === 1 ? t.score(offlineScore()) : t.loseLine;
    if (line) text(ctx, line, W / 2, RESULT.y + 94, fitSize(ctx, line, 21, RESULT.w - 40, 600), INK_SOFT, "center", 600);
    // Standings
    const order = match.players.map((p, i) => ({ p, i })).sort((a, b) => (a.p.place ?? 9) - (b.p.place ?? 9));
    order.forEach(({ p, i }, row) => {
      const y = RESULT.y + 128 + row * 66;
      ctx.fillStyle = i === mine ? LIGHT[p.corner] : "rgba(74,44,23,0.05)";
      roundRect(ctx, { x: RESULT.x + 24, y, w: RESULT.w - 48, h: 58 }, 16);
      ctx.fill();
      const place = p.place ?? match.players.length;
      ctx.beginPath();
      ctx.arc(RESULT.x + 56, y + 29, 19, 0, Math.PI * 2);
      ctx.fillStyle = place === 1 ? "#f6c22e" : place === 2 ? "#cfd6dd" : place === 3 ? "#e0a165" : "#e9dccb";
      ctx.fill();
      text(ctx, String(place), RESULT.x + 56, y + 30, 22, INK);
      drawToken(ctx, tokenImg, p.corner, RESULT.x + 104, y + 54, 1.15);
      const name = nameOf(i);
      text(ctx, name, RESULT.x + 136, y + 22, fitSize(ctx, name, 22, RESULT.w - 260), INK, "left");
      text(ctx, subOf(i), RESULT.x + 136, y + 44, 16, INK_SOFT, "left", 600);
      const home = t.homeCount(p.tokens.filter((x) => x >= HOME).length);
      text(ctx, home, RESULT.x + RESULT.w - 40, y + 30, 18, INK_SOFT, "right", 600);
    });
    for (const b of resultButtons()) drawButton(ctx, b);
    ctx.restore();
  }

  function render() {
    stage.begin();
    drawBackground(ctx, stage.view);
    const colorOf = [0, 1, 2, 3].map((vc) => {
      const corner = (vc + rot) % 4;
      return match.players.some((p) => p.corner === corner) ? corner : null;
    });
    drawBoard(ctx, colorOf, rot, propsImg);
    drawTokens();
    drawParticles();
    drawPlayers();
    drawDieArea();
    for (const b of buttons()) drawRoundButton(ctx, b.id, b.label, b.x, b.y, ROUND_R);
    if (showResult()) drawResult();
    else drawStatus();
    if (overlay === "menu") drawMenu();
    else if (overlay === "rules") drawRules();
    stage.end();
  }

  // Taps: act on release, so a drag off a button cancels it
  let downAt: { id: number; x: number; y: number } | null = null;
  const pointer = {
    down(p: PointerInfo) {
      downAt = { id: p.id, x: p.x, y: p.y };
    },
    up(p: PointerInfo) {
      if (!downAt || downAt.id !== p.id) return;
      const moved = Math.hypot(p.x - downAt.x, p.y - downAt.y) > 24;
      downAt = null;
      if (!moved) tap(p);
    },
  };

  if (!online) for (const e of match.events.splice(0)) onEvent(e);

  return {
    update,
    render,
    pointer,
    keydown(e) {
      if (e.code === "Escape" && !online) {
        if (overlay === "rules") overlay = rulesFrom;
        else if (overlay === "menu" && canResume()) overlay = null;
        else if (!overlay) overlay = "menu";
      } else if ((e.code === "Space" || e.code === "Enter") && !overlay) roll();
      else if (/^Digit[1-4]$/.test(e.code) && canMove()) {
        const token = Number(e.code.slice(5)) - 1;
        if (movable().includes(token)) act({ kind: "move", token });
        else sfx.nope();
      }
    },
    dispose() {
      stopListening?.();
      save();
    },
  };
}
