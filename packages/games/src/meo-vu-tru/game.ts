import "@fontsource/baloo-2/800.css";
import {
  type GameHooks,
  type PointerInfo,
  type Point,
  type Rect,
  type Runtime,
  SUMMARY_KEY,
  easeOutCubic,
  inRect,
} from "@web-games/core";
import {
  FAMILY_COLOR,
  GOLD,
  INK,
  ORANGE,
  SPRITE,
  blast,
  button,
  canIndex,
  drawBullet,
  drawEnemy,
  drawPickup,
  drawShip,
  drawShot,
  drawSpace,
  drawZap,
  heart,
  panel,
  sprite,
  text,
} from "./art";
import {
  FISH_PER_MISSILE,
  H,
  MAX_LIVES,
  MAX_POWER,
  SHIP_START,
  W,
  WAVE_INTRO,
} from "./config";
import bgImg from "./img/bg.webp";
import bossesImg from "./img/bosses.webp";
import spritesImg from "./img/sprites.webp";
import {
  type GameEvent,
  type Input,
  type State,
  createRun,
  isBoss,
  stageInfo,
  update,
  waveDef,
} from "./logic";
import { STRINGS } from "./strings";

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface Pop {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
  size: number;
}

interface Best {
  score: number;
  stage: number;
}

