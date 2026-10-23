import "@fontsource/handjet/800.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, type StageHandlers, inRect } from "../core";
import {
  FX,
  POSE,
  type TouchLayout,
  type UiKit,
  drawUi,
  pixelPanel,
  drawFighter,
  drawFx,
  drawHud,
  drawRing,
  drawSpark,
  drawSprite,
  drawTouch,
  drawWave,
  makeStage,
  poseFor,
  text,
  touchLayout,
} from "./art";
import { BEAST_MAX, type Difficulty, FIGHTERS, FLOOR_Y, type FighterId, H, ROUNDS_TO_WIN, STATS, W } from "./config";
import { type Brain, cpuInput, createBrain } from "./cpu";
import { BTN, type Fighter, type GameEvent, type GameState, type Input, createGame, scoreOf, update } from "./logic";
import pxEffects from "./img/px/effects.webp";
import gauBeastPx from "./img/px/gau-beast.webp";
import gauHumanPx from "./img/px/gau-human.webp";
import hoBeastPx from "./img/px/ho-beast.webp";
import hoHumanPx from "./img/px/ho-human.webp";
import soiBeastPx from "./img/px/soi-beast.webp";
import soiHumanPx from "./img/px/soi-human.webp";
import pxPortraits from "./img/px/portraits.webp";
import pxStage from "./img/px/stage.webp";
import uiRects from "./img/px/ui.json";
import pxUi from "./img/px/ui.webp";
import { STRINGS } from "./strings";

/** Pixel atlases for the fight (generated pose sheets, normalized; see RE_NOTES.md). */
const SPRITES: Record<FighterId, { human: string; beast: string }> = {
  ho: { human: hoHumanPx, beast: hoBeastPx },
  soi: { human: soiHumanPx, beast: soiBeastPx },
  gau: { human: gauHumanPx, beast: gauBeastPx },
};

/** Cell of each fighter-form in the portraits atlas (96×96 true pixels, drawn at 2x). */
const PORTRAIT_CELL: Record<FighterId, { human: number; beast: number }> = {
  ho: { human: 0, beast: 1 },
  soi: { human: 2, beast: 3 },
  gau: { human: 4, beast: 5 },
};
const PORTRAIT = 96;

type Screen = "select" | "vs" | "fight" | "result";

interface Spark {
  x: number;
  y: number;
  k: number;
  kind: "hit" | "heavy" | "block";
}

interface Banner {
  text: string;
  sub?: string;
  t: number;
  life: number;
  color: string;
  size: number;
}

