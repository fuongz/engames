import "@fontsource/baloo-2/800.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, easeOutCubic, inRect } from "@web-games/core";
import {
  BOARD_Y,
  BOOSTERS,
  type Booster,
  CONFETTI,
  KIND_COLORS,
  TILE_H,
  TILE_W,
  bigButton,
  buttonRect,
  cellAt,
  cellCenter,
  drawButton,
  drawLink,
  drawPanel,
  drawTable,
  drawTile,
  drawTimer,
  gravityIcon,
  pill,
  text,
  tileGlow,
} from "./art";
import { BONUS_EVERY, COLS, FREEZE_TIME, H, LINE_TIME, ROWS, SLIDE_DELAY, SLIDE_TIME, W, gravityFor } from "./config";
import tilesUrl from "./img/tiles.webp";
import {
  type Cell,
  EMPTY,
  type MatchResult,
  type Pair,
  type Run,
  at,
  canMatch,
  createRun,
  match,
  nextLevel,
  parseRun,
  tick,
  useFreeze,
  useHint,
  useShuffle,
} from "./logic";
import { STRINGS } from "./strings";

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  t: number;
}

/** A just-matched pair: its line and the two tiles popping, drawn for LINE_TIME. */
interface Link {
  path: Cell[];
  kind: number;
  ends: Cell[];
  t: number;
}

