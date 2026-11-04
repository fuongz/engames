import "@fontsource/baloo-2/800.css";
import {
  type GameHooks,
  type PointerInfo,
  type Rect,
  type Runtime,
  SUMMARY_KEY,
  easeOutCubic,
  inRect,
} from "@web-games/core";
import {
  CREAM,
  GOLD,
  GREEN,
  ICON,
  INK,
  ORANGE,
  SHOP_ICON,
  blast,
  button,
  clock,
  cover,
  drawClaw,
  drawItem,
  drawMiner,
  drawWorld,
  icon,
  panel,
  pill,
  text,
} from "./art";
import { H, ITEMS, PIVOT, W } from "./config";
import clawImg from "./img/claw.webp";
import bgImg from "./img/bg.webp";
import itemsImg from "./img/items.webp";
import minerImg from "./img/miner.webp";
import shopImg from "./img/shop.webp";
import {
  type GameEvent,
  type Input,
  type State,
  buy,
  canBuy,
  createRun,
  leaveShop,
  openShop,
  pullSpeed,
  update,
} from "./logic";
import { STRINGS } from "./strings";

interface Pop {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
  size: number;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface Best {
  money: number;
  level: number;
}

const newSeed = () => Math.floor(Math.random() * 2 ** 32);

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];

  // Pictures load in the background; art.ts draws stand-ins until each is ready
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
  for (const src of [bgImg, minerImg, clawImg, itemsImg, shopImg]) picture(src);

  let best: Best = storage.get<Best>("best", { money: 0, level: 0 });
  let s: State = createRun(newSeed());
  /** The level card before the clock starts (also unlocks audio on the first tap). */
  let intro = true;
  let paused = false;
  let reported = false;
  /** Time since the current overlay opened, for its entrance. */
  let overlayT = 0;
  let input: Input = {};
  let pops: Pop[] = [];
  let bits: Bit[] = [];
  let blasts: { x: number; y: number; t: number }[] = [];
  let shake = 0;
  let toast: { text: string; t: number } | null = null;
  let t = 0;
  let crank = 0;
  /** Whether the player has fired yet this run, for the first-level hint. */
  let fired = false;

  const view = () => stage.view;
  const top = () => view().y;
  const left = () => Math.max(view().x, 0);
  const right = () => Math.min(view().x + view().w, W);

  // ---------------------------------------------------------- layout

  const dynamiteBtn = (): Rect => ({ x: right() - 92, y: 100, w: 80, h: 66 });
  const overlayBtn = (): Rect => ({
    x: W / 2 - 130,
    y: H / 2 + 70,
    w: 260,
    h: 66,
  });
  const offerRect = (i: number): Rect => ({
    x: 34,
    y: 376 + i * 100,
    w: W - 68,
    h: 90,
  });
  const leaveBtn = (): Rect => ({ x: W / 2 - 150, y: 790, w: 300, h: 66 });

  // ---------------------------------------------------------- feedback

  function burst(
    x: number,
    y: number,
    n: number,
    colors: string[],
    speed = 220,
  ) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      bits.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 80,
        life: 0.5 + Math.random() * 0.5,
        color: colors[i % colors.length],
        size: 3 + Math.random() * 4,
      });
    }
  }

  function pop(str: string, color = GOLD, size = 34) {
    pops.push({
      text: str,
      x: PIVOT.x + 70,
      y: PIVOT.y - 30,
      t: 0,
      color,
      size,
    });
  }

  function say(str: string) {
    toast = { text: str, t: 0 };
  }

  function onEvent(e: GameEvent) {
    const l = tr();
    switch (e.type) {
      case "fire":
        fired = true;
        audio.tone({
          freq: 520,
          to: 260,
          dur: 0.12,
          type: "triangle",
          vol: 0.06,
        });
        break;
      case "grab": {
        const heavy = ITEMS[e.item.kind].weight;
        audio.tone({
          freq: 240 / Math.sqrt(heavy),
          dur: 0.12,
          type: "square",
          vol: 0.06,
        });
        burst(e.item.x, e.item.y, 8, ["#c98a4a", "#8a5530"], 140);
        if (e.item.kind.startsWith("rock") && s.dynamite > 0)
          say(l.dynamiteHint);
        break;
      }
      case "miss":
        audio.tone({ freq: 140, to: 90, dur: 0.15, type: "sine", vol: 0.08 });
        break;
      case "land": {
        const kind = e.item.kind;
        if (e.value > 0) {
          const big = e.value >= 400;
          pop(
            `+${e.value.toLocaleString(rt.locale() === "vi" ? "vi-VN" : "en-US")}`,
            big ? "#9ff3ff" : GOLD,
            big ? 44 : 34,
          );
          for (const [i, f] of (big ? [784, 988, 1318] : [880, 1175]).entries())
            audio.tone({
              freq: f,
              dur: 0.1,
              type: "sine",
              vol: 0.08,
              delay: i * 0.06,
            });
        } else {
          audio.tone({ freq: 300, dur: 0.08, type: "triangle", vol: 0.05 });
        }
        if (kind === "diamond" || kind === "moleDiamond")
          burst(PIVOT.x, PIVOT.y + 30, 22, ["#9ff3ff", "#ffffff", "#5ad0ff"]);
        else if (kind.startsWith("gold"))
          burst(PIVOT.x, PIVOT.y + 30, 16, [GOLD, "#fff2a8", "#f0a020"]);
        if (e.sack?.kind === "dynamite") {
          pop(l.sackDynamite, "#ff8a5a", 28);
          say(l.sackDynamite);
        }
        if (e.sack?.kind === "strength") {
          pop(l.sackStrength, "#9aff8a", 28);
          say(l.sackStrength);
        }
        break;
      }
      case "boom":
        blasts.push({ x: e.x, y: e.y, t: 0 });
        burst(e.x, e.y, 30, ["#ffb020", "#ff6a20", "#8a8f99", "#5a4030"], 320);
        shake = 0.35;
        pop(tr().boom, "#ffb020", 36);
        audio.tone({
          freq: 160,
          to: 40,
          dur: 0.45,
          type: "sawtooth",
          vol: 0.12,
        });
        audio.tone({
          freq: 90,
          to: 30,
          dur: 0.5,
          type: "square",
          vol: 0.08,
          delay: 0.03,
        });
        break;
      case "tick":
        audio.tone({
          freq: e.sec <= 3 ? 1046 : 784,
          dur: 0.06,
          type: "square",
          vol: 0.04,
        });
        break;
      case "end":
        overlayT = 0;
        if (e.won) {
          for (const [i, f] of [523, 659, 784, 1046].entries())
            audio.tone({
              freq: f,
              dur: 0.18,
              type: "triangle",
              vol: 0.1,
              delay: i * 0.1,
            });
          burst(
            W / 2,
            H / 2 - 80,
            50,
            [GOLD, "#9ff3ff", "#ff8a3a", "#7ee04f"],
            380,
          );
          record(s.level);
        } else {
          for (const [i, f] of [392, 330, 262].entries())
            audio.tone({
              freq: f,
              dur: 0.22,
              type: "triangle",
              vol: 0.09,
              delay: i * 0.14,
            });
          record(s.level - 1);
          // Once per run, at game over; never on quit
          if (!reported) {
            reported = true;
            reportScore?.({ score: s.money, detail: tr().detail(s.level) });
          }
        }
        break;
    }
  }

  /** Remember the best run (money banked, deepest level cleared) for the portal card. */
  function record(levelCleared: number) {
    if (s.money <= best.money && levelCleared <= best.level) return;
    best = {
      money: Math.max(best.money, s.money),
      level: Math.max(best.level, levelCleared),
    };
    storage.set("best", best);
    storage.set(SUMMARY_KEY, {
      vi: STRINGS.vi.best(best.money, best.level),
      en: STRINGS.en.best(best.money, best.level),
    });
  }

  // ---------------------------------------------------------- actions

  function primary() {
    if (paused) {
      paused = false;
      return;
    }
    if (intro) {
      intro = false;
      audio.tone({
        freq: 660,
        to: 990,
        dur: 0.12,
        type: "triangle",
        vol: 0.07,
      });
      return;
    }
    if (s.phase === "play") input.fire = true;
    else if (s.phase === "cleared" && overlayT > 0.5) toShop();
    else if (s.phase === "over" && overlayT > 0.8) restart();
    else if (s.phase === "shop") leave();
  }

  function toShop() {
    openShop(s);
    overlayT = 0;
    audio.tone({ freq: 440, to: 660, dur: 0.1, type: "triangle", vol: 0.06 });
  }

  function leave() {
    leaveShop(s);
    intro = true;
    pops = [];
    toast = null;
    audio.tone({ freq: 660, to: 440, dur: 0.1, type: "triangle", vol: 0.06 });
  }

  function restart() {
    s = createRun(newSeed());
    intro = true;
    reported = false;
    fired = false;
    pops = [];
    toast = null;
  }

  function tryBuy(i: number) {
    const o = s.offers[i];
    if (!o || o.sold) return;
    if (buy(s, i)) {
      const r = offerRect(i);
      burst(r.x + 60, r.y + r.h / 2, 18, [GOLD, "#fff2a8"]);
      for (const [k, f] of [988, 1318].entries())
        audio.tone({
          freq: f,
          dur: 0.08,
          type: "sine",
          vol: 0.08,
          delay: k * 0.05,
        });
    } else {
      say(tr().tooPoor);
      audio.tone({ freq: 200, dur: 0.12, type: "square", vol: 0.05 });
    }
  }

  // ---------------------------------------------------------- input

  function onPointerDown(p: PointerInfo) {
    if (paused || intro) return primary();
    if (s.phase === "play") {
      if (inRect(p, dynamiteBtn())) input.dynamite = true;
      else input.fire = true;
      return;
    }
    if (s.phase === "shop") {
      for (let i = 0; i < s.offers.length; i++)
        if (inRect(p, offerRect(i))) return tryBuy(i);
      if (inRect(p, leaveBtn())) leave();
      return;
    }
    if (inRect(p, overlayBtn())) primary();
  }

  function onKey(e: KeyboardEvent) {
    if (e.repeat) return;
    const c = e.code;
    if (c === "Space" || c === "ArrowDown" || c === "Enter" || c === "KeyS")
      return primary();
    if (c === "ArrowUp" || c === "KeyW" || c === "KeyD") {
      if (s.phase === "play" && !intro && !paused) input.dynamite = true;
      return;
    }
    if ((c === "KeyP" || c === "Escape") && s.phase === "play" && !intro) {
      paused = !paused;
      return;
    }
    if (s.phase === "shop" && /^Digit[1-4]$/.test(c))
      tryBuy(Number(c.slice(5)) - 1);
  }

  // ---------------------------------------------------------- frame

  function step(dt: number) {
    t += dt;
    overlayT += dt;
    if (!paused && !intro && s.phase === "play") {
      for (const e of update(s, input, dt)) onEvent(e);
      if (s.claw.mode === "retract")
        crank += dt * (pullSpeed(s.claw.held, s.buffs.strength) / 70);
    }
    input = {};
    if (paused) return;
    shake = Math.max(0, shake - dt);
    for (const b of bits) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 600 * dt;
    }
    bits = bits.filter((b) => b.life > 0);
    for (const p of pops) {
      p.t += dt;
      p.y -= 40 * dt;
    }
    pops = pops.filter((p) => p.t < 1.2);
    for (const b of blasts) b.t += dt * 2.2;
    blasts = blasts.filter((b) => b.t < 1);
    if (toast) {
      toast.t += dt;
      if (toast.t > 2.4) toast = null;
    }
  }

  function draw() {
    const v = view();
    stage.begin();
    if (s.phase === "shop") drawShop();
    else drawDig();
    for (const b of bits) {
      ctx.globalAlpha = Math.min(1, b.life * 2);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }
    ctx.globalAlpha = 1;
    if (toast) {
      ctx.globalAlpha = Math.min(1, toast.t * 5, (2.4 - toast.t) * 3);
      text(ctx, toast.text, W / 2, H - 40, 20, "#ffffff", "center", 800);
      ctx.globalAlpha = 1;
    }
    if (paused) {
      ctx.fillStyle = "rgba(20,8,2,0.6)";
      ctx.fillRect(v.x, v.y, v.w, v.h);
      text(ctx, tr().paused, W / 2, H / 2 - 20, 52, CREAM);
      text(ctx, tr().resume, W / 2, H / 2 + 36, 22, "#ffffff", "center", 700);
    }
    stage.end();
  }

  function drawDig() {
    const v = view();
    const l = tr();
    ctx.save();
    if (shake > 0)
      ctx.translate(
        (Math.random() - 0.5) * 14 * shake,
        (Math.random() - 0.5) * 14 * shake,
      );
    drawWorld(ctx, picture(bgImg), v);
    const items = picture(itemsImg);
    for (const it of s.items)
      drawItem(ctx, items, it.kind, it.x, it.y, it.r, t, it.dir);
    const frame =
      s.claw.mode === "retract" ? 1 + (Math.floor(crank * 2) % 2) : 0;
    drawMiner(ctx, picture(minerImg), frame);
    const held = s.claw.held;
    if (held)
      drawItem(
        ctx,
        items,
        held.kind,
        held.x,
        held.y,
        held.r,
        t,
        held.dir,
        false,
      );
    drawClaw(ctx, picture(clawImg), s.claw, !!held);
    for (const b of blasts) blast(ctx, b.x, b.y, b.t);
    ctx.restore();

    drawHud();
    for (const p of pops) {
      const k = easeOutCubic(Math.min(1, p.t * 4));
      ctx.globalAlpha = Math.min(1, (1.2 - p.t) * 3);
      text(ctx, p.text, p.x, p.y, p.size * (0.6 + 0.4 * k), p.color);
    }
    ctx.globalAlpha = 1;

    if (s.phase === "play" && !intro && !paused && s.level === 1 && !fired) {
      const a = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.globalAlpha = a;
      text(ctx, l.aimHint, W / 2, H - 40, 22, "#ffffff");
      ctx.globalAlpha = 1;
    }
    if (intro) drawIntro();
    else if (s.phase === "cleared" || s.phase === "over") drawResult();
  }

  function drawHud() {
    const l = tr();
    const items = picture(itemsImg);
    const y = Math.max(top() + 12, -90);
    // Money and goal, top left
    const m: Rect = { x: left() + 10, y, w: 142, h: 44 };
    pill(ctx, m);
    icon(ctx, items, ICON.coin, m.x + 22, m.y + m.h / 2, 34);
    const reached = s.money >= s.goal;
    text(
      ctx,
      l.bank(s.money),
      m.x + 44,
      m.y + m.h / 2 + 1,
      24,
      reached ? "#2f9a2a" : INK,
      "left",
      800,
      null,
    );
    text(
      ctx,
      l.goal(s.goal),
      m.x + 6,
      m.y + m.h + 20,
      18,
      reached ? "#c8ff9a" : "#ffffff",
      "left",
    );
    // Time and level, top right
    const r: Rect = { x: right() - 128, y, w: 118, h: 44 };
    pill(ctx, r);
    const urgent = s.phase === "play" && s.time <= 10;
    clock(ctx, r.x + 24, r.y + r.h / 2 + 2, 13, urgent);
    const secs = String(Math.ceil(s.time));
    const throb = urgent ? 1 + 0.12 * Math.max(0, Math.sin(t * 12)) : 1;
    text(
      ctx,
      secs,
      r.x + 76,
      r.y + r.h / 2 + 1,
      26 * throb,
      urgent ? "#e8321c" : INK,
      "center",
      800,
      null,
    );
    text(
      ctx,
      l.level(s.level),
      r.x + r.w - 6,
      r.y + r.h + 20,
      18,
      "#ffffff",
      "right",
    );

    // Dynamite button on the grass, right
    const d = dynamiteBtn();
    const can = s.dynamite > 0 && s.claw.held !== null && s.phase === "play";
    ctx.save();
    ctx.globalAlpha = s.dynamite > 0 ? 1 : 0.45;
    panel(ctx, d, can ? "#ffe2a8" : CREAM, 18);
    icon(ctx, items, ICON.dynamite, d.x + 30, d.y + d.h / 2, 50);
    text(
      ctx,
      `×${s.dynamite}`,
      d.x + d.w - 18,
      d.y + d.h / 2 + 2,
      22,
      INK,
      "center",
      800,
      null,
    );
    ctx.restore();
    if (can) {
      ctx.strokeStyle = `rgba(255,140,40,${0.5 + 0.5 * Math.sin(t * 10)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(d.x - 4, d.y - 4, d.w + 8, d.h + 8, 22);
      ctx.stroke();
    }
    // Active one-level buffs, small icons on the left of the grass
    const on = (
      [
        [s.buffs.strength, ICON.strength],
        [s.buffs.lucky, ICON.clover],
        [s.buffs.polish, ICON.polish],
        [s.buffs.book, ICON.book],
      ] as const
    )
      .filter(([active]) => active)
      .map(([, index]) => index);
    for (const [i, index] of on.entries())
      icon(ctx, items, index, left() + 26 + i * 36, 140, 34);
  }

  function dim(a = 0.55) {
    const v = view();
    ctx.fillStyle = `rgba(30,12,4,${a})`;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function drawIntro() {
    const l = tr();
    dim(0.45);
    const r: Rect = { x: 50, y: H / 2 - 150, w: W - 100, h: 220 };
    panel(ctx, r);
    text(ctx, l.level(s.level), W / 2, r.y + 56, 54, GOLD);
    icon(ctx, picture(itemsImg), ICON.coin, W / 2 - 92, r.y + 126, 46);
    text(
      ctx,
      s.goal.toLocaleString(rt.locale() === "vi" ? "vi-VN" : "en-US"),
      W / 2 - 62,
      r.y + 128,
      44,
      INK,
      "left",
      800,
      null,
    );
    text(
      ctx,
      l.goalLong(s.goal),
      W / 2,
      r.y + 180,
      19,
      "#7a4a28",
      "center",
      700,
      null,
    );
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
    text(ctx, l.tapToStart, W / 2, r.y + r.h + 50, 26, "#ffffff");
    ctx.globalAlpha = 1;
  }

  function drawResult() {
    const l = tr();
    const won = s.phase === "cleared";
    const k = easeOutCubic(Math.min(1, overlayT * 3));
    dim(0.55 * k);
    ctx.save();
    ctx.globalAlpha = k;
    const r: Rect = { x: 50, y: H / 2 - 150, w: W - 100, h: 200 };
    panel(ctx, r);
    const pop = 1 + Math.max(0, 0.3 - overlayT) * 1.4;
    ctx.save();
    ctx.translate(W / 2, r.y + 58);
    ctx.scale(pop, pop);
    text(ctx, won ? l.cleared : l.timeUp, 0, 0, 48, won ? GOLD : "#ff8a6a");
    ctx.restore();
    if (won) {
      text(
        ctx,
        l.clearedLine(s.money),
        W / 2,
        r.y + 130,
        24,
        INK,
        "center",
        800,
        null,
      );
    } else {
      text(
        ctx,
        l.overLine(s.money, s.goal),
        W / 2,
        r.y + 118,
        22,
        INK,
        "center",
        800,
        null,
      );
      text(
        ctx,
        l.overStats(s.level),
        W / 2,
        r.y + 154,
        19,
        "#7a4a28",
        "center",
        700,
        null,
      );
    }
    if (overlayT > (won ? 0.5 : 0.8))
      button(ctx, overlayBtn(), won ? l.toShop : l.again, won ? GREEN : ORANGE);
    ctx.restore();
  }

  function drawShop() {
    const l = tr();
    const v = view();
    const items = picture(itemsImg);
    cover(ctx, picture(shopImg), v, "#8a4a1a");
    text(ctx, l.shopTitle, W / 2, 252, 46, GOLD);
    text(ctx, l.shopLine, W / 2, 290, 19, "#ffffff", "center", 700);
    // The bank, between the title and the offers
    const b: Rect = { x: W / 2 - 80, y: 312, w: 160, h: 44 };
    pill(ctx, b);
    icon(ctx, items, ICON.coin, b.x + 24, b.y + b.h / 2, 34);
    text(
      ctx,
      l.bank(s.money),
      b.x + 48,
      b.y + b.h / 2 + 1,
      24,
      INK,
      "left",
      800,
      null,
    );

    s.offers.forEach((o, i) => {
      const r = offerRect(i);
      const can = canBuy(s, i);
      ctx.save();
      if (o.sold) ctx.globalAlpha = 0.6;
      panel(ctx, r, o.sold ? "#e8dcc4" : CREAM, 20);
      icon(ctx, items, SHOP_ICON[o.kind], r.x + 50, r.y + r.h / 2, 72);
      const info = l.items[o.kind];
      text(ctx, info.name, r.x + 96, r.y + 30, 24, INK, "left", 800, null);
      text(
        ctx,
        info.info,
        r.x + 96,
        r.y + 62,
        16,
        "#7a4a28",
        "left",
        700,
        null,
      );
      ctx.restore();
      // Price tag
      const p: Rect = { x: r.x + r.w - 118, y: r.y + 16, w: 106, h: 30 };
      if (o.sold) {
        text(
          ctx,
          l.sold,
          p.x + p.w / 2,
          r.y + r.h / 2 - 12,
          20,
          "#2f9a2a",
          "center",
          800,
          null,
        );
      } else {
        icon(ctx, items, ICON.coin, p.x + 16, p.y + 15, 26);
        text(
          ctx,
          l.bank(o.price),
          p.x + 34,
          p.y + 16,
          22,
          can ? INK : "#c0392b",
          "left",
          800,
          null,
        );
      }
    });
    button(ctx, leaveBtn(), l.leave, GREEN);
    if (
      s.offers.every((o, i) => o.sold || !canBuy(s, i)) &&
      s.offers.some((o) => !o.sold)
    ) {
      // Nothing affordable left: nudge towards the exit
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 4;
      const r = leaveBtn();
      ctx.beginPath();
      ctx.roundRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 32);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  return {
    update: step,
    render: draw,
    pointer: { down: onPointerDown },
    keydown: onKey,
    suspend() {
      if (s.phase === "play" && !intro) paused = true;
    },
  };
}
