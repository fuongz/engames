import "@fontsource/baloo-2/800.css";
import { type GameContext, type GameInstance, SUMMARY_KEY } from "../core/types";
import { Loop, Stage, type PointerInfo } from "../core/stage";
import {
  CENTER,
  ENEMIES,
  H,
  LEVEL_COLORS,
  MAX_LEVEL,
  PATH_END,
  PATH_START,
  SLOT_R,
  START_BASE_HP,
  TRACK_R,
  W,
  bladeHalf,
  bladeOrbit,
  critterSize,
  speciesFor,
} from "./config";
import {
  OUTLINE,
  drawBaseBar,
  drawBlade,
  drawBladeTrail,
  drawCritter,
  drawEgg,
  drawEnemy,
  drawHand,
  drawKid,
  renderBackground,
  roundRect,
  text,
} from "./art";
import {
  SLOTS,
  blades,
  canSummon,
  createGame,
  critterAt,
  dropCritter,
  enemyPos,
  slotAt,
  summon,
  summonPrice,
  update,
  type GameEvent,
  type GameState,
  type Vec,
} from "./logic";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "spark" | "smoke" | "star";
}

interface FlyingEgg {
  from: Vec;
  t: number;
}

interface Evolution {
  level: number;
  t: number;
}

const KID = { x: CENTER.x + Math.cos(PATH_END) * TRACK_R + 2, y: CENTER.y + Math.sin(PATH_END) * TRACK_R - 4 };
const GATE = { x: CENTER.x + Math.cos(PATH_START - 0.05) * TRACK_R, y: KID.y + 52 };
const EGG_HUD = { x: 222, y: 40 };
const BUTTON = { x: 270 - 120, y: 800, w: 240, h: 72 };
const RESTART = { x: 270 - 110, y: 600, w: 220, h: 66 };
const EVOLVE_REVEAL = 1.9;
/** Matches the tree line at the top and bottom of the background. */
const FOREST = "#2f8a3c";

