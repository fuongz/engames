// The imperative shell of Qua Đường: input → logic.step at the engine's fixed
// step → sounds, particles and animation → the 3D scene and the 2D HUD.
//
// Online (rt.game.online) the room runs the race: this shell sends hops, keeps
// a copy of every racer's duck built from the shared seed, brings it to each
// snapshot (replaying its own unacknowledged hops so a tap answers at once),
// and draws the others as see-through ducks with name tags. It never reports a
// score or pays tickets online.
//
// WebGL hook (kept inside the game, not in packages/core): the engine's Stage
// owns a 2D canvas that receives pointer input. We put our own WebGL canvas
// underneath it in the same root, leave the 2D canvas transparent for the HUD,
// and size the WebGL canvas with a ResizeObserver on the root (no window or
// document listeners). The loop, keys, pause and teardown stay the engine's.
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/800.css";
import { type CosmeticInventory, type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, inRect } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import { Color } from "three";
import { CATCH_TIME, DAY_CYCLE, DEFAULT_SKIN, HOP_TIME, PALETTE, RACE_SECONDS, SKINS, STALL_WARN, type SkinId, isSkinId } from "./config";
import {
  drawBanner,
  drawCenter,
  drawClock,
  drawHurry,
  drawNameTag,
  drawNoWebGL,
  drawOver,
  drawPaused,
  drawReady,
  drawResults,
  drawScore,
  drawStandings,
  skinArrows,
} from "./hud";
import {
  type Dir,
  type GameEvent,
  type RaceEvent,
  type RaceSnap,
  type State,
  applyDuckSnap,
  createRun,
  duckPos,
  laneAt,
  parseBest,
  score,
  step,
  ticketsFor,
} from "./logic";
import { type Particle, type Pose, Scene3D } from "./scene";
import { STRINGS } from "./strings";

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

/** Facing → rotation about y; the models look along +z. */
const FACING: Record<Dir, number> = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };

/** Logical units a finger must travel before a press becomes a swipe. */
const SWIPE = 34;

