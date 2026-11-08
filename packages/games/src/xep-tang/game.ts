import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/800.css";
import { type GameHooks, type Rect, type Runtime, SUMMARY_KEY, clamp, easeOutCubic, fitFontSize, inRect, lerp } from "@web-games/core";
import { type Camera, FONT, drawButton, drawCard, drawPlinth, drawRipple, drawSky, drawSlab, inkFor, project, text } from "./art";
import { H, PLAY_ANCHOR_Y, PLINTH_H, SCALE, SLAB_H, SPAN, W } from "./config";
import { type Axis, type Box, type Drop, type Run, createRun, drop, hueFor, moverBox, parseBest, start, tick, top } from "./logic";
import { STRINGS } from "./strings";

/** A sliced-off piece (or the whole missed slab) tumbling away. */
interface Piece {
  box: Box;
  /** World height of its underside. */
  y: number;
  vy: number;
  vx: number;
  vz: number;
  rot: number;
  spin: number;
  hue: number;
  t: number;
}

/** A spark in world space, from a perfect drop. */
interface Spark {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  hue: number;
}

const GRAVITY = 7;
const PIECE_LIFE = 1.6;
/** Major pentatonic steps: each perfect in a row rings a note higher. */
const CHIME = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
/** Card and button for the game-over screen. */
const CARD: Rect = { x: 50, y: 610, w: W - 100, h: 318 };
const AGAIN: Rect = { x: W / 2 - 140, y: 834, w: 280, h: 66 };
/** Region the whole tower zooms into at game over. */
const OVER_TOP = 140;
const OVER_BOTTOM = 590;

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];

  let best = parseBest(storage.get<unknown>("best", 0));
  let run: Run = createRun(newSeed());
  let paused = false;
  let t = 0;
  /** Seconds since the run ended (camera zoom, card fade, input guard). */
  let overT = 0;
  let newBest = false;

  const cam: Camera = { focusY: 0, zoom: 1, anchorY: PLAY_ANCHOR_Y, dx: 0, dy: 0 };
  /** Floor the sky shows, eased toward the score. */
  let skyFloor = 0;
  let nudge = 0;
  let shake = 0;
  /** The newest slab's landing squash, 1 → 0. */
  let squash = 0;
  let ripples: { box: Box; y: number; t: number }[] = [];
  let pieces: Piece[] = [];
  let sparks: Spark[] = [];
  let banner: { text: string; sub: string | null; t: number } | null = null;
  let pressed = 0;
  /** The mover's position before the last update, for drawing between fixed steps. */
  let prevPos = run.mover.pos;
  let prevDir = run.mover.dir;

  // ---------------------------------------------------------- actions

  function begin() {
    start(run);
    audio.tone({ freq: 392, to: 587, dur: 0.18, type: "sine", vol: 0.08 });
  }

  function restart() {
    run = createRun(newSeed());
    start(run);
    overT = 0;
    newBest = false;
    pieces = [];
    sparks = [];
    ripples = [];
    banner = null;
    prevPos = run.mover.pos;
    audio.tone({ freq: 392, to: 587, dur: 0.18, type: "sine", vol: 0.08 });
  }

  function onDrop(d: Drop) {
    if (d.kind === "miss") return onMiss(d.axis, d.box);
    const level = run.score;
    const y0 = (level - 1) * SLAB_H;
    squash = 1;
    if (d.cut) launch(d.cut, d.axis, y0, hueFor(run, level), centreOf(top(run), d.axis));
    if (d.perfect) {
      nudge = 7;
      ripples.push({ box: d.box, y: y0 + SLAB_H, t: 0 });
      ripples.push({ box: d.box, y: y0 + SLAB_H, t: -0.12 });
      burst(d.box, y0 + SLAB_H, hueFor(run, level), d.grew ? 26 : 16);
      const step = CHIME[Math.min(d.streak - 1, CHIME.length - 1)];
      const f = 587.33 * 2 ** (step / 12);
      audio.tone({ freq: f, dur: 0.32, type: "sine", vol: 0.11 });
      audio.tone({ freq: f * 2, dur: 0.22, type: "triangle", vol: 0.03, delay: 0.01 });
      if (d.grew) audio.tone({ freq: f * 1.5, to: f * 2, dur: 0.25, type: "sine", vol: 0.06, delay: 0.09 });
      const l = tr();
      banner = { text: d.streak > 1 ? l.streak(d.streak) : l.perfect, sub: d.grew ? l.grew : null, t: 0 };
    } else {
      nudge = 4;
      audio.tone({ freq: 150, to: 92, dur: 0.11, type: "triangle", vol: 0.12 });
      audio.noise(0.06, 0.035);
    }
  }

  function onMiss(axis: Axis, box: Box) {
    const y0 = run.score * SLAB_H;
    launch(box, axis, y0, hueFor(run, run.score + 1), centreOf(top(run), axis));
    shake = 0.35;
    overT = 0;
    banner = null;
    audio.tone({ freq: 320, to: 70, dur: 0.55, type: "sine", vol: 0.12 });
    audio.noise(0.25, 0.05);
    newBest = run.score > best;
    if (newBest) {
      best = run.score;
      storage.set("best", best);
      for (const [i, f] of [523, 659, 784, 1046].entries())
        audio.tone({ freq: f, dur: 0.2, type: "triangle", vol: 0.08, delay: 0.55 + i * 0.09 });
    }
    storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(best), en: STRINGS.en.summary(best) });
    reportScore?.({ score: run.score, detail: tr().detail(run.score, run.perfects) });
  }

  const centreOf = (b: Box, axis: Axis) => (axis === "x" ? b.x : b.z);

  /** Send a piece tumbling outward along `axis`, away from the tower's centre. */
  function launch(box: Box, axis: Axis, y: number, hue: number, from: number) {
    const side = Math.sign(centreOf(box, axis) - from) || 1;
    const push = 0.5 + Math.random() * 0.3;
    pieces.push({
      box: { ...box },
      y,
      vy: 0.6,
      vx: axis === "x" ? side * push : 0,
      vz: axis === "z" ? side * push : 0,
      rot: 0,
      // Tumble away from the tower on screen: +x drifts right, +z drifts left
      spin: (axis === "x" ? side : -side) * (1.4 + Math.random() * 1.2),
      hue,
      t: 0,
    });
    audio.noise(0.09, 0.025);
  }

  function burst(b: Box, y: number, hue: number, n: number) {
    for (let i = 0; i < n; i++) {
      // Spawn on the rim of the top face
      const edge = Math.random() * 4;
      const k = edge % 1;
      const side = Math.floor(edge);
      const x = b.x + (side === 0 ? -0.5 + k : side === 1 ? 0.5 : side === 2 ? 0.5 - k : -0.5) * b.w;
      const z = b.z + (side === 0 ? -0.5 : side === 1 ? -0.5 + k : side === 2 ? 0.5 : 0.5 - k) * b.d;
      const life = 0.6 + Math.random() * 0.5;
      sparks.push({
        x,
        y,
        z,
        vx: (x - b.x) * 0.8,
        vy: 0.5 + Math.random() * 0.9,
        vz: (z - b.z) * 0.8,
        life,
        max: life,
        hue,
      });
    }
  }

  // ---------------------------------------------------------- input

  function act(fromKey: boolean, p?: { x: number; y: number }) {
    if (paused) {
      paused = false;
      return;
    }
    if (run.phase === "ready") return begin();
    if (run.phase === "play") {
      const d = drop(run);
      if (d) onDrop(d);
      prevPos = run.mover.pos;
      prevDir = run.mover.dir;
      return;
    }
    // Over: a short guard so a frantic last tap doesn't restart at once
    if (overT < 0.9) return;
    if (fromKey || (p && inRect(p, { x: AGAIN.x - 10, y: AGAIN.y - 10, w: AGAIN.w + 20, h: AGAIN.h + 20 }))) {
      pressed = 0.12;
      restart();
    }
  }

  // ---------------------------------------------------------- frame

  function update(dt: number) {
    t += dt;
    prevPos = run.mover.pos;
    prevDir = run.mover.dir;
    if (!paused) tick(run, dt);
    if (run.phase === "over") overT += dt;

    // Camera: follow the top while playing, pull back to the whole tower after
    const towerTop = run.score * SLAB_H;
    const ease = (rate: number) => 1 - Math.exp(-rate * dt);
    if (run.phase === "over" && overT > 0.45) {
      const span = (towerTop + PLINTH_H) * SCALE + SCALE;
      const zoom = Math.min(1, (OVER_BOTTOM - OVER_TOP) / span);
      cam.zoom = lerp(cam.zoom, zoom, ease(3));
      cam.focusY = lerp(cam.focusY, (towerTop - PLINTH_H) / 2, ease(3));
      cam.anchorY = lerp(cam.anchorY, (OVER_TOP + OVER_BOTTOM) / 2, ease(3));
    } else {
      cam.zoom = lerp(cam.zoom, 1, ease(5));
      cam.focusY = lerp(cam.focusY, towerTop, ease(5));
      cam.anchorY = lerp(cam.anchorY, PLAY_ANCHOR_Y, ease(5));
    }
    skyFloor = lerp(skyFloor, run.score, ease(1.5));
    nudge = Math.max(0, nudge - dt * 40);
    shake = Math.max(0, shake - dt);
    cam.dy = nudge * Math.sin(Math.min(1, nudge / 7) * Math.PI) + Math.sin(t * 61) * shake * 10;
    cam.dx = Math.cos(t * 47) * shake * 10;
    squash = Math.max(0, squash - dt / 0.22);
    pressed = Math.max(0, pressed - dt);

    for (const r of ripples) r.t += dt;
    ripples = ripples.filter((r) => r.t < 0.7);
    for (const p of pieces) {
      p.t += dt;
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      p.box.x += p.vx * dt;
      p.box.z += p.vz * dt;
      p.rot += p.spin * dt * clamp(p.t * 3, 0, 1);
    }
    pieces = pieces.filter((p) => p.t < PIECE_LIFE);
    for (const s of sparks) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy -= 1.2 * dt;
    }
    sparks = sparks.filter((s) => s.life > 0);
    if (banner) {
      banner.t += dt;
      if (banner.t > 1.1) banner = null;
    }
  }

  function render(alpha: number) {
    const v = stage.view;
    stage.begin();
    const sky = drawSky(ctx, v, skyFloor, t);
    const ink = inkFor(sky.lum);
    const topBox = top(run);
    const depthKey = topBox.x + topBox.z;

    // Pieces behind the tower first, the rest after it
    for (const p of pieces) if (p.box.x + p.box.z < depthKey) drawPiece(p);
    drawTower();
    for (const r of ripples) if (r.t > 0) drawRipple(ctx, cam, r.box, r.y, r.t / 0.7);
    if (run.phase === "play") drawMover(alpha);
    else if (run.phase === "ready") drawGlide();
    for (const p of pieces) if (p.box.x + p.box.z >= depthKey) drawPiece(p);
    drawSparks();

    if (run.phase === "ready") drawStart(ink);
    else if (run.phase === "play") drawHud(ink);
    else drawOver(ink);
    if (paused && run.phase === "play") drawPaused(v);
    stage.end();
  }

  function drawTower() {
    const n = run.stack.length;
    drawPlinth(ctx, cam, run.stack[0], PLINTH_H * 2.2, hueFor(run, 0));
    // Only the slabs that can be on screen
    const s = SCALE * cam.zoom;
    const below = Math.ceil((H + 240 - cam.anchorY) / (SLAB_H * s)) + 2;
    const from = cam.zoom < 1 ? 1 : Math.max(1, Math.floor(cam.focusY / SLAB_H) - below);
    for (let i = from; i < n; i++) {
      const y0 = (i - 1) * SLAB_H;
      const h = i === n - 1 ? SLAB_H * (1 - 0.28 * Math.sin(squash * Math.PI)) : SLAB_H;
      drawSlab(ctx, cam, run.stack[i], y0, y0 + h, hueFor(run, i));
    }
  }

  function drawMover(alpha: number) {
    const m = moverBox(run);
    // Between fixed steps, unless it just bounced
    const pos = prevDir === run.mover.dir ? lerp(prevPos, run.mover.pos, alpha) : run.mover.pos;
    const b = run.mover.axis === "x" ? { ...m, x: pos } : { ...m, z: pos };
    const y0 = run.score * SLAB_H;
    drawSlab(ctx, cam, b, y0, y0 + SLAB_H, hueFor(run, run.score + 1));
  }

  /** On the start screen the first slab drifts to and fro, showing what is coming. */
  function drawGlide() {
    const m = moverBox(run);
    const b = { ...m, x: Math.sin(t * 1.4) * SPAN * 0.75 };
    drawSlab(ctx, cam, b, 0, SLAB_H, hueFor(run, 1));
  }

  function drawPiece(p: Piece) {
    const a = clamp((PIECE_LIFE - p.t) / 0.6, 0, 1);
    if (a <= 0) return;
    const c = project(cam, p.box.x, p.y + SLAB_H / 2, p.box.z);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(c.x, c.y);
    ctx.rotate(p.rot);
    ctx.translate(-c.x, -c.y);
    drawSlab(ctx, cam, p.box, p.y, p.y + SLAB_H, p.hue);
    ctx.restore();
  }

  function drawSparks() {
    for (const s of sparks) {
      const p = project(cam, s.x, s.y, s.z);
      const k = s.life / s.max;
      const r = (2 + 3 * k) * cam.zoom;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillStyle = `hsl(${s.hue} 90% 92%)`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r * 1.6);
      ctx.lineTo(p.x + r, p.y);
      ctx.lineTo(p.x, p.y + r * 1.6);
      ctx.lineTo(p.x - r, p.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  type Ink = ReturnType<typeof inkFor>;

  function drawHud(ink: Ink) {
    text(ctx, String(run.score), W / 2, 150, 112, ink.ink, { shadow: ink.shadow });
    if (banner) {
      const k = banner.t;
      const a = Math.min(1, k * 8, (1.1 - k) * 4);
      const pop = 1 + 0.18 * (1 - easeOutCubic(k * 5));
      ctx.globalAlpha = a;
      text(ctx, banner.text, W / 2, 232 - k * 10, 30 * pop, ink.ink, { shadow: ink.shadow });
      if (banner.sub) text(ctx, banner.sub, W / 2, 268 - k * 10, 20, ink.soft, { weight: 600 });
      ctx.globalAlpha = 1;
    }
  }

  function drawStart(ink: Ink) {
    const l = tr();
    const size = fitFontSize(ctx, l.title, 92, W - 60, FONT);
    text(ctx, l.title, W / 2, 168, size, ink.ink, { shadow: ink.shadow, spacing: 4 });
    if (best > 0) text(ctx, l.best(best), W / 2, 232, 22, ink.soft, { weight: 600 });
    const pulse = 0.6 + 0.4 * Math.sin(t * 3.2);
    ctx.globalAlpha = pulse;
    text(ctx, l.tapToStart, W / 2, 318, 34, ink.ink, { shadow: ink.shadow });
    ctx.globalAlpha = 1;
    const hs = fitFontSize(ctx, l.startHint, 19, W - 70, FONT, 600);
    text(ctx, l.startHint, W / 2, 362, hs, ink.soft, { weight: 600 });
  }

  function drawOver(ink: Ink) {
    const l = tr();
    const a = clamp((overT - 0.7) / 0.35, 0, 1);
    // The score stays up top until the card takes over
    if (a < 1) {
      ctx.globalAlpha = 1 - a;
      text(ctx, String(run.score), W / 2, 150, 112, ink.ink, { shadow: ink.shadow });
      ctx.globalAlpha = 1;
    }
    if (a <= 0) return;
    const rise = (1 - easeOutCubic(a)) * 40;
    const r = { ...CARD, y: CARD.y + rise };
    drawCard(ctx, r, a);
    const hue = hueFor(run, run.score);
    ctx.globalAlpha = a;
    text(ctx, l.over.toUpperCase(), W / 2, r.y + 38, 18, "#8a7c9a", { weight: 600, spacing: 3 });
    text(ctx, String(run.score), W / 2, r.y + 100, 84, `hsl(${hue} 45% 38%)`);
    text(ctx, l.floors, W / 2, r.y + 148, 20, "#6e6182", { weight: 600 });
    const line = newBest ? `${l.newBest} · ${l.perfects(run.perfects)}` : `${l.best(best)} · ${l.perfects(run.perfects)}`;
    const ls = fitFontSize(ctx, line, 19, r.w - 40, FONT, 600);
    text(ctx, line, W / 2, r.y + 186, ls, newBest ? `hsl(${hue} 60% 40%)` : "#5a4d6e", { weight: 600 });
    ctx.globalAlpha = 1;
    drawButton(ctx, { ...AGAIN, y: AGAIN.y + rise }, l.again, hue, pressed > 0, a);
  }

  function drawPaused(v: Rect) {
    const l = tr();
    ctx.fillStyle = "rgba(20,14,40,0.55)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    text(ctx, l.paused, W / 2, H / 2 - 30, 48, "#ffffff");
    text(ctx, l.tapToResume, W / 2, H / 2 + 26, 24, "#fff4e0", { weight: 600 });
  }

  return {
    update,
    render,
    pointer: { down: (p) => act(false, p) },
    keydown(e) {
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        act(true);
      }
    },
    suspend() {
      if (run.phase === "play") paused = true;
    },
  };
}