const newSeed = () => Math.floor(Math.random() * 2 ** 32);
const KILL_COLORS: Record<string, string[]> = {
  ufo: ["#4fe0b0", "#a070ff", "#ffb020", "#ff7ac0"],
};

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx, keys } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];

  const images = new Map<string, HTMLImageElement>();
  const picture = (src: string) => {
    let img = images.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      images.set(src, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  };
  for (const src of [bgImg, spritesImg, bossesImg]) picture(src);

  let best: Best = storage.get<Best>("best", { score: 0, stage: 0 });
  let s: State = createRun(newSeed());
  let screen: "title" | "play" = "title";
  let paused = false;
  let reported = false;
  let newBest = false;
  let overT = 0;
  let t = 0;
  let shake = 0;
  let flash = 0;
  let bits: Bit[] = [];
  let pops: Pop[] = [];
  let blasts: { x: number; y: number; t: number; size: number }[] = [];
  let zaps: { pts: Point[]; t: number }[] = [];
  let toast: { text: string; t: number; color: string } | null = null;
  /** Whether the player has fired a missile yet, for the hint. */
  let usedMissile = false;
  let shots = 0;
  let hitSound = 0;

  // Input: a relative drag (ship keeps its offset from the finger), or a hovering mouse
  let drag: {
    id: number;
    px: number;
    py: number;
    sx: number;
    sy: number;
  } | null = null;
  let target: Point | null = null;
  let missileQueued = false;

  const view = () => stage.view;
  const top = () => Math.max(view().y, -140);
  const bottom = () => Math.min(view().y + view().h, H + 140);
  const left = () => Math.max(view().x, 0);
  const right = () => Math.min(view().x + view().w, W);

  const missileBtn = (): Rect => ({
    x: right() - 104,
    y: bottom() - 108,
    w: 92,
    h: 92,
  });
  const againBtn = (): Rect => ({
    x: W / 2 - 130,
    y: H / 2 + 120,
    w: 260,
    h: 68,
  });

  // ---------------------------------------------------------- feedback

  function burst(
    x: number,
    y: number,
    n: number,
    colors: string[],
    speed = 240,
  ) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.9);
      bits.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.4 + Math.random() * 0.5,
        color: colors[i % colors.length],
        size: 3 + Math.random() * 5,
      });
    }
    if (bits.length > 500) bits = bits.slice(-500);
  }

  function pop(str: string, x: number, y: number, color = GOLD, size = 24) {
    pops.push({ text: str, x, y, t: 0, color, size });
    if (pops.length > 24) pops.shift();
  }

  function say(str: string, color = "#ffffff") {
    toast = { text: str, t: 0, color };
  }

  const tone = audio.tone.bind(audio);

  function onEvent(e: GameEvent) {
    const l = tr();
    switch (e.type) {
      case "fire":
        // Quiet ticks, and not every shot: auto-fire never stops
        if (++shots % (e.family === "bolt" ? 1 : 3) === 0)
          tone(
            e.family === "spread"
              ? { freq: 880, to: 660, dur: 0.04, type: "square", vol: 0.015 }
              : e.family === "laser"
                ? { freq: 1500, to: 1100, dur: 0.05, type: "sine", vol: 0.02 }
                : {
                    freq: 300,
                    to: 900,
                    dur: 0.06,
                    type: "sawtooth",
                    vol: 0.018,
                  },
          );
        break;
      case "zap":
        zaps.push({ pts: e.pts, t: 0 });
        break;
      case "hit":
        if (t - hitSound > 0.06) {
          hitSound = t;
          tone({
            freq: e.boss ? 180 : 420,
            dur: 0.03,
            type: "square",
            vol: 0.02,
          });
        }
        if (e.boss)
          burst(
            e.x + (Math.random() - 0.5) * 120,
            e.y + 40 + Math.random() * 40,
            2,
            ["#fff2a8", "#ffb020"],
            140,
          );
        break;
      case "kill": {
        const colors = KILL_COLORS[e.kind]
          ? [KILL_COLORS[e.kind][e.color % 4], "#ffffff", GOLD]
          : e.kind === "rock"
            ? ["#8a7f9e", "#c9bfd8", "#5e5474"]
            : ["#ffb020", "#ffffff", "#ff7ac0", "#8fd8ff"];
        burst(
          e.x,
          e.y,
          e.kind === "mini" ? 50 : 16,
          colors,
          e.kind === "mini" ? 380 : 240,
        );
        blasts.push({
          x: e.x,
          y: e.y,
          t: 0,
          size: e.kind === "mini" ? 2.2 : 0.8,
        });
        if (e.kind === "mini") shake = Math.max(shake, 0.5);
        tone({
          freq: 520 + Math.random() * 200,
          to: 160,
          dur: 0.12,
          type: "triangle",
          vol: 0.05,
        });
        if (e.kind === "mini") pop(`+${e.score}`, e.x, e.y, GOLD, 34);
        break;
      }
      case "pickup":
        if (e.kind === "fish" || e.kind === "bone")
          tone({
            freq: e.kind === "fish" ? 1320 : 990,
            dur: 0.05,
            type: "sine",
            vol: 0.04,
          });
        if (e.kind === "heart") {
          say(l.lifeGain, "#ff8aa0");
          for (const [i, f] of [660, 880, 1320].entries())
            tone({
              freq: f,
              dur: 0.1,
              type: "triangle",
              vol: 0.07,
              delay: i * 0.07,
            });
        }
        if (
          e.score > 0 &&
          (e.kind === "can" || e.kind === "orb" || e.kind === "heart")
        )
          pop(`+${e.score}`, e.x, e.y - 20);
        break;
      case "power": {
        const label =
          s.power >= MAX_POWER && !e.switched ? l.maxed : l.level(e.power);
        say(`${l.family[e.family]} · ${label}`, FAMILY_COLOR[e.family]);
        burst(s.ship.x, s.ship.y, 18, [FAMILY_COLOR[e.family], "#ffffff"], 200);
        for (const [i, f] of (e.switched
          ? [523, 784, 1046]
          : [659, 880, 1175]
        ).entries())
          tone({
            freq: f,
            dur: 0.09,
            type: "triangle",
            vol: 0.07,
            delay: i * 0.06,
          });
        break;
      }
      case "missileGain":
        pop(tr().missileGain, s.ship.x, s.ship.y - 60, "#ffd0a0", 26);
        tone({ freq: 700, to: 1400, dur: 0.18, type: "sine", vol: 0.06 });
        break;
      case "launch":
        usedMissile = true;
        tone({ freq: 200, to: 900, dur: 0.4, type: "sawtooth", vol: 0.05 });
        break;
      case "boom":
        flash = 0.35;
        shake = 0.6;
        blasts.push({ x: e.x, y: e.y, t: 0, size: 5 });
        burst(e.x, e.y, 60, ["#fff7c0", "#ffb020", "#ff5a3a", "#ff7ac0"], 520);
        tone({ freq: 140, to: 30, dur: 0.7, type: "sawtooth", vol: 0.13 });
        tone({
          freq: 80,
          to: 25,
          dur: 0.8,
          type: "square",
          vol: 0.08,
          delay: 0.04,
        });
        break;
      case "hurt":
        shake = 0.55;
        blasts.push({ x: e.x, y: e.y, t: 0, size: 1.6 });
        burst(e.x, e.y, 40, ["#ff5a3a", "#ffd23f", "#ffffff", "#9aa0ff"], 360);
        tone({ freq: 300, to: 60, dur: 0.5, type: "sawtooth", vol: 0.1 });
        break;
      case "respawn":
        tone({ freq: 440, to: 880, dur: 0.2, type: "triangle", vol: 0.05 });
        break;
      case "wave":
        if (waveDef(e.stage).kind === "boss")
          for (let i = 0; i < 3; i++)
            tone({
              freq: 220,
              to: 180,
              dur: 0.25,
              type: "square",
              vol: 0.06,
              delay: i * 0.35,
            });
        else
          tone({ freq: 523, to: 784, dur: 0.18, type: "triangle", vol: 0.06 });
        break;
      case "clear":
        if (e.bonus > 0) pop(l.bonus(e.bonus), W / 2, H * 0.42, GOLD, 30);
        for (const [i, f] of [523, 659, 784, 1046].entries())
          tone({
            freq: f,
            dur: 0.14,
            type: "triangle",
            vol: 0.07,
            delay: i * 0.08,
          });
        record();
        break;
      case "bossPhase":
        shake = 0.4;
        burst(e.x, e.y, 30, ["#ffb020", "#ffffff", "#ff5a3a"], 320);
        tone({ freq: 160, to: 90, dur: 0.35, type: "square", vol: 0.08 });
        break;
      case "bossDown":
        shake = 1;
        flash = 0.5;
        for (let i = 0; i < 6; i++)
          blasts.push({
            x: e.x + (Math.random() - 0.5) * 200,
            y: e.y + (Math.random() - 0.5) * 140,
            t: -i * 0.12,
            size: 2.5,
          });
        burst(
          e.x,
          e.y,
          90,
          ["#fff7c0", "#ffb020", "#ff5a3a", "#8fd8ff", "#ff7ac0"],
          560,
        );
        pop(`+${e.score}`, e.x, e.y, GOLD, 40);
        say(tr().bossDown, GOLD);
        for (const [i, f] of [392, 523, 659, 784, 1046].entries())
          tone({
            freq: f,
            dur: 0.2,
            type: "triangle",
            vol: 0.09,
            delay: 0.2 + i * 0.1,
          });
        break;
      case "over":
        overT = 0;
        for (const [i, f] of [392, 330, 262, 196].entries())
          tone({
            freq: f,
            dur: 0.25,
            type: "triangle",
            vol: 0.09,
            delay: i * 0.16,
          });
        newBest = s.score > best.score;
        record();
        // Once per run, at game over; never on quit
        if (!reported) {
          reported = true;
          reportScore?.({
            score: s.score,
            detail: tr().detail(stageInfo(s.stage)),
          });
        }
        break;
    }
  }

  /** Best score and furthest wave reached, for the portal card. */
  function record() {
    if (s.score <= best.score && s.stage <= best.stage) return;
    best = {
      score: Math.max(best.score, s.score),
      stage: Math.max(best.stage, s.stage),
    };
    storage.set("best", best);
    const where = stageInfo(best.stage);
    storage.set(SUMMARY_KEY, {
      vi: STRINGS.vi.best(best.score, where),
      en: STRINGS.en.best(best.score, where),
    });
  }

  // ---------------------------------------------------------- actions

  function start() {
    screen = "play";
    tone({ freq: 523, to: 1046, dur: 0.2, type: "triangle", vol: 0.07 });
  }

  function restart() {
    s = createRun(newSeed());
    reported = false;
    newBest = false;
    bits = [];
    pops = [];
    blasts = [];
    zaps = [];
    toast = null;
    target = null;
    drag = null;
    start();
  }

  // ---------------------------------------------------------- input

  function down(p: PointerInfo) {
    if (screen === "title") return start();
    if (paused) {
      paused = false;
      return;
    }
    if (s.phase === "over") {
      if (overT > 0.9 && inRect(p, againBtn())) restart();
      return;
    }
    const m = missileBtn();
    if (inRect(p, { x: m.x - 8, y: m.y - 8, w: m.w + 16, h: m.h + 16 })) {
      missileQueued = true;
      return;
    }
    drag = { id: p.id, px: p.x, py: p.y, sx: s.ship.x, sy: s.ship.y };
    target = null;
  }

  function move(p: PointerInfo) {
    if (drag && p.id === drag.id) {
      target = {
        x: drag.sx + (p.x - drag.px) * 1.15,
        y: drag.sy + (p.y - drag.py) * 1.15,
      };
      if (!s.ship.alive) {
        // Re-anchor after a respawn so the ship does not leap
        drag = {
          id: p.id,
          px: p.x,
          py: p.y,
          sx: SHIP_START.x,
          sy: SHIP_START.y,
        };
        target = null;
      }
    } else if (!drag) {
      // A mouse hovering (touch never moves without a press): the ship follows it
      target = { x: p.x, y: p.y };
    }
  }

  function up(p: PointerInfo) {
    if (drag && p.id === drag.id) {
      drag = null;
      target = null;
    }
  }

  function keydown(e: KeyboardEvent) {
    const c = e.code;
    if (e.repeat) return;
    if (screen === "title" && (c === "Space" || c === "Enter")) return start();
    if (c === "KeyP" || c === "Escape") {
      if (screen === "play" && s.phase === "play") paused = !paused;
      return;
    }
    if (paused && (c === "Space" || c === "Enter")) {
      paused = false;
      return;
    }
    if (s.phase === "over" && overT > 0.9 && (c === "Space" || c === "Enter"))
      return restart();
    if (c === "Space" || c === "KeyX" || c === "ShiftLeft")
      missileQueued = true;
  }

  function keyInput(): Input | null {
    const l = keys.has("ArrowLeft") || keys.has("KeyA");
    const r = keys.has("ArrowRight") || keys.has("KeyD");
    const u = keys.has("ArrowUp") || keys.has("KeyW");
    const d = keys.has("ArrowDown") || keys.has("KeyS");
    if (!(l || r || u || d)) return null;
    return { dx: (r ? 1 : 0) - (l ? 1 : 0), dy: (d ? 1 : 0) - (u ? 1 : 0) };
  }

  // ---------------------------------------------------------- frame

  function step(dt: number) {
    t += dt;
    overT += dt;
    if (screen === "play" && !paused && s.phase === "play") {
      const k = keyInput();
      let input: Input = {};
      if (k) {
        input = k;
        if (!drag) target = null;
      } else if (target) input = { tx: target.x, ty: target.y };
      if (missileQueued) input.missile = true;
      missileQueued = false;
      for (const e of update(s, input, dt)) onEvent(e);
    }
    missileQueued = false;
    if (paused) return;
    shake = Math.max(0, shake - dt * 1.6);
    flash = Math.max(0, flash - dt);
    for (const b of bits) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 1 - dt * 1.5;
      b.vy *= 1 - dt * 1.5;
    }
    bits = bits.filter((b) => b.life > 0);
    for (const p of pops) {
      p.t += dt;
      p.y -= 50 * dt;
    }
    pops = pops.filter((p) => p.t < 1.1);
    for (const b of blasts) b.t += dt * 2.4;
    blasts = blasts.filter((b) => b.t < 1);
    for (const z of zaps) z.t += dt;
    zaps = zaps.filter((z) => z.t < 0.12);
    if (toast) {
      toast.t += dt;
      if (toast.t > 1.8) toast = null;
    }
  }

  function draw() {
    const v = view();
    stage.begin();
    ctx.save();
    if (shake > 0)
      ctx.translate(
        (Math.random() - 0.5) * 16 * shake,
        (Math.random() - 0.5) * 16 * shake,
      );
    drawSpace(ctx, picture(bgImg), v, t);
    if (screen === "title") {
      ctx.restore();
      drawTitle();
      stage.end();
      return;
    }
    drawWorld();
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,250,230,${Math.min(0.7, flash * 1.6)})`;
      ctx.fillRect(v.x, v.y, v.w, v.h);
    }
    drawHud();
    drawBanner();
    if (s.phase === "over") drawOver();
    if (paused) {
      ctx.fillStyle = "rgba(10,6,40,0.65)";
      ctx.fillRect(v.x, v.y, v.w, v.h);
      text(ctx, tr().paused, W / 2, H / 2 - 24, 56, "#ffffff");
      text(ctx, tr().resume, W / 2, H / 2 + 36, 24, "#d8d0ff", "center", 700);
    }
    stage.end();
  }

  function drawWorld() {
    const sprites = picture(spritesImg);
    const bosses = picture(bossesImg);
    for (const p of s.pickups) drawPickup(ctx, sprites, p, t);
    for (const e of s.enemies) drawEnemy(ctx, sprites, bosses, e, t);
    for (const sh of s.shots) drawShot(ctx, sh);
    for (const z of zaps) drawZap(ctx, z.pts, 1 - z.t / 0.12);
    if (s.ship.alive)
      drawShip(ctx, sprites, s.ship.x, s.ship.y, s.ship.vx, t, s.ship.shield);
    for (const b of s.bombs) {
      const k = b.t;
      ctx.fillStyle = "rgba(255,200,120,0.5)";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 40, 6, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      sprite(ctx, sprites, SPRITE.missile, b.x, b.y, 54 + k * 20);
    }
    for (const b of s.bullets) drawBullet(ctx, b, t);
    for (const b of blasts) if (b.t >= 0) blast(ctx, b.x, b.y, b.t, b.size);
    for (const b of bits) {
      ctx.globalAlpha = Math.min(1, b.life * 2.5);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }
    ctx.globalAlpha = 1;
    for (const p of pops) {
      const k = easeOutCubic(Math.min(1, p.t * 5));
      ctx.globalAlpha = Math.min(1, (1.1 - p.t) * 3);
      text(ctx, p.text, p.x, p.y, p.size * (0.6 + 0.4 * k), p.color);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    const l = tr();
    const sprites = picture(spritesImg);
    const y = top() + 30;
    const lang = rt.locale() === "vi" ? "vi-VN" : "en-US";
    // Score, top left
    text(ctx, s.score.toLocaleString(lang), left() + 16, y, 32, GOLD, "left");
    // Where we are, top centre
    text(
      ctx,
      l.where(stageInfo(s.stage)),
      W / 2 + 20,
      y + 44,
      19,
      "#ffffff",
      "center",
      800,
    );
    // Weapon, top right: its can and ten pips
    const wx = right() - 16;
    sprite(ctx, sprites, canIndex(s.family), wx - 108, y, 44);
    text(ctx, l.level(s.power), wx, y - 6, 20, FAMILY_COLOR[s.family], "right");
    for (let i = 0; i < MAX_POWER; i++) {
      ctx.fillStyle =
        i < s.power ? FAMILY_COLOR[s.family] : "rgba(255,255,255,0.18)";
      ctx.fillRect(wx - 80 + i * 8, y + 14, 6, 8);
    }
    // Boss / saucer HP
    const big = s.enemies.find((e) => isBoss(e.kind) || e.kind === "mini");
    if (big && big.y > 0) {
      const r: Rect = { x: W / 2 - 170, y: y + 66, w: 340, h: 16 };
      ctx.fillStyle = "rgba(10,6,40,0.7)";
      ctx.beginPath();
      ctx.roundRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 10);
      ctx.fill();
      const k = Math.max(0, big.hp / big.maxHp);
      const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
      g.addColorStop(0, "#ff3b55");
      g.addColorStop(1, "#ffb020");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w * k, r.h, 8);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 8);
      ctx.stroke();
      if (isBoss(big.kind))
        for (const f of [1 / 3, 2 / 3]) {
          ctx.fillStyle = INK;
          ctx.fillRect(r.x + r.w * f - 1, r.y, 2, r.h);
        }
    }
    // Lives, bottom left
    const by = bottom() - 62;
    for (let i = 0; i < Math.min(MAX_LIVES, Math.max(3, s.lives)); i++)
      heart(ctx, left() + 34 + i * 40, by + 20, 34, i < s.lives);
    // Missile button, bottom right: a ring fills with fish toward the next missile
    const m = missileBtn();
    const cx = m.x + m.w / 2;
    const cy = m.y + m.h / 2;
    ctx.save();
    ctx.globalAlpha = s.missiles > 0 ? 1 : 0.55;
    ctx.fillStyle = "rgba(20,12,70,0.75)";
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = GOLD;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      44,
      -Math.PI / 2,
      -Math.PI / 2 + (Math.PI * 2 * s.fish) / FISH_PER_MISSILE,
    );
    ctx.stroke();
    sprite(ctx, sprites, SPRITE.missile, cx - 6, cy - 2, 62);
    text(ctx, `×${s.missiles}`, cx + 26, cy + 26, 22, "#ffffff");
    ctx.restore();
    sprite(ctx, sprites, SPRITE.fish, m.x - 30, cy + 26, 30);
    text(
      ctx,
      `${s.fish}/${FISH_PER_MISSILE}`,
      m.x - 46,
      cy + 26,
      16,
      "#ffffff",
      "right",
      800,
    );
    // Hints for the first waves
    if (s.stage === 0 && s.wave.t < WAVE_INTRO + 5) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
      text(ctx, l.dragHint, W / 2, by - 30, 20, "#ffffff", "center", 700);
      ctx.globalAlpha = 1;
    } else if (
      !usedMissile &&
      s.missiles > 0 &&
      s.stage >= 2 &&
      s.stage <= 4 &&
      s.wave.state === "fight" &&
      s.wave.t < 6
    ) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
      text(ctx, l.missileHint, W / 2, by - 30, 18, "#ffd0a0", "center", 700);
      ctx.globalAlpha = 1;
    }
    if (toast) {
      ctx.globalAlpha = Math.min(1, toast.t * 6, (1.8 - toast.t) * 3);
      text(ctx, toast.text, W / 2, H * 0.62, 30, toast.color);
      ctx.globalAlpha = 1;
    }
  }

  /** Wave title on arrival, "wave clear" after. */
  function drawBanner() {
    const l = tr();
    const w = s.wave;
    if (s.phase !== "play") return;
    if (w.state === "fight" && w.t < WAVE_INTRO + 0.6) {
      const k = Math.min(1, w.t * 4, (WAVE_INTRO + 0.6 - w.t) * 3);
      const boss = w.def.kind === "boss";
      ctx.globalAlpha = Math.max(0, k);
      const y = H * 0.4;
      ctx.fillStyle = boss ? "rgba(120,10,30,0.55)" : "rgba(10,6,40,0.5)";
      ctx.fillRect(view().x, y - 70, view().w, 150);
      if (boss && Math.floor(t * 4) % 2 === 0)
        text(ctx, l.bossWarning, W / 2, y - 40, 24, "#ff6a7a");
      text(
        ctx,
        l.where(stageInfo(s.stage)),
        W / 2,
        y + (boss ? -4 : -22),
        26,
        "#d8d0ff",
      );
      text(
        ctx,
        l.waveName(w.def),
        W / 2,
        y + (boss ? 40 : 24),
        44,
        boss ? "#ffb020" : GOLD,
      );
      ctx.globalAlpha = 1;
    } else if (
      w.state === "clear" &&
      w.def.kind !== "bonus" &&
      w.def.kind !== "boss"
    ) {
      ctx.globalAlpha = Math.min(1, w.t * 5, (1.8 - w.t) * 3);
      text(ctx, l.cleared, W / 2, H * 0.36, 44, "#7cff5a");
      ctx.globalAlpha = 1;
    }
  }

  function drawTitle() {
    const l = tr();
    const v = view();
    const sprites = picture(spritesImg);
    ctx.fillStyle = "rgba(10,6,40,0.35)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    // A little parade of UFO cats
    for (let i = 0; i < 4; i++) {
      const x = W / 2 + (i - 1.5) * 112;
      const y = 250 + Math.sin(t * 2 + i) * 10;
      sprite(ctx, sprites, SPRITE.ufo + i, x, y, 92);
    }
    const bob = Math.sin(t * 2) * 6;
    text(ctx, l.title, W / 2, 420 + bob, 72, GOLD);
    text(ctx, l.story, W / 2, 480, 22, "#ffffff", "center", 700);
    drawShip(
      ctx,
      sprites,
      W / 2,
      640 + Math.sin(t * 3) * 8,
      Math.sin(t) * 300,
      t,
      0,
    );
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
    text(ctx, l.tapToStart, W / 2, 770, 32, "#ffffff");
    ctx.globalAlpha = 1;
    text(ctx, l.dragHint, W / 2, 830, 18, "#d8d0ff", "center", 700);
    text(ctx, l.keysHint, W / 2, 860, 15, "#b8b0e8", "center", 700);
    if (best.score > 0)
      text(ctx, l.bestLine(best.score), W / 2, 540, 22, "#ffd0a0");
  }

  function drawOver() {
    const l = tr();
    const k = easeOutCubic(Math.min(1, overT * 2.5));
    const v = view();
    ctx.fillStyle = `rgba(10,6,40,${0.6 * k})`;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.save();
    ctx.globalAlpha = k;
    const r: Rect = { x: 50, y: H / 2 - 170, w: W - 100, h: 260 };
    panel(ctx, r);
    text(ctx, l.gameOver, W / 2, r.y + 54, 46, "#ff8aa0");
    text(ctx, l.scoreLine(s.score), W / 2, r.y + 118, 38, GOLD);
    text(
      ctx,
      l.reached(stageInfo(s.stage)),
      W / 2,
      r.y + 170,
      20,
      "#ffffff",
      "center",
      700,
    );
    text(
      ctx,
      newBest ? l.newBest : l.bestLine(best.score),
      W / 2,
      r.y + 220,
      22,
      newBest ? "#7cff5a" : "#d8d0ff",
    );
    if (overT > 0.9) button(ctx, againBtn(), l.again, ORANGE);
    ctx.restore();
  }

  return {
    update: step,
    render: draw,
    pointer: { down, move, up },
    keydown,
    suspend() {
      if (screen === "play" && s.phase === "play") paused = true;
      drag = null;
      target = null;
    },
  };
}
