// The imperative shell of Nói Là Có: thumbs and keys → the rules at the
// engine's fixed step → sounds, particles and animation → the 3D scene and the
// 2D HUD.
//
// The camera sits behind your villager and turns with a swipe on the right of
// the screen (a mouse drag on a computer); the stick on the left runs the way
// the camera looks. Out of the match (before the start, as a ghost, watching)
// it pulls back over the whole bank.
//
// Online (rt.game.online) the room runs the match: this shell sends the stick,
// jump, dash and the typed word at the room's tick rate, draws the room's
// snapshots, and moves only its own villager ahead of them (replaying inputs
// the room has not confirmed yet) so the stick answers at once. It never
// reports a score online.
//
// Two things live in the DOM beside the engine's canvas: the WebGL canvas under
// it (as in Qua Đường) and one <input> over the writing panel, because a canvas
// cannot open a phone's keyboard. Neither adds a window or document listener.
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/800.css";
import { type GameHooks, InputLog, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, approach, clamp, inRect } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import { Color } from "three";
import { DASH_COOLDOWN, GRID, PALETTE, SEATS, SEAT_COLORS, SPEED, WORDS, WORD_MAX, WRITE_TIME, type WordId } from "./config";
import {
  type ActivePill,
  FONT,
  type MapMark,
  STICK_R,
  cssColor,
  drawActive,
  drawArrow,
  drawCenter,
  drawCorner,
  drawDark,
  drawDash,
  drawHearts,
  drawMinimap,
  drawNameTag,
  drawNoWebGL,
  drawNote,
  drawPaused,
  drawReady,
  drawResults,
  drawRoster,
  drawSoloCard,
  drawStick,
  drawTurn,
  drawWord,
  drawWrite,
  writeLayout,
} from "./hud";
import { type GameEvent, type Input, type Snapshot, type State, createGame, fromSnapshot, outcomeOf, parseBest, placeOf, scoreOf, step, suggestions } from "./logic";
import { type Actor, type Particle, type Quality, Scene3D, type View, guessQuality } from "./scene";
import { active, flying, ground, groundAt, living, movePlayer } from "./sim";
import { STRINGS } from "./strings";

const newSeed = () => Math.floor(Math.random() * 2 ** 31);
const HALF = GRID / 2;