interface Bit extends Particle {
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

/** Ground height under a lane kind, so the duck stands on the surface. */
const groundY = (s: State, row: number) => {
  const k = laneAt(s, Math.round(row))?.kind;
  return k === "road" ? -0.03 : k === "rail" ? -0.02 : k === "river" ? 0.02 : 0;
};

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx, root } = rt;
  const { storage, audio, reportScore, tickets, cosmetics, online } = rt.game;
  const tr = () => STRINGS[rt.locale()];

  // ---------------------------------------------------------- the WebGL layer
  let scene: Scene3D | null = null;
  try {
    scene = new Scene3D();
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

  // ---------------------------------------------------------- run state
  let best = parseBest(storage.get<unknown>("best", 0));
  let wallet = parseBest(storage.get<unknown>("coins", 0));
  let disposed = false;

  // ---------------------------------------------------------- outfits (account cosmetics)
  // Ownership comes only from the account (ctx.cosmetics): never from storage.
  // Signed out, or before the account answers, only the free duck is owned.
  let inventory: CosmeticInventory = { signedIn: false, balance: null, owned: [DEFAULT_SKIN], equipped: DEFAULT_SKIN };
  let inventoryLoaded = false;
  let skin: SkinId = DEFAULT_SKIN;
  let equipSeq = 0;
  scene?.setSkin(skin);

  const ownedSkins = () => SKINS.filter((x) => x.price === 0 || inventory.owned.includes(x.id));

  function applyInventory(inv: CosmeticInventory) {
    if (disposed) return;
    inventory = inv;
    inventoryLoaded = true;
    skin = isSkinId(inv.equipped) && ownedSkins().some((x) => x.id === inv.equipped) ? inv.equipped : DEFAULT_SKIN;
    if (!online) scene?.setSkin(skin);
  }

  function refreshInventory() {
    if (!cosmetics) {
      inventoryLoaded = true;
      return;
    }
    const at = equipSeq;
    cosmetics.state().then(
      (inv) => at === equipSeq && applyInventory(inv),
      () => {
        inventoryLoaded = true;
      },
    );
  }
  refreshInventory();

  // ---------------------------------------------------------- tickets (solo, signed in)
  let ticketBalance: number | null = null;
  const offBalance = online
    ? undefined
    : tickets?.onBalance((b) => {
        ticketBalance = b;
      });
  if (!online)
    void tickets?.balance().then(
      (b) => {
        if (!disposed) ticketBalance = b;
      },
      () => {},
    );
  let payout: { tickets: number; cap: boolean } | null = null;

  let run: State = createRun(online ? online.seed : newSeed());
  let pending: Dir | null = null;
  let paused = false;
  let reported = false;
  let newBest = false;
  let usedKeys = false;
  let clock = 0;

  // animation
  let angle = FACING.up;
  let squash = 0;
  let camRow = 4.5;
  let camX = 0;
  let dusk = 0;
  let bits: Bit[] = [];
  let pressed: "again" | null = null;
  let againRect: Rect | null = null;

  function restart() {
    run = createRun(newSeed());
    pending = null;
    reported = false;
    newBest = false;
    payout = null;
    bits = [];
    angle = FACING.up;
    camRow = 4.5;
    camX = 0;
    audio.tone({ freq: 392, to: 587, dur: 0.16, type: "sine", vol: 0.07 });
    // An outfit bought at the Prize Counter meanwhile shows up on the start screen
    refreshInventory();
  }

  function cycleSkin(by: number) {
    const list = ownedSkins();
    if (list.length < 2) {
      audio.tone({ freq: 170, dur: 0.05, type: "triangle", vol: 0.06 });
      return;
    }
    const i = Math.max(0, list.findIndex((x) => x.id === skin));
    const next = list[(i + by + list.length) % list.length].id;
    skin = next;
    scene?.setSkin(skin);
    audio.tone({ freq: 660, dur: 0.07, type: "triangle", vol: 0.06 });
    if (!inventory.signedIn || !cosmetics) return;
    // Saved to the account; the latest pick wins if answers cross
    const at = ++equipSeq;
    cosmetics.equip(next).then(
      (inv) => at === equipSeq && applyInventory(inv),
      () => at === equipSeq && refreshInventory(),
    );
  }

  // ---------------------------------------------------------- effects
  const tint = (c: number) => new Color(c);
  function burst(n: number, x: number, y: number, z: number, colors: number[], speed: number, up: number) {
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
        size: 0.06 + Math.random() * 0.08,
        life: 0.5 + Math.random() * 0.5,
        color: tint(colors[i % colors.length]),
      });
    }
  }

  function onEvents(events: GameEvent[]) {
    for (const e of events) {
      if (e.type === "hop") audio.tone({ freq: 520, to: 760, dur: 0.06, type: "square", vol: 0.035 });
      else if (e.type === "bump") audio.tone({ freq: 170, dur: 0.05, type: "triangle", vol: 0.06 });
      else if (e.type === "land") {
        squash = 1;
        if (e.riding) audio.tone({ freq: 320, to: 220, dur: 0.08, type: "sine", vol: 0.05 });
      } else if (e.type === "coin") {
        burst(10, e.x, 0.6, -e.row, [PALETTE.coin, PALETTE.coinFace], 1.6, 2.4);
        audio.tone({ freq: 988, dur: 0.07, type: "square", vol: 0.04 });
        audio.tone({ freq: 1319, dur: 0.12, type: "square", vol: 0.04, delay: 0.07 });
      } else if (e.type === "row" && e.row % 50 === 0) {
        for (const [i, f] of [523, 659, 784].entries()) audio.tone({ freq: f, dur: 0.12, type: "triangle", vol: 0.05, delay: i * 0.08 });
      } else if (e.type === "train-warn") {
        for (let i = 0; i < 4; i++) audio.tone({ freq: 1480, dur: 0.18, type: "triangle", vol: 0.06, delay: i * 0.32 });
      } else if (e.type === "stall-warn") {
        audio.tone({ freq: 2300, to: 2500, dur: 0.18, type: "square", vol: 0.025 });
      } else if (e.type === "whistle") {
        audio.tone({ freq: 2400, to: 2650, dur: 0.22, type: "square", vol: 0.04 });
        audio.tone({ freq: 2400, to: 2700, dur: 0.45, type: "square", vol: 0.04, delay: 0.26 });
      } else if (e.type === "die") dieEffects(e.cause);
    }
  }

  function dieEffects(cause: NonNullable<State["death"]>) {
    const p = duckPos(run);
    const z = -p.row;
    if (cause === "drown" || cause === "edge") {
      burst(26, p.x, 0, z, [PALETTE.splash, PALETTE.water, PALETTE.splash], 1.8, 3.4);
      audio.noise(0.35, 0.08);
      audio.tone({ freq: 620, to: 140, dur: 0.35, type: "sine", vol: 0.08 });
    } else if (cause === "hit" || cause === "train") {
      burst(18, p.x, 0.4, z, [PALETTE.duck, PALETTE.splash, PALETTE.duckShade], 2.4, 2.6);
      audio.noise(0.2, 0.09);
      audio.tone({ freq: 220, to: 60, dur: 0.3, type: "triangle", vol: 0.1 });
    } else {
      audio.tone({ freq: 2500, to: 2200, dur: 0.3, type: "square", vol: 0.04 });
    }
    if (!online) finishRun();
  }

  /** A solo run ended: best, coins, the leaderboard and the ticket payout, once. */
  function finishRun() {
    if (reported) return;
    reported = true;
    const rows = score(run);
    newBest = rows > best;
    if (newBest) {
      best = rows;
      storage.set("best", best);
    }
    wallet += run.coins;
    storage.set("coins", wallet);
    storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(best), en: STRINGS.en.summary(best) });
    reportScore?.({ score: rows, detail: tr().detail(rows, run.coins) });
    const won = ticketsFor(rows, run.coins);
    if (tickets && won > 0) {
      const mine = { tickets: won, cap: false };
      payout = mine;
      tickets.deposit(won).then(
        ({ accepted }) => {
          if (accepted < won && payout === mine) payout = { tickets: accepted, cap: true };
        },
        () => {
          if (payout === mine) payout = null;
        },
      );
    }
  }

  // ---------------------------------------------------------- the online race
  const me = online?.seat ?? -1;
  /** Every racer's duck, indexed by seat, built from the shared seed and brought to each snapshot. */
  const views: State[] = [];
  let snap: RaceSnap | null = null;
  let unacked: { seq: number; dir: Dir }[] = [];
  let seq = 0;
  let skinSent = false;
  let follow = Math.max(0, me);
  const race = {
    results: null as SeatResult[] | null,
    /** Seconds since `end`, "Go!" and "Time's up!". */
    endT: 0,
    goT: 99,
    timeUpT: 99,
    hop(dir: Dir) {
      const v = views[me];
      if (!online || !snap || snap.phase !== "play" || race.results || !v || v.phase !== "play") return;
      online.send({ seq: ++seq, move: { x: 0, y: 0 }, actions: [{ type: "hop", dir }] });
      unacked.push({ seq, dir });
      // Answer the tap at once; the room's snapshot confirms (or corrects) it
      for (const e of step(v, dir, 0)) {
        if (e.type === "hop") audio.tone({ freq: 520, to: 760, dur: 0.06, type: "square", vol: 0.035 });
        else if (e.type === "bump") audio.tone({ freq: 170, dur: 0.05, type: "triangle", vol: 0.06 });
      }
    },
  };

  function onSnap(next: RaceSnap, acks: Record<number, number>) {
    snap = next;
    while (views.length < next.racers.length) views.push(createRun(next.seed));
    for (const [i, r] of next.racers.entries()) applyDuckSnap(views[i], r.duck, r.got);
    const mine = views[me];
    if (!mine) return;
    const acked = acks[me] ?? 0;
    unacked = unacked.filter((u) => u.seq > acked);
    if (next.phase === "play") for (const u of unacked) step(mine, u.dir, 0);
  }

  function onRaceEvents(events: RaceEvent[]) {
    for (const e of events) {
      if (e.type === "go") {
        race.goT = 0;
        for (const [i, f] of [523, 659, 784, 1047].entries()) audio.tone({ freq: f, dur: 0.1, type: "triangle", vol: 0.05, delay: i * 0.06 });
      } else if (e.type === "time-up") {
        race.timeUpT = 0;
        audio.tone({ freq: 880, to: 440, dur: 0.4, type: "square", vol: 0.05 });
      } else if (e.seat !== follow) {
        if (e.type === "coin") burst(6, e.x, 0.6, -e.row, [PALETTE.coin, PALETTE.coinFace], 1.4, 2);
      } else if (!(e.seat === me && (e.type === "hop" || e.type === "bump"))) {
        run = views[follow] ?? run;
        onEvents([e]);
      }
    }
  }

  const unsubscribe = online?.onMessage((m) => {
    if (disposed) return;
    if (m.t === "snap" && m.state) onSnap(m.state as RaceSnap, m.acks);
    else if (m.t === "ev") onRaceEvents(m.events as RaceEvent[]);
    else if (m.t === "end") {
      race.results = m.results;
      race.endT = 0;
    }
  });

  /** Your duck while it runs (and a moment after it goes out), then the leader still running. */
  function pickFollow(): number {
    const mine = views[me];
    if (mine && (mine.phase !== "over" || mine.overT < 1.6)) return me;
    let bestSeat = -1;
    views.forEach((v, i) => {
      if (v.phase !== "over" && (bestSeat < 0 || v.maxRow > views[bestSeat].maxRow)) bestSeat = i;
    });
    return bestSeat >= 0 ? bestSeat : Math.max(0, me);
  }

  function updateOnline(dt: number) {
    race.goT += dt;
    race.timeUpT += dt;
    if (race.results) race.endT += dt;
    if (snap && snap.phase !== "over" && !race.results) for (const v of views) step(v, null, dt);
    if (snap?.phase === "countdown" && !skinSent && inventoryLoaded && online && me >= 0) {
      skinSent = true;
      online.send({ seq: ++seq, move: { x: 0, y: 0 }, actions: [{ type: "skin", id: skin }] });
    }
    const next = pickFollow();
    if (next !== follow && views[next]) {
      follow = next;
      angle = FACING[views[next].facing];
      bits = [];
    }
    run = views[follow] ?? run;
    const racer = snap?.racers[follow];
    if (racer) scene?.setSkin(racer.skin);
    animate(dt);
  }

  function ghostPose(s: State): Pose | null {
    const p = duckPos(s);
    if (s.phase === "over" && s.overT > 0.6) return null;
    const flat = s.death === "hit" || s.death === "train";
    return { x: p.x, y: groundY(s, p.row) + p.lift * 0.55, z: -p.row, rotY: FACING[s.facing], sx: flat ? 1.4 : 1, sy: flat ? 0.14 : 1, sz: flat ? 1.4 : 1 };
  }

  function renderOnline(view: Rect, safe: Rect) {
    const l = tr();
    if (!snap) {
      drawBanner(ctx, safe, l.connecting);
      return;
    }
    const s = snap;
    drawScore(ctx, safe, l, score(run), null, run.coins);
    drawClock(ctx, safe, s.phase === "countdown" ? RACE_SECONDS : RACE_SECONDS - s.elapsed);
    const order = views.map((_, i) => i).sort((a, b) => views[b].maxRow - views[a].maxRow || a - b);
    drawStandings(
      ctx,
      safe,
      order.map((i) => ({ name: s.racers[i]?.name ?? "", rows: views[i].maxRow, me: i === me, out: views[i].phase === "over" })),
    );
    // Name tags over every duck still on the street
    views.forEach((v, i) => {
      if (!scene || (v.phase === "over" && v.overT > 0.6)) return;
      const p = duckPos(v);
      const at = scene.project(p.x, 1.45 + p.lift * 0.55, -p.row);
      if (!at) return;
      drawNameTag(ctx, view.x + at.x * view.w, view.y + at.y * view.h, i === me ? l.you : (s.racers[i]?.name ?? ""), i === me);
    });
    if (s.phase === "countdown") drawCenter(ctx, safe, String(Math.max(1, Math.ceil(s.countdown))));
    else if (race.goT < 0.8) drawCenter(ctx, safe, l.go, 1 - race.goT / 0.8);
    if (race.timeUpT < 1.6 && !race.results) drawCenter(ctx, safe, l.timeUp);
    const mine = views[me];
    if (!race.results) {
      if (me < 0) drawBanner(ctx, safe, l.watching);
      else if (mine?.phase === "over") drawBanner(ctx, safe, follow === me ? l.out : `${l.out} ${l.spectating(s.racers[follow]?.name ?? "")}`);
      else if (mine?.phase === "play" && mine.stall >= STALL_WARN) drawHurry(ctx, safe, l, clock);
      againRect = null;
    } else againRect = drawResults(ctx, view, safe, l, race.results, me, clamp(race.endT / 0.3, 0, 1), pressed === "again");
  }

  // ---------------------------------------------------------- input
  let gesture: { x: number; y: number; fired: boolean } | null = null;

  function send(dir: Dir) {
    if (online) return race.hop(dir);
    if (paused) {
      paused = false;
      return;
    }
    if (run.phase === "over") return;
    pending = dir;
  }

  function tap(p: PointerInfo) {
    if (online) {
      if (race.results && race.endT > 0.6 && againRect && inRect(p, againRect)) online.backToLobby();
      else send("up");
      return;
    }
    if (paused) {
      paused = false;
      return;
    }
    if (run.phase === "over") {
      if (run.overT > 0.7) restart();
      return;
    }
    if (run.phase === "ready") {
      const a = skinArrows(safeArea());
      if (inRect(p, a.prev)) return cycleSkin(-1);
      if (inRect(p, a.next)) return cycleSkin(1);
    }
    send("up");
  }

  // ---------------------------------------------------------- frame
  function poseDuck(): Pose | null {
    const p = duckPos(run);
    const h = run.hop;
    const base = h ? groundY(run, h.fromRow) + (groundY(run, h.toRow) - groundY(run, h.fromRow)) * h.t : groundY(run, p.row);
    if (run.phase === "over" && online && run.overT > 1.2) return null;
    let sy = 1;
    let sxz = 1;
    let y = base + p.lift * 0.55;
    if (h) {
      sy = 1 + 0.22 * p.lift;
      sxz = 1 - 0.1 * p.lift;
    } else {
      sy = 1 - 0.25 * squash + 0.03 * Math.sin(clock * 7);
      sxz = 1 + 0.12 * squash;
    }
    const death = run.death;
    if (death === "hit" || death === "train") {
      sy = 0.14;
      sxz = 1.4;
      y = base + 0.01;
    } else if (death === "drown" || death === "edge") {
      y = base - 0.15 - run.overT * 1.4;
      if (run.overT > 0.5) return null;
    } else if (death === "caught") {
      const o = poseOfficer();
      return { x: (o?.x ?? p.x) + 0.42, y: 0.42 + Math.sin(clock * 14) * 0.03, z: o?.z ?? -p.row, rotY: angle, sx: 1, sy: 1, sz: 1 };
    }
    return { x: p.x, y, z: -p.row, rotY: angle, sx: sxz, sy, sz: sxz };
  }

  function poseOfficer(): Pose | null {
    const p = duckPos(run);
    // He starts five rows back when he whistles; the duck is frozen from then on
    const officerFrom = run.catchT !== null || run.death === "caught" ? { x: clamp(p.x - 3, -6, 6), row: p.row - 5 } : null;
    if (officerFrom) {
      const t = run.death === "caught" ? 1 : clamp((run.catchT ?? 0) / CATCH_TIME, 0, 1);
      const tx = p.x - 0.5;
      const tr0 = p.row - 0.6;
      const x = officerFrom.x + (tx - officerFrom.x) * t;
      const row = officerFrom.row + (tr0 - officerFrom.row) * t;
      const running = t < 1;
      const rotY = running ? Math.atan2(tx - officerFrom.x, -(tr0 - officerFrom.row)) : FACING.up;
      return { x, y: running ? Math.abs(Math.sin(clock * 16)) * 0.12 : 0, z: -row, rotY, sx: 1, sy: 1, sz: 1 };
    }
    // Losing patience: he waits at the bottom of the screen, whistle ready
    if (run.phase === "play" && run.stall >= STALL_WARN) {
      return { x: clamp(p.x - 1.5, -4, 4), y: Math.abs(Math.sin(clock * 6)) * 0.05, z: -(p.row - 5.5), rotY: FACING.up, sx: 1, sy: 1, sz: 1 };
    }
    return null;
  }

  function animate(dt: number) {
    clock += dt;
    // turn toward the way the duck faces, the short way round
    const target = FACING[run.facing];
    let d = target - angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    angle += d * Math.min(1, dt * 22);
    squash = Math.max(0, squash - dt / (HOP_TIME * 1.2));

    const p = duckPos(run);
    camRow += (p.row + 4.5 - camRow) * Math.min(1, dt * 4);
    camX += (clamp(p.x * 0.45, -1.6, 1.6) - camX) * Math.min(1, dt * 3);

    // day → dusk → day every DAY_CYCLE rows reached
    const c = (score(run) % DAY_CYCLE) / DAY_CYCLE;
    const ramp = (k: number) => clamp(k, 0, 1) * clamp(k, 0, 1) * (3 - 2 * clamp(k, 0, 1));
    const want = ramp((c - 0.42) / 0.08) * (1 - ramp((c - 0.92) / 0.08));
    dusk += clamp(want - dusk, -dt * 0.35, dt * 0.35);

    for (const b of bits) {
      b.vy -= 9 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.life -= dt;
      if (b.y < -0.2) {
        b.y = -0.2;
        b.vy = 0;
        b.vx *= 0.8;
        b.vz *= 0.8;
      }
    }
    bits = bits.filter((b) => b.life > 0);
  }

  return {
    update(dt) {
      if (online) return updateOnline(dt);
      if (paused) return;
      const events = step(run, pending, dt);
      pending = null;
      onEvents(events);
      animate(dt);
    },

    render() {
      const ghosts: { pose: Pose; skin: SkinId }[] = [];
      if (online && snap)
        views.forEach((v, i) => {
          const pose = i === follow ? null : ghostPose(v);
          if (pose) ghosts.push({ pose, skin: snap?.racers[i]?.skin ?? DEFAULT_SKIN });
        });
      scene?.render(run, {
        time: run.time,
        dusk,
        lookX: camX,
        lookRow: camRow,
        duck: poseDuck(),
        ghosts,
        officer: poseOfficer(),
        particles: bits,
      });

      stage.begin();
      const view = stage.view;
      const safe = safeArea();
      const l = tr();
      if (!scene) drawNoWebGL(ctx, view, safe, l.noWebGL);
      if (online) {
        renderOnline(view, safe);
      } else if (run.phase === "ready") {
        const owned = ownedSkins();
        drawReady(ctx, safe, l, clock, SKINS.find((s) => s.id === skin)?.name[rt.locale()] ?? "", usedKeys, SKINS.length - owned.length, owned.length > 1);
        drawScore(ctx, safe, l, 0, best, wallet, ticketBalance);
      } else {
        drawScore(ctx, safe, l, score(run), Math.max(best, score(run)), run.coins);
        if (run.phase === "play" && run.stall >= STALL_WARN) drawHurry(ctx, safe, l, clock);
      }
      if (!online && run.phase === "over" && run.overT > 0.45) {
        const k = clamp((run.overT - 0.45) / 0.3, 0, 1);
        againRect = drawOver(
          ctx,
          view,
          safe,
          l,
          { reason: l.death[run.death ?? "hit"], rows: score(run), coins: run.coins, best, newBest, tickets: payout?.tickets ?? null, ticketCap: payout?.cap ?? false },
          k,
          pressed === "again",
        );
      } else if (!online) againRect = null;
      if (paused) drawPaused(ctx, view, safe, l);
      stage.end();
    },

    pointer: {
      down(p) {
        gesture = { x: p.x, y: p.y, fired: false };
        pressed = againRect && inRect(p, againRect) ? "again" : null;
      },
      move(p) {
        if (!gesture || gesture.fired) return;
        const dx = p.x - gesture.x;
        const dy = p.y - gesture.y;
        if (Math.hypot(dx, dy) < SWIPE) return;
        gesture.fired = true;
        if (run.phase === "over") return;
        send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
      },
      up(p) {
        const g = gesture;
        gesture = null;
        pressed = null;
        if (g && !g.fired) tap(p);
      },
    },

    keydown(e) {
      if (e.repeat) return;
      const dir = KEYS[e.code];
      if (dir) {
        usedKeys = true;
        e.preventDefault();
        send(dir);
        return;
      }
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (online) {
          if (race.results) {
            if (race.endT > 0.6) online.backToLobby();
          } else send("up");
          return;
        }
        if (paused) paused = false;
        else if (run.phase === "over" && run.overT > 0.4) restart();
        else if (run.phase !== "over") send("up");
      }
    },

    suspend() {
      // A race goes on without you: nothing to pause online
      if (!online && run.phase === "play") paused = true;
      gesture = null;
      pressed = null;
    },

    dispose() {
      disposed = true;
      offBalance?.();
      unsubscribe?.();
      observer.disconnect();
      probe.remove();
      scene?.dispose();
      scene = null;
      stage.canvas.style.position = "";
      stage.canvas.style.zIndex = "";
      root.style.position = restorePosition;
    },
  };
}
