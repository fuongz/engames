import "@fontsource/baloo-2/800.css";
import { type Locale, currentLocale } from "../core/i18n";
import { Loop, type PointerInfo, Stage } from "../core/stage";
import {
  type GameContext,
  type GameInstance,
  SUMMARY_KEY,
} from "../core/types";
import {
  HERO_WEAPONS,
  OUTLINE,
  drawArrow,
  drawCoin,
  drawEnemy,
  drawFlame,
  drawHero,
  drawHpBar,
  drawScene,
  drawShieldIcon,
  drawSkull,
  drawWeapon,
  roundRect,
  text,
} from "./art";
import {
  GROUND_Y,
  H,
  HERO_X,
  SHIELDS,
  SPACING,
  W,
  WALK_SPEED,
  WEAPONS,
  type EnemyKind,
} from "./config";
import {
  type GameEvent,
  type GameState,
  type Upgrade,
  buy,
  canBuy,
  createGame,
  nextShield,
  nextWeapon,
  update,
} from "./logic";
import { STRINGS } from "./strings";

const SWING_TIME = 0.32;
const KILLS_HUD = { x: 178, y: 46 };
const GOLD_HUD = { x: 352, y: 46 };
const BUTTONS: Record<Upgrade, { x: number; y: number; s: number }> = {
  weapon: { x: W / 2 - 160, y: 760, s: 140 },
  shield: { x: W / 2 + 20, y: 760, s: 140 },
};
const RESTART = { x: W / 2 - 110, y: 690, w: 220, h: 64 };

interface Floater {
  /** Resolved at draw time, so a language switch also relabels popups in flight. */
  text: (locale: Locale) => string;
  x: number;
  y: number;
  t: number;
  color: string;
  crit?: boolean;
  size: number;
}

interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
}

interface Ghost {
  kind: EnemyKind;
  x: number;
  t: number;
}

const SCORE: Record<Locale, Intl.NumberFormat> = {
  vi: new Intl.NumberFormat(STRINGS.vi.numberLocale),
  en: new Intl.NumberFormat(STRINGS.en.numberLocale),
};

