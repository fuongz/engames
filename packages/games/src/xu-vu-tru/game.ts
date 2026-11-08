import "@fontsource/baloo-2/800.css";
import "@fontsource/handjet/700.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, easeOutCubic, inRect } from "@web-games/core";
import {
  AMBER,
  CHUTE,
  COINS_BOX,
  CORE_COLORS,
  FONT,
  GOLD,
  LAMPS_Y,
  LED_FONT,
  MENU_BTN,
  MINT,
  NEON,
  PINK,
  REEL,
  SHELF_BOTTOM,
  SHOOT,
  SPINS_BOX,
  TICKETS_BOX,
  WHEEL_C,
  INK,
  along,
  betaTag,
  button,
  drawBackground,
  drawBody,
  drawCabinet,
  drawChute,
  drawCoreLamps,
  drawCounter,
  drawFlyingCoin,
  drawFrontLip,
  drawGlass,
  drawMarquee,
  drawPusher,
  drawReels,
  drawRobots,
  drawShadow,
  drawShelf,
  drawShootButton,
  drawTray,
  drawWheel,
  fitSize,
  makeSprites,
  neon,
  panel,
  proj,
  text,
} from "./art";
import { CORE_COUNT, FLIGHT_DOWN, FLIGHT_UP, H, SHELF_D, SPIN_PRIZES, SPIN_TIME, SUPER_TICKETS, SUPER_TIME, W } from "./config";
import robotsImg from "./img/robots.webp";
import { type GameEvent, type State, createRun, pusherAt, segmentAt, update } from "./logic";
import { STRINGS } from "./strings";

// The imperative shell: turns the SHOOT button into inputs for logic.ts, plays
// its events as sound, light and particles, and draws the cabinet. Solo only.

const RUN_KEY = "run";
/** Toasts sit on the pusher's top plate, the one calm strip in the machine. */
const TOAST_Y = 522;
const SAVE_EVERY = 8;

type Overlay = "start" | "rules" | "pause" | "over" | null;

interface Best {
  tickets: number;
  supers: number;
}

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
  max: number;
  color: string;
  size: number;
}

/** Something that just went over an edge, animated until it is gone. */
interface Faller {
  x: number;
  y: number;
  edge: "front" | "side";
  stack: number;
  core: number;
  t: number;
}

/** Reels run at full speed for 60% of the spin, then brake evenly to a stop. */
function reelEase(k: number) {
  if (k < 0.6) return k / 0.8;
  const u = (k - 0.6) / 0.4;
  return 0.75 + 0.25 * (1 - (1 - u) * (1 - u));
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** A saved run, if it still has the shape this version expects. */
function parseRun(raw: unknown): State | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<State>;
  if (
    typeof r.seed !== "number" ||
    typeof r.coins !== "number" ||
    typeof r.tickets !== "number" ||
    typeof r.wheel !== "number" ||
    typeof r.pusherT !== "number" ||
    !Array.isArray(r.bodies) ||
    !Array.isArray(r.flights) ||
    !Array.isArray(r.respawns) ||
    !Array.isArray(r.cores) ||
    r.cores.length !== CORE_COUNT
  )
    return null;
  return r as State;
}