const key = (c: Cell) => c.y * (COLS + 2) + c.x;
const sameCell = (a: Cell | null, b: Cell | null) => !!a && !!b && a.x === b.x && a.y === b.y;
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];

  const atlas = new Image();
  atlas.src = tilesUrl;
  const sheet = () => (atlas.complete && atlas.naturalWidth > 0 ? atlas : null);

  let run: Run = parseRun(storage.get<unknown>("run", null)) ?? createRun(newSeed());
  let best = storage.get<number>("best", 0);
  const save = () => storage.set("run", run);
  save();

  let selected: Cell | null = null;
  let hint: Pair | null = null;
  let links: Link[] = [];
  /** Tiles still sliding after gravity: cell key → where they came from, and the clock. */
  let slides = new Map<number, { from: Cell; t: number }>();
  let shakes = new Map<number, number>();
  let bits: Bit[] = [];
  let floaters: Floater[] = [];
  let toast: { text: string; t: number; color: string } | null = null;
  let intro = 0; // level banner clock
  let shuffleFx = 0;
  const presses: Partial<Record<Booster, number>> = {};
  let t = 0;
  let saveClock = 0;
  let lastSecond = Math.ceil(run.time);
  let firstMatch = run.level > 1;

  const view = () => stage.view;

  // ---------------------------------------------------------- actions

  function say(str: string, color = "#ffffff") {
    toast = { text: str, t: 0, color };
  }

  function resetTransient() {
    selected = null;
    hint = null;
    links = [];
    slides = new Map();
    shakes = new Map();
  }

  function tapTile(c: Cell) {
    if (at(run.board, c) === EMPTY) {
      selected = null;
      return;
    }
    if (!selected) {
      selected = c;
      audio.tone({ freq: 660, dur: 0.05, type: "triangle", vol: 0.06 });
      return;
    }
    if (sameCell(selected, c)) {
      selected = null;
      return;
    }
    const a = selected;
    if (at(run.board, a) !== at(run.board, c)) {
      // Different animals: pick the new one instead (classic)
      shakes.set(key(c), 0.25);
      selected = c;
      audio.tone({ freq: 220, dur: 0.06, type: "square", vol: 0.035 });
      return;
    }
    if (!canMatch(run.board, a, c)) {
      shakes.set(key(a), 0.3);
      shakes.set(key(c), 0.3);
      selected = null;
      audio.tone({ freq: 170, dur: 0.14, type: "square", vol: 0.05 });
      say(tr().noPath, "#ffc0c0");
      return;
    }
    const r = match(run, a, c);
    selected = null;
    if (r) onMatch(r, a, c);
  }

  function onMatch(r: MatchResult, a: Cell, b: Cell) {
    firstMatch = true;
    hint = null;
    links.push({ path: r.path, kind: r.kind, ends: [a, b], t: 0 });
    for (const end of [a, b]) {
      const p = cellCenter(end);
      pop(p.x, p.y, KIND_COLORS[r.kind] ?? "#fff", 14);
      pop(p.x, p.y, "#ffd0dc", 6);
    }
    // Tiles gravity moved slide in from their old cells; a tile already sliding
    // restarts from where it now sits logically
    const moved = new Set(r.slides.map((s) => key(s.from)));
    const next = new Map([...slides].filter(([k]) => !moved.has(k)));
    for (const s of r.slides) next.set(key(s.to), { from: s.from, t: 0 });
    slides = next;
    shakes = new Map();

    // Score text floats from the line's middle, kept clear of the HUD and the screen edges
    const m = cellCenter(r.path[Math.floor(r.path.length / 2)]);
    const mid = { x: Math.min(W - 100, Math.max(100, m.x)), y: Math.max(BOARD_Y + 70, m.y) };
    floaters.push({ x: mid.x, y: mid.y, text: `+${r.points}`, color: "#ffffff", size: 22, t: 0 });
    if (r.combo > 0) floaters.push({ x: mid.x, y: mid.y - 30, text: tr().combo(r.combo + 1), color: "#ffe14a", size: 26, t: 0 });
    const lift = Math.min(r.combo, 8) * 60;
    audio.tone({ freq: 523 + lift, dur: 0.08, type: "triangle", vol: 0.08 });
    audio.tone({ freq: 784 + lift, dur: 0.12, type: "triangle", vol: 0.08, delay: 0.07 });

    if (r.shuffled) {
      shuffleFx = 0.5;
      say(tr().autoShuffled, "#bff4ff");
      audio.tone({ freq: 300, to: 900, dur: 0.3, type: "sine", vol: 0.06, delay: 0.2 });
    }
    if (r.cleared) onWin();
    save();
  }

  function onWin() {
    if (run.score > best) {
      best = run.score;
      storage.set("best", best);
    }
    storage.set(SUMMARY_KEY, {
      vi: `Qua màn ${run.level}, ${run.score} điểm`,
      en: `Cleared level ${run.level}, ${run.score} pts`,
    });
    confetti(W / 2, 360, 90);
    for (const [i, f] of [523, 659, 784, 1046].entries())
      audio.tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.12, delay: 0.2 + i * 0.1 });
  }

  function onTimeUp() {
    selected = null;
    hint = null;
    if (run.score > best) {
      best = run.score;
      storage.set("best", best);
    }
    storage.set(SUMMARY_KEY, {
      vi: `Kỷ lục ${best} điểm`,
      en: `Best ${best} pts`,
    });
    // The run is over: a reload starts fresh
    storage.set("run", null);
    reportScore?.({ score: run.score, detail: tr().detail(run.level) });
    for (const [i, f] of [440, 370, 311, 262].entries())
      audio.tone({ freq: f, dur: 0.22, type: "triangle", vol: 0.1, delay: i * 0.14 });
  }

  function goNext() {
    if (run.phase !== "won") return;
    nextLevel(run);
    resetTransient();
    intro = 0;
    lastSecond = Math.ceil(run.time);
    save();
    audio.tone({ freq: 660, to: 990, dur: 0.15, type: "sine", vol: 0.08 });
  }

  function playAgain() {
    if (run.phase !== "over") return;
    run = createRun(newSeed());
    resetTransient();
    intro = 0;
    lastSecond = Math.ceil(run.time);
    save();
  }

  function booster(b: Booster) {
    if (run.phase !== "play") return;
    presses[b] = 0.15;
    if (b === "hint") {
      if (run.hints <= 0) return say(tr().noHint, "#ffc0c0");
      hint = useHint(run);
      selected = null;
      audio.tone({ freq: 880, to: 1320, dur: 0.16, type: "sine", vol: 0.07 });
    } else if (b === "shuffle") {
      if (!useShuffle(run)) return say(tr().noShuffle, "#ffc0c0");
      resetTransient();
      shuffleFx = 0.5;
      say(tr().shuffled, "#bff4ff");
      audio.noise(0.2, 0.06);
      audio.tone({ freq: 300, to: 900, dur: 0.3, type: "sine", vol: 0.06 });
    } else {
      if (run.freezes <= 0) return say(tr().noFreeze, "#ffc0c0");
      if (!useFreeze(run)) return say(tr().stillFrozen, "#bff4ff");
      say(tr().frozen(FREEZE_TIME), "#bff4ff");
      audio.tone({ freq: 1760, to: 880, dur: 0.4, type: "sine", vol: 0.07 });
    }
    save();
  }

  function pop(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 200;
      const life = 0.4 + Math.random() * 0.4;
      bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life, max: life, color, size: 4 + Math.random() * 4 });
    }
  }

  function confetti(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const v = 220 + Math.random() * 360;
      const life = 1.4 + Math.random();
      bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color: CONFETTI[i % CONFETTI.length], size: 6 });
    }
  }

  // ---------------------------------------------------------- input

  const overlayButton = (): Rect => ({ x: W / 2 - 130, y: 560, w: 260, h: 64 });

  function onPointerDown(p: PointerInfo) {
    if (run.phase === "won") {
      if (inRect(p, overlayButton())) goNext();
      return;
    }
    if (run.phase === "over") {
      if (inRect(p, overlayButton())) playAgain();
      return;
    }
    for (const b of BOOSTERS) {
      const r = buttonRect(b);
      // Round buttons: a little slack around the circle
      if (Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2)) <= r.w / 2 + 8) return booster(b);
    }
    const c = cellAt(p);
    if (c) tapTile(c);
    else selected = null;
  }

  function onKey(e: KeyboardEvent) {
    if (e.repeat) return;
    if (e.code === "KeyH") booster("hint");
    else if (e.code === "KeyS") booster("shuffle");
    else if (e.code === "KeyF") booster("freeze");
    else if (e.code === "Escape") selected = null;
    else if (e.code === "Enter" || e.code === "Space") {
      if (run.phase === "won") goNext();
      else if (run.phase === "over") playAgain();
    }
  }

  // ---------------------------------------------------------- frame

  function step(dt: number) {
    t += dt;
    intro += dt;
    if (tick(run, dt)) onTimeUp();
    if (run.phase === "play") {
      // A soft tick each second in the last ten
      const s = Math.ceil(run.time);
      if (s !== lastSecond && s <= 10 && s > 0 && run.frozen <= 0)
        audio.tone({ freq: s <= 5 ? 1200 : 900, dur: 0.03, type: "square", vol: 0.04 });
      lastSecond = s;
      saveClock += dt;
      if (saveClock > 5) {
        saveClock = 0;
        save();
      }
    }
    for (const l of links) l.t += dt;
    links = links.filter((l) => l.t < LINE_TIME);
    for (const [k, s] of slides) {
      s.t += dt;
      if (s.t >= SLIDE_DELAY + SLIDE_TIME) slides.delete(k);
    }
    for (const [k, v] of shakes) {
      if (v - dt <= 0) shakes.delete(k);
      else shakes.set(k, v - dt);
    }
    for (const b of bits) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 600 * dt;
      b.vx *= 0.985;
    }
    bits = bits.filter((b) => b.life > 0);
    for (const f of floaters) f.t += dt;
    floaters = floaters.filter((f) => f.t < 0.9);
    if (toast) {
      toast.t += dt;
      if (toast.t > 2.2) toast = null;
    }
    shuffleFx = Math.max(0, shuffleFx - dt);
    for (const b of BOOSTERS) presses[b] = Math.max(0, (presses[b] ?? 0) - dt);
  }

  /** Where a tile is drawn this frame (its cell, or partway back from where gravity took it). */
  function tilePos(c: Cell) {
    const home = cellCenter(c);
    let x = home.x - TILE_W / 2;
    let y = home.y - TILE_H / 2;
    const s = slides.get(key(c));
    if (s) {
      const from = cellCenter(s.from);
      const k = 1 - easeOutCubic((s.t - SLIDE_DELAY) / SLIDE_TIME);
      x += (from.x - home.x) * k;
      y += (from.y - home.y) * k;
    }
    const sh = shakes.get(key(c));
    if (sh) x += Math.sin(t * 70) * 4 * (sh / 0.3);
    return { x, y };
  }

  function draw() {
    const v = view();
    stage.begin();
    drawTable(ctx, v);
    drawHud();
    drawBoard();
    for (const l of links) drawLink(ctx, l.path, Math.min(1, (LINE_TIME - l.t) / 0.12));
    for (const b of bits) {
      ctx.globalAlpha = Math.min(1, (b.life / b.max) * 2);
      ctx.fillStyle = b.color;
      ctx.fillRect(Math.round(b.x - b.size / 2), Math.round(b.y - b.size / 2), b.size, b.size);
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, (0.9 - f.t) * 4);
      text(ctx, f.text, f.x, f.y - f.t * 50, f.size, f.color);
    }
    ctx.globalAlpha = 1;
    for (const b of BOOSTERS) {
      const n = b === "hint" ? run.hints : b === "shuffle" ? run.shuffles : run.freezes;
      const usable = n > 0 && run.phase === "play" && !(b === "freeze" && run.frozen > 0);
      drawButton(ctx, b, n, usable, presses[b] ? 1 : 0);
    }
    drawMessages();
    if (run.frozen > 0) frost(v);
    if (run.phase === "won") drawWin();
    if (run.phase === "over") drawOver();
    stage.end();
  }

  function drawBoard() {
    const img = sheet();
    const pulse = 0.6 + 0.4 * Math.sin(t * 8);
    const flip = shuffleFx > 0 ? Math.abs(Math.cos((1 - shuffleFx / 0.5) * Math.PI)) : 1;
    for (let y = 1; y <= ROWS; y++)
      for (let x = 1; x <= COLS; x++) {
        const c = { x, y };
        const kind = at(run.board, c) as number;
        if (kind === EMPTY) continue;
        const p = tilePos(c);
        if (flip < 1) {
          // Shuffle: every tile flips over and back
          const w = TILE_W * Math.max(0.08, flip);
          drawTile(ctx, img, kind, p.x + (TILE_W - w) / 2, p.y, w, TILE_H);
          continue;
        }
        const picked = sameCell(selected, c);
        drawTile(ctx, img, kind, p.x, picked ? p.y - 3 : p.y);
        if (picked) tileGlow(ctx, p.x, p.y - 3, "#ffe14a");
        else if (hint && (sameCell(hint.a, c) || sameCell(hint.b, c))) tileGlow(ctx, p.x, p.y, "#7af8ff", pulse);
      }
    // Matched tiles pop away while their line shows
    for (const l of links) {
      const k = l.t / LINE_TIME;
      const s = 1 + k * 0.25;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      for (const end of l.ends) {
        const p = cellCenter(end);
        drawTile(ctx, img, l.kind, p.x - (TILE_W * s) / 2, p.y - (TILE_H * s) / 2, TILE_W * s, TILE_H * s);
        if (k < 0.5) tileGlow(ctx, p.x - TILE_W / 2, p.y - TILE_H / 2, "#ffe14a");
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawHud() {
    const l = tr();
    const panel = { x: 16, y: 10, w: W - 32, h: 58 };
    drawPanel(ctx, panel);
    const mode = gravityFor(run.level);
    ctx.font = `800 15px "Baloo 2", system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#3a4a52";
    ctx.fillText(l.level(run.level), panel.x + 18, panel.y + 16);
    const lw = ctx.measureText(l.level(run.level)).width;
    gravityIcon(ctx, mode, panel.x + 18 + lw + 16, panel.y + 16, 24, "#3a4a52");
    ctx.font = `800 28px "Baloo 2", system-ui, sans-serif`;
    ctx.fillStyle = "#2a2440";
    ctx.fillText(String(run.score), panel.x + 18, panel.y + 40);
    const bar = { x: panel.x + 172, y: panel.y + 16, w: panel.w - 190, h: 26 };
    drawTimer(ctx, bar, run.time / run.timeMax, run.frozen > 0, t);
    if (run.frozen > 0) text(ctx, `${Math.ceil(run.frozen)}s`, bar.x + bar.w / 2, bar.y + bar.h / 2 + 1, 16, "#ffffff");
  }

  function drawMessages() {
    const l = tr();
    const y = BOARD_Y + ROWS * TILE_H - 40;
    if (run.phase === "play" && intro < 2) {
      // Level banner: number and this level's gravity
      const a = Math.min(1, intro * 4, (2 - intro) * 3);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(10,28,32,0.8)";
      ctx.fillRect(view().x, 400, view().w, 120);
      text(ctx, l.level(run.level), W / 2, 438, 40, "#ffe14a");
      const name = l.gravity[gravityFor(run.level)];
      text(ctx, name, W / 2 + 16, 488, 22, "#bff4ff");
      gravityIcon(ctx, gravityFor(run.level), W / 2 + 16 - ctx.measureText(name).width / 2 - 22, 488, 26, "#bff4ff");
      ctx.globalAlpha = 1;
    }
    if (toast) {
      ctx.globalAlpha = Math.min(1, toast.t * 6, (2.2 - toast.t) * 3);
      pill(ctx, toast.text, W / 2, y, 17, toast.color);
      ctx.globalAlpha = 1;
    } else if (!firstMatch && run.phase === "play" && intro >= 2) {
      pill(ctx, l.tapHint, W / 2, y, 15, "#ffffff");
    }
  }

  function frost(v: Rect) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 360, W / 2, H / 2, 760);
    g.addColorStop(0, "rgba(180,236,255,0)");
    g.addColorStop(1, `rgba(180,236,255,${0.28 + 0.06 * Math.sin(t * 3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function dim() {
    const v = view();
    ctx.fillStyle = "rgba(6,20,22,0.72)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function drawWin() {
    const l = tr();
    dim();
    text(ctx, l.won, W / 2, 360, 56, "#ffe14a");
    text(ctx, l.wonLine(run.level), W / 2, 420, 22, "#ffffff", "center", 700);
    text(ctx, l.bonus(run.bonus), W / 2, 458, 20, "#9affb0", "center", 700);
    text(ctx, l.reward(run.level % BONUS_EVERY === 0), W / 2, 494, 18, "#bff4ff", "center", 700);
    bigButton(ctx, overlayButton(), l.next);
  }

  function drawOver() {
    const l = tr();
    dim();
    text(ctx, l.timeUp, W / 2, 360, 56, "#ff8a7a");
    text(ctx, l.overLine(run.score, run.level), W / 2, 424, 22, "#ffffff", "center", 700);
    text(ctx, l.best(best), W / 2, 464, 20, "#ffe14a", "center", 700);
    bigButton(ctx, overlayButton(), l.again);
  }

  return {
    update: step,
    render: draw,
    pointer: { down: onPointerDown },
    keydown: onKey,
    suspend: () => {
      if (run.phase !== "over") save();
    },
    dispose: () => {
      if (run.phase !== "over") save();
    },
  };
}
