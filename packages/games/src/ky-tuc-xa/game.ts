import "@fontsource/baloo-2/800.css";
import {
  type GameHooks,
  type PointerInfo,
  type Runtime,
  type StageHandlers,
  SUMMARY_KEY,
  inRect,
} from "../core";
import {
  PALETTES,
  bolt,
  coin,
  drawBar,
  drawBed,
  drawBuilding,
  drawDoor,
  drawHunter,
  drawPerson,
  drawSleeper,
  glow,
  makeMap,
  paragraph,
  text,
} from "./art";
import {
  BED_INCOME,
  BUILDS,
  type BuildKind,
  DOOR_HP,
  H,
  RANGE_UNIT,
  ROOM_COUNT,
  TURRET_DAMAGE,
  TURRET_RANGE,
  W,
  WATCHTOWER_RANGE,
  WORLD_H,
  WORLD_W,
} from "./config";
import {
  type Action,
  type GameEvent,
  type GameState,
  type Pt,
  bedNear,
  bedTile,
  bedUpgradeCost,
  canBuild,
  count,
  createGame,
  doorPos,
  doorUpgradeCost,
  enraged,
  maxDoorHp,
  player,
  roomAt,
  roomRect,
  tileAt,
  tileCenter,
  tilesByDoor,
  turretRange,
  turretUpgradeCost,
  update,
} from "./logic";
import { STRINGS } from "./strings";

type Panel =
  | { kind: "build"; tile: number; tab: "basic" | "workshop" }
  | { kind: "turret"; tile: number }
  | { kind: "info"; tile: number }
  | { kind: "bed" }
  | { kind: "door" };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Float {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
}