const KEYMAP: Record<string, number> = {
  ArrowLeft: BTN.L,
  KeyA: BTN.L,
  ArrowRight: BTN.R,
  KeyD: BTN.R,
  ArrowUp: BTN.U,
  KeyW: BTN.U,
  ArrowDown: BTN.D,
  KeyS: BTN.D,
  KeyJ: BTN.P,
  KeyZ: BTN.P,
  KeyK: BTN.K,
  KeyX: BTN.K,
  KeyL: BTN.S,
  KeyC: BTN.S,
  KeyI: BTN.B,
  KeyV: BTN.B,
};
const BUTTON_BITS = { P: BTN.P, K: BTN.K, S: BTN.S, B: BTN.B } as const;
const STICK_DEAD = 16;
const LADDER = 3;

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx, keys } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const arena = makeStage();
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  let screen: Screen = "select";
  let pick = storage.get<FighterId>("fighter", "ho");
  let level = storage.get<Difficulty>("level", 1);
  let best = storage.get("best", 0);
  let ladder = { opponents: [] as FighterId[], index: 0, won: 0, score: 0 };
  let fight: GameState | null = null;
  let brain: Brain = createBrain(level, 1);
  let t = 0;
  let screenT = 0;
  let paused = false;
  let overT = 0;
  let resultWon = false;
  let reported = false;
  let newRecord = false;
  let sparks: Spark[] = [];
  let rings: { x: number; y: number; k: number; color: string }[] = [];
  let banners: Banner[] = [];
  let shouts: { side: 0 | 1; text: string; t: number }[] = [];
  let combo: { side: 0 | 1; n: number; t: number } | null = null;
  let shake = 0;
  let touched = coarse;

  // Menu art loads in the background; until an image is ready the rig stands in
  const pictures = new Map<string, HTMLImageElement>();
  const picture = (src: string) => {
    let img = pictures.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      pictures.set(src, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  };
  for (const f of FIGHTERS) for (const src of Object.values(SPRITES[f])) picture(src);
  picture(pxPortraits);
  picture(pxUi);
  const uiKit = (): UiKit | null => {
    const img = picture(pxUi);
    return img ? { img, rects: uiRects } : null;
  };
  picture(pxEffects);
  picture(pxStage);
  let puffs: { x: number; y: number; k: number }[] = [];

  /** One portrait cell at 2x, crisp, mirrored when `flip`. */
  function drawPortrait(cell: number, x: number, y: number, scale = 2) {
    const img = picture(pxPortraits);
    if (!img) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cell * PORTRAIT, 0, PORTRAIT, PORTRAIT, Math.round(x), Math.round(y), PORTRAIT * scale, PORTRAIT * scale);
    ctx.restore();
    return true;
  }

  /** A pose from a fighter's atlas, big, for the VS screen (feet at x, y). */
  function drawPose(char: FighterId, beast: boolean, pose: number, x: number, y: number, flip: boolean, scale: number) {
    const img = picture(SPRITES[char][beast ? "beast" : "human"]);
    if (!img) return false;
    const { w, h, ax, by, cols } = { w: 144, h: 112, ax: 60, by: 109, cols: 10 };
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(flip ? -scale : scale, scale);
    ctx.drawImage(img, (pose % cols) * w, Math.floor(pose / cols) * h, w, h, -ax, -by, w, h);
    ctx.restore();
    return true;
  }


  // ---------------------------------------------------------- layout

  const view = () => stage.view;
  const left = () => Math.max(view().x, 0);
  const right = () => Math.min(view().x + view().w, W);
  const top = () => Math.max(view().y, 0);
  // A sideways phone gets the portal's floating toolbar in the top-left corner: keep the HUD below it
  const shortScreen = typeof matchMedia === "function" ? matchMedia("(max-height: 500px)") : null;
  const hudTop = () => top() + (shortScreen?.matches ? 46 : 0);
  const bottom = () => Math.min(view().y + view().h, H);
  const layout = (): TouchLayout => touchLayout(left(), right(), bottom());
  const cardRect = (i: number): Rect => ({ x: W / 2 - 330 + i * 230, y: top() + 96, w: 200, h: 250 });
  const levelRect = (i: number): Rect => ({ x: W / 2 - 180 + i * 125, y: top() + 372, w: 110, h: 40 });
  const startRect = (): Rect => ({ x: W / 2 - 120, y: top() + 428, w: 240, h: 56 });
  const resultButtons = () => ({
    primary: { x: W / 2 - 230, y: H / 2 + 70, w: 220, h: 56 },
    secondary: { x: W / 2 + 10, y: H / 2 + 70, w: 220, h: 56 },
  });
  // Under the timer, clear of both players' bars
  const pauseBtn = () => ({ x: W / 2, y: hudTop() + 96, r: 22 });

  // ---------------------------------------------------------- input

  /** Buttons pressed since the last sim frame: a tap shorter than a frame still counts. */
  let latch = 0;
  /** Floating stick: its centre is wherever the thumb lands (ox, oy); (x, y) is the knob. */
  let stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  const touchHeld = new Map<number, keyof typeof BUTTON_BITS>();

  function stickBits(): Input {
    if (!stick) return 0;
    const dx = stick.x - stick.ox;
    const dy = stick.y - stick.oy;
    if (Math.hypot(dx, dy) < STICK_DEAD) return 0;
    const a = Math.atan2(dy, dx);
    let bits = 0;
    if (Math.cos(a) > 0.38) bits |= BTN.R;
    if (Math.cos(a) < -0.38) bits |= BTN.L;
    if (Math.sin(a) > 0.38) bits |= BTN.D;
    if (Math.sin(a) < -0.38) bits |= BTN.U;
    return bits;
  }

  function heldBits(): Input {
    let bits = latch;
    for (const code of keys) bits |= KEYMAP[code] ?? 0;
    for (const id of touchHeld.values()) bits |= BUTTON_BITS[id];
    return bits | stickBits();
  }

  // ---------------------------------------------------------- flow

  function startLadder() {
    storage.set("fighter", pick);
    storage.set("level", level);
    const others = FIGHTERS.filter((f) => f !== pick);
    // Two rivals, then the champion: your own style, one level up, beast meter full
    ladder = { opponents: [...others, pick], index: 0, won: 0, score: 0 };
    reported = false;
    nextFight();
  }

  function nextFight() {
    const i = ladder.index;
    const opp = ladder.opponents[i];
    fight = createGame(pick, opp, (Date.now() & 0xffff) + i);
    const boss = i === LADDER - 1;
    brain = createBrain(Math.min(2, level + (boss ? 1 : 0)) as Difficulty, (Date.now() & 0xffff) * 3 + i);
    if (boss) fight.fighters[1].beast = BEAST_MAX;
    sparks = [];
    rings = [];
    banners = [];
    shouts = [];
    combo = null;
    overT = 0;
    screen = "vs";
    screenT = 0;
    audio.tone({ freq: 220, to: 440, dur: 0.4, type: "sawtooth", vol: 0.08 });
  }

  function onFightOver() {
    const s = fight;
    if (!s) return;
    resultWon = s.matchWinner === 0;
    ladder.score += scoreOf(s, 0);
    if (resultWon) ladder.won++;
    screen = "result";
    screenT = 0;
    const ladderDone = !resultWon || ladder.index >= LADDER - 1;
    if (ladderDone) finishLadder();
  }

  function finishLadder() {
    if (reported) return;
    reported = true;
    const name = tr().fighters[pick].beast;
    newRecord = ladder.score > best;
    if (ladder.score > best) {
      best = ladder.score;
      storage.set("best", best);
    }
    storage.set(SUMMARY_KEY, { vi: `Kỷ lục ${best.toLocaleString("vi-VN")} điểm`, en: `Best ${best.toLocaleString("en-US")} pts` });
    reportScore?.({ score: ladder.score, detail: tr().detail(name, ladder.won, LADDER) });
  }

  function resultPrimary() {
    if (resultWon && ladder.index < LADDER - 1) {
      ladder.index++;
      nextFight();
    } else startLadder();
  }

  // ---------------------------------------------------------- events → sound & effects

  function banner(textStr: string, color = "#fff", life = 1.2, size = 64, sub?: string) {
    banners.push({ text: textStr, sub, t: 0, life, color, size });
  }

  function handle(e: GameEvent, s: GameState) {
    const l = tr();
    switch (e.type) {
      case "round": {
        const [a, b] = s.fighters;
        const final = a.wins === ROUNDS_TO_WIN - 1 && b.wins === ROUNDS_TO_WIN - 1;
        banner(final ? l.finalRound : l.round(e.n), "#ffe7a6", 1.6, 60);
        break;
      }
      case "fight":
        banner(l.fight, "#ff8a3a", 0.8, 84);
        audio.tone({ freq: 330, to: 660, dur: 0.25, type: "square", vol: 0.1 });
        break;
      case "hit":
        sparks.push({ x: e.x, y: e.y, k: 0, kind: e.heavy ? "heavy" : "hit" });
        shake = Math.max(shake, e.heavy ? 0.28 : 0.12);
        if (e.combo >= 2) combo = { side: e.side, n: e.combo, t: 0 };
        audio.noise(e.heavy ? 0.16 : 0.08, e.heavy ? 0.22 : 0.14);
        audio.tone({ freq: e.heavy ? 120 : 180, to: 60, dur: 0.1, type: "square", vol: 0.08 });
        break;
      case "block":
        sparks.push({ x: e.x, y: e.y, k: 0, kind: "block" });
        audio.tone({ freq: 900, dur: 0.05, type: "triangle", vol: 0.07 });
        break;
      case "armor":
        audio.tone({ freq: 140, dur: 0.12, type: "sawtooth", vol: 0.08 });
        break;
      case "special": {
        const idx = { rush: 0, rising: 1, third: 2, frenzy: 3 }[e.move as "rush" | "rising" | "third" | "frenzy"];
        if (idx !== undefined) shouts.push({ side: e.side, text: l.fighters[s.fighters[e.side].char].moves[idx], t: 0 });
        audio.tone({ freq: 520, to: 260, dur: 0.18, type: "sawtooth", vol: 0.06 });
        break;
      }
      case "projectile":
        audio.tone({ freq: 700, to: 300, dur: 0.35, type: "sine", vol: 0.08 });
        break;
      case "transform": {
        const f = s.fighters[e.side];
        rings.push({ x: f.x, y: f.y - 70, k: 0, color: STATS[f.char].palette.eye });
        shouts.push({ side: e.side, text: `${l.fighters[f.char].beast.toUpperCase()}!`, t: 0 });
        shake = 0.35;
        audio.tone({ freq: 90, to: 260, dur: 0.7, type: "sawtooth", vol: 0.13 });
        break;
      }
      case "revert":
        audio.tone({ freq: 300, to: 150, dur: 0.3, type: "triangle", vol: 0.06 });
        break;
      case "jump":
        audio.tone({ freq: 380, to: 520, dur: 0.06, type: "triangle", vol: 0.04 });
        break;
      case "land":
        puffs.push({ x: s.fighters[e.side].x, y: FLOOR_Y - 10, k: 0 });
        if (e.hard) {
          shake = Math.max(shake, 0.18);
          audio.noise(0.12, 0.14);
        }
        break;
      case "ko":
        banner(e.timeUp ? l.timeUp : l.ko, "#ff5a3a", 1.8, 96);
        shake = 0.5;
        audio.tone({ freq: 160, to: 40, dur: 0.9, type: "sawtooth", vol: 0.14 });
        break;
      case "roundWin":
        if (e.side === null) banner(l.draw, "#dce6ff", 1.4, 60);
        else if (e.perfect) banners.push({ text: l.perfect, t: -0.9, life: 1.4, color: "#ffd23a", size: 54 });
        break;
      case "finishPrompt":
        banners.push({ text: l.finishHim, sub: l.finishHint, t: -0.6, life: 2.6, color: "#ff3a3a", size: 80 });
        audio.tone({ freq: 110, dur: 0.6, type: "square", vol: 0.1 });
        break;
      case "finisher": {
        const f = s.fighters[e.side];
        banners.length = 0;
        banner(l.finisher, "#ffd23a", 1.8, 56);
        rings.push({ x: f.x, y: f.y - 70, k: 0, color: STATS[f.char].palette.eye }, { x: f.x, y: f.y - 70, k: -0.3, color: "#ffffff" });
        shake = 0.7;
        audio.tone({ freq: 70, to: 300, dur: 1.2, type: "sawtooth", vol: 0.16 });
        audio.noise(0.8, 0.18);
        break;
      }
      case "matchWin": {
        const name = l.fighters[s.fighters[e.side].char].name.toUpperCase();
        banners.push({ text: l.wins(name), t: -0.5, life: 1.8, color: e.side === 0 ? "#9affb0" : "#ffb0b0", size: 58 });
        const win = e.side === 0;
        for (const [i, f] of (win ? [523, 659, 784, 1046] : [392, 330, 262]).entries())
          audio.tone({ freq: f, dur: 0.22, type: "triangle", vol: 0.12, delay: 0.5 + i * 0.13 });
        break;
      }
    }
  }

  // ---------------------------------------------------------- pointer & keys

  function tapMenu(p: PointerInfo) {
    if (screen === "select") {
      for (let i = 0; i < FIGHTERS.length; i++)
        if (inRect(p, cardRect(i))) {
          pick = FIGHTERS[i];
          audio.tone({ freq: 660, dur: 0.05, type: "triangle", vol: 0.06 });
          return true;
        }
      for (let i = 0; i < 3; i++)
        if (inRect(p, levelRect(i))) {
          level = i as Difficulty;
          return true;
        }
      if (inRect(p, startRect())) startLadder();
      return true;
    }
    if (screen === "result" && screenT > 0.6) {
      const b = resultButtons();
      if (inRect(p, b.primary)) resultPrimary();
      else if (inRect(p, b.secondary)) {
        screen = "select";
        screenT = 0;
      }
      return true;
    }
    if (paused) {
      paused = false;
      return true;
    }
    return false;
  }

  const pointer: StageHandlers = {
    down(p) {
      if (screen !== "fight") {
        tapMenu(p);
        return;
      }
      if (paused) {
        paused = false;
        return;
      }
      const pb = pauseBtn();
      if ((p.x - pb.x) ** 2 + (p.y - pb.y) ** 2 <= (pb.r + 10) ** 2) {
        paused = true;
        return;
      }
      touched = true;
      const lay = layout();
      for (const b of lay.buttons)
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= (b.r + 12) ** 2) {
          touchHeld.set(p.id, b.id);
          latch |= BUTTON_BITS[b.id];
          return;
        }
      if (p.x < W / 2) stick = { id: p.id, ox: p.x, oy: p.y, x: p.x, y: p.y };
    },
    move(p) {
      if (stick && p.id === stick.id) {
        const r = layout().stick.r;
        const dx = p.x - stick.ox;
        const dy = p.y - stick.oy;
        const d = Math.hypot(dx, dy);
        // Dragging past the rim pulls the centre along, so a long slide never stops responding
        if (d > r) {
          stick.ox = p.x - (dx / d) * r;
          stick.oy = p.y - (dy / d) * r;
        }
        stick.x = p.x;
        stick.y = p.y;
      }
    },
    up(p) {
      if (stick && p.id === stick.id) stick = null;
      touchHeld.delete(p.id);
    },
  };

  function keydown(e: KeyboardEvent) {
    if (e.code in KEYMAP || e.code === "Space") e.preventDefault();
    if (e.repeat) return;
    if (screen === "select") {
      const i = FIGHTERS.indexOf(pick);
      if (e.code === "ArrowLeft" || e.code === "KeyA") pick = FIGHTERS[(i + FIGHTERS.length - 1) % FIGHTERS.length];
      else if (e.code === "ArrowRight" || e.code === "KeyD") pick = FIGHTERS[(i + 1) % FIGHTERS.length];
      else if (e.code === "ArrowUp" || e.code === "KeyW") level = Math.min(2, level + 1) as Difficulty;
      else if (e.code === "ArrowDown" || e.code === "KeyS") level = Math.max(0, level - 1) as Difficulty;
      else if (e.code === "Enter" || e.code === "Space" || e.code === "KeyJ") startLadder();
      return;
    }
    if (screen === "result") {
      if (screenT > 0.6 && (e.code === "Enter" || e.code === "KeyJ")) resultPrimary();
      else if (e.code === "Escape") screen = "select";
      return;
    }
    if (e.code === "Escape" || e.code === "KeyP") {
      paused = !paused;
      return;
    }
    if (paused) return;
    latch |= KEYMAP[e.code] ?? (e.code === "Space" ? BTN.B : 0);
  }

  // ---------------------------------------------------------- frame

  function step(dt: number) {
    t += dt;
    screenT += dt;
    if (paused) return;
    if (screen === "vs" && screenT > 1.7) {
      screen = "fight";
      screenT = 0;
    }
    if (screen === "fight" && fight) {
      const s = fight;
      const p1 = heldBits() | (keys.has("Space") ? BTN.B : 0);
      latch = 0;
      update(s, [p1, cpuInput(s, 1, brain)]);
      for (const e of s.events) handle(e, s);
      s.events.length = 0;
      if (s.phase === "over") {
        overT += dt;
        if (overT > 2.2) onFightOver();
      }
    }
    for (const sp of sparks) sp.k += dt * 3.2;
    sparks = sparks.filter((sp) => sp.k < 1);
    for (const p of puffs) p.k += dt * 2.5;
    puffs = puffs.filter((p) => p.k < 1);
    for (const r of rings) r.k += dt * 1.6;
    rings = rings.filter((r) => r.k < 1);
    for (const b of banners) b.t += dt;
    banners = banners.filter((b) => b.t < b.life);
    for (const sh of shouts) sh.t += dt;
    shouts = shouts.filter((sh) => sh.t < 0.9);
    if (combo) {
      combo.t += dt;
      if (combo.t > 1.2) combo = null;
    }
    shake = Math.max(0, shake - dt);
  }

  // ---------------------------------------------------------- draw

  function drawArena() {
    const v = view();
    ctx.fillStyle = "#1a0f1c";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    const px = picture(pxStage);
    if (px) {
      // The pixel stage is a 480x270 grid shown at 2x: keep its pixels square and sharp
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(px, 0, 0, W, H);
      if (v.x < 0) {
        // Wider screens: mirror the stage's outer edge into the letterbox (no stretched streaks)
        const band = -v.x;
        const src = (band / W) * px.naturalWidth;
        for (const [sx, dx] of [[0, 0], [px.naturalWidth - src, W]] as const) {
          ctx.save();
          ctx.translate(dx, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(px, sx, 0, src, px.naturalHeight, dx === 0 ? 0 : -band, 0, band, H);
          ctx.restore();
        }
      }
      ctx.imageSmoothingEnabled = true;
      return;
    }
    ctx.drawImage(arena, 0, 0);
    // Wider screens: stretch the arena's outer edge into the letterbox
    if (v.x < 0) {
      ctx.drawImage(arena, 0, 0, 2, H, v.x, 0, -v.x, H);
      ctx.drawImage(arena, W - 2, 0, 2, H, W, 0, v.x + v.w - W, H);
    }
  }

  /** During the finisher the loser is thrown off stage in a spin. */
  function finisherLoser(s: GameState, f: Fighter): Fighter {
    if (s.phase !== "finisher" || s.matchWinner === null || f.side === s.matchWinner) return f;
    const k = Math.max(0, s.phaseFrame - 34);
    if (k === 0) return f;
    const dir = f.x >= s.fighters[s.matchWinner].x ? 1 : -1;
    return { ...f, state: "juggle", x: f.x + dir * k * 9, y: FLOOR_Y - 1 - k * 7 + k * k * 0.06, vy: -12 };
  }

  function drawFight(s: GameState) {
    const l = tr();
    const fx = picture(pxEffects);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 24, (Math.random() - 0.5) * shake * 16);
    // The one attacking is drawn on top
    const order = [...s.fighters].sort((a, b) => Number(a.state === "attack") - Number(b.state === "attack"));
    for (const f of order) {
      const input = f.history[f.history.length - 1] ?? 0;
      const away = f.facing === 1 ? BTN.L : BTN.R;
      const shown = finisherLoser(s, f);
      const guarding = (input & away) !== 0 && f.state !== "attack";
      // Beast art from the moment the transformation roar starts
      const beast = f.beastLeft > 0 || (f.state === "transform" && f.frame > 12) || (s.phase === "finisher" && f.side === s.matchWinner);
      const atlas = picture(SPRITES[f.char][beast ? "beast" : "human"]);
      if (atlas) drawSprite(ctx, atlas, shown, poseFor(shown, guarding, t), t, fx);
      else drawFighter(ctx, shown, t, guarding);
    }
    for (const p of s.projectiles) {
      if (fx) drawFx(ctx, fx, FX.wave, p.x, p.y, 0, 1.4, Math.sign(p.vx));
      else drawWave(ctx, p.x, p.y, Math.sign(p.vx), t);
    }
    for (const p of puffs) if (fx) drawFx(ctx, fx, FX.puff, p.x, p.y, p.k, 1.2);
    for (const sp of sparks) {
      if (fx) drawFx(ctx, fx, sp.kind === "block" ? FX.block : sp.kind === "heavy" ? FX.bigSpark : FX.spark, sp.x, sp.y, sp.k, sp.kind === "heavy" ? 2 : 1.5);
      else drawSpark(ctx, sp.x, sp.y, sp.k, sp.kind);
    }
    for (const r of rings) {
      if (r.k < 0) continue;
      if (fx) drawFx(ctx, fx, FX.burst, r.x, r.y, r.k, 3.2);
      drawRing(ctx, r.x, r.y, r.k, r.color);
    }
    for (const sh of shouts) {
      const f = s.fighters[sh.side];
      ctx.globalAlpha = Math.min(1, (0.9 - sh.t) * 4);
      // Side 2 shouts a line higher, so two specials at close range stay readable
      text(ctx, sh.text, f.x, f.y - 176 - sh.side * 28 - sh.t * 20, 20, "#ffe7a6");
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    const names: [string, string] = [l.fighters[s.fighters[0].char].name, l.fighters[s.fighters[1].char].name];
    drawHud(ctx, s.fighters, names, s.timer, left(), right(), hudTop(), uiKit());
    for (const f of s.fighters)
      if (f.beast >= BEAST_MAX && f.beastLeft === 0 && f.side === 0 && s.phase === "fight") {
        ctx.globalAlpha = 0.6 + Math.sin(t * 8) * 0.4;
        text(ctx, l.beastReady, left() + 16, hudTop() + 150, 15, STATS[f.char].palette.eye, "left");
        ctx.globalAlpha = 1;
      }
    if (combo) {
      const x = combo.side === 1 ? right() - 120 : left() + 120;
      ctx.globalAlpha = Math.min(1, (1.2 - combo.t) * 4);
      text(ctx, l.combo(combo.n), x, hudTop() + 190, 30 + Math.min(10, combo.n * 2), "#ffd23a");
      ctx.globalAlpha = 1;
    }
    for (const b of banners) {
      if (b.t < 0) continue;
      const pop = 1 + Math.max(0, 0.25 - b.t) * 1.6;
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.t * 6, (b.life - b.t) * 4);
      ctx.translate(W / 2, H / 2 - 40);
      ctx.scale(pop, pop);
      text(ctx, b.text, 0, 0, b.size, b.color);
      if (b.sub) text(ctx, b.sub, 0, b.size * 0.75, 26, "#fff");
      ctx.restore();
    }
    // Pause button and touch controls
    if (s.phase !== "over") {
      const pb = pauseBtn();
      const ui = uiKit();
      const pr = ui?.rects.pause;
      if (ui && pr) drawUi(ctx, ui, "pause", pb.x - pr.w, pb.y - pr.h);
      else {
        pixelPanel(ctx, pb.x - 16, pb.y - 16, 32, 32);
        ctx.fillStyle = "#fff";
        ctx.fillRect(pb.x - 8, pb.y - 8, 6, 16);
        ctx.fillRect(pb.x + 2, pb.y - 8, 6, 16);
      }
    }
    if (touched) {
      const held = new Set<string>(touchHeld.values());
      const me = s.fighters[0];
      drawTouch(ctx, layout(), stick, held, l.buttons, me.beast >= BEAST_MAX && me.beastLeft === 0, t, uiKit());
    }
  }

  /** A hard-edged pixel panel (no rounded corners, no translucency banding). */
  function card(r: Rect, fill = "#1a1020", rim = "#5a4468") {
    pixelPanel(ctx, r.x, r.y, r.w, r.h, fill, rim);
  }

  /** A chunky pixel button: a darker lip underneath, a light top edge. */
  function button(r: Rect, label: string, color: string) {
    ctx.fillStyle = "#140c10";
    ctx.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 12);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(r.x, r.y + 6, r.w, r.h);
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(r.x, r.y, r.w, 4);
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, 24, "#fff");
  }


  /** A posed stand-in for menus. */
  function dummy(char: FighterId, side: 0 | 1, x: number, y: number, beast = false): Fighter {
    const f = createGame(char, char).fighters[side];
    return { ...f, x, y, facing: side === 0 ? 1 : -1, beastLeft: beast ? 1 : 0 };
  }

  function drawSelect() {
    const l = tr();
    const v = view();
    ctx.fillStyle = "rgba(10,6,14,0.72)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    text(ctx, l.pickFighter, W / 2, top() + 54, 40, "#ffe7a6");
    FIGHTERS.forEach((id, i) => {
      const r = cardRect(i);
      const on = id === pick;
      card(r, on ? "#3a1c14" : "#1a1020", on ? "#ff8a3a" : "#5a4468");
      // The picked fighter flips between human and beast
      const beastNow = on && Math.sin(t * 2) > 0;
      const cell = PORTRAIT_CELL[id][beastNow ? "beast" : "human"];
      // Clipped to the card: the bust sits on the line above the name
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      if (!drawPortrait(cell, r.x + (r.w - PORTRAIT * 2) / 2, r.y + 2))
        drawFighter(ctx, dummy(id, 0, r.x + r.w / 2, r.y + 178, beastNow), t, false);
      ctx.restore();
      const info = l.fighters[id];
      text(ctx, info.name, r.x + r.w / 2, r.y + 210, 24, on ? "#ffd23a" : "#fff");
      text(ctx, `${info.beast} | ${info.style}`, r.x + r.w / 2, r.y + 236, 13, "#dcd2e6", "center", 700);
    });
    text(ctx, l.difficulty, levelRect(0).x - 14, top() + 392, 18, "#dcd2e6", "right", 700);
    l.levels.forEach((name, i) => {
      const r = levelRect(i);
      card(r, i === level ? "#c8501c" : "#1a1020", i === level ? "#ffd23a" : "#5a4468");
      text(ctx, name, r.x + r.w / 2, r.y + r.h / 2 + 1, 18, "#fff");
    });
    button(startRect(), l.start, "#e8501c");
    if (!coarse) text(ctx, l.pickHint, W / 2, bottom() - 14, 13, "#b8acc8", "center", 600);
  }

  function drawVs() {
    const l = tr();
    const s = fight;
    if (!s) return;
    const v = view();
    ctx.fillStyle = "rgba(10,6,14,0.78)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    const k = Math.min(1, screenT * 3);
    const boss = ladder.index === LADDER - 1;
    text(ctx, l.fightOf(ladder.index + 1, LADDER), W / 2, top() + 70, 30, "#ffe7a6");
    if (boss) text(ctx, l.bossTag, W / 2, top() + 108, 22, "#ff5a3a");
    const [a, b] = s.fighters;
    const slide = (1 - k) * 200;
    // Each side's signature special, from the same pixel atlas as the fight, at 3x
    if (!drawPose(a.char, false, POSE.rush, W / 2 - 300 - slide, 410, false, 3))
      drawFighter(ctx, dummy(a.char, 0, W / 2 - 300 - slide, 380), t, false);
    if (!drawPose(b.char, boss, POSE.rush, W / 2 + 300 + slide, 410, true, 3))
      drawFighter(ctx, dummy(b.char, 1, W / 2 + 300 + slide, 380, boss), t, false);
    text(ctx, "VS", W / 2, 300, 90 * (2 - k), "#ff8a3a");
    text(ctx, l.fighters[a.char].name, W / 2 - 300, 430, 28, "#fff");
    text(ctx, l.fighters[b.char].name, W / 2 + 300, 430, 28, "#fff");
  }

  function drawResult() {
    const l = tr();
    const v = view();
    ctx.fillStyle = "rgba(10,6,14,0.75)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    const r = { x: W / 2 - 260, y: H / 2 - 150, w: 520, h: 300 };
    card(r);
    const cleared = resultWon && ladder.index >= LADDER - 1;
    text(ctx, resultWon ? l.victory : l.defeat, W / 2, r.y + 56, 52, resultWon ? "#ffd23a" : "#ff6a5a");
    if (cleared) text(ctx, l.ladderCleared, W / 2, r.y + 100, 20, "#9affb0");
    text(ctx, l.score(ladder.score), W / 2, r.y + 140, 34, "#fff");
    const finished = !resultWon || cleared;
    if (finished) text(ctx, newRecord ? l.newBest : l.best(best), W / 2, r.y + 176, 16, newRecord ? "#9affb0" : "#b8acc8", "center", 700);
    const b = resultButtons();
    button(b.primary, resultWon && !cleared ? l.next : l.retry, "#e8501c");
    button(b.secondary, l.change, "#4a3a5a");
  }

  function drawPause() {
    const v = view();
    ctx.fillStyle = "rgba(10,6,14,0.7)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    text(ctx, tr().paused, W / 2, H / 2 - 40, 48, "#ffe7a6");
    text(ctx, tr().keys, W / 2, H / 2 + 10, 15, "#dcd2e6", "center", 600);
    text(ctx, tr().resume, W / 2, H / 2 + 60, 22, "#fff");
  }

  function draw() {
    stage.begin();
    drawArena();
    // Menus show the painted art over the bare arena; the fight scene only once it starts
    if (fight && (screen === "fight" || screen === "result")) drawFight(fight);
    if (screen === "select") drawSelect();
    if (screen === "vs") drawVs();
    if (screen === "result") drawResult();
    if (paused) drawPause();
    stage.end();
  }

  return {
    update: step,
    render: draw,
    pointer,
    keydown,
    suspend() {
      if (screen === "fight") paused = true;
      stick = null;
      touchHeld.clear();
    },
  };
}