export function startGame(root: HTMLElement, game: GameContext): GameInstance {
  const { storage, audio, reportScore } = game;
  // The player can switch language mid-run, so look it up whenever we draw
  const locale = () => currentLocale(game);
  const tr = () => STRINGS[locale()];
  const fmt = (n: number) => SCORE[locale()].format(n);
  void document.fonts?.load('800 20px "Baloo 2"');
  const stage = new Stage(root, W, H, { bleed: true });
  const { ctx } = stage;

  let state: GameState = createGame();
  let t = 0;
  let scroll = 0;
  let pendingScroll = 0;
  let swings = new Map<number | "hero", number>();
  let flashes = new Map<number | "hero", number>();
  let floaters: Floater[] = [];
  let coins: Coin[] = [];
  let ghosts: Ghost[] = [];
  let dust: { x: number; y: number; vx: number; vy: number; t: number }[] = [];
  let goldBump = 0;
  let shake = 0;
  let defeatT = -1;
  let pressed: Upgrade | null = null;
  let tutorial = !storage.get("tutorialDone", false);
  let best = storage.get("best", 0);
  let reported = false;

  function restart() {
    state = createGame();
    scroll = 0;
    pendingScroll = 0;
    swings = new Map();
    flashes = new Map();
    floaters = [];
    coins = [];
    ghosts = [];
    dust = [];
    defeatT = -1;
    reported = false;
  }

  const float = (f: Omit<Floater, "t">) => floaters.push({ ...f, t: 0 });

  function handle(e: GameEvent) {
    switch (e.type) {
      case "heroSwing":
        swings.set("hero", 0);
        break;
      case "heroHit":
        flashes.set(e.targetId, 0.14);
        float({
          text: () => String(e.damage),
          x: e.x + 4,
          y: GROUND_Y - 112,
          color: e.crit ? "#ffd23f" : "#ffffff",
          crit: e.crit,
          size: e.crit ? 34 : 28,
        });
        shake = Math.max(shake, e.crit ? 0.18 : 0.06);
        audio.noise(0.06, e.crit ? 0.14 : 0.08);
        audio.tone({
          freq: e.crit ? 320 : 220,
          to: 90,
          dur: 0.1,
          type: "triangle",
          vol: 0.12,
        });
        break;
      case "heroMiss":
        float({
          text: (l) => STRINGS[l].miss,
          x: e.x,
          y: GROUND_Y - 112,
          color: "#d9d9d9",
          size: 22,
        });
        audio.tone({ freq: 700, to: 300, dur: 0.12, type: "sine", vol: 0.05 });
        break;
      case "enemySwing":
        swings.set(e.id, 0);
        break;
      case "hurt":
        flashes.set("hero", 0.12);
        float({
          text: () => String(e.damage),
          x: HERO_X,
          y: GROUND_Y - 112,
          color: "#ffffff",
          size: 28,
        });
        audio.tone({
          freq: e.source === "arrow" ? 500 : 160,
          to: 70,
          dur: 0.12,
          type: "square",
          vol: 0.07,
        });
        break;
      case "enemyMiss":
        float({
          text: (l) => STRINGS[l].miss,
          x: HERO_X,
          y: GROUND_Y - 112,
          color: "#d9d9d9",
          size: 22,
        });
        break;
      case "block":
        float({
          text: (l) => STRINGS[l].block,
          x: HERO_X,
          y: GROUND_Y - 112,
          color: "#9fd8ff",
          size: 22,
        });
        audio.tone({
          freq: 1250,
          to: 900,
          dur: 0.12,
          type: "triangle",
          vol: 0.08,
        });
        break;
      case "arrowFired":
        audio.tone({ freq: 900, to: 1400, dur: 0.06, type: "sine", vol: 0.04 });
        break;
      case "kill": {
        ghosts.push({ kind: e.kind, x: e.x, t: 0 });
        pendingScroll += SPACING;
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          dust.push({
            x: e.x,
            y: GROUND_Y - 20,
            vx: Math.cos(a) * 90,
            vy: Math.sin(a) * 60 - 30,
            t: 0,
          });
        }
        const n = e.kind === "chief" ? 8 : e.gold > 250 ? 4 : 3;
        for (let i = 0; i < n; i++)
          coins.push({
            x: e.x,
            y: GROUND_Y - 40,
            vx: (Math.random() - 0.3) * 160,
            vy: -260 - Math.random() * 120,
            t: -i * 0.05,
          });
        if (e.heal > 0)
          float({
            text: () => `+${e.heal}`,
            x: HERO_X,
            y: GROUND_Y - 140,
            color: "#7dff7d",
            size: 22,
          });
        audio.noise(0.12, 0.08);
        break;
      }
      case "upgrade": {
        const isWeapon = e.upgrade === "weapon";
        const tier = isWeapon ? WEAPONS[e.tier] : SHIELDS[e.tier];
        const gain = isWeapon
          ? WEAPONS[e.tier].damage - WEAPONS[e.tier - 1].damage
          : SHIELDS[e.tier].hp - SHIELDS[e.tier - 1].hp;
        // Up on the grass, clear of the damage numbers over the road
        float({
          text: (l) => `${tier.name[l]}!`,
          x: W / 2,
          y: 250,
          color: "#ffe680",
          size: 34,
        });
        float({
          text: (l) =>
            isWeapon ? STRINGS[l].damageGain(gain) : STRINGS[l].hpGain(gain),
          x: W / 2,
          y: 290,
          color: "#7dff7d",
          size: 22,
        });
        if (tutorial) {
          tutorial = false;
          storage.set("tutorialDone", true);
        }
        for (const [i, f] of [523, 659, 784, 1046].entries())
          audio.tone({
            freq: f,
            dur: 0.1,
            type: "square",
            vol: 0.08,
            delay: i * 0.06,
          });
        break;
      }
      case "defeat":
        defeatT = 0;
        if (state.kills > best) {
          best = state.kills;
          storage.set("best", best);
        }
        storage.set(SUMMARY_KEY, {
          vi: STRINGS.vi.summary(best),
          en: STRINGS.en.summary(best),
        });
        if (!reported) {
          reported = true;
          reportScore?.({
            score: state.kills,
            detail: `${WEAPONS[state.weapon].name[locale()]} · ${SHIELDS[state.shield].name[locale()]}`,
          });
        }
        for (const [i, f] of [392, 330, 262, 196].entries())
          audio.tone({
            freq: f,
            dur: 0.25,
            type: "triangle",
            vol: 0.12,
            delay: i * 0.16,
          });
        break;
    }
  }

  // ---------------------------------------------------------- input

  const inButton = (
    p: { x: number; y: number },
    b: { x: number; y: number; s: number },
  ) => p.x >= b.x && p.x <= b.x + b.s && p.y >= b.y && p.y <= b.y + b.s;

  stage.onPointer({
    down(p: PointerInfo) {
      audio.unlock();
      if (state.over) {
        if (
          defeatT > 0.8 &&
          p.x >= RESTART.x &&
          p.x <= RESTART.x + RESTART.w &&
          p.y >= RESTART.y &&
          p.y <= RESTART.y + RESTART.h
        ) {
          restart();
        }
        return;
      }
      for (const u of ["weapon", "shield"] as const) {
        if (!inButton(p, BUTTONS[u])) continue;
        pressed = u;
        if (!buy(state, u))
          audio.tone({ freq: 150, dur: 0.08, type: "square", vol: 0.06 });
      }
    },
    up() {
      pressed = null;
    },
  });

  // ---------------------------------------------------------- frame

  function step(dt: number) {
    t += dt;
    update(state, dt);
    for (const e of state.events) handle(e);
    state.events.length = 0;

    // Scenery scrolls with the line, so the hero reads as walking forward
    if (pendingScroll > 0) {
      const d = Math.min(pendingScroll, WALK_SPEED * dt);
      scroll += d;
      pendingScroll -= d;
    }
    for (const [k, v] of swings) {
      if (v + dt / SWING_TIME >= 1) swings.delete(k);
      else swings.set(k, v + dt / SWING_TIME);
    }
    for (const [k, v] of flashes) {
      if (v - dt <= 0) flashes.delete(k);
      else flashes.set(k, v - dt);
    }
    for (const f of floaters) f.t += dt;
    floaters = floaters.filter((f) => f.t < 1.4);
    for (const g of ghosts) g.t += dt;
    ghosts = ghosts.filter((g) => g.t < 0.4);
    for (const d of dust) {
      d.t += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    dust = dust.filter((d) => d.t < 0.5);
    for (const c of coins) {
      c.t += dt;
      if (c.t > 0 && c.t < 0.35) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vy += 900 * dt;
      } else if (c.t >= 0.35) {
        // Then home in on the gold counter
        const k = Math.min(1, dt * 7);
        c.x += (GOLD_HUD.x - 44 - c.x) * k;
        c.y += (GOLD_HUD.y - c.y) * k;
      }
    }
    const arrived = coins.filter(
      (c) =>
        c.t > 0.35 &&
        Math.hypot(c.x - (GOLD_HUD.x - 44), c.y - GOLD_HUD.y) < 12,
    );
    if (arrived.length) {
      goldBump = 0.2;
      audio.tone({ freq: 1320, to: 1760, dur: 0.06, type: "sine", vol: 0.05 });
    }
    coins = coins.filter((c) => !arrived.includes(c) && c.t < 2);
    goldBump = Math.max(0, goldBump - dt);
    shake = Math.max(0, shake - dt);
    if (defeatT >= 0) defeatT += dt;
    draw();
  }

  function draw() {
    const v = stage.view;
    stage.begin();
    ctx.save();
    if (shake > 0)
      ctx.translate(
        (Math.random() - 0.5) * shake * 20,
        (Math.random() - 0.5) * shake * 10,
      );
    drawScene(ctx, scroll, v.x, v.x + v.w, v.y, v.y + v.h);

    // Back to front so the front foe overlaps the one behind it
    for (let i = state.queue.length - 1; i >= 0; i--) {
      const e = state.queue[i];
      const swing = swings.get(e.id) ?? 0;
      drawEnemy(ctx, e.kind, e.x, GROUND_Y, {
        t,
        swing,
        flash: flashes.get(e.id) ?? 0,
        lunge:
          swing > 0.45 ? Math.sin(((swing - 0.45) / 0.55) * Math.PI) * 14 : 0,
      });
    }
    for (const g of ghosts) {
      ctx.globalAlpha = 1 - g.t / 0.4;
      drawEnemy(ctx, g.kind, g.x, GROUND_Y - g.t * 30, {
        t,
        swing: 0,
        flash: 0.1,
        lunge: 0,
      });
      ctx.globalAlpha = 1;
    }
    const hs = swings.get("hero") ?? 0;
    const walking = pendingScroll > 0;
    drawHero(
      ctx,
      HERO_X,
      GROUND_Y - (walking ? Math.abs(Math.sin(t * 14)) * 4 : 0),
      state.weapon,
      {
        t,
        swing: hs,
        flash: flashes.get("hero") ?? 0,
        lunge: hs > 0.45 ? Math.sin(((hs - 0.45) / 0.55) * Math.PI) * 16 : 0,
      },
    );
    for (const a of state.arrows) drawArrow(ctx, a.x, GROUND_Y - 50);

    drawHpBar(ctx, HERO_X, GROUND_Y + 14, state.hp, state.maxHp, true);
    for (const e of state.queue)
      if (e.x < v.x + v.w + 40)
        drawHpBar(ctx, e.x, GROUND_Y + 14, e.hp, e.maxHp, false);

    for (const d of dust) {
      ctx.globalAlpha = 1 - d.t / 0.5;
      ctx.fillStyle = "#efe6d8";
      ctx.beginPath();
      ctx.arc(d.x, d.y, 6 + d.t * 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Damage numbers rise, then settle into grey (as in the ad)
    const l = locale();
    for (const f of floaters) {
      const k = Math.min(1, f.t / 0.25);
      const y = f.y - k * 18 - f.t * 6;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.t - 0.9) / 0.5);
      const pop = f.t < 0.12 ? 1 + (0.12 - f.t) * 3 : 1;
      const color = f.t > 0.6 && !f.crit ? "#bdbdbd" : f.color;
      if (f.crit) drawFlame(ctx, f.x - f.size * 0.75, y, f.size * 0.4);
      text(ctx, f.text(l), f.x + (f.crit ? 10 : 0), y, f.size * pop, color);
      ctx.globalAlpha = 1;
    }
    for (const c of coins) if (c.t > 0) drawCoin(ctx, c.x, c.y, 11);
    ctx.restore();

    drawHud();
    drawButtons();
    if (tutorial && !state.over) drawTutorial();
    if (defeatT >= 0.6) drawDefeat(Math.min(1, (defeatT - 0.6) / 0.4));
    stage.end();
  }

  function pill(
    x: number,
    y: number,
    label: string,
    icon: () => void,
    bump = 0,
  ) {
    roundRect(ctx, x - 70, y - 22, 140, 44, 12, "rgba(20,32,20,0.62)");
    icon();
    text(ctx, label, x + 14, y + 2, 26 * (1 + bump));
  }

  function drawHud() {
    pill(KILLS_HUD.x, KILLS_HUD.y, String(state.kills), () =>
      drawSkull(ctx, KILLS_HUD.x - 44, KILLS_HUD.y, 14),
    );
    pill(
      GOLD_HUD.x,
      GOLD_HUD.y,
      fmt(state.gold),
      () => drawCoin(ctx, GOLD_HUD.x - 44, GOLD_HUD.y, 14),
      goldBump,
    );
  }

  function drawButtons() {
    for (const u of ["weapon", "shield"] as const) {
      const b = BUTTONS[u];
      const next = u === "weapon" ? nextWeapon(state) : nextShield(state);
      const enabled = canBuy(state, u);
      const press = pressed === u && enabled ? 4 : 0;
      ctx.save();
      ctx.translate(0, press);
      if (enabled) {
        // Affordable: lit, with a soft pulse (ad: icon turns from grey to colour)
        ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.2;
        roundRect(ctx, b.x - 6, b.y - 6, b.s + 12, b.s + 12, 30, "#fff7b0");
        ctx.globalAlpha = 1;
      }
      roundRect(ctx, b.x, b.y + 6, b.s, b.s, 26, "#1d3a1a");
      const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.s);
      g.addColorStop(0, enabled ? "#3f6e36" : "#3a4a38");
      g.addColorStop(1, enabled ? "#2c5427" : "#2c382a");
      roundRect(ctx, b.x, b.y, b.s, b.s, 26, g, 3);
      ctx.globalAlpha = enabled ? 1 : 0.45;
      const cx = b.x + b.s / 2;
      if (u === "weapon") {
        ctx.save();
        ctx.translate(cx - 24, b.y + 72);
        ctx.rotate(-0.8);
        ctx.scale(1.25, 1.25);
        drawWeapon(ctx, HERO_WEAPONS[next ? state.weapon + 1 : state.weapon]);
        ctx.restore();
      } else {
        drawShieldIcon(
          ctx,
          cx,
          b.y + 54,
          30,
          next ? state.shield + 1 : state.shield,
        );
      }
      ctx.globalAlpha = 1;
      if (next) {
        drawCoin(ctx, cx - 30, b.y + b.s - 24, 11);
        text(
          ctx,
          fmt(next.cost),
          cx + 12,
          b.y + b.s - 23,
          24,
          enabled ? "#fff" : "#c8c8c8",
        );
      } else {
        text(ctx, tr().max, cx, b.y + b.s - 23, 24, "#ffd23f");
      }
      ctx.restore();
      const current = (
        u === "weapon" ? WEAPONS[state.weapon] : SHIELDS[state.shield]
      ).name[locale()];
      text(ctx, current, cx, b.y + b.s + 30, 16, "#e8f5e0");
    }
  }

  function drawTutorial() {
    const target = (["weapon", "shield"] as const).find((u) =>
      canBuy(state, u),
    );
    if (!target) return;
    const b = BUTTONS[target];
    const k = (Math.sin(t * 6) + 1) / 2;
    const x = b.x + b.s * 0.62 + k * 6;
    const y = b.y + b.s * 0.55 + k * 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.4);
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(-6, -2, 12, 30, 6);
    ctx.roundRect(-4, 18, 36, 34, 14);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.restore();
    text(ctx, tr().tapToUpgrade, W / 2, b.y - 26, 22, "#fff7b0");
  }

  function drawDefeat(k: number) {
    const v = stage.view;
    ctx.fillStyle = `rgba(16,20,16,${0.72 * k})`;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.save();
    ctx.globalAlpha = k;
    const cy = 380 - (1 - k) * 30;
    // Crossed sword and axe behind a knocked-out hero (ad's DEFEAT art)
    ctx.save();
    ctx.translate(W / 2 - 40, cy - 30);
    ctx.rotate(-0.8);
    ctx.scale(2.2, 2.2);
    drawWeapon(ctx, "sword");
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2 + 40, cy - 30);
    ctx.rotate(-2.35);
    ctx.scale(2.2, 2.2);
    drawWeapon(ctx, "axe");
    ctx.restore();
    ctx.beginPath();
    ctx.arc(W / 2, cy + 10, 62, 0, Math.PI * 2);
    ctx.fillStyle = "#f3b9a3";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    for (const dx of [-22, 22]) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + dx - 9, cy - 4);
      ctx.lineTo(W / 2 + dx + 9, cy + 14);
      ctx.moveTo(W / 2 + dx + 9, cy - 4);
      ctx.lineTo(W / 2 + dx - 9, cy + 14);
      ctx.stroke();
    }
    // Ribbon banner
    roundRect(ctx, W / 2 - 190, cy + 86, 380, 70, 10, "#6b6b6b", 4);
    roundRect(ctx, W / 2 - 176, cy + 94, 352, 54, 8, "#8a8a8a", 0);
    const s = tr();
    text(ctx, s.defeat, W / 2, cy + 122, 40, "#f2f2f2");
    text(ctx, s.kills(state.kills), W / 2, cy + 200, 30, "#ffffff");
    text(ctx, s.best(best), W / 2, cy + 240, 20, "#cfe8c4");
    const g = ctx.createLinearGradient(0, RESTART.y, 0, RESTART.y + RESTART.h);
    g.addColorStop(0, "#ffd04a");
    g.addColorStop(1, "#ff8a1f");
    roundRect(
      ctx,
      RESTART.x,
      RESTART.y + 5,
      RESTART.w,
      RESTART.h,
      22,
      "#b8520f",
    );
    roundRect(ctx, RESTART.x, RESTART.y, RESTART.w, RESTART.h, 22, g, 3.5);
    text(ctx, s.playAgain, W / 2, RESTART.y + RESTART.h / 2 + 1, 28);
    ctx.restore();
  }

  const loop = new Loop(step);
  loop.start();
  const onVisibility = () => (document.hidden ? loop.stop() : loop.start());
  document.addEventListener("visibilitychange", onVisibility);

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    destroy() {
      loop.stop();
      document.removeEventListener("visibilitychange", onVisibility);
      stage.destroy();
    },
  };
}