interface Beam {
  from: Pt;
  to: Pt;
  t: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

/** A finger on the screen: a floating joystick while awake, a pan-or-tap once in bed. */
interface Gesture {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
  mode: "stick" | "look";
  moved: boolean;
}

const KINDS: BuildKind[] = [
  "turret",
  "arcade",
  "station",
  "watchtower",
  "accelerator",
];
const STICK_R = 56;
/** Safe zone: the HUD owns this much of the top of the screen, the buttons this much of the bottom. */
const HUD_TOP = 168;
const HUD_BOTTOM = 92;
const LOOK_RETURN = 2.5;
const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

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

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx, keys } = rt;
  const { storage, audio, reportScore } = rt.game;
  // Resolved per frame: the player can switch language mid-run
  const tr = () => STRINGS[rt.locale()];
  const map = makeMap();
  const coarse =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  let state: GameState = createGame();
  let noticeOpen = true;
  let paused = false;
  let panel: Panel | null = null;
  let t = 0;
  let floats: Float[] = [];
  let beams: Beam[] = [];
  let sparks: Spark[] = [];
  let banner: { text: () => string; t: number; color: string } | null = null;
  let doorShake = new Array(ROOM_COUNT).fill(0);
  let shake = 0;
  let best = storage.get("best", 0);
  let saved = false;
  let lastShotSound = 0;
  let lastHitSound = 0;
  let lastCoinSound = 0;
  let pending: Action[] = [];
  let wasEnraged = false;
  let noticeBottom = 0;

  // Camera: `cam` is the world point at stage (0,0); `look` pans away from the focus while in bed
  const cam = { x: 0, y: 0 };
  const look = { x: 0, y: 0 };
  let lookIdle = 0;
  let gesture: Gesture | null = null;

  const view = () => stage.view;
  const top = () => view().y;
  const bottom = () => view().y + view().h;
  const left = () => Math.max(view().x, 0);
  const right = () => Math.min(view().x + view().w, W);
  const toWorld = (p: Pt): Pt => ({ x: p.x + cam.x, y: p.y + cam.y });

  function restart() {
    state = createGame();
    paused = false;
    panel = null;
    floats = [];
    beams = [];
    sparks = [];
    banner = null;
    doorShake = new Array(ROOM_COUNT).fill(0);
    saved = false;
    pending = [];
    gesture = null;
    look.x = 0;
    look.y = 0;
    snapCamera();
  }

  // ---------------------------------------------------------- camera

  function focus(): Pt {
    const room = myRoom();
    if (room) {
      const r = roomRect(room.index);
      return { x: r.x + r.w / 2 + look.x, y: r.y + r.h / 2 + look.y };
    }
    const me = player(state);
    return { x: me.x, y: me.y };
  }

  /** The part of the screen the dorm may use: below the HUD band, above the buttons (or an open sheet). */
  function safeArea(): Rect {
    const v = view();
    const y0 = v.y + HUD_TOP;
    let y1 = v.y + v.h - HUD_BOTTOM;
    if (panel) y1 = Math.min(y1, sheet().y - 8);
    return { x: v.x, y: y0, w: v.w, h: Math.max(120, y1 - y0) };
  }

  /** Centre the focus in the safe area; the dorm's edges may reach the safe area's edges but not past them. */
  function cameraTarget(): Pt {
    const a = safeArea();
    const f = focus();
    const axis = (want: number, start: number, size: number, world: number) => {
      if (world <= size) return (world - size) / 2 - start;
      return Math.max(
        -start,
        Math.min(world - start - size, want - (start + size / 2)),
      );
    };
    return { x: axis(f.x, a.x, a.w, WORLD_W), y: axis(f.y, a.y, a.h, WORLD_H) };
  }

  function snapCamera() {
    const c = cameraTarget();
    cam.x = c.x;
    cam.y = c.y;
  }

  // ---------------------------------------------------------- layout (stage coordinates)

  const pauseBtn = () => ({ x: right() - 36, y: top() + 34, r: 22 });
  const repairBtn = (): Rect => ({
    x: right() - 118,
    y: Math.min(bottom(), H + 60) - 70,
    w: 104,
    h: 52,
  });
  const sleepBtn = (): Rect => ({
    x: W / 2 - 80,
    y: Math.min(bottom(), H + 60) - 150,
    w: 160,
    h: 60,
  });
  const sheet = (): Rect => {
    const h = 400;
    return {
      x: left() + 12,
      y: Math.min(bottom(), H + 40) - h - 10,
      w: right() - left() - 24,
      h,
    };
  };
  const sheetRow = (i: number): Rect => {
    const s = sheet();
    return { x: s.x + 12, y: s.y + 108 + i * 76, w: s.w - 24, h: 68 };
  };
  const rowButton = (r: Rect): Rect => ({
    x: r.x + r.w - 116,
    y: r.y + 12,
    w: 106,
    h: 44,
  });
  const tabRect = (i: number): Rect => {
    const s = sheet();
    return { x: s.x + 16 + i * 116, y: s.y + 58, w: 108, h: 36 };
  };
  const closeRect = (): Rect => {
    const s = sheet();
    return { x: s.x + s.w - 52, y: s.y + 10, w: 42, h: 42 };
  };
  const bigButton = (): Rect => {
    const s = sheet();
    return { x: s.x + s.w / 2 - 120, y: s.y + 230, w: 240, h: 58 };
  };
  const overlayButtons = () => {
    const cy = top() + view().h / 2;
    return {
      primary: { x: W / 2 - 120, y: cy + 60, w: 240, h: 56 },
      secondary: { x: W / 2 - 120, y: cy + 128, w: 240, h: 48 },
    };
  };
  const noticeOk = (): Rect => ({
    x: W / 2 - 110,
    y: noticeBottom + 20,
    w: 220,
    h: 56,
  });
  const stickHome = () => ({
    x: left() + 100,
    y: Math.min(bottom(), H + 60) - 130,
  });

  const myRoom = () =>
    state.playerRoom === null ? null : state.rooms[state.playerRoom];
  const canSleepHere = () => {
    if (state.phase !== "setup") return null;
    const near = bedNear(state);
    return near === null
      ? null
      : { room: near, free: state.rooms[near].owner === null };
  };

  function doorRect(room: number): Rect {
    const d = doorPos(room);
    return { x: d.x - 24, y: d.y - 26, w: 48, h: 52 };
  }

  // ---------------------------------------------------------- input

  /** Taps on overlays and HUD buttons; returns true if the tap was used. */
  function tapUi(p: Pt): boolean {
    if (noticeOpen) {
      if (inRect(p, noticeOk())) {
        noticeOpen = false;
        audio.tone({ freq: 660, dur: 0.1, type: "triangle", vol: 0.1 });
      }
      return true;
    }
    if (state.phase === "over") {
      if (inRect(p, overlayButtons().primary)) restart();
      return true;
    }
    if (paused) {
      if (inRect(p, overlayButtons().primary)) paused = false;
      else if (inRect(p, overlayButtons().secondary)) restart();
      return true;
    }
    const pb = pauseBtn();
    if ((p.x - pb.x) ** 2 + (p.y - pb.y) ** 2 <= (pb.r + 10) ** 2) {
      paused = true;
      panel = null;
      return true;
    }
    if (panel) {
      tapPanel(p);
      return true;
    }
    const near = canSleepHere();
    if (near?.free && inRect(p, sleepBtn())) {
      pending.push({ type: "sleep" });
      return true;
    }
    const room = myRoom();
    if (room && !room.dark && inRect(p, repairBtn())) {
      pending.push({ type: "repair" });
      return true;
    }
    return false;
  }

  /** A tap on the dorm itself, once in bed: your tiles, bed and door. */
  function tapWorld(stagePoint: Pt) {
    const room = myRoom();
    if (!room || room.dark) return;
    const p = toWorld(stagePoint);
    if (inRect(p, doorRect(room.index))) {
      panel = { kind: "door" };
      return;
    }
    if (roomAt(p.x, p.y) !== room.index) return;
    const tile = tileAt(room.index, p.x, p.y);
    if (tile === null) return;
    if (tile === bedTile(room.index)) panel = { kind: "bed" };
    else {
      const b = room.tiles[tile];
      panel = !b
        ? { kind: "build", tile, tab: "basic" }
        : b.kind === "turret"
          ? { kind: "turret", tile }
          : { kind: "info", tile };
    }
    audio.tone({ freq: 760, dur: 0.04, type: "triangle", vol: 0.05 });
  }

  function tapPanel(p: Pt) {
    const room = myRoom();
    if (!panel || !room) return;
    if (!inRect(p, sheet()) || inRect(p, closeRect())) {
      panel = null;
      return;
    }
    if (panel.kind === "build") {
      for (const [i, tab] of (["basic", "workshop"] as const).entries()) {
        if (inRect(p, tabRect(i))) {
          panel = { ...panel, tab };
          return;
        }
      }
      const tab = panel.tab;
      const kinds = KINDS.filter((k) => BUILDS[k].tab === tab);
      for (const [i, kind] of kinds.entries()) {
        if (inRect(p, rowButton(sheetRow(i))) && canBuild(room, kind)) {
          pending.push({ type: "build", tile: panel.tile, kind });
          panel = null;
          return;
        }
      }
      return;
    }
    if (!inRect(p, bigButton())) return;
    if (panel.kind === "turret")
      pending.push({ type: "upgradeTurret", tile: panel.tile });
    else if (panel.kind === "bed") pending.push({ type: "upgradeBed" });
    else if (panel.kind === "door") pending.push({ type: "upgradeDoor" });
  }

  const pointer: StageHandlers = {
    down(p: PointerInfo) {
      if (tapUi(p)) return;
      if (gesture) return;
      const awake = !player(state).asleep && state.phase === "setup";
      gesture = {
        id: p.id,
        ox: p.x,
        oy: p.y,
        x: p.x,
        y: p.y,
        mode: awake ? "stick" : "look",
        moved: false,
      };
    },
    move(p: PointerInfo) {
      if (!gesture || p.id !== gesture.id) return;
      if (gesture.mode === "look") {
        const dx = p.x - gesture.x;
        const dy = p.y - gesture.y;
        if (
          gesture.moved ||
          Math.hypot(p.x - gesture.ox, p.y - gesture.oy) > 10
        ) {
          gesture.moved = true;
          look.x -= dx;
          look.y -= dy;
          lookIdle = 0;
        }
      } else if (Math.hypot(p.x - gesture.ox, p.y - gesture.oy) > 6)
        gesture.moved = true;
      gesture.x = p.x;
      gesture.y = p.y;
    },
    up(p: PointerInfo) {
      if (!gesture || p.id !== gesture.id) return;
      const g = gesture;
      gesture = null;
      if (g.mode === "look" && !g.moved) tapWorld({ x: g.x, y: g.y });
    },
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code in MOVE_KEYS || e.code === "Space") e.preventDefault();
    if (e.repeat) return;
    if (e.code === "Escape") {
      if (panel) panel = null;
      else if (!noticeOpen && state.phase !== "over") paused = !paused;
    }
    if (e.code === "Space" || e.code === "KeyE" || e.code === "Enter") {
      if (noticeOpen) noticeOpen = false;
      else if (state.phase === "over" && e.code === "Enter") restart();
      else pending.push({ type: "sleep" });
    }
    if (e.code === "KeyR") pending.push({ type: "repair" });
  };

  /** Keys plus the stick, as one vector with length ≤ 1. */
  function moveVector(): Pt {
    let x = 0;
    let y = 0;
    for (const code of keys) {
      const d = MOVE_KEYS[code];
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    if (gesture?.mode === "stick") {
      x += (gesture.x - gesture.ox) / STICK_R;
      y += (gesture.y - gesture.oy) / STICK_R;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  // ---------------------------------------------------------- events

  function float(str: string, x: number, y: number, color = "#ffe27a") {
    floats.push({ text: str, x, y, t: 0, color });
  }

  function burst(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 120;
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.5 + Math.random() * 0.3,
        color,
      });
    }
  }

  function handle(e: GameEvent) {
    const mine = (room: number) => room === state.playerRoom;
    switch (e.type) {
      case "tick":
        if (e.n <= 5 && e.n > 0)
          audio.tone({ freq: 880, dur: 0.08, type: "square", vol: 0.06 });
        else if (e.n > 0)
          audio.tone({ freq: 440, dur: 0.04, type: "square", vol: 0.025 });
        break;
      case "asleep":
        if (e.player) {
          const c = tileCenter(e.room, bedTile(e.room));
          float("Zzz", c.x, c.y - 24, "#cfe0ff");
          gesture = null;
          for (const [i, f] of [523, 659, 784].entries())
            audio.tone({
              freq: f,
              dur: 0.12,
              type: "sine",
              vol: 0.08,
              delay: i * 0.06,
            });
        }
        break;
      case "roomTaken": {
        const me = player(state);
        float(tr().roomTaken, me.x, me.y - 30, "#ff8a8a");
        audio.tone({ freq: 220, dur: 0.18, type: "square", vol: 0.07 });
        break;
      }
      case "night":
        banner = { text: () => tr().nightBanner, t: 0, color: "#ff5a5a" };
        shake = 0.4;
        audio.tone({ freq: 90, to: 50, dur: 1.4, type: "sawtooth", vol: 0.12 });
        break;
      case "caught":
        shake = 0.8;
        break;
      case "income":
        if (mine(e.room)) {
          const c = tileCenter(e.room, bedTile(e.room));
          float(`+${e.amount}`, c.x + 10, c.y - 18);
          if (t - lastCoinSound > 0.9) {
            audio.tone({
              freq: 1320,
              to: 1760,
              dur: 0.05,
              type: "sine",
              vol: 0.03,
            });
            lastCoinSound = t;
          }
        }
        break;
      case "built":
      case "upgraded":
        if (mine(e.room)) {
          const c =
            e.type === "built" || e.tile !== undefined
              ? tileCenter(e.room, e.tile ?? 0)
              : e.what === "door"
                ? doorPos(e.room)
                : tileCenter(e.room, bedTile(e.room));
          burst(c.x, c.y, 12, "#9affc0");
          for (const [i, f] of [660, 880].entries())
            audio.tone({
              freq: f,
              dur: 0.08,
              type: "triangle",
              vol: 0.08,
              delay: i * 0.05,
            });
        }
        break;
      case "repaired":
        if (mine(e.room)) {
          const d = doorPos(e.room);
          burst(d.x, d.y, 14, "#7affa0");
          audio.tone({
            freq: 500,
            to: 900,
            dur: 0.2,
            type: "triangle",
            vol: 0.08,
          });
        }
        break;
      case "shot":
        beams.push({ from: e.from, to: e.to, t: 0 });
        if (t - lastShotSound > 0.12) {
          audio.tone({
            freq: 1500,
            to: 700,
            dur: 0.05,
            type: "square",
            vol: 0.02,
          });
          lastShotSound = t;
        }
        break;
      case "doorHit":
        doorShake[e.room] = 0.2;
        if (mine(e.room)) {
          shake = Math.max(shake, 0.15);
          audio.tone({
            freq: 120,
            to: 70,
            dur: 0.12,
            type: "sawtooth",
            vol: 0.1,
          });
        } else if (t - lastHitSound > 0.5) {
          audio.tone({ freq: 100, dur: 0.06, type: "sawtooth", vol: 0.03 });
          lastHitSound = t;
        }
        break;
      case "doorBroken": {
        const d = doorPos(e.room);
        burst(d.x, d.y, 26, "#c8b8a8");
        shake = e.player ? 1 : 0.35;
        audio.noise(0.4, 0.16);
        audio.tone({
          freq: 160,
          to: 40,
          dur: 0.5,
          type: "sawtooth",
          vol: 0.12,
        });
        break;
      }
      case "levelUp":
        if (state.hunter)
          float(
            tr().level(e.level),
            state.hunter.x,
            state.hunter.y - 56,
            "#ff8a8a",
          );
        audio.tone({
          freq: 70,
          to: 140,
          dur: 0.6,
          type: "sawtooth",
          vol: 0.08,
        });
        break;
      case "retreat":
        banner = { text: () => tr().retreat, t: 0, color: "#cfe0ff" };
        break;
      case "hunterDown":
        if (state.hunter) burst(state.hunter.x, state.hunter.y, 40, "#ffffff");
        shake = 0.8;
        audio.noise(0.8, 0.18);
        break;
      case "end":
        reportScore?.({
          score: state.score,
          detail: tr().detail(
            e.won,
            fmtTime(state.nightTime),
            state.hunter?.level ?? 1,
          ),
        });
        if (e.won)
          for (const [i, f] of [523, 659, 784, 1046].entries())
            audio.tone({
              freq: f,
              dur: 0.2,
              type: "triangle",
              vol: 0.12,
              delay: i * 0.12,
            });
        else
          for (const [i, f] of [392, 330, 262].entries())
            audio.tone({
              freq: f,
              dur: 0.28,
              type: "triangle",
              vol: 0.12,
              delay: i * 0.2,
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
    storage.set(SUMMARY_KEY, {
      vi: `Kỷ lục ${best} điểm`,
      en: `Best ${best} pts`,
    });
  }

  // ---------------------------------------------------------- frame

  function step(dt: number) {
    t += dt;
    if (!noticeOpen && !paused) {
      const move = moveVector();
      const asleep = player(state).asleep;
      update(state, dt, pending, asleep ? { x: 0, y: 0 } : move);
      pending = [];
      for (const e of state.events) handle(e);
      state.events.length = 0;
      if (state.phase === "over") saveResult();

      // In bed, keys pan the view; it drifts home after a moment of no input
      if (asleep) {
        const keyPan = gesture ? { x: 0, y: 0 } : move;
        look.x += keyPan.x * 460 * dt;
        look.y += keyPan.y * 460 * dt;
        const active =
          Math.hypot(keyPan.x, keyPan.y) > 0.05 ||
          (gesture?.mode === "look" && gesture.moved);
        lookIdle = active ? 0 : lookIdle + dt;
        if (lookIdle > LOOK_RETURN || panel) {
          look.x *= 1 - Math.min(1, dt * 4);
          look.y *= 1 - Math.min(1, dt * 4);
        }
        look.x = Math.max(-WORLD_W, Math.min(WORLD_W, look.x));
        look.y = Math.max(-WORLD_H, Math.min(WORLD_H, look.y));
      }

      const h = state.hunter;
      if (h && enraged(h) && !wasEnraged) {
        banner = { text: () => tr().enraged, t: 0, color: "#ff4a4a" };
        audio.tone({
          freq: 60,
          to: 180,
          dur: 0.8,
          type: "sawtooth",
          vol: 0.12,
        });
      }
      wasEnraged = h ? enraged(h) : false;
      for (const f of floats) {
        f.t += dt;
        f.y -= 26 * dt;
      }
      floats = floats.filter((f) => f.t < 1.1);
      for (const b of beams) b.t += dt;
      beams = beams.filter((b) => b.t < 0.14);
      for (const s of sparks) {
        s.life -= dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.9;
        s.vy *= 0.9;
      }
      sparks = sparks.filter((s) => s.life > 0);
      doorShake = doorShake.map((v) => Math.max(0, v - dt));
      shake = Math.max(0, shake - dt);
      if (banner) {
        banner.t += dt;
        if (banner.t > 2.6) banner = null;
      }
      const room = myRoom();
      if (panel && (!room || room.dark || state.phase === "over")) panel = null;
    }
    // Ease the camera toward its target (snappy while running, softer in bed)
    const target = cameraTarget();
    const k = Math.min(1, dt * (player(state).asleep ? 6 : 10));
    cam.x += (target.x - cam.x) * k;
    cam.y += (target.y - cam.y) * k;
  }

  function draw() {
    const v = view();
    stage.begin();
    ctx.fillStyle = "#151214";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    if (shake > 0)
      ctx.translate(
        (Math.random() - 0.5) * shake * 12,
        (Math.random() - 0.5) * shake * 12,
      );
    ctx.drawImage(map, 0, 0, WORLD_W, WORLD_H);
    drawRooms();
    drawPeople();
    drawHunterLayer();
    drawEffects();
    drawSleepPrompt();
    ctx.restore();

    drawHunterPointer();
    drawSafeBands();
    drawHud();
    drawStick();
    if (banner) drawBanner();
    if (panel) drawPanel();
    if (noticeOpen) drawNotice();
    if (paused) drawPause();
    if (state.phase === "over") drawResult();
    stage.end();
  }

  function drawRooms() {
    const s = state;
    for (const room of s.rooms) {
      const r = roomRect(room.index);
      const mine = room.index === s.playerRoom;
      room.tiles.forEach((b, tile) => {
        if (!b) return;
        const c = tileCenter(room.index, tile);
        drawBuilding(ctx, b.kind, c.x, c.y, 38, b.level, t + tile);
      });
      const bc = tileCenter(room.index, bedTile(room.index));
      const owner = s.occupants.find((o) => o.id === room.owner);
      if (owner?.asleep && owner.alive) {
        drawSleeper(ctx, bc.x, bc.y, PALETTES[owner.id], room.bedLevel);
        if (Math.floor(t * 1.2 + owner.id) % 3 === 0)
          text(ctx, "z", bc.x + 14, bc.y - 26 - ((t * 10) % 6), 12, "#cfe0ff");
      } else drawBed(ctx, bc.x, bc.y, room.bedLevel);
      drawDoor(
        ctx,
        room.index,
        room.doorHp / maxDoorHp(room),
        room.doorLevel,
        room.dark,
        doorShake[room.index],
      );
      if (room.owner !== null && !room.dark && room.doorHp < maxDoorHp(room)) {
        const d = doorPos(room.index);
        const ratio = room.doorHp / maxDoorHp(room);
        drawBar(
          ctx,
          d.x + (room.index % 2 === 0 ? 14 : -14),
          d.y - 30,
          34,
          ratio,
          ratio < 0.35 ? "#ff4a4a" : "#7affa0",
        );
      }
      // ad rule 5: a dark room lost its sleeper
      if (room.dark) {
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      if (mine && !room.dark) {
        ctx.strokeStyle = `rgba(255,214,107,${0.55 + Math.sin(t * 3) * 0.2})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
        // Onboarding: until the first build, the best turret tile glows
        if (!room.tiles.some(Boolean) && !panel) {
          const c = tileCenter(room.index, tilesByDoor(room.index)[0]);
          ctx.fillStyle = `rgba(122,255,160,${0.25 + Math.sin(t * 6) * 0.15})`;
          ctx.fillRect(c.x - 22, c.y - 22, 44, 44);
          ctx.strokeStyle = "#7affa0";
          ctx.lineWidth = 2;
          ctx.strokeRect(c.x - 22, c.y - 22, 44, 44);
        }
      }
    }
  }

  function nameOf(id: number) {
    const o = state.occupants[id];
    return o.bot ? tr().bots[o.bot] : tr().you;
  }

  function drawPeople() {
    const move = moveVector();
    for (const o of state.occupants) {
      if (!o.alive || o.asleep) continue;
      const walking = o.bot
        ? o.path.length > 0
        : Math.hypot(move.x, move.y) > 0.1;
      drawPerson(ctx, o.x, o.y, PALETTES[o.id], t + o.id, walking);
      text(
        ctx,
        nameOf(o.id),
        o.x,
        o.y - 28,
        12,
        o.bot ? "#8aff9a" : "#ffffff",
        "center",
        700,
      );
      if (!o.bot) {
        const bob = Math.sin(t * 6) * 2;
        ctx.fillStyle = "#ffd36b";
        ctx.beginPath();
        ctx.moveTo(o.x - 6, o.y - 46 + bob);
        ctx.lineTo(o.x + 6, o.y - 46 + bob);
        ctx.lineTo(o.x, o.y - 38 + bob);
        ctx.fill();
      }
    }
  }

  /** ad: a "Ngủ" bubble over a free bed you stand at; a warning if it is taken. */
  function drawSleepPrompt() {
    const near = canSleepHere();
    if (!near) return;
    const c = tileCenter(near.room, bedTile(near.room));
    if (near.free) {
      ctx.fillStyle = "rgba(20,40,30,0.85)";
      ctx.beginPath();
      ctx.roundRect(c.x - 30, c.y - 52, 60, 26, 8);
      ctx.fill();
      ctx.strokeStyle = "#7affa0";
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, tr().sleep, c.x, c.y - 38, 14, "#ffe680");
    } else
      text(ctx, tr().roomTaken, c.x, c.y - 40, 13, "#ff8a8a", "center", 700);
  }

  function drawHunterLayer() {
    const h = state.hunter;
    if (!h || h.mode === "dead") return;
    const angry = enraged(h);
    drawHunter(ctx, h.x, h.y, t, h.flash, angry);
    drawBar(
      ctx,
      h.x,
      h.y - 50,
      54,
      h.hp / h.maxHp,
      angry ? "#ff3030" : "#e8302a",
    );
    text(
      ctx,
      `${tr().hunter} (${tr().level(h.level)})`,
      h.x,
      h.y - 60,
      11,
      "#ffb0b0",
      "center",
      700,
    );
  }

  /** Dark bands behind the HUD and the bottom buttons, so they never sit on top of a room. */
  function drawSafeBands() {
    const v = view();
    const topBand = ctx.createLinearGradient(0, v.y, 0, v.y + HUD_TOP);
    topBand.addColorStop(0, "rgba(12,10,14,0.97)");
    topBand.addColorStop(0.85, "rgba(12,10,14,0.92)");
    topBand.addColorStop(1, "rgba(12,10,14,0)");
    ctx.fillStyle = topBand;
    ctx.fillRect(v.x, v.y, v.w, HUD_TOP);
    const y = v.y + v.h - HUD_BOTTOM;
    const bottomBand = ctx.createLinearGradient(0, y, 0, v.y + v.h);
    bottomBand.addColorStop(0, "rgba(12,10,14,0)");
    bottomBand.addColorStop(0.3, "rgba(12,10,14,0.85)");
    bottomBand.addColorStop(1, "rgba(12,10,14,0.95)");
    ctx.fillStyle = bottomBand;
    ctx.fillRect(v.x, y, v.w, HUD_BOTTOM);
  }

  /** Off-screen hunter: a red arrow on the screen edge pointing at it. */
  function drawHunterPointer() {
    const h = state.hunter;
    if (!h || h.mode === "dead" || state.phase === "over") return;
    const v = view();
    const sx = h.x - cam.x;
    const sy = h.y - cam.y;
    const margin = 30;
    const a = safeArea();
    if (
      sx > v.x + margin &&
      sx < v.x + v.w - margin &&
      sy > a.y &&
      sy < a.y + a.h
    )
      return;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const px = Math.max(
      v.x + margin,
      Math.min(v.x + v.w - margin, cx + Math.cos(ang) * v.w),
    );
    const py = Math.max(
      a.y + 16,
      Math.min(a.y + a.h - 16, cy + Math.sin(ang) * v.h),
    );
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.75 + Math.sin(t * 8) * 0.2;
    ctx.fillStyle = "#ff3a3a";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -11);
    ctx.lineTo(-8, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawEffects() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of beams) {
      const a = 1 - b.t / 0.14;
      ctx.strokeStyle = `rgba(255,236,150,${a})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.from.x, b.from.y - 6);
      ctx.lineTo(b.to.x, b.to.y);
      ctx.stroke();
      glow(ctx, b.to.x, b.to.y, 12, "rgba(255,230,140,0.9)", a);
    }
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, s.life * 1.6);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    ctx.restore();
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, (1.1 - f.t) * 3);
      text(ctx, f.text, f.x, f.y, 15, f.color);
      ctx.globalAlpha = 1;
    }
  }

  /** ad: a joystick on the lower screen. Floating: it appears where the finger lands. */
  function drawStick() {
    const awake =
      state.phase === "setup" && !player(state).asleep && !noticeOpen;
    if (!awake) return;
    const g = gesture?.mode === "stick" ? gesture : null;
    if (!g && !coarse) return;
    const base = g ? { x: g.ox, y: g.oy } : stickHome();
    let kx = base.x;
    let ky = base.y;
    if (g) {
      const dx = g.x - g.ox;
      const dy = g.y - g.oy;
      const d = Math.hypot(dx, dy);
      const k = d > STICK_R ? STICK_R / d : 1;
      kx += dx * k;
      ky += dy * k;
    }
    ctx.globalAlpha = g ? 0.9 : 0.45;
    ctx.fillStyle = "rgba(200,210,230,0.18)";
    ctx.beginPath();
    ctx.arc(base.x, base.y, STICK_R + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(230,235,245,0.75)";
    ctx.beginPath();
    ctx.arc(kx, ky, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    const s = state;
    const y0 = top() + 34;
    const l = left() + 16;
    const room = myRoom();
    // Gold and energy (ad: coin and bolt, top left)
    ctx.fillStyle = "rgba(10,12,18,0.7)";
    ctx.beginPath();
    ctx.roundRect(l - 6, y0 - 18, 230, 36, 18);
    ctx.fill();
    coin(ctx, l + 12, y0, 11);
    text(ctx, String(room?.gold ?? 0), l + 30, y0 + 1, 20, "#ffe27a", "left");
    bolt(ctx, l + 128, y0, 11);
    text(
      ctx,
      String(room?.energy ?? 0),
      l + 144,
      y0 + 1,
      20,
      "#8ae0ff",
      "left",
    );
    const pb = pauseBtn();
    ctx.fillStyle = "rgba(10,12,18,0.7)";
    ctx.beginPath();
    ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(pb.x - 7, pb.y - 8, 5, 16);
    ctx.fillRect(pb.x + 2, pb.y - 8, 5, 16);

    // Sleepers row (ad: avatars, "Bạn" under yours)
    const ay = y0 + 50;
    for (const o of s.occupants) {
      const x = l + 18 + o.id * 46;
      ctx.fillStyle = o.alive ? "rgba(40,46,60,0.9)" : "rgba(30,20,20,0.9)";
      ctx.beginPath();
      ctx.roundRect(x - 19, ay - 19, 38, 38, 8);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x - 19, ay - 19, 38, 38, 8);
      ctx.clip();
      if (!o.alive) ctx.globalAlpha = 0.35;
      drawPerson(ctx, x, ay + 8, PALETTES[o.id], 0, false);
      ctx.restore();
      if (!o.alive) {
        ctx.strokeStyle = "#ff3a3a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 10, ay - 10);
        ctx.lineTo(x + 10, ay + 10);
        ctx.moveTo(x + 10, ay - 10);
        ctx.lineTo(x - 10, ay + 10);
        ctx.stroke();
      }
      if (!o.bot) text(ctx, tr().you, x, ay + 14, 12, "#8aff9a", "center", 700);
    }
    // Your door, always in view (you may be looking elsewhere when it is hit)
    if (room && !room.dark) {
      const ratio = room.doorHp / maxDoorHp(room);
      const dy = ay + 34;
      text(ctx, tr().door, l, dy, 13, "#cfd6e4", "left", 700);
      drawBar(
        ctx,
        l + 112,
        dy - 2,
        150,
        ratio,
        ratio < 0.35 ? "#ff4a4a" : "#7affa0",
      );
    }

    if (s.phase === "setup") {
      // ad: a big red countdown; kept in the HUD band, right of the avatars
      text(
        ctx,
        String(Math.max(0, Math.ceil(s.countdown))),
        right() - 70,
        ay + 4,
        56,
        "#ff3a3a",
      );
      if (!player(s).asleep) {
        text(ctx, tr().moveHint, W / 2, ay + 46, 16, "#ffffff", "center", 700);
        if (!coarse)
          text(
            ctx,
            tr().keysHint,
            W / 2,
            ay + 66,
            12,
            "#cfd6e4",
            "center",
            600,
          );
      }
    }
    if (
      room &&
      !room.dark &&
      !room.tiles.some(Boolean) &&
      !panel &&
      s.phase !== "over"
    ) {
      text(ctx, tr().buildHint, W / 2, ay + 62, 14, "#7affa0", "center", 700);
    } else if (
      room &&
      !room.dark &&
      !panel &&
      s.phase === "night" &&
      s.nightTime < 8
    ) {
      text(ctx, tr().lookHint, W / 2, ay + 62, 13, "#cfd6e4", "center", 600);
    }

    // Big Sleep button while standing at a free bed
    const near = canSleepHere();
    if (near?.free) {
      const r = sleepBtn();
      ctx.fillStyle = "#2f8a5a";
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 16);
      ctx.fill();
      ctx.strokeStyle = "#bfffd8";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      text(ctx, tr().sleep, r.x + r.w / 2, r.y + r.h / 2 + 1, 24, "#ffffff");
    }

    // Repair button (ad rule 4)
    if (room && !room.dark && player(s).asleep) {
      const r = repairBtn();
      const cd = room.repairCooldown;
      const full = room.doorHp >= maxDoorHp(room);
      ctx.globalAlpha = cd > 0 || full ? 0.55 : 1;
      ctx.fillStyle = "#2f8a4a";
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      text(
        ctx,
        cd > 0 ? `${Math.ceil(cd)}s` : tr().repair,
        r.x + r.w / 2,
        r.y + r.h / 2 + 1,
        18,
        "#ffffff",
      );
      ctx.globalAlpha = 1;
    }
  }

  function drawBanner() {
    if (!banner) return;
    const a = Math.min(1, banner.t * 4, (2.6 - banner.t) * 2);
    const cy = top() + 300;
    ctx.globalAlpha = Math.max(0, a);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "rgba(60,0,10,0)");
    g.addColorStop(0.5, "rgba(60,0,10,0.85)");
    g.addColorStop(1, "rgba(60,0,10,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - 26, W, 52);
    text(ctx, banner.text(), W / 2, cy + 1, 22, banner.color);
    ctx.globalAlpha = 1;
  }

  function card(r: Rect) {
    ctx.fillStyle = "#1a1d26";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 18);
    ctx.fill();
    ctx.strokeStyle = "#3a4152";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function button(r: Rect, label: string, enabled: boolean, color = "#2f8a7a") {
    ctx.globalAlpha = enabled ? 1 : 0.45;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, 18, "#ffffff");
    ctx.globalAlpha = 1;
  }

  function costButton(
    r: Rect,
    currency: "gold" | "energy",
    cost: number,
    enabled: boolean,
  ) {
    ctx.globalAlpha = enabled ? 1 : 0.45;
    ctx.fillStyle = enabled ? "#2f8a7a" : "#3a404c";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (currency === "gold") coin(ctx, r.x + 24, r.y + r.h / 2, 11);
    else bolt(ctx, r.x + 24, r.y + r.h / 2, 11);
    text(ctx, String(cost), r.x + 66, r.y + r.h / 2 + 1, 19, "#ffffff");
    ctx.globalAlpha = 1;
  }

  function drawPanel() {
    const room = myRoom();
    if (!panel || !room) return;
    const s = sheet();
    const l = tr();
    card(s);
    const c = closeRect();
    text(ctx, "✕", c.x + c.w / 2, c.y + c.h / 2, 22, "#cfd6e4");

    if (panel.kind === "build") {
      text(ctx, l.buildTitle, s.x + s.w / 2, s.y + 32, 28, "#ff8a3a");
      for (const [i, tab] of (["basic", "workshop"] as const).entries()) {
        const r = tabRect(i);
        const on = panel.tab === tab;
        ctx.fillStyle = on ? "#5a9a8a" : "#2a3a3a";
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, 8);
        ctx.fill();
        text(
          ctx,
          l.tabs[tab],
          r.x + r.w / 2,
          r.y + r.h / 2 + 1,
          15,
          on ? "#ffffff" : "#a8c0b8",
          "center",
          700,
        );
      }
      const tab = panel.tab;
      const kinds = KINDS.filter((k) => BUILDS[k].tab === tab);
      for (const [i, kind] of kinds.entries()) {
        const r = sheetRow(i);
        ctx.fillStyle = "#262b36";
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, 10);
        ctx.fill();
        drawBuilding(ctx, kind, r.x + 34, r.y + r.h / 2, 40, 1, t);
        const spec = BUILDS[kind];
        text(
          ctx,
          l.builds[kind].name,
          r.x + 64,
          r.y + 18,
          15,
          "#9aff9a",
          "left",
          800,
        );
        const desc =
          kind === "turret"
            ? l.turretStats(TURRET_DAMAGE[0], TURRET_RANGE)
            : l.builds[kind].desc;
        ctx.font = `600 12px "Baloo 2", sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#cfd6e4";
        ctx.fillText(desc, r.x + 64, r.y + 38, r.w - 64 - 124);
        if (spec.limit < 99) {
          ctx.fillStyle = "#7a8aa0";
          ctx.fillText(
            l.limit(count(room, kind), spec.limit),
            r.x + 64,
            r.y + 55,
            r.w - 64 - 124,
          );
        }
        costButton(
          rowButton(r),
          spec.currency,
          spec.cost,
          canBuild(room, kind),
        );
      }
      return;
    }

    const big = bigButton();
    let title = "";
    let line = "";
    let cost: number | null = null;
    if (panel.kind === "turret") {
      const b = room.tiles[panel.tile];
      if (!b) {
        panel = null;
        return;
      }
      title = l.turretLevel(b.level);
      cost = turretUpgradeCost(b);
      const range = Math.round(turretRange(room) / RANGE_UNIT);
      line =
        l.turretStats(TURRET_DAMAGE[b.level - 1], range) +
        (cost !== null ? `  →  ${TURRET_DAMAGE[b.level]}` : "");
      drawBuilding(ctx, "turret", s.x + s.w / 2, s.y + 112, 64, b.level, t);
    } else if (panel.kind === "bed") {
      title = l.bedLevel(room.bedLevel);
      cost = bedUpgradeCost(room);
      line = l.bedIncome(
        BED_INCOME[room.bedLevel - 1],
        cost !== null ? BED_INCOME[room.bedLevel] : null,
      );
      drawBed(ctx, s.x + s.w / 2, s.y + 112, room.bedLevel);
    } else if (panel.kind === "door") {
      title = l.doorLevel(room.doorLevel);
      cost = doorUpgradeCost(room);
      line = l.doorHp(
        Math.ceil(room.doorHp),
        cost !== null ? DOOR_HP[room.doorLevel] : null,
      );
      drawBar(
        ctx,
        s.x + s.w / 2,
        s.y + 112,
        160,
        room.doorHp / maxDoorHp(room),
        "#7affa0",
      );
    } else {
      const b = room.tiles[panel.tile];
      if (!b) {
        panel = null;
        return;
      }
      title = l.builds[b.kind].name;
      line = l.builds[b.kind].desc;
      if (b.kind === "watchtower") line += ` (+${WATCHTOWER_RANGE})`;
      drawBuilding(ctx, b.kind, s.x + s.w / 2, s.y + 112, 64, b.level, t);
    }
    text(ctx, title, s.x + s.w / 2, s.y + 36, 26, "#ffe27a");
    text(ctx, line, s.x + s.w / 2, s.y + 176, 17, "#e8eef8", "center", 700);
    if (panel.kind === "info") return;
    if (cost === null) button(big, l.max, false, "#3a404c");
    else {
      const affordable = room.gold >= cost;
      ctx.fillStyle = affordable ? "#2f8a7a" : "#3a404c";
      ctx.globalAlpha = affordable ? 1 : 0.5;
      ctx.beginPath();
      ctx.roundRect(big.x, big.y, big.w, big.h, 14);
      ctx.fill();
      text(ctx, l.upgrade, big.x + 70, big.y + big.h / 2 + 1, 20, "#ffffff");
      coin(ctx, big.x + 150, big.y + big.h / 2, 12);
      text(
        ctx,
        String(cost),
        big.x + 190,
        big.y + big.h / 2 + 1,
        20,
        "#ffe27a",
      );
      ctx.globalAlpha = 1;
    }
  }

  function overlayCard(h: number) {
    ctx.fillStyle = "rgba(4,6,12,0.72)";
    ctx.fillRect(view().x, view().y, view().w, view().h);
    const cy = top() + view().h / 2;
    const r = { x: W / 2 - 210, y: cy - h / 2, w: 420, h };
    card(r);
    return r;
  }

  /** ad: the paper "THÔNG BÁO" sheet with numbered rules and an OK button. */
  function drawNotice() {
    ctx.fillStyle = "rgba(20,22,28,0.92)";
    ctx.fillRect(view().x, view().y, view().w, view().h);
    const cy = top() + view().h / 2;
    // Measure the rules first (invisibly), then size the paper to fit them
    const x = W / 2 - 230;
    let height = 86;
    ctx.save();
    ctx.globalAlpha = 0;
    for (const rule of tr().rules)
      height = paragraph(ctx, rule, x + 26, height, 408, 17, "#000") + 8;
    ctx.restore();
    height += 14;
    const r = { x, y: cy - (height + 96) / 2, w: 460, h: height };
    noticeBottom = r.y + r.h;
    ctx.fillStyle = "#f3efe6";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = `600 34px "Baloo 2", sans-serif`;
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tr().noticeTitle, W / 2, r.y + 46);
    let y = r.y + 86;
    for (const rule of tr().rules)
      y = paragraph(ctx, rule, r.x + 26, y, r.w - 52, 17, "#2a2a2a") + 8;
    const ok = noticeOk();
    ctx.fillStyle = "#3a8a8a";
    ctx.beginPath();
    ctx.roundRect(ok.x, ok.y, ok.w, ok.h, 8);
    ctx.fill();
    ctx.strokeStyle = "#a8e8e0";
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, tr().ok, W / 2, ok.y + ok.h / 2 + 1, 24, "#ffffff");
  }

  function drawPause() {
    const r = overlayCard(320);
    text(ctx, tr().paused, W / 2, r.y + 50, 32, "#fff3c4");
    text(ctx, tr().keysHint, W / 2, r.y + 100, 13, "#a8b8e0", "center", 600);
    const b = overlayButtons();
    button(b.primary, tr().resume, true, "#d8762a");
    button(b.secondary, tr().restart, true, "#3a404c");
  }

  function drawResult() {
    const r = state.result;
    if (!r) return;
    const c = overlayCard(330);
    const l = tr();
    text(
      ctx,
      r.won ? l.won : l.lost,
      W / 2,
      c.y + 48,
      32,
      r.won ? "#ffe27a" : "#ff6a6a",
    );
    if (!r.won && state.hunter === null)
      text(ctx, l.caught, W / 2, c.y + 84, 16, "#ffb0b0", "center", 700);
    else if (r.won) drawHunter(ctx, W / 2, c.y + 100, t, 0, false, 0.7);
    text(ctx, l.score(state.score), W / 2, c.y + 150, 34, "#ffd36b");
    text(
      ctx,
      l.resultLine(fmtTime(r.nightTime), r.level),
      W / 2,
      c.y + 186,
      16,
      "#dce6ff",
      "center",
      700,
    );
    text(
      ctx,
      state.score >= best ? l.newBest : l.best(best),
      W / 2,
      c.y + 212,
      15,
      "#a8b8e0",
      "center",
      700,
    );
    button(overlayButtons().primary, l.playAgain, true, "#d8762a");
  }

  snapCamera();
  return {
    update: step,
    render: draw,
    pointer,
    keydown: onKeyDown,
    suspend() {
      if (state.phase !== "over" && !noticeOpen) paused = true;
      gesture = null;
    },
  };
}