function wrap(ctx: CanvasRenderingContext2D, str: string, maxW: number, size: number) {
  ctx.font = `800 ${size}px ${FONT}`;
  const lines: string[] = [];
  let line = "";
  for (const word of str.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const sp = makeSprites();
  const robots = new Image();
  robots.src = robotsImg;
  const robotsReady = () => (robots.complete && robots.naturalWidth > 0 ? robots : null);

  let best: Best = storage.get<Best>("best", { tickets: 0, supers: 0 });
  const saved = parseRun(storage.get<unknown>(RUN_KEY, null));
  let s: State = saved && !saved.over ? saved : createRun(newSeed());
  let resumable = !!saved && !saved.over && saved.shots > 0;
  let overlay: Overlay = "start";
  let rulesFrom: "start" | "pause" = "start";
  let reported = false;
  let newBest = false;
  let overAt = -1;

  // Input
  let pointerHeld: number | null = null;
  let spaceHeld = false;
  /** A press that hasn't fired yet (a quick tap between two steps still counts). */
  let tap = false;

  // Display state
  let t = 0;
  let chase = 0;
  let shake = 0;
  let cheer = 0;
  let superFx = 0;
  let chuteGlow = 0;
  let saveT = 0;
  let shownCoins = s.coins;
  let shownTickets = s.tickets;
  let bumpCoins = 0;
  let bumpTickets = 0;
  let toast: { text: string; t: number; color: string } | null = null;
  let hit: { seg: number; t: number } | null = null;
  let lastSeg = segmentAt(s.wheel);
  let lastClink = 0;
  let lastDry = -9;
  const lampPulse = Array.from({ length: CORE_COUNT }, () => 0);
  const landed = new Map<number, number>();
  let pops: Pop[] = [];
  let bits: Bit[] = [];
  let fallers: Faller[] = [];
  /** The Bonus Spin reel: where the strip is, and the run it is making. */
  let reelPos = 0;
  let reel: { from: number; to: number } | null = null;
  let lastReelCell = 0;

  const view = () => stage.view;

  // ---------------------------------------------------------------- sound

  const sfx = {
    shoot() {
      audio.tone({ freq: 220, to: 900, dur: 0.12, type: "sawtooth", vol: 0.045 });
      audio.tone({ freq: 1500, to: 2400, dur: 0.05, type: "square", vol: 0.02, delay: 0.03 });
    },
    tick() {
      audio.tone({ freq: 2100, dur: 0.012, type: "square", vol: 0.012 });
    },
    clink(v = 1) {
      if (t - lastClink < 0.045) return;
      lastClink = t;
      const f = 2500 + Math.random() * 700;
      audio.tone({ freq: f, dur: 0.05, type: "triangle", vol: 0.05 * v });
      audio.tone({ freq: f * 1.5, dur: 0.04, type: "sine", vol: 0.03 * v, delay: 0.018 });
    },
    win(value: number) {
      const notes = value >= 12 ? [784, 988, 1175, 1568] : value >= 6 ? [784, 988, 1175] : [880, 1175];
      for (const [i, f] of notes.entries()) audio.tone({ freq: f, dur: 0.09, type: "square", vol: 0.04, delay: i * 0.055 });
    },
    back(n: number) {
      for (let i = 0; i < Math.min(n, 3); i++)
        audio.tone({ freq: 2900 - i * 300, dur: 0.05, type: "triangle", vol: 0.05, delay: i * 0.05 });
      audio.tone({ freq: 1320, dur: 0.12, type: "sine", vol: 0.05, delay: 0.06 });
    },
    lost() {
      audio.tone({ freq: 200, to: 80, dur: 0.16, type: "sine", vol: 0.05 });
    },
    core() {
      for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) audio.tone({ freq: f, dur: 0.16, type: "triangle", vol: 0.06, delay: i * 0.06 });
    },
    spinStart() {
      for (const [i, f] of [392, 523, 659, 784].entries()) audio.tone({ freq: f, dur: 0.1, type: "square", vol: 0.04, delay: i * 0.07 });
    },
    reelTick() {
      audio.tone({ freq: 1100, dur: 0.018, type: "square", vol: 0.02 });
    },
    spinWin(prize: number) {
      const n = prize >= 65 ? 8 : prize >= 30 ? 6 : 4;
      for (let i = 0; i < n; i++)
        audio.tone({ freq: [784, 988, 1175, 1568][i % 4] * (i >= 4 ? 2 : 1), dur: 0.1, type: "square", vol: 0.045, delay: i * 0.07 });
    },
    superBonus() {
      const tune = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      for (const [i, f] of tune.entries()) {
        audio.tone({ freq: f, dur: 0.16, type: "square", vol: 0.05, delay: i * 0.11 });
        audio.tone({ freq: f / 2, dur: 0.16, type: "triangle", vol: 0.05, delay: i * 0.11 });
      }
      audio.noise(0.4, 0.06);
    },
    reset() {
      audio.tone({ freq: 880, to: 220, dur: 0.4, type: "triangle", vol: 0.04 });
    },
    dry() {
      audio.tone({ freq: 110, dur: 0.18, type: "square", vol: 0.05 });
    },
    over() {
      for (const [i, f] of [784, 659, 523, 392].entries()) audio.tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.05, delay: i * 0.12 });
    },
  };

  // ---------------------------------------------------------------- feedback

  function burst(x: number, y: number, n: number, colors: string[], speed = 260) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.8);
      const life = 0.5 + Math.random() * 0.6;
      bits.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 120,
        life,
        max: life,
        color: colors[i % colors.length],
        size: 2.5 + Math.random() * 4,
      });
    }
  }

  function pop(str: string, x: number, y: number, color = GOLD, size = 30) {
    pops.push({ text: str, x, y, t: 0, color, size });
  }

  function say(str: string, color = GOLD) {
    toast = { text: str, t: 0, color };
  }

  const pointerTip = CHUTE[CHUTE.length - 1];

  function onEvent(e: GameEvent) {
    const l = tr();
    switch (e.type) {
      case "shoot":
        sfx.shoot();
        chuteGlow = 1;
        break;
      case "dry":
        if (t - lastDry > 1.2) {
          lastDry = t;
          sfx.dry();
          say(l.noCoins, PINK);
        }
        break;
      case "hit":
        hit = { seg: e.seg, t: 0 };
        sfx.clink(1.2);
        burst(pointerTip.x - 10, pointerTip.y, 10, ["#ffffff", GOLD, NEON], 200);
        if (e.segment.kind === "bonus") {
          pop("BONUS!", pointerTip.x - 40, pointerTip.y - 34, PINK, 36);
          cheer = Math.max(cheer, 1.2);
        }
        break;
      case "tickets":
        bumpTickets = 1;
        if (e.source === "wheel") {
          pop(
            `+${e.amount}`,
            pointerTip.x - 34 + (Math.random() - 0.5) * 36,
            pointerTip.y - 26 - Math.random() * 20,
            e.amount >= 12 ? GOLD : "#ffffff",
            e.amount >= 12 ? 40 : 30,
          );
          sfx.win(e.amount);
          if (e.amount >= 12) cheer = Math.max(cheer, 1);
        }
        break;
      case "land":
        landed.set(e.id, 0);
        sfx.clink(e.core >= 0 ? 0.5 : 0.6);
        break;
      case "fall":
        fallers.push({ x: e.x, y: e.y, edge: e.edge, stack: e.stack, core: e.core, t: 0 });
        if (e.edge === "front") {
          const p = proj(e.x, SHELF_D);
          if (e.core >= 0) {
            burst(p.x, p.y, 30, [CORE_COLORS[e.core], "#ffffff", GOLD], 320);
            cheer = Math.max(cheer, 2);
          } else {
            sfx.back(e.stack);
            bumpCoins = 1;
            pop(`+${e.stack}`, p.x, p.y - 14, MINT, e.stack > 1 ? 30 : 24);
          }
        } else sfx.lost();
        break;
      case "coreLit": {
        lampPulse[e.core] = 1;
        sfx.core();
        say(l.coreLit, CORE_COLORS[e.core]);
        const x = W / 2 - (58 * (CORE_COUNT - 1)) / 2 + e.core * 58;
        burst(x, LAMPS_Y, 22, [CORE_COLORS[e.core], "#ffffff"], 240);
        break;
      }
      case "spinStart": {
        sfx.spinStart();
        const idx = SPIN_PRIZES.indexOf(e.prize as (typeof SPIN_PRIZES)[number]);
        const n = SPIN_PRIZES.length;
        const from = reelPos;
        const at = ((Math.round(from) % n) + n) % n;
        reel = { from, to: Math.round(from) + n * 5 + ((idx - at + n) % n) };
        say(l.bonusSpin, GOLD);
        break;
      }
      case "spinWin":
        sfx.spinWin(e.prize);
        pop(`+${e.prize}`, REEL.x + REEL.w - 70, REEL.y - 16, GOLD, e.prize >= 65 ? 46 : 38);
        burst(REEL.x + REEL.w - 70, REEL.y + REEL.h / 2, e.prize >= 65 ? 40 : 22, [GOLD, "#ffffff", PINK], 300);
        cheer = Math.max(cheer, 1.5);
        if (e.prize >= 65) shake = Math.max(shake, 0.3);
        break;
      case "super":
        superFx = SUPER_TIME;
        shake = 0.9;
        cheer = SUPER_TIME;
        sfx.superBonus();
        for (let i = 0; i < 6; i++) burst(60 + i * 84, 300 + (i % 2) * 200, 26, CORE_COLORS, 380);
        break;
      case "reset":
        sfx.reset();
        break;
      case "over":
        overAt = t;
        sfx.over();
        finish();
        break;
    }
  }

  function finish() {
    if (reported) return;
    reported = true;
    storage.set(RUN_KEY, null);
    resumable = false;
    newBest = s.tickets > best.tickets;
    if (newBest) {
      best = { tickets: s.tickets, supers: Math.max(best.supers, s.supers) };
      storage.set("best", best);
      storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(best.tickets), en: STRINGS.en.summary(best.tickets) });
    }
    if (s.tickets > 0) reportScore?.({ score: s.tickets, detail: tr().detail(s.tickets, s.supers) });
  }

  function save() {
    if (s.over || s.shots === 0) return;
    storage.set(RUN_KEY, s);
  }

  function newRun() {
    s = createRun(newSeed());
    reported = false;
    newBest = false;
    overAt = -1;
    shownCoins = s.coins;
    shownTickets = s.tickets;
    fallers = [];
    pops = [];
    landed.clear();
    reel = null;
    superFx = 0;
    storage.set(RUN_KEY, null);
    resumable = false;
    overlay = null;
  }

  // ---------------------------------------------------------------- overlay buttons

  const PANEL: Rect = { x: 40, y: 236, w: 460, h: 428 };
  const startButtons = (): { rect: Rect; id: "go" | "new" | "rules" }[] => {
    const list: { rect: Rect; id: "go" | "new" | "rules" }[] = [{ rect: { x: 100, y: 500, w: 340, h: 66 }, id: "go" }];
    if (resumable) list.push({ rect: { x: 100, y: 578, w: 164, h: 56 }, id: "new" }, { rect: { x: 276, y: 578, w: 164, h: 56 }, id: "rules" });
    else list.push({ rect: { x: 140, y: 578, w: 260, h: 56 }, id: "rules" });
    return list;
  };
  const pauseButtons = (): { rect: Rect; id: "go" | "new" | "rules" }[] => [
    { rect: { x: 100, y: 390, w: 340, h: 66 }, id: "go" },
    { rect: { x: 100, y: 470, w: 164, h: 56 }, id: "rules" },
    { rect: { x: 276, y: 470, w: 164, h: 56 }, id: "new" },
  ];
  const RULE_LINE = 28;
  const RULE_GAP = 14;
  /** The rules card hugs its text (the line count depends on the language). */
  const rulesRect = (): Rect => {
    let lines = 0;
    for (const line of tr().rulesLines) lines += wrap(ctx, line, 400, 19).length;
    const h = 106 + lines * RULE_LINE + tr().rulesLines.length * RULE_GAP + 96;
    return { x: 24, y: H / 2 - h / 2, w: 492, h };
  };
  const rulesClose = (): Rect => {
    const r = rulesRect();
    return { x: 150, y: r.y + r.h - 84, w: 240, h: 60 };
  };
  const AGAIN: Rect = { x: 110, y: 600, w: 320, h: 66 };

  function press(id: "go" | "new" | "rules", from: "start" | "pause") {
    audio.tone({ freq: 660, dur: 0.06, type: "square", vol: 0.04 });
    if (id === "go") overlay = null;
    else if (id === "new") newRun();
    else {
      rulesFrom = from;
      overlay = "rules";
    }
  }

  function onSpace(down: boolean) {
    spaceHeld = down;
    if (down && overlay === null) tap = true;
  }

  // ---------------------------------------------------------------- update

  function step(dt: number) {
    t += dt;
    // A resumed run waits behind the menu; a fresh one idles there (wheel and pusher moving)
    const frozen =
      overlay === "pause" || (overlay === "rules" && rulesFrom === "pause") || (overlay !== null && overlay !== "over" && resumable);
    if (!frozen) {
      const live = overlay === null;
      const shoot = live && (pointerHeld !== null || spaceHeld || tap);
      if (tap && s.cooldown <= 0) tap = false;
      for (const e of update(s, { shoot }, dt)) onEvent(e);
      const seg = segmentAt(s.wheel);
      if (seg !== lastSeg) {
        lastSeg = seg;
        if (live) sfx.tick();
      }
      if (live) {
        saveT += dt;
        if (saveT > SAVE_EVERY) {
          saveT = 0;
          save();
        }
      }
    }
    if (s.over && overlay === null && overAt >= 0 && t - overAt > 1.1) overlay = "over";

    // Lights and counters
    const busyReels = s.spin !== null;
    chase += dt * (superFx > 0 ? 24 : busyReels ? 14 : 5);
    shake = Math.max(0, shake - dt);
    cheer = Math.max(0, cheer - dt);
    superFx = Math.max(0, superFx - dt);
    chuteGlow = Math.max(0, chuteGlow - dt * 4);
    bumpCoins = Math.max(0, bumpCoins - dt * 4);
    bumpTickets = Math.max(0, bumpTickets - dt * 4);
    for (let i = 0; i < lampPulse.length; i++) lampPulse[i] = Math.max(0, lampPulse[i] - dt * 1.5);
    if (hit) {
      hit.t += dt;
      if (hit.t > 0.6) hit = null;
    }
    if (toast) {
      toast.t += dt;
      if (toast.t > 1.6) toast = null;
    }
    const roll = (shown: number, real: number) => {
      const d = real - shown;
      if (Math.abs(d) < 0.5) return real;
      return shown + Math.sign(d) * Math.max(dt * 30, Math.abs(d) * dt * 6);
    };
    shownCoins = roll(shownCoins, s.coins);
    shownTickets = roll(shownTickets, s.tickets);
    for (const [id, k] of landed) {
      if (k > 0.2) landed.delete(id);
      else landed.set(id, k + dt);
    }

    // The Bonus Spin reel
    if (s.spin && !reel) {
      const n = SPIN_PRIZES.length;
      const idx = SPIN_PRIZES.indexOf(s.spin.prize as (typeof SPIN_PRIZES)[number]);
      reel = { from: reelPos, to: Math.round(reelPos) + n * 5 + ((idx - (Math.round(reelPos) % n) + n) % n) };
    }
    if (s.spin && reel) {
      const k = clamp(s.spin.t / SPIN_TIME, 0, 1);
      reelPos = reel.from + (reel.to - reel.from) * reelEase(k);
      const cell = Math.floor(reelPos);
      if (cell !== lastReelCell) {
        lastReelCell = cell;
        if (k < 1) sfx.reelTick();
      }
    } else reel = null;

    // Particles and pops
    for (const b of bits) {
      b.vy += 700 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    bits = bits.filter((b) => b.life > 0);
    for (const p of pops) p.t += dt;
    pops = pops.filter((p) => p.t < 1);
    for (const f of fallers) f.t += dt;
    fallers = fallers.filter((f) => f.t < (f.edge === "front" && f.core < 0 ? 0.8 : 0.55));
    if (bits.length > 400) bits.splice(0, bits.length - 400);
  }

  // ---------------------------------------------------------------- render

  function drawFlights() {
    const py = pusherAt(s.pusherT).y;
    for (const f of s.flights) {
      if (f.t < 0) continue;
      if (f.phase === "up") {
        const k = f.t / FLIGHT_UP;
        const p = along(CHUTE, k);
        const q = along(CHUTE, k - 0.05);
        ctx.save();
        ctx.strokeStyle = "rgba(255,220,120,0.6)";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
        drawFlyingCoin(ctx, sp, p.x, p.y, 22, f.t * 30);
        continue;
      }
      const k = clamp(f.t / FLIGHT_DOWN, 0, 1);
      const end = proj(f.x, py + 16);
      if (f.core >= 0) {
        const y = lerpN(330, end.y, k * k);
        const img = sp.cores[f.core];
        const w = 48 * end.s;
        ctx.save();
        ctx.shadowColor = CORE_COLORS[f.core];
        ctx.shadowBlur = 20;
        ctx.drawImage(img, end.x - w / 2, y - w * 1.1, w, w * (img.height / img.width));
        ctx.restore();
        continue;
      }
      const from = f.from === "hub" ? WHEEL_C : f.from === "wheel" ? pointerTip : { x: end.x, y: 330 };
      const cx = (from.x + end.x) / 2;
      const cy = Math.min(from.y, end.y) - 60;
      const x = (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * cx + k * k * end.x;
      const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * cy + k * k * end.y;
      drawFlyingCoin(ctx, sp, x, y, lerpN(20, 30 * end.s, k), f.t * 22);
    }
  }

  const lerpN = (a: number, b: number, k: number) => a + (b - a) * k;

  function drawFallers() {
    for (const f of fallers) {
      const p = proj(f.x, f.edge === "front" ? SHELF_D : f.y);
      if (f.edge === "front") {
        const k = Math.min(f.t, 0.35);
        const x = p.x;
        const y = p.y + 200 * k + 900 * k * k;
        if (f.t < 0.35) {
          ctx.globalAlpha = 1 - k / 0.5;
          if (f.core >= 0) {
            const img = sp.cores[f.core];
            ctx.drawImage(img, x - 26, y - 40, 52, 52 * (img.height / img.width));
          } else for (let i = 0; i < f.stack; i++) drawFlyingCoin(ctx, sp, x + i * 8, y - i * 6, 30, f.t * 20 + i);
          ctx.globalAlpha = 1;
        } else if (f.core < 0) {
          // Back to the coin counter
          const q = easeOutCubic((f.t - 0.35) / 0.45);
          const tx = COINS_BOX.x + COINS_BOX.w / 2;
          const ty = COINS_BOX.y + COINS_BOX.h / 2;
          const sx = x;
          const sy = p.y + 200 * 0.35 + 900 * 0.35 * 0.35;
          for (let i = 0; i < f.stack; i++)
            drawFlyingCoin(ctx, sp, lerpN(sx, tx, q) + i * 6, lerpN(sy, ty, q) - Math.sin(q * Math.PI) * 60 - i * 6, 24 * (1 - q * 0.4), f.t * 20);
        }
      } else {
        const dir = f.x < 220 ? -1 : 1;
        const x = p.x + dir * 90 * f.t;
        const y = p.y + 500 * f.t * f.t;
        ctx.globalAlpha = Math.max(0, 1 - f.t / 0.55);
        if (f.core >= 0) {
          const img = sp.cores[f.core];
          ctx.drawImage(img, x - 22, y - 34, 44, 44 * (img.height / img.width));
        } else drawFlyingCoin(ctx, sp, x, y, 26 * p.s, 1.2 + f.t * 8);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawMachine() {
    const l = tr();
    const v = view();
    const rainbow = superFx > 0;
    drawBackground(ctx, sp, v, t);
    drawCabinet(ctx, v, t, chase, rainbow);
    // Title on the cabinet's crown when the phone is tall enough to show it
    if (v.y < -50) neon(ctx, l.title, W / 2, v.y / 2, fitSize(ctx, l.title, 40, 380), NEON, 1);
    drawMarquee(ctx, l.marquee(SUPER_TICKETS), t, rainbow);
    // Menu button
    ctx.save();
    ctx.fillStyle = "rgba(10,8,32,0.85)";
    ctx.strokeStyle = "rgba(79,243,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(MENU_BTN.x, MENU_BTN.y, MENU_BTN.w, MENU_BTN.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i++) ctx.fillRect(MENU_BTN.x + 27, MENU_BTN.y + 12 + i * 6, 24, 3);
    text(ctx, l.menu, MENU_BTN.x + MENU_BTN.w / 2, MENU_BTN.y + 41, 14, "#ffffff", "center", null);
    ctx.restore();
    betaTag(ctx, 492, 35, l.beta);
    drawCoreLamps(ctx, sp, s.cores, t, rainbow, lampPulse);
    drawRobots(ctx, robotsReady(), t, cheer);
    drawWheel(ctx, sp, s.wheel, t, chase, hit);
    drawGlass(ctx, { x: 120, y: 112, w: 300, h: 300 }, t);

    // Reels and the spins counter
    const spinning = s.spin !== null;
    drawReels(ctx, l.youWin, SPIN_PRIZES, reelPos, spinning, !!s.spin?.paid, t);
    drawCounter(ctx, SPINS_BOX, l.spins, s.queued, PINK, 2, 0);

    // The shelf
    drawShelf(ctx, t);
    const py = pusherAt(s.pusherT).y;
    drawPusher(ctx, py, t, rainbow);
    const order = [...s.bodies].sort((a, b) => a.y - b.y || a.id - b.id);
    for (const b of order) drawShadow(ctx, b);
    for (const b of order) {
      const k = landed.get(b.id);
      drawBody(ctx, sp, b, t, k === undefined ? 0 : Math.max(0, 1 - k / 0.18), b.core >= 0 && s.cores[b.core] ? 1 : 0);
    }
    drawFrontLip(ctx, chase, rainbow);
    drawFallers();
    drawGlass(ctx, { x: 30, y: 476, w: 480, h: 340 }, t + 4);
    drawChute(ctx, chuteGlow);
    drawFlights();

    // Controls
    drawCounter(ctx, COINS_BOX, l.coins, shownCoins, MINT, 4, bumpCoins);
    drawCounter(ctx, TICKETS_BOX, l.tickets, shownTickets, AMBER, 5, bumpTickets);
    const pressed = pointerHeld !== null || spaceHeld;
    drawShootButton(ctx, l.shoot, pressed, t, s.coins > 0 && !s.over);
    drawTray(ctx, sp, shownCoins, view());
    if (s.shots < 6 && overlay === null)
      text(ctx, l.holdHint, W / 2, SHELF_BOTTOM + 38, 15, "#cfd6ff", "center", INK);
  }

  function drawFx() {
    for (const b of bits) {
      ctx.globalAlpha = Math.min(1, (b.life / b.max) * 1.5);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }
    ctx.globalAlpha = 1;
    for (const p of pops) {
      const k = p.t;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const scale = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : 1.1 - Math.min(0.1, (k - 0.12) * 0.4);
      text(ctx, p.text, p.x, p.y - k * 50, p.size * scale, p.color);
    }
    ctx.globalAlpha = 1;
    if (toast) {
      const k = toast.t;
      const a = k < 0.15 ? k / 0.15 : k > 1.3 ? 1 - (k - 1.3) / 0.3 : 1;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(8,6,28,0.82)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 150, TOAST_Y - 22, 300, 44, 22);
      ctx.fill();
      ctx.strokeStyle = toast.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, toast.text, W / 2, TOAST_Y + 1, fitSize(ctx, toast.text, 26, 280), toast.color);
      ctx.globalAlpha = 1;
    }
    if (superFx > 0) {
      const k = SUPER_TIME - superFx;
      const l = tr();
      const pop = k < 0.3 ? easeOutCubic(k / 0.3) : 1;
      const fade = superFx < 0.4 ? superFx / 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = "rgba(10,4,30,0.72)";
      ctx.fillRect(0, WHEEL_C.y - 78, W, 156);
      ctx.translate(W / 2, WHEEL_C.y - 18);
      ctx.scale(pop, pop);
      ctx.rotate(Math.sin(t * 6) * 0.03);
      neon(ctx, l.superBonus, 0, 0, fitSize(ctx, l.superBonus, 62, 480), CORE_COLORS[Math.floor(t * 10) % 6], 1.8);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = fade;
      neon(ctx, `+${SUPER_TICKETS} ${l.tickets}`, W / 2, WHEEL_C.y + 44, 40, GOLD, 1.4);
      ctx.restore();
      if (Math.random() < 0.5) burst(Math.random() * W, WHEEL_C.y - 70, 3, CORE_COLORS, 160);
    }
  }

  function drawOverlay() {
    const l = tr();
    if (!overlay) return;
    const v = view();
    ctx.fillStyle = "rgba(4,3,14,0.66)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    if (overlay === "start") {
      panel(ctx, PANEL, 26);
      neon(ctx, l.title, W / 2, 300, fitSize(ctx, l.title, 58, 400), NEON, 1.3);
      text(ctx, l.subtitle, W / 2, 352, 22, "#d6dcff", "center", null);
      betaTag(ctx, W / 2, 392, l.beta);
      text(ctx, l.betaNote(s.coins), W / 2, 424, 18, MINT, "center", null);
      if (best.tickets > 0) text(ctx, l.best(best.tickets), W / 2, 460, 20, AMBER, "center", null);
      for (const b of startButtons()) {
        const label = b.id === "go" ? (resumable ? l.resume : l.start) : b.id === "new" ? l.newRun : l.rules;
        button(ctx, b.rect, label, b.id === "go" ? ["#ffb03a", "#e0560e"] : ["#3a8bff", "#2340b0"], b.id === "go" ? 30 : 22);
      }
    } else if (overlay === "pause") {
      panel(ctx, { x: 60, y: 290, w: 420, h: 270 }, 24);
      neon(ctx, l.paused, W / 2, 344, 40, NEON);
      for (const b of pauseButtons()) {
        const label = b.id === "go" ? l.resume : b.id === "new" ? l.newRun : l.rules;
        button(ctx, b.rect, label, b.id === "go" ? ["#ffb03a", "#e0560e"] : ["#3a8bff", "#2340b0"], b.id === "go" ? 28 : 20);
      }
    } else if (overlay === "rules") {
      const r = rulesRect();
      panel(ctx, r, 24);
      neon(ctx, l.rules, W / 2, r.y + 50, 38, NEON);
      let y = r.y + 106;
      l.rulesLines.forEach((line, i) => {
        ctx.fillStyle = [NEON, GOLD, MINT, CORE_COLORS[i % 6], PINK, AMBER][i % 6];
        ctx.beginPath();
        ctx.arc(64, y + 1, 7, 0, Math.PI * 2);
        ctx.fill();
        for (const ln of wrap(ctx, line, 400, 19)) {
          text(ctx, ln, 84, y, 19, "#eef0ff", "left", null);
          y += RULE_LINE;
        }
        y += RULE_GAP;
      });
      button(ctx, rulesClose(), l.close, ["#ffb03a", "#e0560e"], 26);
    } else if (overlay === "over") {
      const r: Rect = { x: 50, y: 250, w: 440, h: 450 };
      panel(ctx, r, 26);
      neon(ctx, l.over, W / 2, 312, fitSize(ctx, l.over, 52, 400), PINK, 1.4);
      text(ctx, l.totalTickets, W / 2, 374, 22, "#d6dcff", "center", null);
      ctx.save();
      ctx.font = `700 96px ${LED_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = AMBER;
      ctx.shadowBlur = 24;
      ctx.fillStyle = AMBER;
      ctx.fillText(String(Math.round(shownTickets)), W / 2, 448);
      ctx.restore();
      text(ctx, l.supersLine(s.supers), W / 2, 518, 22, s.supers > 0 ? GOLD : "#bfc6ff", "center", null);
      if (newBest) neon(ctx, l.newBest, W / 2, 560, 28, MINT);
      else text(ctx, l.best(best.tickets), W / 2, 560, 20, AMBER, "center", null);
      button(ctx, AGAIN, l.again, ["#ffb03a", "#e0560e"], 30);
    }
  }

  // ---------------------------------------------------------------- input

  function down(p: PointerInfo) {
    if (overlay === "start") {
      for (const b of startButtons()) if (inRect(p, b.rect)) return press(b.id, "start");
      return;
    }
    if (overlay === "pause") {
      for (const b of pauseButtons()) if (inRect(p, b.rect)) return press(b.id, "pause");
      return;
    }
    if (overlay === "rules") {
      if (inRect(p, rulesClose()) || !inRect(p, rulesRect())) overlay = rulesFrom;
      return;
    }
    if (overlay === "over") {
      if (inRect(p, AGAIN)) newRun();
      return;
    }
    if (inRect(p, { x: MENU_BTN.x - 6, y: MENU_BTN.y - 6, w: MENU_BTN.w + 12, h: MENU_BTN.h + 12 })) {
      overlay = "pause";
      save();
      return;
    }
    if (Math.hypot(p.x - SHOOT.x, p.y - SHOOT.y) < SHOOT.r + 26) {
      pointerHeld = p.id;
      tap = true;
    }
  }

  return {
    update: step,
    render() {
      stage.begin();
      ctx.save();
      if (shake > 0) {
        const a = Math.min(1, shake) * 9;
        ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      }
      drawMachine();
      drawFx();
      ctx.restore();
      drawOverlay();
      stage.end();
    },
    pointer: {
      down,
      up(p) {
        if (p.id === pointerHeld) pointerHeld = null;
      },
    },
    keydown(e) {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        if (overlay === "start" || overlay === "pause") press("go", overlay);
        else if (overlay === "over") newRun();
        else if (overlay === "rules") overlay = rulesFrom;
        else onSpace(true);
      } else if (e.code === "Escape") {
        if (overlay === null) {
          overlay = "pause";
          save();
        } else if (overlay === "pause") overlay = null;
        else if (overlay === "rules") overlay = rulesFrom;
      }
    },
    keyup(e) {
      if (e.code === "Space" || e.code === "Enter") onSpace(false);
    },
    suspend() {
      pointerHeld = null;
      spaceHeld = false;
      tap = false;
      if (overlay === null) overlay = "pause";
      save();
    },
    dispose() {
      save();
    },
  };
}