const MOVE_KEYS: Record<string, readonly [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

/** Camera: close behind you while you play, far over the bank otherwise. */
const FOLLOW = { pitch: 0.55, dist: 9.5 };
const OVERVIEW = { pitch: 0.95, dist: GRID * 1.25 };
const PITCH_MIN = 0.12;
const PITCH_MAX = 1.25;
/** Radians per logical unit dragged. */
const TURN = 0.0085;

/** Slower than this (seconds per frame, smoothed) for a few seconds drops one quality level. */
const SLOW_FRAME = 1 / 38;

interface Bit extends Particle {
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

/** Where a seat is drawn: eased towards the rules' position. */
interface Shown {
  x: number;
  y: number;
  z: number;
}

const QUALITY_KEY = "quality";
const isQuality = (v: unknown): v is Quality => v === 0 || v === 1 || v === 2;

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx, root, keys } = rt;
  const { storage, audio, reportScore, online } = rt.game;
  const tr = () => STRINGS[rt.locale()];

  // ---------------------------------------------------------- the WebGL layer
  const saved = storage.get<unknown>(QUALITY_KEY, null);
  let scene: Scene3D | null = null;
  try {
    scene = new Scene3D(isQuality(saved) ? saved : guessQuality());
  } catch {
    scene = null;
  }
  const restorePosition = root.style.position;
  if (getComputedStyle(root).position === "static") root.style.position = "relative";
  stage.canvas.style.position = "relative";
  stage.canvas.style.zIndex = "1";
  if (scene) root.insertBefore(scene.canvas, stage.canvas);

  // env(safe-area-inset-*) read through a hidden probe, re-read on every resize
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  root.appendChild(probe);
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const measure = () => {
    const cs = getComputedStyle(probe);
    insets.top = Number.parseFloat(cs.paddingTop) || 0;
    insets.right = Number.parseFloat(cs.paddingRight) || 0;
    insets.bottom = Number.parseFloat(cs.paddingBottom) || 0;
    insets.left = Number.parseFloat(cs.paddingLeft) || 0;
    scene?.resize(root.clientWidth, root.clientHeight, window.devicePixelRatio);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(root);
  measure();

  /** The visible stage area minus the safe-area insets, in logical units. */
  function safeArea(): Rect {
    const v = stage.view;
    const k = root.clientWidth > 0 ? v.w / root.clientWidth : 1;
    return {
      x: v.x + insets.left * k,
      y: v.y + insets.top * k,
      w: v.w - (insets.left + insets.right) * k,
      h: v.h - (insets.top + insets.bottom) * k,
    };
  }

  // ---------------------------------------------------------- the word field (the one DOM input)
  const field = document.createElement("input");
  field.type = "text";
  field.maxLength = WORD_MAX;
  field.autocomplete = "off";
  field.autocapitalize = "off";
  field.spellcheck = false;
  field.enterKeyHint = "send";
  field.style.cssText = `position:absolute;z-index:2;display:none;border:none;outline:none;background:transparent;color:#2b1d14;font-family:${FONT};font-weight:700;padding:0 10px;margin:0;box-sizing:border-box`;
  root.appendChild(field);
  const typing = () => document.activeElement === field;
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit(field.value);
    } else if (e.key === "Escape") field.blur();
  });

  function placeField(r: Rect | null) {
    if (!r) {
      if (field.style.display !== "none") {
        field.blur();
        field.value = "";
        field.style.display = "none";
      }
      return;
    }
    const { view, canvas } = stage;
    const k = canvas.clientWidth / view.w;
    field.placeholder = tr().typeHere;
    field.style.display = "block";
    field.style.left = `${(r.x - view.x) * k}px`;
    field.style.top = `${(r.y - view.y) * k}px`;
    field.style.width = `${r.w * k}px`;
    field.style.height = `${r.h * k}px`;
    field.style.fontSize = `${22 * k}px`;
  }

  // ---------------------------------------------------------- match state
  const me = online ? online.seat : 0;
  let best = parseBest(storage.get<unknown>("best", 0));
  let disposed = false;
  /** Solo: the match itself. Online: the latest snapshot, with my own villager moved ahead. */
  let state: State | null = online ? null : createGame(newSeed(), [{ name: tr().you }]);
  let started = !!online;
  let paused = false;
  let reported = false;
  let newBest = false;
  /** Solo, out but the match goes on: the card was closed to keep writing as a ghost. */
  let stayed = false;
  let usedKeys = false;
  let clock = 0;

  // input: several fingers at once, each by pointer id
  let stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  let look: { id: number; x: number; y: number } | null = null;
  const held = new Map<number, string>();
  let dashQueued = false;
  let jumpQueued = false;
  let wordQueued: string | null = null;
  /** The turn (state.orderI) a word was already sent for, so the panel closes at once. */
  let sentFor = -1;
  let chips: WordId[] = [];
  let chipsFor = -1;
  const pressed = (key: string) => [...held.values()].includes(key);

  // camera
  const view: View = { x: 0, y: 0, z: 0, yaw: 0, pitch: OVERVIEW.pitch, dist: OVERVIEW.dist };
  let yaw = 0;
  let pitch = FOLLOW.pitch;

  // animation
  const shown: Shown[] = [];
  let bits: Bit[] = [];
  let bolts: { x: number; z: number; k: number }[] = [];
  let banner: { word: WordId | "storm"; by: number; auto: boolean; t: number } | null = null;
  let goT = 99;
  let hurtFlash = 0;
  let darkK = 0;
  let tinyK = 0;
  let outT = 0;
  let rects: { again: Rect | null; stay: Rect | null; corner: Rect | null; back: Rect | null } = { again: null, stay: null, corner: null, back: null };

  // the minimap's bank: one pixel per tile, redrawn for a new map or a ground word
  const bank = document.createElement("canvas");
  bank.width = GRID;
  bank.height = GRID;
  let bankKey = "";

  // frame-rate watch: lower the quality when this device cannot keep up
  let lastFrame = 0;
  let frameAvg = 1 / 60;
  let slowFor = 0;

  // online
  const log = new InputLog<Input>();
  const tick = online ? 1 / online.tickRate : 1 / 20;
  let tickAcc = 0;
  let results: SeatResult[] | null = null;
  let endT = 0;

  const mine = () => (state && me >= 0 ? state.players[me] : undefined);
  const following = () => !!mine()?.alive && started && !results;
  const canWrite = () => !!state && started && !paused && state.phase === "play" && state.turn?.writer === me && sentFor !== state.orderI && !results;

  function restart() {
    state = createGame(newSeed(), [{ name: tr().you }]);
    started = true;
    paused = false;
    reported = false;
    newBest = false;
    stayed = false;
    sentFor = -1;
    outT = 0;
    bits = [];
    bolts = [];
    banner = null;
    shown.length = 0;
    audio.tone({ freq: 392, to: 587, dur: 0.16, type: "sine", vol: 0.07 });
  }

  // ---------------------------------------------------------- input → the rules

  /** Keys plus the stick, turned from the camera's view to the bank's directions, length ≤ 1. */
  function moveVector() {
    let x = 0;
    let y = 0;
    if (!typing()) {
      for (const code of keys) {
        const d = MOVE_KEYS[code];
        if (d) {
          x += d[0];
          y += d[1];
        }
      }
    }
    if (stick) {
      x += (stick.x - stick.ox) / STICK_R;
      y += (stick.y - stick.oy) / STICK_R;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    // Screen up is the way the camera looks: -(sin yaw, cos yaw); screen right is (cos yaw, -sin yaw)
    const s = Math.sin(view.yaw);
    const c = Math.cos(view.yaw);
    return { mx: x * c + -y * -s, my: x * -s + -y * -c };
  }

  function takeInput(): Input {
    const holdJump = pressed("jump") || (!typing() && keys.has("Space"));
    const input: Input = { ...moveVector(), dash: dashQueued || (!typing() && (keys.has("ShiftLeft") || keys.has("ShiftRight"))), jump: jumpQueued || holdJump, word: wordQueued };
    dashQueued = false;
    jumpQueued = false;
    wordQueued = null;
    return input;
  }

  function submit(text: string) {
    const clean = text.trim().slice(0, WORD_MAX);
    if (!clean || !canWrite() || !state) return;
    wordQueued = clean;
    sentFor = state.orderI;
    placeField(null);
    audio.tone({ freq: 660, to: 990, dur: 0.1, type: "triangle", vol: 0.06 });
  }

  // ---------------------------------------------------------- effects
  const tint = (c: number) => new Color(c);
  function burst(n: number, x: number, y: number, z: number, colors: readonly number[], speed: number, up: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      bits.push({
        x,
        y,
        z,
        vx: Math.cos(a) * v,
        vy: up * (0.5 + Math.random() * 0.8),
        vz: Math.sin(a) * v,
        size: 0.07 + Math.random() * 0.09,
        life: 0.5 + Math.random() * 0.5,
        color: tint(colors[i % colors.length]),
      });
    }
  }
  const wx = (x: number) => x - HALF;
  const groundY = (x: number, y: number) => (state ? groundAt(state, x, y) : 0);

  function onEvents(events: readonly GameEvent[]) {
    for (const e of events) {
      if (e.type === "go") {
        goT = 0;
        for (const [i, f] of [523, 659, 784, 1047].entries()) audio.tone({ freq: f, dur: 0.1, type: "triangle", vol: 0.05, delay: i * 0.06 });
      } else if (e.type === "writer") {
        if (e.seat === me) for (const [i, f] of [784, 988, 1319].entries()) audio.tone({ freq: f, dur: 0.12, type: "square", vol: 0.05, delay: i * 0.09 });
        else audio.tone({ freq: 620, dur: 0.07, type: "triangle", vol: 0.04 });
      } else if (e.type === "word") {
        banner = { word: e.word, by: e.by, auto: e.auto, t: 0 };
        const kind = WORDS[e.word].kind;
        if (kind === "help") for (const [i, f] of [523, 659, 784].entries()) audio.tone({ freq: f, dur: 0.14, type: "sine", vol: 0.06, delay: i * 0.08 });
        else if (kind === "twist") audio.tone({ freq: 300, to: 620, dur: 0.3, type: "sawtooth", vol: 0.04 });
        else {
          audio.tone({ freq: 196, to: 98, dur: 0.45, type: "sawtooth", vol: 0.07 });
          audio.noise(0.25, 0.05);
        }
      } else if (e.type === "hurt") {
        burst(12, wx(e.x), groundY(e.x, e.y) + 0.8, wx(e.y), [PALETTE.cross, 0xffffff, SEAT_COLORS[e.seat % SEAT_COLORS.length]], 2.2, 2.8);
        if (e.seat === me) {
          hurtFlash = 1;
          audio.noise(0.2, 0.09);
          audio.tone({ freq: 240, to: 70, dur: 0.3, type: "triangle", vol: 0.1 });
        } else audio.tone({ freq: 300, to: 160, dur: 0.12, type: "triangle", vol: 0.04 });
      } else if (e.type === "out") {
        const p = state?.players[e.seat];
        if (p) burst(22, wx(p.x), p.z + 0.8, wx(p.y), [PALETTE.ghost, 0xffffff], 2.4, 3.4);
        audio.tone({ freq: 520, to: 130, dur: 0.5, type: "sine", vol: e.seat === me ? 0.1 : 0.05 });
      } else if (e.type === "heal") {
        const p = state?.players[e.seat];
        if (p) burst(12, wx(p.x), p.z + 1, wx(p.y), [0x4ade80, 0xffffff], 1.4, 2.6);
        audio.tone({ freq: 660, to: 1320, dur: 0.18, type: "sine", vol: 0.06 });
      } else if (e.type === "slip") audio.tone({ freq: 900, to: 300, dur: 0.22, type: "sine", vol: e.seat === me ? 0.07 : 0.03 });
      else if (e.type === "sleep") audio.tone({ freq: 330, to: 220, dur: 0.4, type: "sine", vol: e.seat === me ? 0.07 : 0.03 });
      else if (e.type === "jump") {
        if (e.seat === me) audio.tone({ freq: 330, to: 660, dur: 0.12, type: "sine", vol: 0.05 });
      } else if (e.type === "dash") {
        if (e.seat === me) audio.noise(0.08, 0.05);
      } else if (e.type === "strike") {
        const y = groundY(e.x, e.y);
        if (e.kind === "bolt") {
          bolts.push({ x: wx(e.x), z: wx(e.y), k: 1 });
          burst(10, wx(e.x), y + 0.2, wx(e.y), [PALETTE.bolt, 0xffffff], 2.6, 2.4);
          audio.noise(0.22, 0.08);
          audio.tone({ freq: 1800, to: 200, dur: 0.18, type: "sawtooth", vol: 0.05 });
        } else if (e.kind === "rocket") {
          burst(16, wx(e.x), y + 0.4, wx(e.y), [PALETTE.gold, PALETTE.cross, 0x3b82f6, 0x4ade80, 0xf472b6], 2.8, 3.2);
          audio.noise(0.1, 0.05);
          audio.tone({ freq: 880, to: 1500, dur: 0.1, type: "square", vol: 0.03 });
        } else {
          burst(28, wx(e.x), y + 0.3, wx(e.y), [PALETTE.lava, PALETTE.lavaWarn, PALETTE.bomb], 3.6, 3.6);
          audio.noise(0.35, 0.12);
          audio.tone({ freq: 140, to: 40, dur: 0.4, type: "triangle", vol: 0.12 });
        }
      } else if (e.type === "wave") {
        audio.noise(0.9, 0.1);
        audio.tone({ freq: 120, to: 60, dur: 0.9, type: "sine", vol: 0.08 });
      } else if (e.type === "roar") audio.tone({ freq: 110, to: 70, dur: 0.5, type: "sawtooth", vol: 0.07 });
      else if (e.type === "storm") {
        banner = { word: "storm", by: -1, auto: false, t: 0 };
        audio.noise(0.6, 0.1);
        audio.tone({ freq: 90, to: 45, dur: 0.8, type: "sawtooth", vol: 0.09 });
      }
    }
  }

  /** A solo run is decided (out, or the last one standing): best and the leaderboard, once. */
  function finishRun() {
    if (reported || !state) return;
    reported = true;
    const points = scoreOf(state, me);
    newBest = points > best;
    if (newBest) {
      best = points;
      storage.set("best", best);
    }
    storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(best), en: STRINGS.en.summary(best) });
    reportScore?.({ score: points, detail: tr().detail(placeOf(state, me), state.players[me].survived) });
  }

  // ---------------------------------------------------------- online
  function onSnap(snap: Snapshot, acks: Record<number, number>) {
    state = fromSnapshot(snap);
    const p = mine();
    if (!p) return;
    log.ack(acks[me] ?? 0);
    for (const u of log.unacked) movePlayer(state, p, u.input, tick);
    state.events = [];
  }

  const unsubscribe = online?.onMessage((m) => {
    if (disposed) return;
    if (m.t === "snap" && m.state) onSnap(m.state as Snapshot, m.acks);
    else if (m.t === "ev") onEvents(m.events as GameEvent[]);
    else if (m.t === "end") {
      results = m.results;
      endT = 0;
    }
  });

  /** One input tick online: send what the thumbs are doing and move my own villager at once. */
  function netTick() {
    if (!online || !state || results) return;
    const input = takeInput();
    const p = mine();
    // In the air every tick counts (gravity runs on both sides), so it is sent too
    const acting = Math.hypot(input.mx, input.my) > 0.02 || input.dash || input.jump || input.word !== null || (p ? !p.grounded : false);
    if (acting) {
      const actions: unknown[] = [];
      if (input.dash) actions.push({ type: "dash" });
      if (input.jump) actions.push({ type: "jump" });
      if (input.word !== null) actions.push({ type: "word", text: input.word });
      online.send({ seq: log.push(input), move: { x: input.mx, y: input.my }, actions });
    }
    if (p && state.phase !== "over") {
      movePlayer(state, p, input, tick);
      state.events = [];
    }
  }

  /** Between snapshots the clocks keep running here, so rings blink and bars drain smoothly. */
  function runClocks(s: State, dt: number) {
    if (s.phase === "countdown") s.countdown -= dt;
    if (s.phase !== "play") return;
    s.time += dt;
    if (s.turn) s.turn.left = Math.max(0, s.turn.left - dt);
    else s.gap = Math.max(0, s.gap - dt);
    for (const hz of s.hazards) hz.t = Math.min(hz.dur, hz.t + dt);
  }

  // ---------------------------------------------------------- frame

  function animate(dt: number) {
    clock += dt;
    goT += dt;
    hurtFlash = Math.max(0, hurtFlash - dt * 2.5);
    if (banner) {
      banner.t += dt;
      if (banner.t > 3.2) banner = null;
    }
    if (!state) return;
    darkK = approach(darkK, active(state, "toi") ? 1 : 0, dt, 4);
    tinyK = approach(tinyK, active(state, "ti-hon") ? 1 : 0, dt, 6);
    for (const p of state.players) {
      const at = shown[p.seat];
      if (!at || Math.hypot(at.x - p.x, at.y - p.y) > 4) {
        shown[p.seat] = { x: p.x, y: p.y, z: p.z };
        continue;
      }
      // Offline the rules run every frame; online everyone else is eased towards the room's word
      const rate = online ? (p.seat === me ? 30 : 13) : 60;
      at.x = approach(at.x, p.x, dt, rate);
      at.y = approach(at.y, p.y, dt, rate);
      at.z = approach(at.z, p.z, dt, rate);
    }
    const p = mine();
    if (p && !p.alive) outT += dt;
    for (const b of bolts) b.k -= dt * 5;
    bolts = bolts.filter((b) => b.k > 0);
    for (const b of bits) {
      b.vy -= 9 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.life -= dt;
    }
    bits = bits.filter((b) => b.life > 0 && b.y > -0.4);
    steerCamera(dt);
  }

  function steerCamera(dt: number) {
    // Q and E turn the camera from the keyboard
    if (!typing()) {
      if (keys.has("KeyQ")) yaw += dt * 2.2;
      if (keys.has("KeyE")) yaw -= dt * 2.2;
    }
    if (!started) yaw += dt * 0.12;
    const p = mine();
    const at = p ? shown[p.seat] : undefined;
    const close = following() && at;
    const tx = close ? wx(at.x) : 0;
    const tz = close ? wx(at.y) : 0;
    const ty = close ? at.z + 1.2 : 0;
    const rate = close ? 12 : 3;
    view.x = approach(view.x, tx, dt, rate);
    view.z = approach(view.z, tz, dt, rate);
    view.y = approach(view.y, ty, dt, close ? 8 : 3);
    view.yaw = approach(view.yaw, yaw, dt, 18);
    view.pitch = approach(view.pitch, close ? pitch : Math.max(pitch, OVERVIEW.pitch * 0.85), dt, 6);
    view.dist = approach(view.dist, close ? FOLLOW.dist * (1 - tinyK * 0.35) : OVERVIEW.dist, dt, 3);
  }

  /** Watch the frame time; three slow seconds in a row drop one quality level for good. */
  function watchFrames() {
    const now = performance.now();
    const dt = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
    lastFrame = now;
    if (!scene || !started || paused || dt > 0.25) return;
    frameAvg += (dt - frameAvg) * 0.05;
    slowFor = frameAvg > SLOW_FRAME ? slowFor + dt : 0;
    if (slowFor > 3 && scene.level > 0) {
      const lower = (scene.level - 1) as Quality;
      scene.setQuality(lower);
      storage.set(QUALITY_KEY, lower);
      slowFor = 0;
      frameAvg = 1 / 60;
    }
  }

  function actors(s: State): Actor[] {
    const fly = flying(s);
    return s.players.map((p) => {
      const at = shown[p.seat] ?? { x: p.x, y: p.y, z: p.z };
      const scale = 1 - tinyK * 0.45;
      if (!p.alive) {
        return { seat: p.seat, x: wx(at.x), y: at.z + 0.6 + Math.sin(clock * 2.2 + p.seat) * 0.15, z: wx(at.y), rotY: Math.sin(clock + p.seat) * 0.4, scale: 1, speed: 0, air: false, lie: false, show: true, ghost: true, kite: false };
      }
      const blink = p.inv > 0 && Math.floor(clock * 14) % 2 === 0;
      return {
        seat: p.seat,
        x: wx(at.x),
        y: at.z,
        z: wx(at.y),
        rotY: p.face,
        scale,
        speed: p.stun > 0 ? 0 : clamp(Math.hypot(p.vx, p.vy) / SPEED, 0, 1),
        air: !p.grounded && !fly,
        lie: p.stun > 0,
        show: !blink,
        ghost: false,
        kite: fly,
      };
    });
  }

  // ---------------------------------------------------------- HUD pieces

  const jumpRect = (safe: Rect): Rect => ({ x: safe.x + safe.w - 124, y: safe.y + safe.h - 140, w: 104, h: 104 });
  const dashRect = (safe: Rect): Rect => ({ x: safe.x + safe.w - 206, y: safe.y + safe.h - 96, w: 72, h: 72 });
  const mapRect = (safe: Rect, top: number): Rect => ({ x: safe.x + safe.w - 124, y: top + 40, w: 112, h: 112 });

  function drawThumbs(safe: Rect) {
    const p = mine();
    if (!p?.alive || !started || results) return;
    const home = { x: safe.x + 110, y: safe.y + safe.h - 110 };
    if (stick) {
      const dx = stick.x - stick.ox;
      const dy = stick.y - stick.oy;
      const d = Math.hypot(dx, dy);
      const k = d > STICK_R ? STICK_R / d : 1;
      drawStick(ctx, { x: stick.ox, y: stick.oy }, { x: stick.ox + dx * k, y: stick.oy + dy * k }, true);
    } else if (!usedKeys) drawStick(ctx, home, home, false);
    drawDash(ctx, jumpRect(safe), tr().jump, p.grounded || flying(state as State) ? 1 : 0.6, pressed("jump"), "#22a559");
    drawDash(ctx, dashRect(safe), tr().dash, 1 - p.dashCd / DASH_COOLDOWN, pressed("dash"));
  }

  /** The bank as one pixel per tile, for the minimap. */
  function paintBank(s: State) {
    const word = ground(s);
    const key = `${s.seed0}:${word}`;
    if (key === bankKey) return;
    bankKey = key;
    const g = bank.getContext("2d");
    if (!g) return;
    for (let i = 0; i < GRID * GRID; i++) {
      const level = s.h[i] ?? 1;
      let c: number = level === 0 ? PALETTE.sand : level === 1 ? PALETTE.grassA : level === 2 ? PALETTE.hill : level === 3 ? PALETTE.hilltop : PALETTE.leafDark;
      if (word === "bang" && level < 4) c = PALETTE.ice;
      else if (word === "sa-mac" && level < 4) c = PALETTE.desert;
      else if (word === "dam-lay" && level < 2) c = PALETTE.swamp;
      g.fillStyle = cssColor(c);
      g.fillRect(i % GRID, Math.floor(i / GRID), 1, 1);
    }
  }

  /** Trouble worth an arrow when the camera does not show it: where it is, in rules units. */
  function threats(s: State): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (const hz of s.hazards) {
      if (hz.word === "trau-dien" || hz.word === "loc-xoay" || hz.word === "rong" || hz.word === "ong" || hz.word === "ca-sau" || hz.word === "bom") for (const e of hz.ents) out.push({ x: e.x, y: e.y });
    }
    return out;
  }

  function drawWorldHud(s: State, safe: Rect, top: number) {
    const sc = scene;
    const p = mine();
    // Arrows towards trouble out of shot, near enough to matter
    if (sc && p?.alive && following()) {
      const cx = safe.x + safe.w / 2;
      const cy = safe.y + safe.h * 0.48;
      const sn = Math.sin(view.yaw);
      const cs = Math.cos(view.yaw);
      for (const t of threats(s)) {
        const dx = t.x - p.x;
        const dy = t.y - p.y;
        if (Math.hypot(dx, dy) > 10) continue;
        const at = sc.project(wx(t.x), groundAt(s, t.x, t.y) + 0.5, wx(t.y));
        if (at && at.x > 0.04 && at.x < 0.96 && at.y > 0.12 && at.y < 0.88) continue;
        const right = dx * cs - dy * sn;
        const ahead = -dx * sn - dy * cs;
        const a = Math.atan2(-ahead, right);
        drawArrow(ctx, cx + Math.cos(a) * safe.w * 0.4, cy + Math.sin(a) * safe.h * 0.3, a, clock);
      }
    }
    // The minimap
    paintBank(s);
    const marks: MapMark[] = [];
    for (const hz of s.hazards) {
      for (const e of hz.ents) {
        if (hz.word === "thuoc") marks.push({ x: e.x / GRID, y: e.y / GRID, color: "#4ade80", size: 3 });
        else if (hz.word === "bom" || hz.word === "sam-set" || hz.word === "phao-hoa") marks.push({ x: e.x / GRID, y: e.y / GRID, color: "#e5322b", size: 4, ring: true });
        else if (hz.word !== "vo-chuoi" && hz.word !== "dau" && hz.word !== "dong-rom") marks.push({ x: e.x / GRID, y: e.y / GRID, color: "#e5322b", size: 3.5 });
      }
    }
    for (const q of s.players) {
      if (!q.alive) continue;
      marks.push({ x: q.x / GRID, y: q.y / GRID, color: cssColor(SEAT_COLORS[q.seat % SEAT_COLORS.length]), size: q.seat === me ? 5 : 3.5 });
    }
    const r = mapRect(safe, top);
    drawMinimap(ctx, r, bank, marks, following() && p ? { x: p.x / GRID, y: p.y / GRID, yaw: view.yaw } : null);
    if (p) drawHearts(ctx, r.x - 2, r.y + r.h + 22, p.hearts);
  }

  function pills(s: State): ActivePill[] {
    const out: ActivePill[] = s.hazards.map((hz) => ({ name: WORDS[hz.word].name[rt.locale()], left: 1 - hz.t / hz.dur, kind: WORDS[hz.word].kind }));
    if (s.storm) out.push({ name: tr().storm, left: 1, kind: "harm" });
    return out;
  }

  function drawPlay(s: State, view_: Rect, safe: Rect, cast: readonly Actor[]) {
    const l = tr();
    const locale = rt.locale();
    // Names over heads: not your own while you play, not too far away
    for (const a of cast) {
      if (!scene || (a.seat === me && following())) continue;
      if (Math.hypot(a.x - view.x, a.z - view.z) > 22) continue;
      const at = scene.project(a.x, a.y + 1.75 * a.scale + (a.kite ? 1.2 : 0), a.z);
      if (at) drawNameTag(ctx, view_.x + at.x * view_.w, view_.y + at.y * view_.h, a.seat === me ? l.you : s.players[a.seat].name, a.seat === me, s.players[a.seat].asleep ? " zZ" : "");
    }
    const p = mine();
    if (p?.alive && darkK > 0.02 && scene) {
      const a = cast[me];
      const at = scene.project(a.x, a.y + 0.7, a.z);
      if (at) drawDark(ctx, view_, view_.x + at.x * view_.w, view_.y + at.y * view_.h, darkK);
    }
    if (hurtFlash > 0) {
      ctx.fillStyle = `rgba(229,50,43,${hurtFlash * 0.35})`;
      ctx.fillRect(view_.x, view_.y, view_.w, view_.h);
    }

    const bottom = drawRoster(
      ctx,
      safe,
      s.players.map((x) => ({ color: SEAT_COLORS[x.seat % SEAT_COLORS.length], hearts: x.hearts, alive: x.alive, me: x.seat === me, writer: s.turn?.writer === x.seat })),
    );
    if (s.phase === "play" && !results) {
      const writer = s.turn ? s.players[s.turn.writer] : null;
      const text = !s.turn ? l.nextWriter(Math.max(1, Math.ceil(s.gap))) : writer?.seat === me ? l.yourTurn(Math.ceil(s.turn.left)) : l.writing(writer?.name ?? "", Math.ceil(s.turn.left));
      drawTurn(ctx, safe, bottom + 24, text, writer?.seat === me);
    }
    drawActive(ctx, safe, bottom + 48, pills(s));
    drawWorldHud(s, safe, bottom);

    if (banner) {
      const k = banner.t / 3.2;
      const y = safe.y + safe.h * 0.3;
      if (banner.word === "storm") drawWord(ctx, safe, y, l.storm, l.stormTip, "", k, "harm");
      else {
        const who = banner.by === me ? l.you : (s.players[banner.by]?.name ?? "");
        drawWord(ctx, safe, y, WORDS[banner.word].name[locale], l.tip[banner.word], banner.auto ? l.drawnFor(who) : l.wroteBy(who), k, WORDS[banner.word].kind);
      }
    }
    if (s.phase === "countdown") drawCenter(ctx, safe, String(Math.max(1, Math.ceil(s.countdown))));
    else if (goT < 0.8) drawCenter(ctx, safe, l.go, 1 - goT / 0.8);

    drawThumbs(safe);
    if (canWrite() && s.turn) {
      if (chipsFor !== s.orderI) {
        chipsFor = s.orderI;
        chips = suggestions(s.seed0 + s.orderI * 7919 + me);
      }
      const layout = writeLayout(safe);
      const chip = [0, 1, 2, 3].find((i) => pressed(`chip${i}`));
      drawWrite(
        ctx,
        layout,
        l,
        chips.map((w) => WORDS[w].name[locale]),
        chip ?? (pressed("send") ? 4 : -1),
        s.turn.left / WRITE_TIME,
        usedKeys,
      );
      placeField(layout.field);
    } else placeField(null);
  }

  function drawCards(s: State, view_: Rect, safe: Rect) {
    const l = tr();
    rects = { again: null, stay: null, corner: null, back: null };
    if (online) {
      if (!results) {
        if (me < 0) drawNote(ctx, safe, l.watching);
        return;
      }
      const mineResult = results.find((r) => r.seat === me);
      const title = mineResult?.outcome === "win" ? l.win : mineResult?.outcome === "draw" ? l.draw : l.matchOver;
      const rows = [...results].sort((a, b) => b.score - a.score).map((r) => ({ name: r.seat === me ? l.you : r.name, score: r.score, me: r.seat === me, color: SEAT_COLORS[r.seat % SEAT_COLORS.length] }));
      rects.back = drawResults(ctx, view_, safe, l, title, rows, clamp(endT / 0.3, 0, 1), pressed("back"));
      return;
    }
    const p = s.players[me];
    const over = s.phase === "over";
    if (!over && (p.alive || outT < 0.9)) return;
    if (!over && stayed) {
      rects.corner = drawCorner(ctx, safe, l.again, pressed("corner"));
      return;
    }
    const k = over ? clamp((s.overT - 0.6) / 0.3, 0, 1) : clamp((outT - 0.9) / 0.3, 0, 1);
    if (k <= 0) return;
    const outcome = outcomeOf(s, me);
    const title = !over ? l.outTitle : outcome === "win" ? l.win : outcome === "draw" ? l.draw : l.lose;
    const card = { title, place: l.place(placeOf(s, me), SEATS), points: scoreOf(s, me), best, newBest, canStay: !over && living(s).length > 1 };
    const r = drawSoloCard(ctx, view_, safe, l, card, k, pressed("again") ? "again" : pressed("stay") ? "stay" : null);
    rects.again = r.again;
    rects.stay = r.stay;
  }

  // ---------------------------------------------------------- pointer

  /** Which button a point is on, if any. */
  function hit(p: PointerInfo): string | null {
    for (const [key, r] of Object.entries(rects)) if (r && inRect(p, r)) return key;
    const safe = safeArea();
    if (canWrite()) {
      const layout = writeLayout(safe);
      const i = layout.chips.findIndex((r, n) => chips[n] && inRect(p, r));
      if (i >= 0) return `chip${i}`;
      if (inRect(p, layout.send)) return "send";
      if (inRect(p, layout.panel)) return "panel";
    }
    if (mine()?.alive && started && !results) {
      if (inRect(p, jumpRect(safe))) return "jump";
      if (inRect(p, dashRect(safe))) return "dash";
    }
    return null;
  }

  function press(key: string) {
    if (key === "again" || key === "corner") restart();
    else if (key === "stay") stayed = true;
    else if (key === "back") online?.backToLobby();
    else if (key === "send") submit(field.value);
    else if (key.startsWith("chip")) {
      const word = chips[Number(key.slice(4))];
      if (word) submit(WORDS[word].name[rt.locale()]);
    }
  }

  return {
    update(dt) {
      if (online) {
        if (results) endT += dt;
        if (state) runClocks(state, dt);
        tickAcc += dt;
        while (tickAcc >= tick) {
          tickAcc -= tick;
          netTick();
        }
        animate(dt);
        return;
      }
      if (!state) return;
      if (!started || paused) {
        animate(0);
        clock += dt;
        steerCamera(dt);
        return;
      }
      onEvents(step(state, [takeInput()], dt));
      const p = state.players[me];
      if (!p.alive || state.phase === "over") finishRun();
      animate(dt);
    },

    render() {
      watchFrames();
      const s = state;
      const cast = s ? actors(s) : [];
      if (s) {
        const writer = s.turn ? cast[s.turn.writer] : null;
        scene?.render(s, { clock, dark: darkK * 0.55, view, actors: cast, writer: writer ? { x: writer.x, y: writer.y, z: writer.z } : null, particles: bits, bolts });
      }
      stage.begin();
      const v = stage.view;
      const safe = safeArea();
      const l = tr();
      if (!scene) drawNoWebGL(ctx, v, safe, l.noWebGL);
      if (!s) drawNote(ctx, safe, l.connecting);
      else if (!started) {
        drawReady(ctx, safe, l, clock, best, usedKeys);
        placeField(null);
      } else {
        drawPlay(s, v, safe, cast);
        drawCards(s, v, safe);
      }
      if (paused) drawPaused(ctx, v, safe, l);
      stage.end();
    },

    pointer: {
      down(p) {
        if ((!online && !started) || paused) return;
        const key = hit(p);
        if (key) {
          held.set(p.id, key);
          if (key === "jump") jumpQueued = true;
          else if (key === "dash") dashQueued = true;
          return;
        }
        const safe = safeArea();
        // The left half of a phone is the stick; anything else turns the camera
        if (!stick && mine()?.alive && following() && !usedKeys && p.x < safe.x + safe.w / 2) stick = { id: p.id, ox: p.x, oy: p.y, x: p.x, y: p.y };
        else if (!look) look = { id: p.id, x: p.x, y: p.y };
      },
      move(p) {
        if (stick && p.id === stick.id) {
          stick.x = p.x;
          stick.y = p.y;
        } else if (look && p.id === look.id) {
          yaw -= (p.x - look.x) * TURN;
          pitch = clamp(pitch + (p.y - look.y) * TURN * 0.6, PITCH_MIN, PITCH_MAX);
          look.x = p.x;
          look.y = p.y;
        }
      },
      up(p) {
        if (stick && p.id === stick.id) {
          stick = null;
          return;
        }
        if (look && p.id === look.id) {
          look = null;
          return;
        }
        if (!online && !started) {
          started = true;
          yaw = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;
          audio.tone({ freq: 392, to: 587, dur: 0.16, type: "sine", vol: 0.07 });
          return;
        }
        if (paused) {
          paused = false;
          return;
        }
        const was = held.get(p.id);
        held.delete(p.id);
        if (was && was !== "jump" && was !== "dash" && was !== "panel" && hit(p) === was) press(was);
      },
    },

    keydown(e) {
      if (typing()) return;
      if (e.code in MOVE_KEYS || e.code === "KeyQ" || e.code === "KeyE") {
        usedKeys = true;
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        usedKeys = true;
        if (!online && !started) started = true;
        else if (paused) paused = false;
        else if (rects.back) online?.backToLobby();
        else if (rects.again && e.code === "Enter") restart();
        else if (e.code === "Enter" && canWrite()) field.focus();
        else if (e.code === "Space") jumpQueued = true;
        return;
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        dashQueued = true;
        return;
      }
      const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
      if (n >= 0 && canWrite() && chips[n]) submit(WORDS[chips[n]].name[rt.locale()]);
    },

    suspend() {
      // An online match goes on without you: nothing to pause there
      if (!online && started && state?.phase !== "over") paused = true;
      stick = null;
      look = null;
      held.clear();
      field.blur();
    },

    dispose() {
      disposed = true;
      unsubscribe?.();
      observer.disconnect();
      probe.remove();
      field.remove();
      scene?.dispose();
      scene = null;
      stage.canvas.style.position = "";
      stage.canvas.style.zIndex = "";
      root.style.position = restorePosition;
    },
  };
}
