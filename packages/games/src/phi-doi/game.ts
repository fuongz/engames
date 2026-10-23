import "@fontsource/baloo-2/800.css";
import { Loop, type PointerInfo, Stage } from "../core/stage";
import {
  type GameContext,
  type GameInstance,
  SUMMARY_KEY,
} from "../core/types";
import {
  blit,
  drawBattleship,
  drawHpBar,
  drawRotor,
  drawSea,
  drawThrust,
  glowDot,
  hitFlash,
  makeSea,
  makeSprites,
  shadowOf,
  text,
} from "./art";
import {
  BOSS_HALF_H,
  ENEMIES,
  ENERGY_FULL,
  H,
  MAX_BOMBS,
  MAX_HP,
  PICKUP_TEXT,
  RAPID_TIME,
  SCROLL_SPEED,
  W,
  WARNING_TIME,
  WINGMEN,
} from "./config";
import {
  type GameEvent,
  type GameState,
  type Input,
  createGame,
  energyReady,
  update,
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

const SHADOW = { x: 16, y: 26 };

export function startGame(
  root: HTMLElement,
  { storage, audio, reportScore }: GameContext,
): GameInstance {
  // Canvas text silently falls back until the face is loaded; ask for it up front.
  void document.fonts?.load('800 20px "Baloo 2"');
  const stage = new Stage(root, W, H, { bleed: true });
  const { ctx } = stage;
  const sprites = makeSprites();
  const shadows = {
    hero: shadowOf(sprites.hero),
    wingman: shadowOf(sprites.wingman),
    zero: shadowOf(sprites.zero),
    bomber: shadowOf(sprites.bomber),
    heli: shadowOf(sprites.heli),
  };
  const sea = makeSea();

  let state: GameState = fresh();
  let t = 0;
  let scroll = 0;
  let particles: Particle[] = [];
  let booms: Boom[] = [];
  let popup: { text: string; x: number; y: number; t: number } | null = null;
  let banner: { title: string; sub: string; t: number } | null = null;
  let warn = 0;
  let shake = 0;
  let hurtFlash = 0;
  let bombFlash = 0;
  let coinPulse = 0;
  let paused = false;
  let lastShot = 0;
  let lastBossHit = 0;
  let lastCoin = 0;
  let best = storage.get("best", 0);
  let saved = false;

  function fresh() {
    const s = createGame();
    const v = stage.view;
    s.bounds = { left: v.x, right: v.x + v.w, top: v.y, bottom: v.y + v.h };
    s.player.y = s.bounds.bottom + 80;
    return s;
  }

  // ---------------------------------------------------------- input

  const keys = new Set<string>();
  let drag: { id: number; x: number; y: number } | null = null;
  let pendingDx = 0;
  let pendingDy = 0;
  let skillQueued = false;
  let bombQueued = false;

  const view = () => stage.view;
  const top = () => view().y;
  const bottom = () => view().y + view().h;
  const left = () => Math.max(view().x, 0);
  const right = () => Math.min(view().x + view().w, W);
  const pauseBtn = (): Button => ({ x: right() - 34, y: top() + 40, r: 22 });
  // ad: two round buttons stacked on the bottom left, skill above bomb
  const skillBtn = (): Button => ({ x: left() + 46, y: bottom() - 196, r: 32 });
  const bombBtn = (): Button => ({ x: left() + 46, y: bottom() - 112, r: 32 });
  const panelY = () => top() + view().h / 2;
  const overlayBtns = () => ({
    primary: { x: W / 2 - 120, y: panelY() + 70, w: 240, h: 58 },
    secondary: { x: W / 2 - 120, y: panelY() + 140, w: 240, h: 50 },
  });
  const inCircle = (p: { x: number; y: number }, b: Button) =>
    (p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= (b.r + 10) ** 2;
  const inRect = (
    p: { x: number; y: number },
    r: { x: number; y: number; w: number; h: number },
  ) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function restart() {
    state = fresh();
    particles = [];
    booms = [];
    popup = null;
    banner = null;
    warn = 0;
    paused = false;
    saved = false;
    drag = null;
  }

  function togglePause() {
    if (state.phase === "over") return;
    paused = !paused;
    drag = null;
    audio.tone({
      freq: paused ? 500 : 700,
      dur: 0.06,
      type: "triangle",
      vol: 0.08,
    });
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
      if (inCircle(p, bombBtn())) {
        bombQueued = true;
        return;
      }
      // Drag anywhere: the plane follows the finger's movement, not its position,
      // so the finger never covers the plane.
      if (!drag) drag = { id: p.id, x: p.x, y: p.y };
    },
    move(p: PointerInfo) {
      if (!drag || p.id !== drag.id) return;
      pendingDx += p.x - drag.x;
      pendingDy += p.y - drag.y;
      drag.x = p.x;
      drag.y = p.y;
    },
    up(p: PointerInfo) {
      if (drag && p.id === drag.id) drag = null;
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
    audio.unlock();
    if (e.code === "KeyJ" || e.code === "KeyZ") skillQueued = true;
    if (e.code === "Space" || e.code === "KeyK" || e.code === "KeyX")
      bombQueued = true;
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
    const input = {
      dx: pendingDx,
      dy: pendingDy,
      mx,
      my,
      skill: skillQueued,
      bomb: bombQueued,
    };
    pendingDx = 0;
    pendingDy = 0;
    skillQueued = false;
    bombQueued = false;
    return input;
  }

  // ---------------------------------------------------------- effects & sound

  function sparks(
    x: number,
    y: number,
    n: number,
    color: string,
    speed: number,
  ) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      const max = 0.3 + Math.random() * 0.35;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: max,
        max,
        size: 1.5 + Math.random() * 2.5,
        color,
      });
    }
  }

  function explode(x: number, y: number, size: number, delay = 0) {
    booms.push({ x, y, t: -delay, size });
    if (delay === 0) sparks(x, y, Math.round(size / 3), "#ffcf5a", size * 6);
  }

  function handle(e: GameEvent) {
    switch (e.type) {
      case "shot":
        if (t - lastShot > 0.09) {
          audio.tone({
            freq: 1200,
            to: 700,
            dur: 0.03,
            type: "square",
            vol: 0.012,
          });
          lastShot = t;
        }
        break;
      case "hit":
        sparks(e.x, e.y, 2, "#fff0b0", 110);
        break;
      case "kill": {
        const big =
          e.kind === "bomber" || e.kind === "boat" || e.kind === "heli";
        explode(e.x, e.y, big ? 74 : 46);
        if (big) shake = Math.max(shake, 0.18);
        audio.noise(big ? 0.32 : 0.16, big ? 0.16 : 0.09);
        audio.tone({
          freq: big ? 150 : 230,
          to: 50,
          dur: 0.22,
          type: "triangle",
          vol: 0.1,
        });
        break;
      }
      case "hurt":
        shake = Math.max(shake, 0.3);
        hurtFlash = 0.45;
        sparks(state.player.x, state.player.y, 10, "#ff8a5a", 200);
        audio.tone({
          freq: 180,
          to: 60,
          dur: 0.3,
          type: "sawtooth",
          vol: 0.13,
        });
        break;
      case "pickup":
        if (e.kind === "coin") {
          coinPulse = 0.2;
          if (t - lastCoin > 0.05) {
            audio.tone({
              freq: 1320,
              to: 1760,
              dur: 0.06,
              type: "sine",
              vol: 0.06,
            });
            lastCoin = t;
          }
        } else {
          popup = { text: PICKUP_TEXT[e.kind], x: e.x, y: e.y, t: 0 };
          sparks(
            e.x,
            e.y,
            14,
            e.kind === "power"
              ? "#ff9a5a"
              : e.kind === "bomb"
                ? "#8ab4ff"
                : "#7affa0",
            160,
          );
          for (const [i, f] of [784, 988, 1318].entries())
            audio.tone({
              freq: f,
              dur: 0.1,
              type: "sine",
              vol: 0.1,
              delay: i * 0.05,
            });
        }
        break;
      case "energyFull":
        audio.tone({ freq: 880, to: 1760, dur: 0.25, type: "sine", vol: 0.1 });
        break;
      case "rapid":
        audio.tone({
          freq: 300,
          to: 1200,
          dur: 0.4,
          type: "sawtooth",
          vol: 0.08,
        });
        sparks(state.player.x, state.player.y, 24, "#7affa0", 240);
        break;
      case "bomb":
        bombFlash = 1;
        shake = 0.7;
        drag = null;
        for (let i = 0; i < 14; i++) {
          const y = bottom() - (i / 14) * view().h;
          explode(
            left() + 40 + Math.random() * (right() - left() - 80),
            y,
            70 + Math.random() * 40,
            i * 0.05,
          );
        }
        audio.noise(1, 0.22);
        audio.tone({ freq: 120, to: 40, dur: 1, type: "sawtooth", vol: 0.14 });
        break;
      case "warning":
        warn = WARNING_TIME + 0.4;
        for (let i = 0; i < 4; i++) {
          audio.tone({
            freq: 620,
            dur: 0.22,
            type: "square",
            vol: 0.07,
            delay: i * 0.6,
          });
          audio.tone({
            freq: 440,
            dur: 0.22,
            type: "square",
            vol: 0.07,
            delay: i * 0.6 + 0.25,
          });
        }
        break;
      case "bossEnter":
        shake = 0.5;
        audio.tone({ freq: 70, to: 40, dur: 1.6, type: "sawtooth", vol: 0.12 });
        break;
      case "bossHit":
        if (t - lastBossHit > 0.12) {
          audio.tone({ freq: 260, dur: 0.03, type: "square", vol: 0.025 });
          lastBossHit = t;
        }
        break;
      case "bossAttack":
        if (e.kind === "missiles")
          audio.tone({
            freq: 900,
            to: 300,
            dur: 0.5,
            type: "sawtooth",
            vol: 0.05,
          });
        else
          audio.tone({
            freq: 220,
            to: 140,
            dur: 0.2,
            type: "square",
            vol: 0.05,
          });
        break;
      case "bossDie":
        shake = 1.4;
        for (let i = 0; i < 14; i++)
          explode(
            e.x + (Math.random() - 0.5) * 120,
            e.y + (Math.random() - 0.5) * BOSS_HALF_H * 2,
            80 + Math.random() * 60,
            i * 0.12,
          );
        audio.noise(1.4, 0.24);
        audio.tone({
          freq: 110,
          to: 35,
          dur: 1.6,
          type: "sawtooth",
          vol: 0.15,
        });
        break;
      case "stageClear":
        banner = {
          title: "HOÀN THÀNH",
          sub: `Đã đánh chìm chiến hạm · Màn ${e.stage}`,
          t: 0,
        };
        for (const [i, f] of [523, 659, 784, 1046].entries())
          audio.tone({
            freq: f,
            dur: 0.18,
            type: "triangle",
            vol: 0.12,
            delay: 0.5 + i * 0.1,
          });
        break;
      case "stageStart":
        banner = {
          title: `MÀN ${e.stage}`,
          sub: "Địch đông hơn và bắn nhanh hơn",
          t: 0,
        };
        break;
      case "end":
        drag = null;
        explode(state.player.x, state.player.y, 110);
        shake = 1;
        reportScore?.({
          score: state.score,
          detail: `Màn ${state.stage} · ${state.coins} xu`,
        });
        for (const [i, f] of [440, 349, 262].entries())
          audio.tone({
            freq: f,
            dur: 0.25,
            type: "triangle",
            vol: 0.12,
            delay: 0.3 + i * 0.18,
          });
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
      state.bounds = {
        left: v.x,
        right: v.x + v.w,
        top: v.y,
        bottom: v.y + v.h,
      };
      update(state, dt, readInput());
      for (const e of state.events) handle(e);
      state.events.length = 0;
      if (state.phase === "over") saveResult();
      scroll += SCROLL_SPEED * dt;

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
      if (popup) {
        popup.t += dt;
        if (popup.t > 1.4) popup = null;
      }
      if (banner) {
        banner.t += dt;
        if (banner.t > 2.8) banner = null;
      }
      warn = Math.max(0, warn - dt);
      shake = Math.max(0, shake - dt);
      hurtFlash = Math.max(0, hurtFlash - dt);
      bombFlash = Math.max(0, bombFlash - dt * 1.6);
      coinPulse = Math.max(0, coinPulse - dt);
    } else {
      pendingDx = 0;
      pendingDy = 0;
    }
    draw();
  }

  function draw() {
    const v = view();
    stage.begin();
    ctx.save();
    if (shake > 0)
      ctx.translate(
        (Math.random() - 0.5) * shake * 14,
        (Math.random() - 0.5) * shake * 14,
      );
    drawSea(ctx, sea, scroll, v.x, v.x + v.w, v.y, v.y + v.h);

    const s = state;
    // Ships on the water first
    for (const e of s.enemies) {
      if (e.kind !== "boat") continue;
      // V-shaped wake fading out behind the stern
      const wake = ctx.createLinearGradient(0, e.y - 30, 0, e.y - 120);
      wake.addColorStop(0, "rgba(230,240,255,0.55)");
      wake.addColorStop(1, "rgba(230,240,255,0)");
      ctx.strokeStyle = wake;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(e.x - 30, e.y - 120);
      ctx.lineTo(e.x, e.y - 30);
      ctx.lineTo(e.x + 30, e.y - 120);
      ctx.stroke();
      blit(
        ctx,
        sprites.boat,
        e.x,
        e.y,
        1,
        Math.atan2(e.vy, e.vx) - Math.PI / 2,
      );
      hitFlash(ctx, e.x, e.y, 20, e.flash);
    }
    const boss = s.boss;
    if (boss)
      drawBattleship(
        ctx,
        boss.x,
        boss.y,
        t,
        boss.flash,
        boss.mode === "dying" ? boss.dying : 0,
      );

    // Air layer: shadows, then aircraft
    for (const e of s.enemies) {
      if (e.kind === "boat") continue;
      blit(
        ctx,
        shadows[e.kind],
        e.x + SHADOW.x * 0.7,
        e.y + SHADOW.y * 0.7,
        0.9,
        enemyAngle(e),
      );
    }
    const p = s.player;
    const playerShown = s.phase !== "over";
    if (playerShown) {
      blit(ctx, shadows.hero, p.x + SHADOW.x, p.y + SHADOW.y, 0.85);
      for (const w of WINGMEN)
        blit(
          ctx,
          shadows.wingman,
          p.x + w.dx + SHADOW.x,
          p.y + w.dy + SHADOW.y,
          0.85,
        );
    }

    for (const k of s.pickups) {
      if (k.kind === "coin") {
        // Spinning coin: squash horizontally
        const squash = Math.abs(Math.cos(t * 8 + k.id));
        ctx.save();
        ctx.translate(k.x, k.y);
        ctx.scale(0.3 + squash * 0.7, 1);
        blit(ctx, sprites.coin, 0, 0);
        ctx.restore();
      } else {
        blit(
          ctx,
          sprites.pickups[k.kind],
          k.x,
          k.y,
          1 + Math.sin(t * 6 + k.id) * 0.06,
        );
      }
    }

    for (const e of s.enemies) {
      if (e.kind === "boat") continue;
      const sp = sprites[e.kind];
      blit(ctx, sp, e.x, e.y, 1, enemyAngle(e));
      if (e.kind === "heli") drawRotor(ctx, e.x, e.y + 4, t + e.id);
      hitFlash(ctx, e.x, e.y, ENEMIES[e.kind].radius, e.flash);
    }
    for (const e of s.enemies) {
      if (e.hp < e.maxHp)
        drawHpBar(
          ctx,
          e.x,
          e.y + ENEMIES[e.kind].radius + 6,
          Math.min(70, ENEMIES[e.kind].radius * 1.6),
          e.hp / e.maxHp,
        );
    }

    for (const b of s.bullets)
      blit(
        ctx,
        b.wing ? sprites.wingBullet : sprites.bullet,
        b.x,
        b.y,
        1,
        Math.atan2(b.vx, -b.vy),
      );

    if (playerShown) {
      const blink =
        p.invuln > 0 && s.phase === "play" && Math.floor(t * 16) % 2 === 0;
      if (s.rapid > 0)
        glowDot(
          ctx,
          p.x,
          p.y,
          80,
          "rgba(90,255,140,0.5)",
          0.5 + Math.sin(t * 12) * 0.2,
        );
      if (!blink) {
        for (const w of WINGMEN)
          blit(
            ctx,
            sprites.wingman,
            p.x + w.dx,
            p.y + w.dy + Math.sin(t * 3 + w.dx) * 2,
          );
        blit(ctx, sprites.hero, p.x, p.y);
      }
    }

    for (const sh of s.shots) {
      if (sh.kind === "missile") {
        drawThrust(ctx, sh.x, sh.y - 20, 34, t + sh.id, -1);
        blit(ctx, sprites.missile, sh.x, sh.y);
      } else {
        blit(ctx, sprites.orb, sh.x, sh.y);
      }
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

    if (popup) {
      ctx.globalAlpha = Math.min(1, (1.4 - popup.t) * 3);
      text(
        ctx,
        popup.text,
        popup.x,
        popup.y - 30 - popup.t * 30,
        22,
        "#fff3c4",
      );
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (bombFlash > 0) fillView(`rgba(255,240,200,${bombFlash * 0.55})`);
    if (hurtFlash > 0) vignette(`rgba(255,30,30,${hurtFlash})`);
    if (warn > 0) drawWarning();
    drawHud();
    if (banner) drawBanner(banner.title, banner.sub, banner.t);
    if (s.phase === "intro") drawIntro();
    if (paused) drawPause();
    if (s.phase === "over" && booms.length === 0) drawResult();
    stage.end();
  }

  function enemyAngle(e: GameState["enemies"][number]) {
    if (e.kind === "zero") return Math.atan2(e.vy, e.vx) + Math.PI / 2;
    return 0;
  }

  function fillView(style: string | CanvasGradient) {
    const v = view();
    ctx.fillStyle = style;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function vignette(color: string) {
    const v = view();
    const cy = v.y + v.h / 2;
    const g = ctx.createRadialGradient(
      W / 2,
      cy,
      v.w * 0.3,
      W / 2,
      cy,
      v.h * 0.6,
    );
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

  /** ad: a red band with "WARNING" between two strips of scrolling "!!!BEWARE". */
  function drawWarning() {
    const v = view();
    const a = Math.min(1, warn * 3, (WARNING_TIME + 0.4 - warn) * 4);
    const cy = top() + v.h * 0.3;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    vignette(`rgba(255,20,30,${0.25 + Math.sin(t * 10) * 0.12})`);
    ctx.fillStyle = "rgba(60,10,30,0.55)";
    ctx.fillRect(v.x, cy - 46, v.w, 92);
    for (const [dy, dir] of [
      [-62, 1],
      [62, -1],
    ] as const) {
      ctx.fillStyle = "rgba(170,20,40,0.8)";
      ctx.fillRect(v.x, cy + dy - 13, v.w, 26);
      ctx.save();
      ctx.beginPath();
      ctx.rect(v.x, cy + dy - 13, v.w, 26);
      ctx.clip();
      const seg = 170;
      const off = ((t * 140 * dir) % seg) - seg;
      for (let x = v.x + off; x < v.x + v.w + seg; x += seg)
        text(ctx, "!!! CẨN THẬN", x, cy + dy + 1, 16, "#ffb0a8", "left");
      ctx.restore();
    }
    const blink = Math.sin(t * 14) > -0.3;
    if (blink) text(ctx, "CẢNH BÁO", W / 2, cy + 2, 54, "#ff4a4a");
    ctx.restore();
  }

  function drawHud() {
    const s = state;
    const y0 = top() + 40;
    const l = left() + 14;

    // HP bar (ad: top-left, red trailing into yellow)
    const bw = Math.min(200, (right() - left()) * 0.4);
    ctx.save();
    ctx.translate(l, y0 - 12);
    ctx.fillStyle = "rgba(10,14,30,0.75)";
    ctx.beginPath();
    ctx.roundRect(-4, -4, bw + 8, 32, 8);
    ctx.fill();
    ctx.strokeStyle = "#e8d29a";
    ctx.lineWidth = 2;
    ctx.stroke();
    const ratio = s.player.hp / MAX_HP;
    const g = ctx.createLinearGradient(0, 0, bw, 0);
    g.addColorStop(0, "#e8302a");
    g.addColorStop(0.45, "#ff8a2a");
    g.addColorStop(1, "#ffe04a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, bw * ratio, 24);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let x = 6; x < bw * ratio; x += 6) ctx.fillRect(x, 0, 1.5, 24);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(0, 0, bw * ratio, 6);
    ctx.restore();
    text(ctx, `Màn ${s.stage}`, l, y0 + 30, 15, "#cfe0ff", "left", 700);

    // Score, top centre-right; coins under it (ad: coin counter top right)
    const pb = pauseBtn();
    text(ctx, String(s.score), pb.x - 34, y0, 26, "#ffffff", "right");
    const cs = 1 + coinPulse * 1.5;
    ctx.save();
    ctx.translate(pb.x - 24, y0 + 32);
    ctx.scale(cs, cs);
    blit(ctx, sprites.coin, 0, 0, 0.9);
    ctx.restore();
    text(ctx, String(s.coins), pb.x - 40, y0 + 32, 18, "#ffd36b", "right");

    // Pause
    ctx.fillStyle = "rgba(10,14,30,0.6)";
    ctx.beginPath();
    ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#e8d29a";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pb.x - 7, pb.y - 8, 5, 16);
    ctx.fillRect(pb.x + 2, pb.y - 8, 5, 16);

    // Boss HP under the HUD
    const boss = s.boss;
    if (boss && boss.mode !== "dying") {
      const w = Math.min(320, right() - left() - 40);
      const x = W / 2 - w / 2;
      const y = y0 + 58;
      ctx.fillStyle = "rgba(10,14,30,0.75)";
      ctx.fillRect(x - 3, y - 3, w + 6, 16);
      ctx.fillStyle = "#e8302a";
      ctx.fillRect(x, y, (w * Math.max(0, boss.hp)) / boss.maxHp, 10);
      text(ctx, "CHIẾN HẠM", W / 2, y + 24, 14, "#ffb0a8", "center", 700);
    }

    if (s.phase !== "over") {
      drawSkillButton();
      drawBombButton();
    }
  }

  function roundButton(
    b: Button,
    core: [string, string, string],
    active: boolean,
  ) {
    if (active)
      glowDot(ctx, b.x, b.y, b.r + 22 + Math.sin(t * 6) * 4, core[1], 0.55);
    const g = ctx.createRadialGradient(b.x - 8, b.y - 10, 3, b.x, b.y, b.r);
    g.addColorStop(0, core[0]);
    g.addColorStop(0.6, core[1]);
    g.addColorStop(1, core[2]);
    ctx.globalAlpha = active ? 1 : 0.6;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.stroke();
  }

  /** ad: green round button with three bullets; here it fills as kills charge it. */
  function drawSkillButton() {
    const b = skillBtn();
    const s = state;
    const ready = energyReady(s);
    roundButton(b, ["#b8ffb0", "#2fa84a", "#14522a"], ready || s.rapid > 0);
    // Charge ring, or remaining rapid time
    const frac = s.rapid > 0 ? s.rapid / RAPID_TIME : s.energy / ENERGY_FULL;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(10,14,30,0.6)";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = s.rapid > 0 ? "#7affa0" : "#ffe04a";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 6, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    for (const dx of [-10, 0, 10]) {
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.roundRect(b.x + dx - 3, b.y - 12 + Math.abs(dx) * 0.4, 6, 20, 3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** ad: missiles icon with a count, bottom left. */
  function drawBombButton() {
    const b = bombBtn();
    const n = state.bombs;
    roundButton(b, ["#b8d4ff", "#2f62c8", "#132a6a"], n > 0);
    for (const dx of [-11, 0, 11]) {
      const big = dx === 0;
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.ellipse(
        b.x + dx,
        b.y - (big ? 4 : 0),
        big ? 5 : 4,
        big ? 12 : 9,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = "#e8302a";
      ctx.beginPath();
      ctx.arc(b.x + dx, b.y - (big ? 14 : 8), big ? 3.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#e8302a";
    ctx.beginPath();
    ctx.arc(b.x + b.r - 4, b.y - b.r + 4, 11, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, `${n}`, b.x + b.r - 4, b.y - b.r + 5, 14, "#ffffff");
    if (n >= MAX_BOMBS)
      text(ctx, "đầy", b.x, b.y + b.r + 14, 12, "#cfe0ff", "center", 700);
  }

  function drawBanner(title: string, sub: string, bt: number) {
    const a = Math.min(1, bt * 4, (2.8 - bt) * 2);
    const cy = top() + view().h * 0.36;
    ctx.globalAlpha = Math.max(0, a);
    const w = 420;
    const g = ctx.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
    g.addColorStop(0, "rgba(20,40,120,0)");
    g.addColorStop(0.5, "rgba(20,40,120,0.85)");
    g.addColorStop(1, "rgba(20,40,120,0)");
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - w / 2, cy - 40, w, 84);
    text(ctx, title, W / 2, cy - 8, 40, "#ffe27a");
    text(ctx, sub, W / 2, cy + 26, 17, "#e8f0ff", "center", 700);
    ctx.globalAlpha = 1;
  }

  /** ad: "Your mission: survive the air battle" card at the top. */
  function drawIntro() {
    const a = Math.min(1, state.intro * 3);
    const y = top() + 150;
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(10,14,40,0.6)";
    ctx.beginPath();
    ctx.roundRect(W / 2 - 220, y - 44, 440, 88, 16);
    ctx.fill();
    text(ctx, "Nhiệm vụ: sống sót qua", W / 2, y - 14, 26, "#ffffff");
    text(ctx, "trận không chiến!", W / 2, y + 18, 26, "#ffffff");
    text(
      ctx,
      "Kéo ngón tay ở bất kỳ đâu để bay",
      W / 2,
      y + 66,
      16,
      "#cfe0ff",
      "center",
      700,
    );
    ctx.globalAlpha = 1;
  }

  function panel(title: string, h: number) {
    fillView("rgba(4,10,30,0.65)");
    const cy = panelY();
    const x = W / 2 - 200;
    const y = cy - h / 2 - 40;
    ctx.beginPath();
    ctx.roundRect(x, y, 400, h, 24);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#22408e");
    g.addColorStop(1, "#0f1e50");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#e8d29a";
    ctx.stroke();
    text(ctx, title, W / 2, y + 46, 36, "#fff3c4");
    return y;
  }

  function button(
    r: { x: number; y: number; w: number; h: number },
    label: string,
    primary: boolean,
  ) {
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
    if (primary) {
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, "#ffd27a");
      g.addColorStop(1, "#ff7a2a");
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.14)";
    }
    ctx.fill();
    text(
      ctx,
      label,
      r.x + r.w / 2,
      r.y + r.h / 2 + 1,
      primary ? 24 : 20,
      "#fff",
    );
  }

  function drawPause() {
    const y = panel("Tạm Dừng", 330);
    text(
      ctx,
      `Điểm: ${state.score} · Màn ${state.stage}`,
      W / 2,
      y + 100,
      20,
      "#dce6ff",
      "center",
      700,
    );
    text(
      ctx,
      "Phím: WASD bay · J hỏa lực · Space bom",
      W / 2,
      y + 134,
      14,
      "#a8b8e0",
      "center",
      600,
    );
    button(overlayBtns().primary, "Tiếp tục", true);
    button(overlayBtns().secondary, "Chơi lại", false);
  }

  function drawResult() {
    const s = state;
    const y = panel("Bị Bắn Hạ!", 300);
    text(ctx, `${s.score}`, W / 2, y + 102, 40, "#ffd36b");
    text(
      ctx,
      `Màn ${s.stage} · ${s.coins} xu · ${s.bossesBeaten} chiến hạm`,
      W / 2,
      y + 142,
      17,
      "#dce6ff",
      "center",
      700,
    );
    text(
      ctx,
      s.score >= best ? "Kỷ lục mới!" : `Kỷ lục ${best}`,
      W / 2,
      y + 170,
      15,
      "#a8b8e0",
      "center",
      700,
    );
    button(overlayBtns().primary, "Bay lại", true);
  }

  const loop = new Loop(step);
  loop.start();
  const onVisibility = () => {
    if (document.hidden) {
      if (state.phase !== "over") paused = true;
      loop.stop();
    } else loop.start();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    pause: () => {
      if (state.phase !== "over") paused = true;
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