const inRect = (p: Vec, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export function startGame(root: HTMLElement, { storage, audio, reportScore }: GameContext): GameInstance {
  // Canvas text silently falls back until the face is loaded; ask for it up front.
  void document.fonts?.load('800 20px "Baloo 2"');
  const stage = new Stage(root, W, H, { bleed: true });
  const { ctx } = stage;
  const background = renderBackground();

  let state: GameState = createGame();
  let particles: Particle[] = [];
  let eggs: FlyingEgg[] = [];
  let beams: { slot: number; t: number }[] = [];
  let banner: { text: string; color: string; t: number } | null = null;
  let evolution: Evolution | null = null;
  let display = new Map<number, Vec>();
  let drag: { id: number; x: number; y: number } | null = null;
  let buttonDown = false;
  let eggBump = 0;
  let kidHurt = 0;
  let shake = 0;
  let lastHitSound = 0;
  let t = 0;
  let tutorial = !storage.get("tutorialDone", false);
  const dex = new Set<number>(storage.get<number[]>("dex", [1]));
  let best = storage.get("best", { wave: 0, score: 0 });
  let savedRun = false;

  function restart() {
    state = createGame();
    particles = [];
    eggs = [];
    beams = [];
    display = new Map();
    drag = null;
    evolution = null;
    savedRun = false;
  }

  // ---------------------------------------------------------- effects & sound

  function burst(x: number, y: number, n: number, color: string, kind: Particle["kind"], speed = 120) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const max = kind === "smoke" ? 0.55 : 0.45;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === "smoke" ? 30 : 0), life: max, max, size: kind === "smoke" ? 9 + Math.random() * 7 : 3 + Math.random() * 3, color, kind });
    }
  }

  function handle(e: GameEvent) {
    switch (e.type) {
      case "hit": {
        burst(e.x, e.y - 10, 3, LEVEL_COLORS[e.level - 1], "spark", 140);
        if (t - lastHitSound > 0.05) {
          audio.tone({ freq: 620, to: 320, dur: 0.05, type: "square", vol: 0.05 });
          lastHitSound = t;
        }
        break;
      }
      case "kill":
        burst(e.x, e.y - 8, 7, "rgba(240,240,235,0.9)", "smoke", 70);
        burst(e.x, e.y - 8, 6, "#ffe066", "star", 160);
        audio.noise(0.12, 0.1);
        audio.tone({ freq: 340, to: 110, dur: 0.14, type: "triangle", vol: 0.12 });
        break;
      case "egg":
        for (let i = 0; i < e.amount; i++) eggs.push({ from: { x: e.x + i * 10, y: e.y }, t: -i * 0.12 });
        break;
      case "leak":
        kidHurt = 0.5;
        shake = 0.25;
        audio.tone({ freq: 220, to: 70, dur: 0.3, type: "sawtooth", vol: 0.15 });
        break;
      case "merge": {
        const s = SLOTS[e.slot];
        burst(s.x, s.y, 18, "#fff8b0", "star", 220);
        burst(s.x, s.y, 10, LEVEL_COLORS[e.level - 1], "spark", 180);
        shake = 0.12;
        for (const [i, f] of [523, 659, 784].entries()) audio.tone({ freq: f, dur: 0.12, type: "square", vol: 0.1, delay: i * 0.06 });
        if (tutorial) {
          tutorial = false;
          storage.set("tutorialDone", true);
        }
        break;
      }
      case "evolve":
        if (!dex.has(e.level)) {
          dex.add(e.level);
          storage.set("dex", [...dex]);
          evolution = { level: e.level, t: 0 };
          drag = null;
          state.held = null;
          audio.tone({ freq: 200, to: 900, dur: EVOLVE_REVEAL, type: "sine", vol: 0.12 });
        }
        break;
      case "summon":
        beams.push({ slot: e.slot, t: 0 });
        audio.tone({ freq: 380, to: 900, dur: 0.25, type: "sine", vol: 0.15 });
        break;
      case "move":
        audio.tone({ freq: 300, to: 260, dur: 0.06, type: "triangle", vol: 0.08 });
        break;
      case "wave": {
        const boss = e.wave % 5 === 0;
        banner = { text: boss ? `ĐỢT ${e.wave} · BOSS!` : `ĐỢT ${e.wave}`, color: boss ? "#ff5a5a" : "#fff", t: 0 };
        audio.tone({ freq: 440, dur: 0.1, type: "square", vol: 0.1 });
        audio.tone({ freq: 660, dur: 0.18, type: "square", vol: 0.1, delay: 0.1 });
        break;
      }
      case "waveClear":
        eggs.push({ from: { x: CENTER.x, y: CENTER.y }, t: 0 });
        break;
      case "gameover":
        reportScore?.({ score: state.score, detail: `Đợt ${state.wave}` });
        for (const [i, f] of [440, 349, 262, 196].entries()) audio.tone({ freq: f, dur: 0.22, type: "triangle", vol: 0.15, delay: i * 0.18 });
        break;
    }
  }

  function saveRun() {
    if (savedRun) return;
    savedRun = true;
    if (state.score > best.score || state.wave > best.wave) {
      best = { wave: Math.max(best.wave, state.wave), score: Math.max(best.score, state.score) };
      storage.set("best", best);
      storage.set(SUMMARY_KEY, `Đợt ${best.wave} · ${best.score} điểm`);
    }
  }

  // ---------------------------------------------------------- input

  stage.onPointer({
    down(p: PointerInfo) {
      audio.unlock();
      if (evolution) {
        if (evolution.t > EVOLVE_REVEAL + 0.4) evolution = null;
        return;
      }
      if (state.over) {
        if (inRect(p, RESTART)) {
          audio.tone({ freq: 660, dur: 0.08, vol: 0.1 });
          restart();
        }
        return;
      }
      if (inRect(p, BUTTON)) {
        buttonDown = true;
        if (summon(state)) eggBump = 0.25;
        else audio.tone({ freq: 160, dur: 0.08, type: "square", vol: 0.08 });
        return;
      }
      const slot = slotAt(p.x, p.y, SLOT_R + 8);
      const critter = slot === null ? undefined : critterAt(state, slot);
      if (critter) {
        drag = { id: critter.id, x: p.x, y: p.y };
        state.held = critter.id;
        audio.tone({ freq: 500, dur: 0.05, type: "triangle", vol: 0.08 });
      }
    },
    move(p: PointerInfo) {
      if (drag) {
        drag.x = p.x;
        drag.y = p.y;
      }
    },
    up(p: PointerInfo) {
      buttonDown = false;
      if (!drag) return;
      const result = dropCritter(state, drag.id, slotAt(p.x, p.y, SLOT_R + 16));
      if (result === "move" || result === "swap" || result === "none") display.set(drag.id, { x: drag.x, y: drag.y });
      drag = null;
      state.held = null;
    },
  });

  // ---------------------------------------------------------- frame

  function step(dt: number) {
    t += dt;
    if (evolution) {
      evolution.t += dt;
      if (evolution.t > 6) evolution = null;
    } else {
      update(state, dt);
    }
    for (const e of state.events) handle(e);
    state.events.length = 0;
    if (state.over) saveRun();

    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy = p.vy * 0.9 + (p.kind === "star" ? 260 * dt : 0);
    }
    particles = particles.filter((p) => p.life > 0);
    for (const egg of eggs) egg.t += dt * 1.6;
    const landed = eggs.filter((e) => e.t >= 1).length;
    if (landed) {
      eggBump = 0.25;
      audio.tone({ freq: 880, to: 1320, dur: 0.1, type: "triangle", vol: 0.1 });
    }
    eggs = eggs.filter((e) => e.t < 1);
    for (const b of beams) b.t += dt;
    beams = beams.filter((b) => b.t < 0.7);
    if (banner) {
      banner.t += dt;
      if (banner.t > 1.8) banner = null;
    }
    eggBump = Math.max(0, eggBump - dt);
    kidHurt = Math.max(0, kidHurt - dt);
    shake = Math.max(0, shake - dt);

    // Ease critters toward their slot after a move/swap/bad drop
    const k = 1 - Math.exp(-dt * 16);
    for (const c of state.critters) {
      const target = SLOTS[c.slot];
      const cur = display.get(c.id) ?? { x: target.x, y: target.y };
      display.set(c.id, { x: cur.x + (target.x - cur.x) * k, y: cur.y + (target.y - cur.y) * k });
    }

    draw();
  }

  function critterPos(id: number, slot: number): Vec {
    if (drag && drag.id === id) return { x: drag.x, y: drag.y - 10 };
    return display.get(id) ?? SLOTS[slot];
  }

  function draw() {
    stage.begin();
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 30, (Math.random() - 0.5) * shake * 30);
    // Bleed: continue the forest above and below the play area on tall phones
    const v = stage.view;
    ctx.fillStyle = FOREST;
    ctx.fillRect(v.x - 20, v.y - 20, v.w + 40, v.h + 40);
    ctx.drawImage(background, 0, 0, W, H);

    // Merge targets light up while dragging
    if (drag) {
      const heldId = drag.id;
      const held = state.critters.find((c) => c.id === heldId);
      for (const c of state.critters) {
        if (!held || c === held || c.level !== held.level || c.level >= MAX_LEVEL) continue;
        const s = SLOTS[c.slot];
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(t * 10) * 0.3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, SLOT_R + 6, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#fff36b";
        ctx.stroke();
        ctx.restore();
      }
      const hover = slotAt(drag.x, drag.y, SLOT_R + 16);
      if (hover !== null) {
        const s = SLOTS[hover];
        ctx.beginPath();
        ctx.arc(s.x, s.y, SLOT_R, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fill();
      }
    }

    // Enemies, back to front
    const sorted = [...state.enemies].sort((a, b) => enemyPos(a).y - enemyPos(b).y);
    for (const e of sorted) {
      const pos = enemyPos(e);
      // Walking direction is the path tangent; face left or right accordingly
      const facing = Math.sin(pos.angle) >= 0 ? -1 : 1;
      drawEnemy(ctx, e.kind, pos.x, pos.y, t + e.id * 0.37, facing, e.flash);
    }
    drawBaseBar(ctx, GATE.x, GATE.y, state.baseHp / START_BASE_HP, t);
    drawKid(ctx, KID.x, KID.y, t, kidHurt);

    // Critters and their spinning blades
    const critters = [...state.critters].sort((a, b) => (drag?.id === a.id ? 1 : drag?.id === b.id ? -1 : SLOTS[a.slot].y - SLOTS[b.slot].y));
    for (const c of critters) {
      const pos = critterPos(c.id, c.slot);
      const sp = speciesFor(c.level);
      const trail = sp.blade === "leek" ? "#7cf05a" : sp.blade === "gold" ? "#ffe14a" : "#5dffa8";
      for (const b of blades(c, pos)) drawBladeTrail(ctx, pos.x, pos.y, bladeOrbit(c.level), bladeHalf(c.level) * 0.9, b.angle, trail);
      const pop = c.pop > 0 ? 1 + Math.sin((c.pop / 0.45) * Math.PI) * 0.35 : 1;
      drawCritter(ctx, c.level, pos.x, pos.y, { t, scale: (drag?.id === c.id ? 1.15 : 1) * pop, glow: c.level >= 2 });
      for (const b of blades(c, pos)) drawBlade(ctx, sp.blade, b.x1, b.y1, b.x2, b.y2);
    }

    // HP numbers above enemies, level numbers above critters
    for (const e of sorted) {
      const pos = enemyPos(e);
      text(ctx, String(Math.max(0, e.hp)), pos.x, pos.y - ENEMIES[e.kind].radius * 2.9 - 6, 20);
    }
    for (const c of critters) {
      const pos = critterPos(c.id, c.slot);
      text(ctx, String(c.level), pos.x + 4, pos.y - critterSize(c.level) * 1.45, 22, LEVEL_COLORS[c.level - 1]);
    }

    // Hatch beams
    for (const b of beams) {
      const s = SLOTS[b.slot];
      const a = 1 - b.t / 0.7;
      const g = ctx.createLinearGradient(s.x, s.y - 140, s.x, s.y + 20);
      g.addColorStop(0, "rgba(255,250,170,0)");
      g.addColorStop(1, `rgba(255,240,120,${a * 0.9})`);
      ctx.fillStyle = g;
      ctx.fillRect(s.x - 26, s.y - 140, 52, 160);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 30 + b.t * 30, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,200,${a * 0.6})`;
      ctx.fill();
    }

    for (const p of particles) {
      const a = p.life / p.max;
      ctx.globalAlpha = a;
      if (p.kind === "star") {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(t * 8);
        ctx.fillRect(-p.size, -p.size * 0.35, p.size * 2, p.size * 0.7);
        ctx.fillRect(-p.size * 0.35, -p.size, p.size * 0.7, p.size * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.kind === "smoke" ? p.size * (1.6 - a * 0.6) : p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Eggs flying to the counter on a little arc
    for (const egg of eggs) {
      if (egg.t < 0) continue;
      const k = egg.t * egg.t;
      const x = egg.from.x + (EGG_HUD.x - egg.from.x) * k;
      const y = egg.from.y + (EGG_HUD.y - egg.from.y) * k - Math.sin(egg.t * Math.PI) * 60;
      drawEgg(ctx, x, y, 12 + (1 - egg.t) * 4);
    }

    if (tutorial && !drag && state.critters.length >= 2) drawTutorial();
    ctx.restore();

    drawHud();
    if (banner) drawBanner(banner);
    if (evolution) drawEvolution(evolution);
    if (state.over) drawGameOver();
    stage.end();
  }

  function drawTutorial() {
    const a = state.critters.find((c) => c.level === 1);
    const b = a && state.critters.find((c) => c !== a && c.level === a.level);
    if (!a || !b) return;
    const from = SLOTS[a.slot];
    const to = SLOTS[b.slot];
    const cycle = (t % 1.8) / 1.8;
    const k = Math.min(1, Math.max(0, (cycle - 0.2) / 0.55));
    const ease = k * k * (3 - 2 * k);
    const x = from.x + (to.x - from.x) * ease;
    const y = from.y + (to.y - from.y) * ease;
    if (cycle > 0.2 && cycle < 0.8) {
      ctx.globalAlpha = 0.55;
      drawCritter(ctx, a.level, x, y - 10, { t, scale: 1.1 });
      ctx.globalAlpha = 1;
    }
    drawHand(ctx, x + 6, y + 8, cycle > 0.15 && cycle < 0.8);
    text(ctx, "Kéo 2 thú cùng cấp để ghép!", CENTER.x, CENTER.y + 230 + 52, 20, "#fff");
  }

  function drawHud() {
    // Egg counter pill, like the ad
    roundRect(ctx, EGG_HUD.x - 30, EGG_HUD.y - 22, 140, 44, 22, "rgba(30,60,25,0.6)", null);
    const bump = 1 + eggBump * 1.2;
    ctx.save();
    ctx.translate(EGG_HUD.x, EGG_HUD.y);
    ctx.scale(bump, bump);
    drawEgg(ctx, 0, 0, 16);
    ctx.restore();
    text(ctx, String(state.eggs), EGG_HUD.x + 55, EGG_HUD.y + 1, 28 * (1 + eggBump * 0.4));

    roundRect(ctx, 14, 18, 92, 40, 20, "rgba(30,60,25,0.6)", null);
    text(ctx, `Đợt ${Math.max(1, state.wave)}`, 60, 39, 20);
    roundRect(ctx, W - 136, 18, 122, 40, 20, "rgba(30,60,25,0.6)", null);
    text(ctx, `★ ${state.score}`, W - 75, 39, 20, "#ffe066");

    // Hatch button
    const enabled = canSummon(state);
    const press = buttonDown && enabled ? 4 : 0;
    roundRect(ctx, BUTTON.x, BUTTON.y + 6, BUTTON.w, BUTTON.h, 22, enabled ? "#b8520f" : "#555", OUTLINE, 3.5);
    const g = ctx.createLinearGradient(0, BUTTON.y, 0, BUTTON.y + BUTTON.h);
    g.addColorStop(0, enabled ? "#ffd04a" : "#bbb");
    g.addColorStop(1, enabled ? "#ff8a1f" : "#888");
    roundRect(ctx, BUTTON.x, BUTTON.y + press, BUTTON.w, BUTTON.h, 22, g, OUTLINE, 3.5);
    roundRect(ctx, BUTTON.x + 12, BUTTON.y + 6 + press, BUTTON.w - 24, 14, 7, "rgba(255,255,255,0.35)", null);
    text(ctx, "ẤP TRỨNG", BUTTON.x + 96, BUTTON.y + BUTTON.h / 2 + press + 1, 28);
    drawEgg(ctx, BUTTON.x + 182, BUTTON.y + BUTTON.h / 2 + press, 15);
    text(ctx, `×${summonPrice(state)}`, BUTTON.x + 214, BUTTON.y + BUTTON.h / 2 + press + 2, 20);
    if (enabled && !tutorial) {
      ctx.globalAlpha = 0.25 + Math.sin(t * 5) * 0.2;
      roundRect(ctx, BUTTON.x - 4, BUTTON.y - 4 + press, BUTTON.w + 8, BUTTON.h + 8, 26, "rgba(0,0,0,0)", "#fff7a8", 4);
      ctx.globalAlpha = 1;
    }
  }

  function drawBanner(b: { text: string; color: string; t: number }) {
    const inT = Math.min(1, b.t / 0.25);
    const outT = Math.max(0, (b.t - 1.4) / 0.4);
    const x = CENTER.x + (1 - inT) * -300 + outT * 300;
    ctx.globalAlpha = 1 - outT;
    roundRect(ctx, x - 150, CENTER.y - 34, 300, 68, 18, "rgba(20,30,15,0.65)", null);
    text(ctx, b.text, x, CENTER.y, 40, b.color);
    ctx.globalAlpha = 1;
  }

  function drawEvolution(ev: Evolution) {
    const cx = CENTER.x;
    const cy = CENTER.y - 20;
    const appear = Math.min(1, ev.t / 0.3);
    fillView(`rgba(10,8,4,${0.72 * appear})`);

    // Rotating golden rays
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.6);
    for (let i = 0; i < 14; i++) {
      ctx.rotate((Math.PI * 2) / 14);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-28, -420);
      ctx.lineTo(28, -420);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,200,60,${0.16 * appear})`;
      ctx.fill();
    }
    ctx.restore();
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190);
    glow.addColorStop(0, `rgba(255,220,100,${0.7 * appear})`);
    glow.addColorStop(1, "rgba(255,180,40,0)");
    fillView(glow);
    ctx.beginPath();
    ctx.arc(cx, cy, 150, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(255,220,120,${0.6 * appear})`;
    ctx.stroke();

    const revealed = ev.t >= EVOLVE_REVEAL;
    const wobble = revealed ? 0 : Math.sin(ev.t * 14) * 0.12;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wobble);
    const scale = 2.6 + (revealed ? Math.max(0, 0.6 - (ev.t - EVOLVE_REVEAL) * 2) : Math.sin(ev.t * 6) * 0.15);
    drawCritter(ctx, ev.level, 0, 0, { t, scale: scale * appear, silhouette: !revealed });
    ctx.restore();

    if (!revealed) {
      // Magnifying glass circling the silhouette
      const a = ev.t * 3;
      const mx = cx + Math.cos(a) * 50;
      const my = cy + Math.sin(a) * 40;
      ctx.lineCap = "round";
      ctx.lineWidth = 9;
      ctx.strokeStyle = "#e29a2c";
      ctx.beginPath();
      ctx.moveTo(mx + 18, my + 18);
      ctx.lineTo(mx + 40, my + 40);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx, my, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#6c8df0";
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#ffd23f";
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const sa = t * 5 + i * 2.1;
        text(ctx, "✦", cx + Math.cos(sa) * 120, cy + Math.sin(sa * 1.3) * 110, 22, "#ffe680", "rgba(0,0,0,0)");
      }
      text(ctx, "Đang tiến hóa", cx, 230, 44, "#fff3c4");
      text(ctx, "???", cx, cy + 170, 40, "#fff");
    } else {
      const flash = Math.max(0, 1 - (ev.t - EVOLVE_REVEAL) * 3);
      if (flash > 0) fillView(`rgba(255,255,240,${flash})`);
      text(ctx, "Tiến hóa thành công!", cx, 230, 38, "#fff3c4");
      text(ctx, speciesFor(ev.level).name, cx, cy + 165, 40, LEVEL_COLORS[ev.level - 1]);
      text(ctx, `Cấp ${ev.level}`, cx, cy + 210, 24, "#fff");
      if (ev.t > EVOLVE_REVEAL + 0.4) {
        ctx.globalAlpha = 0.6 + Math.sin(t * 5) * 0.4;
        text(ctx, "Chạm để tiếp tục", cx, H - 150, 22, "#fff");
        ctx.globalAlpha = 1;
      }
    }
  }

  function fillView(style: string | CanvasGradient) {
    const v = stage.view;
    ctx.fillStyle = style;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function drawGameOver() {
    fillView("rgba(10,10,20,0.7)");
    // Panel with an orange header band clipped to its rounded corners
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(70, 300, 400, 400, 28);
    ctx.clip();
    ctx.fillStyle = "#fff4d6";
    ctx.fillRect(70, 300, 400, 400);
    ctx.fillStyle = "#ff7a3d";
    ctx.fillRect(70, 300, 400, 80);
    ctx.restore();
    roundRect(ctx, 70, 300, 400, 400, 28, "rgba(0,0,0,0)", OUTLINE, 5);
    text(ctx, "THUA RỒI!", W / 2, 342, 44, "#fff");
    text(ctx, `Trụ được tới đợt ${state.wave}`, W / 2, 425, 26, "#5a3a1a", "#fff4d6");
    text(ctx, `Điểm: ${state.score}`, W / 2, 470, 30, "#ff7a3d", "#fff4d6");
    text(ctx, `Kỷ lục: đợt ${best.wave} · ${best.score} điểm`, W / 2, 520, 20, "#7a5a3a", "#fff4d6");
    text(ctx, `Hạ gục ${state.kills} zombie`, W / 2, 555, 20, "#7a5a3a", "#fff4d6");
    const g = ctx.createLinearGradient(0, RESTART.y, 0, RESTART.y + RESTART.h);
    g.addColorStop(0, "#7ee05a");
    g.addColorStop(1, "#3fae3a");
    roundRect(ctx, RESTART.x, RESTART.y + 5, RESTART.w, RESTART.h, 20, "#25702a", OUTLINE, 3.5);
    roundRect(ctx, RESTART.x, RESTART.y, RESTART.w, RESTART.h, 20, g, OUTLINE, 3.5);
    text(ctx, "CHƠI LẠI", W / 2, RESTART.y + RESTART.h / 2 + 1, 30);
  }

  const loop = new Loop(step);
  loop.start();
  const onVisibility = () => (document.hidden ? loop.stop() : loop.start());
  document.addEventListener("visibilitychange", onVisibility);

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    destroy() {
      if (state.wave > 0) saveRun();
      loop.stop();
      document.removeEventListener("visibilitychange", onVisibility);
      stage.destroy();
    },
  };
}

