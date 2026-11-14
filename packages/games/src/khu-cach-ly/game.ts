import "@fontsource/baloo-2/800.css";
import {
  type GameHooks,
  type PointerInfo,
  type Runtime,
  SUMMARY_KEY,
  clamp,
  inRect,
} from "@web-games/core";
import { C, H, W, WEAPONS, WORLD_H, WORLD_W } from "./config";
import { circle, drawWorld, panel, renderFloor, text } from "./art";
import { createGame, selectWeapon, update, type Event } from "./logic";
import { STRINGS } from "./strings";
const ACTION = { x: 390, y: 784, w: 126, h: 64 };
const START = { x: 80, y: 550, w: 380, h: 66 };
const PAUSE = { x: 474, y: 22, w: 44, h: 44 };
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}
export function setup(rt: Runtime): GameHooks {
  const { ctx, stage, keys } = rt;
  const floor = renderFloor(),
    tr = () => STRINGS[rt.locale()];
  let s = createGame(Date.now()),
    mode: "intro" | "play" | "paused" | "over" = "intro";
  let best = rt.game.storage.get("best", 0),
    t = 0,
    shake = 0,
    blast = 0,
    moving = false;
  let particles: Particle[] = [];
  let drag: {
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null = null;
  let blastRequested = false;
  function start() {
    s = createGame(Date.now());
    mode = "play";
    particles = [];
    drag = null;
    blastRequested = false;
  }
  function pause() {
    if (mode === "play") mode = "paused";
    drag = null;
    blastRequested = false;
  }
  function handle(e: Event) {
    const { audio, storage, reportScore } = rt.game;
    if (e.type === "shot")
      audio.tone({
        freq: s.weapon === 2 ? 540 : 150,
        to: 70,
        dur: 0.045,
        type: "sawtooth",
        vol: 0.035,
      });
    if (e.type === "kill" || e.type === "hit" || e.type === "blast") {
      for (let i = 0; i < (e.boss ? 40 : 12); i++) {
        const a = Math.random() * Math.PI * 2,
          v = 50 + Math.random() * 150;
        particles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0.3 + Math.random() * 0.4,
          color:
            e.type === "hit" ? C.red : e.type === "blast" ? C.cyan : C.lime,
        });
      }
      if (e.type === "hit" || e.type === "blast" || e.boss) {
        shake = 0.22;
        audio.noise(0.18, 0.13);
      }
    }
    if (e.type === "blast") blast = 0.6;
    if (e.type === "heal")
      audio.tone({ freq: 520, to: 980, dur: 0.2, vol: 0.1 });
    if (e.type === "wave")
      audio.tone({
        freq: e.boss ? 110 : 440,
        to: e.boss ? 70 : 660,
        dur: 0.3,
        vol: 0.08,
      });
    if (e.type === "over") {
      mode = "over";
      drag = null;
      best = Math.max(best, s.score);
      storage.set("best", best);
      storage.set(SUMMARY_KEY, {
        vi: STRINGS.vi.summary(best),
        en: STRINGS.en.summary(best),
      });
      reportScore?.({ score: s.score, detail: tr().detail(s.wave, s.kills) });
    }
  }
  function down(p: PointerInfo) {
    if (mode !== "play") {
      if (inRect(p, START)) {
        if (mode === "paused") mode = "play";
        else start();
      }
      return;
    }
    if (inRect(p, PAUSE)) {
      pause();
      return;
    }
    if (inRect(p, ACTION)) {
      blastRequested = true;
      return;
    }
    if (p.y >= 868 && p.y <= 930) {
      const index = Math.floor((p.x - 24) / 166);
      selectWeapon(s, index);
      return;
    }
    if (!drag) drag = { id: p.id, x: p.x, y: p.y, dx: 0, dy: 0 };
  }
  function drawHud() {
    const str = tr();
    panel(ctx, 20, 22, 212, 66);
    text(
      ctx,
      `${str.wave} ${String(Math.max(1, s.wave)).padStart(2, "0")}`,
      36,
      43,
      18,
      C.lime,
      "left",
    );
    text(ctx, `${str.kills} ${s.kills}`, 36, 69, 16, C.muted, "left");
    panel(ctx, 244, 22, 218, 66);
    text(ctx, str.score, 260, 43, 15, C.muted, "left");
    text(ctx, s.score.toLocaleString(), 446, 67, 26, C.white, "right");
    panel(ctx, PAUSE.x, PAUSE.y, PAUSE.w, PAUSE.h);
    ctx.fillStyle = C.white;
    ctx.fillRect(489, 36, 4, 16);
    ctx.fillRect(499, 36, 4, 16);
    panel(ctx, 20, 101, 212, 28);
    ctx.fillStyle = C.seam;
    ctx.fillRect(28, 109, 144, 12);
    ctx.fillStyle = s.hp < 30 ? C.red : C.lime;
    ctx.fillRect(28, 109, (144 * s.hp) / 100, 12);
    text(ctx, String(s.hp), 203, 116, 17);
    const mins = Math.floor(s.elapsed / 60),
      secs = Math.floor(s.elapsed % 60);
    text(
      ctx,
      `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
      500,
      111,
      18,
      C.muted,
      "right",
    );
    if (s.banner > 0) {
      panel(ctx, 40, 162, 460, 70, C.panel, s.wave % 5 === 0 ? C.red : C.lime);
      text(ctx, `${str.wave} ${s.wave}`, 270, 184, 23, C.white);
      text(
        ctx,
        s.wave % 5 === 0 ? str.boss : str.incoming,
        270,
        211,
        17,
        s.wave % 5 === 0 ? C.red : C.lime,
      );
    }
    const boss = s.enemies.find((e) => e.kind === "boss");
    if (boss) {
      panel(ctx, 70, 245, 400, 12);
      ctx.fillStyle = C.red;
      ctx.fillRect(74, 249, (392 * boss.hp) / boss.maxHp, 4);
    }
    panel(
      ctx,
      ACTION.x,
      ACTION.y,
      ACTION.w,
      ACTION.h,
      C.panel,
      s.energy >= 100 ? C.cyan : C.wallTop,
    );
    text(ctx, str.blast, 453, 804, 20, C.cyan);
    text(
      ctx,
      s.energy >= 100 ? str.ready : `${Math.floor(s.energy)}%`,
      453,
      829,
      16,
      C.muted,
    );
    for (let i = 0; i < 3; i++) {
      const x = 24 + i * 166,
        locked = s.kills < WEAPONS[i].unlock;
      panel(ctx, x, 868, 160, 60, C.panel, s.weapon === i ? C.lime : C.wallTop);
      text(
        ctx,
        `${i + 1}  ${str.weapons[i]}`,
        x + 80,
        888,
        18,
        locked ? C.muted : s.weapon === i ? C.lime : C.white,
      );
      text(
        ctx,
        locked ? str.locked(WEAPONS[i].unlock) : "▰ ▰ ▰",
        x + 80,
        911,
        14,
        C.muted,
      );
    }
    if (s.elapsed < 12) text(ctx, str.move, 160, 820, 19, C.muted);
  }
  function overlay() {
    const str = tr();
    ctx.fillStyle = C.veil;
    ctx.fillRect(0, 0, W, H);
    text(ctx, str.subtitle, 270, 270, 17, C.lime);
    text(
      ctx,
      mode === "intro" ? str.title : mode === "paused" ? str.paused : str.over,
      270,
      330,
      44,
      C.white,
    );
    ctx.fillStyle = C.lime;
    ctx.fillRect(235, 376, 70, 3);
    if (mode === "intro") {
      text(ctx, str.move, 270, 425, 24);
      text(ctx, str.shoot, 270, 466, 22, C.muted);
    } else {
      text(ctx, `${str.score}  ${s.score}`, 270, 427, 30, C.lime);
      text(
        ctx,
        `${str.best}  ${best}, ${str.wave} ${Math.max(1, s.wave)}`,
        270,
        473,
        22,
        C.muted,
      );
    }
    panel(ctx, START.x, START.y, START.w, START.h, C.lime, C.lime);
    text(
      ctx,
      mode === "intro" ? str.start : mode === "paused" ? str.resume : str.again,
      270,
      584,
      26,
      C.ink,
    );
    // Separate lines keep the desktop controls legible at phone width.
    const parts = str.keys.split(", ");
    text(ctx, parts.slice(0, 2).join(", "), 270, 674, 17, C.muted);
    text(ctx, parts.slice(2).join(", "), 270, 704, 17, C.muted);
  }
  return {
    update(dt) {
      t += dt;
      if (mode !== "play") return;
      const x =
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
        (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) +
        (drag?.dx ?? 0);
      const y =
        (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
        (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) +
        (drag?.dy ?? 0);
      moving = Math.hypot(x, y) > 0.1;
      for (const e of update(s, { x, y, blast: blastRequested }, dt)) handle(e);
      blastRequested = false;
      shake = Math.max(0, shake - dt);
      blast = Math.max(0, blast - dt);
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      particles = particles.filter((p) => p.life > 0);
    },
    render() {
      stage.begin();
      ctx.fillStyle = C.void;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      const cameraX = clamp(s.player.x - W / 2, 0, WORLD_W - W),
        cameraY = clamp(s.player.y - H * 0.53, 0, WORLD_H - H);
      ctx.translate(
        -cameraX + Math.sin(t * 94) * shake * 18,
        -cameraY + Math.cos(t * 87) * shake * 18,
      );
      drawWorld(ctx, s, floor, t, moving);
      for (const p of particles) {
        ctx.globalAlpha = Math.min(1, p.life * 3);
        circle(ctx, p.x, p.y, 3, p.color);
      }
      ctx.globalAlpha = 1;
      if (blast > 0) {
        ctx.strokeStyle = C.cyan;
        ctx.lineWidth = 4;
        ctx.globalAlpha = blast / 0.6;
        ctx.beginPath();
        ctx.arc(
          s.player.x,
          s.player.y,
          (1 - blast / 0.6) * 300,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // Static vignette leaves the centre readable without per-sprite shadows.
      const shade = ctx.createRadialGradient(270, 470, 130, 270, 470, 600);
      shade.addColorStop(0, "transparent");
      shade.addColorStop(1, C.shadow);
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
      if (mode === "play") {
        if (drag) {
          circle(ctx, drag.x, drag.y, 42, C.shadow);
          ctx.strokeStyle = C.edge;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(drag.x, drag.y, 42, 0, Math.PI * 2);
          ctx.stroke();
          circle(ctx, drag.x + drag.dx * 30, drag.y + drag.dy * 30, 18, C.lime);
        }
        drawHud();
      } else overlay();
      stage.end();
    },
    pointer: {
      down,
      move(p) {
        if (drag?.id === p.id) {
          const dx = p.x - drag.x,
            dy = p.y - drag.y,
            d = Math.max(42, Math.hypot(dx, dy));
          drag.dx = dx / d;
          drag.dy = dy / d;
        }
      },
      up(p) {
        if (drag?.id === p.id) drag = null;
      },
    },
    keydown(e) {
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.repeat) return;
      if (e.code === "Enter") {
        if (mode === "paused") mode = "play";
        else if (mode !== "play") start();
      }
      if (e.code === "KeyP" || e.code === "Escape") {
        if (mode === "paused") mode = "play";
        else pause();
      }
      if (mode === "play") {
        if (e.code === "Space") blastRequested = true;
        if (/^Digit[123]$/.test(e.code))
          selectWeapon(s, Number(e.code.slice(-1)) - 1);
      }
    },
    suspend: pause,
  };
}
