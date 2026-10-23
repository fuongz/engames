import "@fontsource/baloo-2/800.css";
import { Loop, type PointerInfo, Stage } from "../core/stage";
import { type GameContext, type GameInstance, SUMMARY_KEY } from "../core/types";
import {
  blit,
  drawBeam,
  drawBoss,
  drawBossBar,
  drawFlames,
  drawHearts,
  drawPortal,
  drawRider,
  drawSky,
  hitFlash,
  makeSky,
  makeSprites,
  skillGlyph,
  text,
} from "./art";
import { BOSS_WARNING, CUTIN_TIME, ENEMIES, ENERGY_FULL, H, MAX_HEARTS, PICKUP_TEXT, SHARD_GOAL, W } from "./config";
import { joystickDirection } from "./joystick";
import { type GameEvent, type GameState, type Input, canUseSkill, createGame, timeLeft, update } from "./logic";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

interface Boom {
  x: number;
  y: number;
  t: number;
  size: number;
}

interface Button {
  x: number;
  y: number;
  r: number;
}

const JOY_RADIUS = 60;

export function startGame(root: HTMLElement, { storage, audio, reportScore }: GameContext): GameInstance {
  // Canvas text silently falls back until the face is loaded; ask for it up front.
  void document.fonts?.load('800 20px "Baloo 2"');
  const stage = new Stage(root, W, H, { bleed: true });
  const { ctx } = stage;
  const sprites = makeSprites();
  const sky = makeSky();

  let state: GameState = createGame();
  let t = 0;
  let particles: Particle[] = [];
  let booms: Boom[] = [];
  let shardFly: { x: number; y: number; t: number }[] = [];
  let popup: { text: string; t: number } | null = null;
  let banner: { text: string; t: number } | null = null;
  let warn = 0;
  let shake = 0;
  let hurtFlash = 0;
  let countPop = 0;
  let paused = false;
  let lastShot = 0;
  let lastBossHit = 0;
  let best = storage.get("best", 0);
  let saved = false;

  // ---------------------------------------------------------- input

  const keys = new Set<string>();
  let joy: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  let usedTouch = false;
  let joySector: number | null = null;
  let skillQueued = false;

  const view = () => stage.view;
  const pauseBtn = (): Button => ({ x: view().x + view().w - 48, y: 48, r: 24 });
  const skillBtn = (): Button => ({ x: view().x + view().w - 104, y: H - 100, r: 50 });
  const joyHome = () => ({ x: view().x + 130, y: H - 112 });
  const overlayBtns = () => ({ primary: { x: W / 2 - 110, y: 352, w: 220, h: 56 }, secondary: { x: W / 2 - 110, y: 420, w: 220, h: 48 } });
  const inCircle = (p: { x: number; y: number }, b: Button) => (p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= (b.r + 12) ** 2;
  const inRect = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
    p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function restart() {
    state = createGame();
    particles = [];
    booms = [];
    shardFly = [];
    popup = null;
    banner = null;
    warn = 0;
    paused = false;
    saved = false;
  }

  function togglePause() {
    if (state.phase === "over") return;
    paused = !paused;
    audio.tone({ freq: paused ? 500 : 700, dur: 0.06, type: "triangle", vol: 0.08 });
  }

  stage.onPointer({
    down(p: PointerInfo) {
      audio.unlock();
      if (state.phase === "over") {
        if (inRect(p, overlayBtns().primary)) restart();
        return;
      }
      if (paused) {
        if (inRect(p, overlayBtns().primary)) togglePause();
        else if (inRect(p, overlayBtns().secondary)) restart();
        return;
      }
      if (inCircle(p, pauseBtn())) return togglePause();
      if (inCircle(p, skillBtn())) {
        skillQueued = true;
        return;
      }
      // Floating joystick anywhere on the left part of the screen
      if (p.x < view().x + view().w * 0.55 && !joy) {
        usedTouch = true;
        joy = { id: p.id, ox: p.x, oy: p.y, x: p.x, y: p.y };
      }
    },
    move(p: PointerInfo) {
      if (joy && p.id === joy.id) {
        joy.x = p.x;
        joy.y = p.y;
      }
    },
    up(p: PointerInfo) {
      if (joy && p.id === joy.id) joy = null;
    },
  });

  const MOVE_KEYS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    KeyA: [-1, 0],
    ArrowRight: [1, 0],
    KeyD: [1, 0],
    ArrowUp: [0, -1],
    KeyW: [0, -1],
    ArrowDown: [0, 1],
    KeyS: [0, 1],
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code in MOVE_KEYS || e.code === "Space") e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "KeyJ" || e.code === "KeyK") skillQueued = true;
    if (e.code === "Escape" || e.code === "KeyP") togglePause();
    if (e.code === "Enter" && state.phase === "over") restart();
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function readInput(): Input {
    let mx = 0;
    let my = 0;
    for (const code of keys) {
      const dir = MOVE_KEYS[code];
      if (dir) {
        mx += dir[0];
        my += dir[1];
      }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    if (joy) {
      // Digital like the keyboard: 8 directions at full speed (see joystick.ts)
      const dir = joystickDirection(joy.x - joy.ox, joy.y - joy.oy, joySector);
      joySector = dir.sector;
      mx = dir.mx;
      my = dir.my;
    } else {
      joySector = null;
    }
    const skill = skillQueued;
    skillQueued = false;
    return { mx, my, skill };
  }

  // ---------------------------------------------------------- effects & sound

  function sparks(x: number, y: number, n: number, color: string, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      const max = 0.35 + Math.random() * 0.35;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max, size: 1.5 + Math.random() * 2.5, color });
    }
  }

  function explode(x: number, y: number, size: number) {
    booms.push({ x, y, t: 0, size });
    sparks(x, y, Math.round(size / 3), "#ffcf5a", size * 6);
  }

  function handle(e: GameEvent) {
    switch (e.type) {
      case "countdown":
        countPop = 0;
        audio.tone({ freq: 660, dur: 0.12, type: "sine", vol: 0.15 });
        break;
      case "go":
        countPop = 0;
        audio.tone({ freq: 990, dur: 0.25, type: "sine", vol: 0.15 });
        break;
      case "shot":
        if (t - lastShot > 0.12) {
          audio.tone({ freq: 1400, to: 900, dur: 0.03, type: "triangle", vol: 0.02 });
          lastShot = t;
        }
        break;
      case "hit":
        sparks(e.x, e.y, 2, "#ffc4ec", 120);
        break;
      case "kill": {
        const big = e.kind === "crystal";
        explode(e.x, e.y, big ? 70 : 44);
        if (big) shake = Math.max(shake, 0.15);
        audio.noise(big ? 0.3 : 0.15, big ? 0.16 : 0.09);
        audio.tone({ freq: big ? 160 : 240, to: 60, dur: 0.2, type: "triangle", vol: 0.1 });
        break;
      }
      case "hurt":
        shake = 0.35;
        hurtFlash = 0.4;
        audio.tone({ freq: 180, to: 60, dur: 0.35, type: "sawtooth", vol: 0.14 });
        break;
      case "pickup":
        popup = { text: PICKUP_TEXT[e.kind], t: 0 };
        for (const [i, f] of [784, 988, 1318].entries()) audio.tone({ freq: f, dur: 0.1, type: "sine", vol: 0.1, delay: i * 0.05 });
        break;
      case "charge":
        audio.tone({ freq: 880, to: 1760, dur: 0.25, type: "sine", vol: 0.1 });
        break;
      case "skill":
        joy = null;
        audio.tone({ freq: 220, to: 1200, dur: CUTIN_TIME, type: "sawtooth", vol: 0.08 });
        break;
      case "beam":
        shake = 0.5;
        audio.noise(0.9, 0.18);
        audio.tone({ freq: 140, to: 70, dur: 2, type: "sawtooth", vol: 0.1 });
        break;
      case "bossWarning":
        warn = BOSS_WARNING + 1.5;
        for (let i = 0; i < 3; i++) {
          audio.tone({ freq: 520, dur: 0.22, type: "square", vol: 0.08, delay: i * 0.6 });
          audio.tone({ freq: 390, dur: 0.22, type: "square", vol: 0.08, delay: i * 0.6 + 0.25 });
        }
        break;
      case "bossEnter":
        shake = 0.6;
        audio.tone({ freq: 60, to: 40, dur: 1.2, type: "sawtooth", vol: 0.14 });
        break;
      case "bossHit":
        if (t - lastBossHit > 0.15) {
          audio.tone({ freq: 300, dur: 0.03, type: "square", vol: 0.03 });
          lastBossHit = t;
        }
        break;
      case "bossAttack":
        if (e.kind === "beam") audio.tone({ freq: 900, dur: 0.6, type: "square", vol: 0.05 });
        else audio.tone({ freq: 200, to: 120, dur: 0.25, type: "sawtooth", vol: 0.08 });
        break;
      case "bossDie":
        warn = 0;
        shake = 1.2;
        for (let i = 0; i < 9; i++) booms.push({ x: e.x + (Math.random() - 0.5) * 160, y: e.y + (Math.random() - 0.5) * 300, t: -i * 0.14, size: 80 + Math.random() * 50 });
        for (let i = 0; i < SHARD_GOAL; i++) shardFly.push({ x: e.x + (Math.random() - 0.5) * 120, y: e.y + (Math.random() - 0.5) * 160, t: -0.4 - i * 0.07 });
        audio.noise(1.2, 0.22);
        audio.tone({ freq: 120, to: 40, dur: 1.4, type: "sawtooth", vol: 0.14 });
        break;
      case "waveClear":
        banner = { text: `Đã Vượt Qua Đợt ${e.wave}!`, t: 0 };
        for (const [i, f] of [523, 659, 784, 1046].entries()) audio.tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.12, delay: 0.4 + i * 0.1 });
        break;
      case "end":
        reportScore?.({
          score: state.score,
          detail: `${state.result?.stars ?? 0}★ · ${state.shards}/${SHARD_GOAL} mảnh`,
        });
        if (e.won) for (const [i, f] of [659, 784, 988, 1318].entries()) audio.tone({ freq: f, dur: 0.2, type: "triangle", vol: 0.12, delay: i * 0.12 });
        else for (const [i, f] of [440, 349, 262].entries()) audio.tone({ freq: f, dur: 0.25, type: "triangle", vol: 0.12, delay: i * 0.18 });
        break;
    }
  }

  function saveResult() {
    if (saved) return;
    saved = true;
    if (state.score > best) {
      best = state.score;
      storage.set("best", best);
    }
    storage.set(SUMMARY_KEY, `Kỷ lục ${best} điểm`);
  }

  // ---------------------------------------------------------- frame

  function step(dt: number) {
    t += dt;
    const v = view();
    if (!paused) {
      state.bounds = { left: v.x, right: v.x + v.w };
      update(state, dt, readInput());
      for (const e of state.events) handle(e);
      state.events.length = 0;
      if (state.phase === "over") saveResult();

      for (const p of particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      particles = particles.filter((p) => p.life > 0);
      for (const b of booms) b.t += dt;
      booms = booms.filter((b) => b.t < 0.6);
      for (const s of shardFly) s.t += dt * 1.4;
      shardFly = shardFly.filter((s) => s.t < 1);
      if (popup) {
        popup.t += dt;
        if (popup.t > 1.8) popup = null;
      }
      if (banner) {
        banner.t += dt;
        if (banner.t > 3) banner = null;
      }
      warn = Math.max(0, warn - dt);
      shake = Math.max(0, shake - dt);
      hurtFlash = Math.max(0, hurtFlash - dt);
      countPop += dt;
    }
    draw();
  }

  function draw() {
    const v = view();
    const right = v.x + v.w;
    stage.begin();
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
    drawSky(ctx, sky, t, v.x, right, v.y, v.y + v.h);

    for (const k of state.pickups) blit(ctx, sprites.pickups[k.kind], k.x, k.y);

    for (const e of state.enemies) {
      const r = ENEMIES[e.kind].radius;
      if (e.kind === "meteor") {
        drawFlames(ctx, e.x + 10, e.y, t + e.id, 34);
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.age * -2);
        blit(ctx, sprites.meteor, 0, 0);
        ctx.restore();
      } else if (e.kind === "crystal") {
        blit(ctx, sprites.crystal, e.x, e.y, 1.25);
      } else {
        blit(ctx, sprites.fighter, e.x, e.y);
      }
      hitFlash(ctx, e.x, e.y, r, e.flash);
    }

    const boss = state.boss;
    if (boss) {
      drawBoss(ctx, boss.x, boss.y, t, boss.flash, boss.mode === "dying" ? boss.dying : 0);
      if (boss.attack) drawBossBeam(boss.x - 90, boss.attack.y, boss.attack.t);
    }
    for (const s of state.shots) blit(ctx, sprites.shot, s.x, s.y, s.radius / 11);
    for (const b of state.bullets) blit(ctx, b.id % 2 ? sprites.bulletPink : sprites.bulletGold, b.x, b.y);

    const p = state.player;
    const blink = p.invuln > 0 && state.skill.beam <= 0 && state.phase === "play" && Math.floor(t * 14) % 2 === 0;
    if (!blink) drawRider(ctx, p.x, p.y, t, 1.25);
    drawHearts(ctx, p.x - 8, p.y - 72, p.hearts, MAX_HEARTS);
    if (popup) {
      ctx.globalAlpha = Math.min(1, 2 - popup.t);
      text(ctx, popup.text, p.x - 8, p.y - 94 - popup.t * 10, 17, "#fff", "center", 800, true);
      ctx.globalAlpha = 1;
    }

    if (state.skill.beam > 0) {
      const strength = Math.min(1, state.skill.beam * 3);
      drawBeam(ctx, p.x + 70, p.y, right, t, strength);
      drawPortal(ctx, p.x + 74, p.y, t, Math.min(1, (2.4 - state.skill.beam) * 6 + 0.3) * strength);
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of booms) if (b.t > 0) drawBoom(b);
    for (const pt of particles) {
      ctx.globalAlpha = pt.life / pt.max;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.restore();
    ctx.restore();

    if (warn > 0 || (boss && boss.mode !== "dying" && boss.age < 1.5)) drawWarning();
    if (hurtFlash > 0) vignette(`rgba(255,40,80,${hurtFlash})`);
    drawHud();
    if (boss && boss.mode === "fight") drawBossBar(ctx, Math.min(boss.x - 30, right - 120), Math.max(96, boss.y - 150), boss.hp / boss.maxHp);
    for (const s of shardFly) {
      if (s.t <= 0) continue;
      const k = s.t * s.t;
      const tx = right - 238;
      ctx.globalAlpha = 1 - Math.max(0, s.t - 0.8) * 5;
      drawShard(s.x + (tx - s.x) * k, s.y + (78 - s.y) * k - Math.sin(s.t * Math.PI) * 60, 9);
      ctx.globalAlpha = 1;
    }
    if (banner) drawBanner(banner.text, banner.t);
    if (state.phase === "cutin") drawCutin(1 - state.skill.cutin / CUTIN_TIME);
    if (state.phase === "countdown") drawCountdown();
    if (paused) drawPause();
    if (state.phase === "over") drawResult();
    stage.end();
  }

  function fillView(style: string | CanvasGradient) {
    const v = view();
    ctx.fillStyle = style;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function vignette(color: string) {
    const v = view();
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, v.w * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, color);
    fillView(g);
  }

  function drawBoom(b: Boom) {
    const q = b.t / 0.6;
    const r = b.size * (0.35 + q * 0.8);
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0, `rgba(255,255,220,${1 - q})`);
    g.addColorStop(0.35, `rgba(255,190,70,${0.9 * (1 - q)})`);
    g.addColorStop(0.7, `rgba(255,90,20,${0.6 * (1 - q)})`);
    g.addColorStop(1, "rgba(120,20,0,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Spiky burst
    ctx.fillStyle = `rgba(255,200,90,${0.8 * (1 - q)})`;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + b.size;
      const r1 = r * 0.7;
      const r2 = r * (1.2 + (i % 2) * 0.3);
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(a - 0.12) * r1, b.y + Math.sin(a - 0.12) * r1);
      ctx.lineTo(b.x + Math.cos(a) * r2, b.y + Math.sin(a) * r2);
      ctx.lineTo(b.x + Math.cos(a + 0.12) * r1, b.y + Math.sin(a + 0.12) * r1);
      ctx.fill();
    }
  }

  function drawBossBeam(x: number, y: number, at: number) {
    const v = view();
    if (at < 0.9) {
      // Telegraph: blinking dashed line along the row it will fire
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(at * 30) * 0.4;
      ctx.strokeStyle = "#ff4060";
      ctx.lineWidth = 3;
      ctx.setLineDash([16, 10]);
      ctx.beginPath();
      ctx.moveTo(v.x, y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [h, color] of [[34, "rgba(255,70,40,0.5)"], [18, "rgba(255,170,80,0.8)"], [6, "rgba(255,255,230,1)"]] as const) {
      const g = ctx.createLinearGradient(0, y - h, 0, y + h);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.5, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(v.x, y - h, x - v.x, h * 2);
    }
    ctx.restore();
  }

  function drawWarning() {
    const pulse = 0.35 + Math.sin(t * 8) * 0.2;
    vignette(`rgba(255,30,70,${pulse})`);
    const b = pauseBtn();
    // Red "!" badge under the pause button, like the ad
    ctx.fillStyle = "#c81e3a";
    ctx.beginPath();
    ctx.arc(b.x, b.y + 62, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffb0b8";
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, "!", b.x, b.y + 63, 26, "#fff");
    if (warn > 0) text(ctx, "CẢNH BÁO: BOSS XUẤT HIỆN", W / 2, 120, 26, "#ff8a9a");
  }

  function drawShard(x: number, y: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.75, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.75, y);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - s, y - s, x + s, y + s);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#ffb8f0");
    g.addColorStop(1, "#9a7bff");
    ctx.fillStyle = g;
    ctx.fill();
  }

  function drawHourglass(x: number, y: number) {
    ctx.strokeStyle = "#e8e6ff";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 7);
    ctx.lineTo(x + 5, y - 7);
    ctx.lineTo(x - 5, y + 7);
    ctx.lineTo(x + 5, y + 7);
    ctx.closePath();
    ctx.stroke();
  }

  function drawHud() {
    const v = view();
    const right = v.x + v.w;
    const s = state;

    // Score: "Điểm Hiện Tại:" + gold number, right-aligned next to pause
    const scoreX = right - 86;
    ctx.font = `800 30px "Baloo 2", sans-serif`;
    const scoreW = ctx.measureText(String(s.score)).width;
    text(ctx, String(s.score), scoreX, 46, 30, "#ffd36b", "right");
    text(ctx, "Điểm Hiện Tại:", scoreX - scoreW - 6, 47, 18, "#cfcaff", "right", 600);
    drawShard(right - 238, 78, 8);
    text(ctx, `${s.shards}/${SHARD_GOAL}`, right - 224, 79, 16, "#dcd8ff", "left", 600);
    const left = Math.ceil(timeLeft(s));
    drawHourglass(right - 150, 79);
    text(ctx, s.phase === "countdown" ? "" : `00:${String(left).padStart(2, "0")}`, right - 138, 79, 16, left <= 10 ? "#ff9aa8" : "#dcd8ff", "left", 600);

    // Pause button
    const pb = pauseBtn();
    ctx.fillStyle = "#1a2a7a";
    ctx.beginPath();
    ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffd68a";
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#7fe0ff";
    ctx.beginPath();
    ctx.arc(pb.x, pb.y, pb.r - 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pb.x - 7, pb.y - 8, 5, 16);
    ctx.fillRect(pb.x + 2, pb.y - 8, 5, 16);

    drawJoystick();
    drawSkillButton();
  }

  function drawJoystick() {
    const home = joyHome();
    const base = joy ? { x: joy.ox, y: joy.oy } : home;
    let kx = base.x;
    let ky = base.y;
    if (joy && joySector !== null) {
      // Knob snaps to the direction actually being applied
      const a = (joySector * Math.PI) / 4;
      kx += Math.cos(a) * JOY_RADIUS * 0.75;
      ky += Math.sin(a) * JOY_RADIUS * 0.75;
    }
    ctx.globalAlpha = joy ? 0.95 : usedTouch ? 0.7 : 0.45;
    ctx.fillStyle = "rgba(20,24,80,0.35)";
    ctx.beginPath();
    ctx.arc(base.x, base.y, JOY_RADIUS + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.stroke();
    const g = ctx.createRadialGradient(kx - 6, ky - 6, 2, kx, ky, 26);
    g.addColorStop(0, "#f2d0ff");
    g.addColorStop(0.6, "#9a6ad8");
    g.addColorStop(1, "#4a3a8a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(kx, ky, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#d8c08a";
    ctx.stroke();
    ctx.fillStyle = "#d8c08a";
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(kx + Math.cos(a) * 34, ky + Math.sin(a) * 34);
      ctx.lineTo(kx + Math.cos(a + 0.2) * 25, ky + Math.sin(a + 0.2) * 25);
      ctx.lineTo(kx + Math.cos(a - 0.2) * 25, ky + Math.sin(a - 0.2) * 25);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSkillButton() {
    const b = skillBtn();
    const k = state.skill;
    const ready = canUseSkill(state) || (state.phase === "countdown" && k.charges > 0);
    if (ready) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(b.x, b.y, b.r, b.x, b.y, b.r + 26 + Math.sin(t * 6) * 4);
      g.addColorStop(0, "rgba(255,180,60,0.6)");
      g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Energy ring
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(20,24,80,0.6)";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 7, 0, Math.PI * 2);
    ctx.stroke();
    const frac = k.charges >= k.max ? 1 : k.energy / ENERGY_FULL;
    ctx.strokeStyle = "#ffe08a";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 7, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    // Orange core
    const core = ctx.createRadialGradient(b.x - 10, b.y - 12, 4, b.x, b.y, b.r);
    core.addColorStop(0, "#ffd27a");
    core.addColorStop(0.55, "#ff6a1f");
    core.addColorStop(1, "#b8300e");
    ctx.globalAlpha = k.charges > 0 ? 1 : 0.88;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffe6a8";
    ctx.stroke();
    skillGlyph(ctx, b.x + 2, b.y - 6, 18, "#fff3d6");
    text(ctx, `${k.charges}/${k.max}`, b.x, b.y + 30, 13, "#ffffff", "center", 700);
    ctx.globalAlpha = 1;
  }

  function drawBanner(label: string, bt: number) {
    const a = Math.min(1, bt * 4, (3 - bt) * 2);
    ctx.globalAlpha = Math.max(0, a);
    const w = 260;
    const g = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
    g.addColorStop(0, "rgba(60,80,220,0)");
    g.addColorStop(0.5, "rgba(60,80,220,0.85)");
    g.addColorStop(1, "rgba(60,80,220,0)");
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - w / 2, 30, w, 30);
    text(ctx, label, W / 2, 46, 17, "#ffffff", "center", 700);
    ctx.globalAlpha = 1;
  }

  function drawCutin(p: number) {
    const v = view();
    fillView(`rgba(5,4,25,${0.6 * Math.min(1, p * 5)})`);
    const enter = Math.min(1, p / 0.25);
    const ease = 1 - (1 - enter) ** 3;
    const exit = Math.max(0, (p - 0.8) / 0.2);
    const off = (1 - ease) * v.w - exit * v.w;
    ctx.save();
    ctx.translate(off, 0);
    // Slanted band
    ctx.beginPath();
    ctx.moveTo(v.x - 40, 150);
    ctx.lineTo(v.x + v.w + 40, 110);
    ctx.lineTo(v.x + v.w + 40, 400);
    ctx.lineTo(v.x - 40, 440);
    ctx.closePath();
    const g = ctx.createLinearGradient(v.x, 0, v.x + v.w, 0);
    g.addColorStop(0, "#ff7ac8");
    g.addColorStop(0.5, "#b88cff");
    g.addColorStop(1, "#6ad8ff");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 26; i++) {
      const y = 120 + ((i * 53) % 320);
      const x = v.x + ((i * 211 + p * 3000) % (v.w + 300)) - 150;
      ctx.fillRect(x, y, 140, 2);
    }
    drawRider(ctx, W / 2 - 60, 300, t, 3.4);
    ctx.restore();
    ctx.globalAlpha = ease * (1 - exit);
    text(ctx, "TINH TÚ QUANG PHÁO", W / 2 + off * 0.2, 470, 40, "#fff3c4", "center", 800, true);
    ctx.globalAlpha = 1;
    if (p > 0.9) fillView(`rgba(255,255,255,${(p - 0.9) * 8})`);
  }

  function drawCountdown() {
    fillView("rgba(4,6,30,0.6)");
    ctx.strokeStyle = "#e8d29a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 200, 96);
    ctx.lineTo(W / 2 - 130, 96);
    ctx.moveTo(W / 2 + 130, 96);
    ctx.lineTo(W / 2 + 200, 96);
    ctx.stroke();
    text(ctx, "Chuẩn Bị Bắt Đầu", W / 2, 96, 26, "#f6e2a8");
    const n = Math.max(1, Math.ceil(state.countdown));
    const pop = 1 + Math.max(0, 0.25 - countPop) * 1.6;
    ctx.save();
    ctx.translate(W / 2, 290);
    ctx.scale(pop, pop);
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, 0, 50, 0, 0, 140);
    glow.addColorStop(0, "rgba(80,120,255,0.7)");
    glow.addColorStop(1, "rgba(40,60,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-140, -140, 280, 280);
    ctx.globalCompositeOperation = "source-over";
    const disc = ctx.createRadialGradient(-20, -30, 10, 0, 0, 92);
    disc.addColorStop(0, "#8ab4ff");
    disc.addColorStop(1, "#2a3fd0");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ffc8ee";
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#7dffb0";
    ctx.beginPath();
    ctx.arc(0, 0, 84, -2.6, -0.5);
    ctx.stroke();
    text(ctx, String(n), 0, 6, 110, "#ffffff");
    ctx.restore();
  }

  function panel(title: string, h: number) {
    fillView("rgba(4,6,30,0.65)");
    const x = W / 2 - 220;
    const y = 270 - h / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 440, h, 24);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#26308a");
    g.addColorStop(1, "#131650");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#e8d29a";
    ctx.stroke();
    text(ctx, title, W / 2, y + 44, 34, "#fff3c4");
    return y;
  }

  function button(r: { x: number; y: number; w: number; h: number }, label: string, primary: boolean) {
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
    if (primary) {
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, "#ffd27a");
      g.addColorStop(1, "#ff7a2a");
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
    }
    ctx.fill();
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, primary ? 24 : 20, "#fff");
  }

  function drawPause() {
    panel("Tạm Dừng", 330);
    text(ctx, `Điểm hiện tại: ${state.score}`, W / 2, 270, 20, "#dcd8ff", "center", 600);
    text(ctx, "Phím: WASD/mũi tên di chuyển · Space dùng chiêu", W / 2, 306, 14, "#aaa6e0", "center", 600);
    button(overlayBtns().primary, "Tiếp tục", true);
    button(overlayBtns().secondary, "Chơi lại", false);
  }

  function drawResult() {
    const r = state.result;
    if (!r) return;
    const y = panel(r.won ? "Hoàn Thành!" : "Thất Bại", 360);
    for (let i = 0; i < 3; i++) {
      const sx = W / 2 + (i - 1) * 70;
      const sy = y + 112 - (i === 1 ? 10 : 0);
      drawStar(sx, sy, i === 1 ? 30 : 24, i < r.stars);
    }
    text(ctx, `Điểm: ${state.score}`, W / 2, y + 176, 28, "#ffd36b");
    text(ctx, `Mảnh tinh tú ${state.shards}/${SHARD_GOAL} · Kỷ lục ${best}`, W / 2, y + 214, 17, "#dcd8ff", "center", 600);
    button(overlayBtns().primary, "Chơi lại", true);
  }

  function drawStar(x: number, y: number, r: number, on: boolean) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = on ? "#ffd36b" : "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = on ? "#fff3c4" : "rgba(255,255,255,0.3)";
    ctx.stroke();
  }

  const loop = new Loop(step);
  loop.start();
  const onVisibility = () => {
    if (document.hidden) {
      if (state.phase === "play") paused = true;
      loop.stop();
    } else loop.start();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    pause: () => {
      if (state.phase === "play") paused = true;
      loop.stop();
    },
    resume: () => loop.start(),
    destroy() {
      loop.stop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      stage.destroy();
    },
  };
}
