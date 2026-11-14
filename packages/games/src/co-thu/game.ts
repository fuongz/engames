// The imperative shell of Cờ Thú: menu, play against the computer or a friend
// on the same phone, taps → logic.applyMove → the 3D board and the 2D HUD.
// Online, it only sends "move from→to" or "resign" and draws what the room
// sends back (docs/standards/online-multiplayer.md); it never reports a score.
//
// WebGL hook (kept inside the game, as in qua-duong): the engine's Stage owns a
// 2D canvas that receives pointer input. Our WebGL canvas goes underneath it in
// the same root, the 2D canvas stays transparent for the HUD, and a
// ResizeObserver on the root sizes the WebGL canvas. The loop, pause and
// teardown stay the engine's.
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, inRect } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import { type Search, createSearch } from "./ai";
import {
  AI_DELAY,
  AI_SLICE_MS,
  DIFFICULTIES,
  type Difficulty,
  HOP_TIME,
  JUMP_TIME,
  QUICK_WIN_BONUS,
  QUICK_WIN_MOVES,
  RECONNECT_SECONDS,
  RESULT_DELAY,
  W,
  WIN_SCORE,
} from "./config";
import { type Button, CREAM, INK, INK_SOFT, LEAF, SAND, button, chip, fitSize, panel, sideColor, sideDark, text, wrap } from "./hud";
import {
  BLUE,
  ELEPHANT,
  type Move,
  RED,
  RAT,
  type Side,
  type State,
  applyMove,
  initialState,
  isJump,
  isLegal,
  lostPieces,
  movesFrom,
  positionKey,
  sideOf,
} from "./logic";
import { type Match, type MatchEvent, type OverReason, createMatch, parseMatch } from "./match";
import { redOf, turnOf } from "./online";
import { Board3D, type Target } from "./scene";
import { STRINGS } from "./strings";

type Mode = "ai" | "hot" | "online";
type Tally = Record<Difficulty, { w: number; l: number }>;

interface SavedRun {
  mode: Mode;
  level: Difficulty;
  human: Side;
  moves: [number, number][];
}

function parseRun(raw: unknown): SavedRun | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<SavedRun>;
  if ((r.mode !== "ai" && r.mode !== "hot") || !DIFFICULTIES.includes(r.level as Difficulty)) return null;
  if ((r.human !== RED && r.human !== BLUE) || !Array.isArray(r.moves)) return null;
  return r as SavedRun;
}

const TAP_SLOP = 12;

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx, root } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const online = rt.game.online ?? null;

  // ---------------------------------------------------------------- the WebGL layer
  let board3d: Board3D | null = null;
  try {
    board3d = new Board3D();
  } catch {
    board3d = null;
  }
  const restorePosition = root.style.position;
  if (getComputedStyle(root).position === "static") root.style.position = "relative";
  stage.canvas.style.position = "relative";
  stage.canvas.style.zIndex = "1";
  if (board3d) root.insertBefore(board3d.canvas, stage.canvas);

  // env(safe-area-inset-*) read through a hidden probe, re-read on every resize
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  root.appendChild(probe);
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let sceneKey = "";
  const measure = () => {
    const cs = getComputedStyle(probe);
    insets.top = Number.parseFloat(cs.paddingTop) || 0;
    insets.right = Number.parseFloat(cs.paddingRight) || 0;
    insets.bottom = Number.parseFloat(cs.paddingBottom) || 0;
    insets.left = Number.parseFloat(cs.paddingLeft) || 0;
    sceneKey = ""; // re-fit the board on the next frame
  };
  const observer = new ResizeObserver(measure);
  observer.observe(root);
  measure();

  /** CSS pixels per logical unit. */
  const cssScale = () => (stage.view.w > 0 ? root.clientWidth / stage.view.w : 1);

  /** The visible stage area minus the safe-area insets, in logical units. */
  function safeArea(): Rect {
    const v = stage.view;
    const k = 1 / cssScale();
    return {
      x: v.x + insets.left * k,
      y: v.y + insets.top * k,
      w: v.w - (insets.left + insets.right) * k,
      h: v.h - (insets.top + insets.bottom) * k,
    };
  }

  // ---------------------------------------------------------------- state
  let mode: Mode = "ai";
  const savedLevel = storage.get<Difficulty>("level", "normal");
  let level: Difficulty = DIFFICULTIES.includes(savedLevel) ? savedLevel : "normal";
  const savedSide = storage.get<number>("side", RED);
  let human: Side = savedSide === BLUE ? BLUE : RED;
  /** The side picked in the menu for the next game against the computer. */
  let pickSide: Side = human;
  let game: State = initialState();
  let moves: Move[] = [];
  /** A stable id per piece, by square (-1 empty), so the 3D board can animate it. */
  let ids: number[] = [];
  let selected: number | null = null;
  let targets: Target[] = [];
  let search: Search | null = null;
  let searchDone = false;
  let searchAt = 0;
  let seed = (Date.now() ^ 0x5eed) >>> 0;
  let reported = false;
  let decidedAt = 0;
  let viewSide: Side = RED;
  let overlay: "menu" | "legend" | null = online ? null : "menu";
  let legendFrom: "menu" | null = null;
  let now = 0;
  const tally: Tally = {
    easy: { w: 0, l: 0 },
    normal: { w: 0, l: 0 },
    hard: { w: 0, l: 0 },
    ...storage.get<Partial<Tally>>("tally", {}),
  };
  const hotWins: Record<Side, number> = { 1: 0, [-1]: 0 } as Record<Side, number>;

  const resetIds = () => {
    ids = game.board.map((p, s) => (p !== 0 ? s : -1));
  };

  function save() {
    if (online) return;
    storage.set(
      "run",
      game.result === null && moves.length > 0 ? ({ mode, level, human, moves: moves.map((m) => [m.from, m.to]) } satisfies SavedRun) : null,
    );
  }

  const saved = online ? null : parseRun(storage.get<unknown>("run", null));
  if (saved) {
    mode = saved.mode;
    level = saved.level;
    human = saved.human;
    pickSide = human;
    resetIds();
    for (const [from, to] of saved.moves) {
      const m = { from, to };
      if (!isLegal(game, m)) break;
      ids[to] = ids[from];
      ids[from] = -1;
      game = applyMove(game, m);
      moves.push(m);
    }
    if (game.result === null && moves.length > 0) overlay = null;
    else {
      game = initialState();
      moves = [];
    }
  }
  if (ids.length === 0 || moves.length === 0) resetIds();

  // ---------------------------------------------------------------- online state
  const me = online ? online.seat : -1;
  let match: Match | null = online
    ? createMatch(
        online.seed,
        online.seats.map((s) => s.name),
        redOf(online.settings),
        turnOf(online.settings),
      )
    : null;
  let results: SeatResult[] | null = null;
  /** Seconds since our move went out, while the room hasn't played it yet. */
  let pending: number | null = null;
  let seq = 0;
  let overSeen = false;
  let confirmResign = -1;
  let notice: { text: string; until: number } | null = null;
  if (online && match) {
    mode = "online";
    human = match.seats[me]?.side ?? RED;
  }

  viewSide = mode === "hot" ? game.turn : human;
  board3d?.setPieces(game.board, ids);
  board3d?.setLastMove(game.last);
  board3d?.setView(viewSide, true);

  // ---------------------------------------------------------------- sound
  const sfx = {
    pick: () => audio.tone({ freq: 760, dur: 0.04, type: "triangle", vol: 0.05 }),
    hop: (delay: number) => audio.tone({ freq: 300, to: 220, dur: 0.07, type: "sine", vol: 0.1, delay }),
    jump: () => {
      audio.tone({ freq: 380, to: 760, dur: 0.22, type: "triangle", vol: 0.06 });
      audio.tone({ freq: 260, to: 200, dur: 0.08, type: "sine", vol: 0.1, delay: JUMP_TIME * 0.95 });
    },
    capture: (delay: number) => {
      audio.tone({ freq: 620, to: 1100, dur: 0.09, type: "square", vol: 0.04, delay });
      audio.tone({ freq: 180, to: 90, dur: 0.18, type: "sawtooth", vol: 0.05, delay });
    },
    win: () => {
      for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) audio.tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.1, delay: i * 0.1 });
    },
    lose: () => {
      for (const [i, f] of [392, 330, 262].entries()) audio.tone({ freq: f, dur: 0.22, type: "sine", vol: 0.08, delay: i * 0.15 });
    },
    nope: () => audio.tone({ freq: 170, dur: 0.08, type: "square", vol: 0.03 }),
  };

  // ---------------------------------------------------------------- flow
  function startGame(m: Mode, lv: Difficulty = level, side: Side = pickSide) {
    mode = m;
    level = lv;
    if (m === "ai") human = side;
    storage.set("level", level);
    storage.set("side", human);
    game = initialState();
    moves = [];
    resetIds();
    select(null);
    search = null;
    reported = false;
    overlay = null;
    seed = (seed * 1103515245 + 12345) >>> 0;
    board3d?.setPieces(game.board, ids);
    board3d?.setLastMove(null);
    viewSide = m === "hot" ? RED : human;
    board3d?.setView(viewSide);
    save();
  }

  function select(s: number | null) {
    selected = s;
    if (s === null) {
      targets = [];
      board3d?.select(null, -1, []);
      return;
    }
    targets = movesFrom(game.board, s).map((m) => ({ sq: m.to, capture: game.board[m.to] !== 0, jump: isJump(m) }));
    board3d?.select(ids[s], s, targets);
  }

  /** Animate `m` on the 3D board and apply it to `game` (offline and online alike). */
  function animate(m: Move) {
    const id = ids[m.from];
    const victim = game.board[m.to] !== 0 ? ids[m.to] : null;
    const jump = isJump(m);
    game = applyMove(game, m);
    moves.push(m);
    ids[m.to] = id;
    ids[m.from] = -1;
    select(null);
    board3d?.move(id, m.to, jump, victim);
    board3d?.setLastMove(m);
    const land = jump ? JUMP_TIME : HOP_TIME;
    if (jump) sfx.jump();
    else sfx.hop(land * 0.9);
    if (victim !== null) sfx.capture(land * 0.8);
  }

  function play(m: Move) {
    animate(m);
    if (game.result) decided(m);
    save();
  }

  const humanMoves = () => (human === RED ? Math.ceil(game.ply / 2) : Math.floor(game.ply / 2));
  const runScore = (n: number) => WIN_SCORE[level] + Math.max(0, QUICK_WIN_MOVES - n) * QUICK_WIN_BONUS[level];

  function decided(last: Move) {
    const r = game.result;
    if (!r || online) return;
    decidedAt = now;
    if (r.reason === "den" && r.winner !== 0) board3d?.celebrate(last.to, r.winner);
    if (mode === "hot") {
      if (r.winner !== 0) hotWins[r.winner]++;
      sfx.win();
      return;
    }
    if (r.winner === human) {
      sfx.win();
      tally[level].w++;
      if (!reported) {
        reported = true;
        const n = humanMoves();
        reportScore?.({ score: runScore(n), detail: tr().detail(level, n) });
      }
      const best = [...DIFFICULTIES].reverse().find((d) => tally[d].w > 0) ?? level;
      storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(best, tally[best].w), en: STRINGS.en.summary(best, tally[best].w) });
    } else if (r.winner !== 0) {
      sfx.lose();
      tally[level].l++;
    } else sfx.win();
    storage.set("tally", tally);
  }

  // ---------------------------------------------------------------- online flow
  const nameOfSeat = (seat: number) => (seat === me ? tr().you : (match?.seats[seat]?.name ?? ""));
  const seatOfSide = (side: Side) => (match ? (match.seats[0].side === side ? 0 : 1) : -1);

  /** Take the room's board as is (first snapshot, reconnect, or a missed move). */
  function adopt(state: State) {
    game = { ...state, board: state.board.slice(), keys: [positionKey(state.board, state.turn)] };
    resetIds();
    select(null);
    board3d?.setPieces(game.board, ids);
    board3d?.setLastMove(game.last);
  }

  function onOver(winner: number | null) {
    if (overSeen) return;
    overSeen = true;
    decidedAt = now;
    pending = null;
    confirmResign = -1;
    select(null);
    const last = game.last;
    if (match?.reason === "den" && winner !== null && last) board3d?.celebrate(last.to, match.seats[winner].side);
    if (winner === null || winner === me) sfx.win();
    else sfx.lose();
  }

  function onEvent(e: MatchEvent) {
    if (!match) return;
    if (e.type === "move") {
      const m = { from: e.from, to: e.to };
      if (e.side === game.turn && isLegal(game, m)) animate(m);
      if (e.side === human) pending = null;
      if (e.auto) notice = { text: tr().autoMoved(nameOfSeat(seatOfSide(e.side))), until: now + 2.6 };
      if (selected !== null && game.board[selected] === 0) select(null);
    } else {
      match.phase = "over";
      match.winner = e.winner;
      match.reason = e.reason;
      onOver(e.winner);
    }
  }

  const stopListening = online?.onMessage((msg) => {
    if (msg.t === "snap") {
      const next = parseMatch(msg.state);
      if (!next) return;
      match = { ...next, events: [] };
      // A snapshot can trail the events by a tick: never step back
      const ahead = next.game.ply > game.ply;
      const differs = next.game.ply === game.ply && next.game.board.some((p, i) => p !== game.board[i]);
      if (ahead || differs) adopt(next.game);
      if (next.phase === "over") onOver(next.winner);
    } else if (msg.t === "ev") {
      for (const e of msg.events as MatchEvent[]) onEvent(e);
    } else if (msg.t === "end") {
      results = msg.results;
    }
  });

  function send(action: Record<string, unknown>) {
    online?.send({ seq: ++seq, move: { x: 0, y: 0 }, actions: [action] });
  }

  function sendMove(m: Move) {
    pending = 0;
    select(null);
    sfx.pick();
    send({ type: "move", from: m.from, to: m.to });
  }

  const onlineLive = () => match !== null && match.phase === "play";
  const humanToMove = () => mode === "hot" || game.turn === human;
  const canAct = () =>
    !overlay && !game.result && humanToMove() && !(board3d?.busy() ?? false) && (!online || (onlineLive() && pending === null));

  function tapSquare(s: number) {
    if (!canAct()) return;
    const p = game.board[s];
    if (p !== 0 && sideOf(p) === game.turn) {
      if (selected === s) select(null);
      else {
        select(s);
        sfx.pick();
        if (targets.length === 0) sfx.nope();
      }
      return;
    }
    if (selected !== null) {
      const t = targets.find((x) => x.sq === s);
      if (t) {
        if (online) sendMove({ from: selected, to: s });
        else play({ from: selected, to: s });
      }
      else select(null);
    }
  }

  // ---------------------------------------------------------------- layout (shared by draw and tap)
  interface Layout {
    sa: Rect;
    land: boolean;
    cards: Rect[];
    status: { x: number; y: number; w: number };
    buttons: Button[];
    /** The free area for the board, logical units. */
    board: Rect;
  }

  function layout(): Layout {
    const t = tr();
    const sa = safeArea();
    const land = sa.w > sa.h * 1.1;
    const cards: Rect[] = [];
    let status: Layout["status"];
    const buttons: Button[] = [];
    let board: Rect;
    if (!land) {
      const cw = Math.min(sa.w, 600) - 24;
      const x0 = sa.x + (sa.w - cw) / 2;
      const w = (cw - 12) / 2;
      cards.push({ x: x0, y: sa.y + 10, w, h: 96 }, { x: x0 + w + 12, y: sa.y + 10, w, h: 96 });
      status = { x: sa.x + sa.w / 2, y: sa.y + 130, w: cw };
      const by = sa.y + sa.h - 66;
      const small = 64;
      const bw = (cw - small - 24) / 2;
      buttons.push({ id: "legend", rect: { x: x0, y: by, w: small, h: 56 }, label: "?", fill: SAND, ink: INK });
      if (online) {
        if (onlineLive()) buttons.push(resignButton({ x: x0 + small + 12, y: by, w: cw - small - 12, h: 56 }));
      } else
        buttons.push(
          { id: "new", rect: { x: x0 + small + 12, y: by, w: bw, h: 56 }, label: t.newGame, fill: LEAF },
          { id: "menu", rect: { x: x0 + small + 24 + bw, y: by, w: bw, h: 56 }, label: t.menu, fill: "#5fa8d8" },
        );
      board = { x: sa.x, y: sa.y + 150, w: sa.w, h: by - 8 - (sa.y + 150) };
    } else {
      const cw = clamp(sa.w * 0.26, 200, 280);
      const x0 = sa.x + 14;
      cards.push({ x: x0, y: sa.y + 14, w: cw, h: 96 }, { x: x0, y: sa.y + 122, w: cw, h: 96 });
      status = { x: x0 + cw / 2, y: sa.y + 244, w: cw };
      const bh = 52;
      const by = sa.y + sa.h - 14 - bh * 3 - 20;
      buttons.push({ id: "legend", rect: { x: x0, y: by, w: cw, h: bh }, label: t.legend, fill: SAND, ink: INK });
      if (online) {
        if (onlineLive()) buttons.push(resignButton({ x: x0, y: by + bh + 10, w: cw, h: bh }));
      } else
        buttons.push(
          { id: "new", rect: { x: x0, y: by + bh + 10, w: cw, h: bh }, label: t.newGame, fill: LEAF },
          { id: "menu", rect: { x: x0, y: by + (bh + 10) * 2, w: cw, h: bh }, label: t.menu, fill: "#5fa8d8" },
        );
      board = { x: x0 + cw + 10, y: sa.y + 6, w: sa.x + sa.w - (x0 + cw + 10), h: sa.h - 12 };
    }
    return { sa, land, cards, status, buttons, board };
  }

  function resignButton(rect: Rect): Button {
    const sure = now < confirmResign;
    return { id: "resign", rect, label: sure ? tr().resignSure : tr().resign, fill: sure ? "#e2483d" : "#c9875a", on: sure };
  }

  /** Tell the 3D board which screen band is free, when it changes. */
  function fitScene(l: Layout) {
    if (!board3d) return;
    const v = stage.view;
    const k = cssScale();
    const w = root.clientWidth;
    const h = root.clientHeight;
    const frame = {
      top: Math.max(0, (l.board.y - v.y) * k),
      bottom: Math.max(0, (v.y + v.h - (l.board.y + l.board.h)) * k),
      left: Math.max(0, (l.board.x - v.x) * k),
      right: Math.max(0, (v.x + v.w - (l.board.x + l.board.w)) * k),
    };
    const key = `${w}x${h}:${Math.round(frame.top)},${Math.round(frame.bottom)},${Math.round(frame.left)},${Math.round(frame.right)}`;
    if (key === sceneKey) return;
    sceneKey = key;
    board3d.resize(w, h, window.devicePixelRatio, frame);
  }

  // Menu
  function menuRect(): Rect {
    const sa = safeArea();
    const w = Math.min(470, sa.w - 28);
    const h = 600;
    return { x: sa.x + (sa.w - w) / 2, y: sa.y + Math.max(10, (sa.h - h) / 2), w, h };
  }
  function menuButtons(): Button[] {
    const t = tr();
    const r = menuRect();
    const x = r.x + 24;
    const w = r.w - 48;
    const half = (w - 12) / 2;
    const third = (w - 24) / 3;
    const list: Button[] = [
      { id: "side:red", rect: { x, y: r.y + 214, w: half, h: 50 }, label: t.red, fill: sideColor(RED), on: pickSide === RED },
      { id: "side:blue", rect: { x: x + half + 12, y: r.y + 214, w: half, h: 50 }, label: t.blue, fill: sideColor(BLUE), on: pickSide === BLUE },
    ];
    DIFFICULTIES.forEach((d, i) => {
      list.push({
        id: `ai:${d}`,
        rect: { x: x + i * (third + 12), y: r.y + 282, w: third, h: 64 },
        label: t.level[d],
        fill: d === "easy" ? "#8fd16a" : d === "normal" ? "#f0b545" : "#e2704a",
      });
    });
    list.push({ id: "hot", rect: { x, y: r.y + 410, w, h: 62 }, label: t.hotseat, fill: "#5fa8d8" });
    list.push({ id: "legend", rect: { x: x + w / 4, y: r.y + r.h - 74, w: w / 2, h: 52 }, label: t.legend, fill: SAND, ink: INK });
    return list;
  }
  const canResume = () => game.result === null && moves.length > 0;
  const closeRect = (): Rect => {
    const r = menuRect();
    return { x: r.x + r.w - 54, y: r.y + 10, w: 44, h: 44 };
  };

  // Legend
  function legendLayout() {
    const t = tr();
    const sa = safeArea();
    const w = Math.min(500, sa.w - 24);
    let size = 19;
    let lines: string[][] = [];
    let h = 0;
    for (; size >= 14; size--) {
      lines = t.legendRules.map((l) => wrap(ctx, l, size, w - 70));
      const rulesH = lines.reduce((a, ls) => a + ls.length * (size + 6) + 8, 0);
      h = 60 + 30 + 4 * 42 + 20 + rulesH + 84;
      if (h <= sa.h - 20) break;
    }
    const r: Rect = { x: sa.x + (sa.w - w) / 2, y: sa.y + Math.max(10, (sa.h - h) / 2), w, h };
    const close: Button = { id: "close", rect: { x: r.x + r.w / 2 - 100, y: r.y + r.h - 70, w: 200, h: 54 }, label: t.close };
    return { r, size, lines, close };
  }

  // Result card, centred on the board's free area
  function resultRect(): Rect {
    const l = layout();
    const w = Math.min(440, l.board.w - 24);
    const h = 200;
    return { x: l.board.x + (l.board.w - w) / 2, y: l.board.y + l.board.h / 2 - h / 2 + (l.land ? 0 : 40), w, h };
  }
  function resultButtons(): Button[] {
    const t = tr();
    const r = resultRect();
    if (online) return [{ id: "lobby", rect: { x: r.x + r.w / 2 - 120, y: r.y + r.h - 72, w: 240, h: 54 }, label: t.backToLobby, fill: LEAF }];
    const bw = (r.w - 60) / 2;
    return [
      { id: "again", rect: { x: r.x + 20, y: r.y + r.h - 72, w: bw, h: 54 }, label: t.again, fill: LEAF },
      { id: "menu", rect: { x: r.x + 40 + bw, y: r.y + r.h - 72, w: bw, h: 54 }, label: t.menu, fill: "#5fa8d8" },
    ];
  }
  const showResult = () => (online ? overSeen : game.result !== null) && overlay === null && now - decidedAt > RESULT_DELAY;

  // ---------------------------------------------------------------- input
  function tap(p: { x: number; y: number }) {
    if (overlay === "legend") {
      const { r, close } = legendLayout();
      if (inRect(p, close.rect) || !inRect(p, r)) {
        sfx.pick();
        overlay = legendFrom;
      }
      return;
    }
    if (overlay === "menu") {
      if (canResume() && inRect(p, closeRect())) {
        sfx.pick();
        overlay = null;
        return;
      }
      const b = menuButtons().find((x) => inRect(p, x.rect));
      if (!b) return;
      sfx.pick();
      if (b.id === "side:red") pickSide = RED;
      else if (b.id === "side:blue") pickSide = BLUE;
      else if (b.id === "legend") {
        legendFrom = "menu";
        overlay = "legend";
      } else if (b.id === "hot") startGame("hot");
      else if (b.id.startsWith("ai:")) startGame("ai", b.id.slice(3) as Difficulty, pickSide);
      return;
    }
    if (showResult()) {
      const b = resultButtons().find((x) => inRect(p, x.rect));
      if (b) {
        sfx.pick();
        if (b.id === "lobby") online?.backToLobby();
        else if (b.id === "again") startGame(mode, level, human);
        else {
          pickSide = human;
          overlay = "menu";
        }
        return;
      }
    }
    const b = layout().buttons.find((x) => inRect(p, x.rect));
    if (b) {
      sfx.pick();
      if (b.id === "legend") {
        legendFrom = null;
        overlay = "legend";
      } else if (b.id === "resign") {
        if (now < confirmResign) {
          confirmResign = -1;
          send({ type: "resign" });
        } else confirmResign = now + 3;
      } else if (b.id === "new") startGame(mode, level, human);
      else if (b.id === "menu") {
        pickSide = human;
        overlay = "menu";
      }
      return;
    }
    if (!board3d || game.result) return;
    const v = stage.view;
    const k = cssScale();
    const s = board3d.pick((p.x - v.x) * k, (p.y - v.y) * k, targets.map((t) => t.sq));
    if (s >= 0) tapSquare(s);
    else if (selected !== null) select(null);
  }

  let press: { id: number; x: number; y: number; moved: boolean } | null = null;
  const pointer = {
    down(p: PointerInfo) {
      if (!press) press = { id: p.id, x: p.x, y: p.y, moved: false };
    },
    move(p: PointerInfo) {
      if (press && press.id === p.id && Math.hypot(p.x - press.x, p.y - press.y) > TAP_SLOP) press.moved = true;
    },
    up(p: PointerInfo) {
      if (!press || press.id !== p.id) return;
      const ok = !press.moved;
      press = null;
      if (ok) tap(p);
    },
  };

  // ---------------------------------------------------------------- update
  function update(dt: number) {
    now += dt;
    if (online) {
      if (match?.phase === "play" && match.turn > 0) match.clock = Math.max(0, match.clock - dt);
      // A move the room never played (it was stale): let the player try again
      if (pending !== null) {
        pending += dt;
        if (pending > 2.5) pending = null;
      }
      for (const s of match?.seats ?? []) if (s.away !== null) s.away += dt;
      return;
    }
    if (overlay || game.result) return;
    const busy = board3d?.busy() ?? false;
    // Hot-seat: once the hop lands, turn the board to the side to move
    if (mode === "hot" && !busy && viewSide !== game.turn) {
      viewSide = game.turn;
      board3d?.setView(viewSide);
      return;
    }
    if (mode !== "ai" || game.turn === human) return;
    if (!search) {
      search = createSearch(game, level, (seed + game.ply * 7919) >>> 0);
      searchDone = false;
      searchAt = now;
    }
    // Search a few root moves per frame so the board keeps animating
    const t0 = performance.now();
    while (!searchDone && performance.now() - t0 < AI_SLICE_MS) searchDone = search.step();
    if (searchDone && !busy && now - searchAt >= AI_DELAY) {
      const m = search.move;
      search = null;
      if (m && isLegal(game, m)) play(m);
    }
  }

  // ---------------------------------------------------------------- render
  function drawCards(l: Layout) {
    const t = tr();
    const sides: Side[] = [RED, BLUE];
    sides.forEach((side, i) => {
      const r = l.cards[i];
      const active = !game.result && !overlay && game.turn === side;
      const lift = active ? 3 : 0;
      const rr = { ...r, y: r.y - lift };
      panel(ctx, rr, CREAM, active ? "#f2c230" : "rgba(63,127,52,0.6)", 18);
      if (active) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(255,226,80,0.8)";
        ctx.beginPath();
        ctx.roundRect(rr.x - 3, rr.y - 3, rr.w + 6, rr.h + 6, 21);
        ctx.stroke();
      }
      // The side's colour as a band on the left edge
      ctx.fillStyle = sideColor(side);
      ctx.beginPath();
      ctx.roundRect(rr.x + 8, rr.y + 10, 10, rr.h - 20, 5);
      ctx.fill();
      let name: string;
      let sub: string;
      if (online && match) {
        const seat = seatOfSide(side);
        name = nameOfSeat(seat);
        sub = t.side(side === RED);
        if (active && match.turn > 0) sub = `${sub}, ${Math.ceil(match.clock)}s`;
      } else if (mode === "hot") {
        name = t.side(side === RED);
        sub = t.wins(hotWins[side]);
      } else if (side === human) {
        name = t.you;
        sub = t.side(side === RED);
      } else {
        name = t.ai(level);
        sub = t.side(side === RED);
      }
      text(ctx, name, rr.x + 28, rr.y + 26, fitSize(ctx, name, 22, rr.w - 40, 800), sideDark(side), "left", 800);
      text(ctx, sub, rr.x + 28, rr.y + 50, fitSize(ctx, sub, 16, rr.w - 40, 600), INK_SOFT, "left", 600);
      // The enemy animals this side has taken
      const taken = lostPieces(game.board, (-side) as Side);
      const cr = Math.min(11, (rr.w - 40) / 8 / 2 - 1);
      taken.forEach((rank, k) => {
        chip(ctx, rr.x + 28 + cr + k * (cr * 2 + 2), rr.y + 76, cr, (-side) as Side, rank);
      });
    });
  }

  function statusLine(): string {
    const t = tr();
    if (online && match) {
      if (notice && now < notice.until) return notice.text;
      const gone = match.seats.findIndex((s, i) => i !== me && s.away !== null);
      if (gone >= 0 && match.phase === "play") {
        const left = Math.max(0, Math.ceil(RECONNECT_SECONDS - (match.seats[gone].away ?? 0)));
        return t.awayLine(nameOfSeat(gone), left);
      }
      if (match.phase === "over") return overLine(match.winner, match.reason);
      if (game.turn !== human) return t.waitingFor(nameOfSeat(seatOfSide(game.turn)));
      return `${t.yourTurn}: ${selected !== null ? t.tapTarget : t.tapPiece}`;
    }
    if (game.result) return t.reason[game.result.reason];
    if (mode === "ai" && game.turn !== human) return t.aiThinking;
    const prefix = mode === "hot" ? t.turnOf(t.side(game.turn === RED)) : t.yourTurn;
    return `${prefix}: ${selected !== null ? t.tapTarget : t.tapPiece}`;
  }

  function drawStatus(l: Layout) {
    const s = statusLine();
    const size = fitSize(ctx, s, 20, l.status.w - 20, 700);
    ctx.font = `700 ${size}px "Baloo 2", system-ui, sans-serif`;
    const w = Math.min(l.status.w, ctx.measureText(s).width + 32);
    ctx.fillStyle = "rgba(255,248,230,0.88)";
    ctx.beginPath();
    ctx.roundRect(l.status.x - w / 2, l.status.y - 17, w, 34, 17);
    ctx.fill();
    text(ctx, s, l.status.x, l.status.y + 1, size, INK, "center", 700);
  }

  function dim() {
    ctx.fillStyle = "rgba(15,40,25,0.42)";
    const v = stage.view;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function drawMenu() {
    dim();
    const t = tr();
    const r = menuRect();
    panel(ctx, r);
    text(ctx, t.title, r.x + r.w / 2, r.y + 60, fitSize(ctx, t.title, 52, r.w - 110, 800), "#2f6b2a", "center", 800);
    text(ctx, t.subtitle, r.x + r.w / 2, r.y + 108, fitSize(ctx, t.subtitle, 19, r.w - 40, 600), INK_SOFT, "center", 600);
    text(ctx, t.vsAi, r.x + r.w / 2, r.y + 160, 25, INK, "center", 800);
    text(ctx, t.playAs, r.x + r.w / 2, r.y + 194, 17, INK_SOFT, "center", 600);
    const list = menuButtons();
    for (const b of list) button(ctx, b);
    for (const d of DIFFICULTIES) {
      const b = list.find((x) => x.id === `ai:${d}`);
      if (b && tally[d].w > 0) text(ctx, `✓ ${tally[d].w}`, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h + 16, 15, INK_SOFT, "center", 700);
    }
    text(ctx, t.redFirst, r.x + r.w / 2, r.y + 380, 16, INK_SOFT, "center", 600);
    text(ctx, t.hotseatHint, r.x + r.w / 2, r.y + 492, fitSize(ctx, t.hotseatHint, 16, r.w - 40, 600), INK_SOFT, "center", 600);
    if (canResume()) {
      const c = closeRect();
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      ctx.strokeStyle = INK_SOFT;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 10);
      ctx.lineTo(cx + 10, cy + 10);
      ctx.moveTo(cx + 10, cy - 10);
      ctx.lineTo(cx - 10, cy + 10);
      ctx.stroke();
    }
  }

  function drawLegend() {
    dim();
    const t = tr();
    const { r, size, lines, close } = legendLayout();
    panel(ctx, r);
    text(ctx, t.legend, r.x + r.w / 2, r.y + 36, 28, "#2f6b2a", "center", 800);
    text(ctx, t.legendRanks, r.x + r.w / 2, r.y + 72, fitSize(ctx, t.legendRanks, 17, r.w - 40, 600), INK_SOFT, "center", 600);
    // Ranks 8..1 in two columns
    const colW = (r.w - 48) / 2;
    for (let i = 0; i < 8; i++) {
      const rank = ELEPHANT - i;
      const col = i < 4 ? 0 : 1;
      const row = i % 4;
      const x = r.x + 24 + col * colW;
      const y = r.y + 108 + row * 42;
      chip(ctx, x + 16, y, 15, i % 2 === 0 ? RED : BLUE, rank);
      const name = t.animals[rank];
      const note = rank === RAT ? ` (> ${t.animals[ELEPHANT]})` : "";
      const label = `${name}${note}`;
      text(ctx, label, x + 40, y + 1, fitSize(ctx, label, 20, colW - 50, 700), INK, "left", 700);
    }
    let y = r.y + 108 + 4 * 42 + 10;
    for (const ls of lines) {
      ctx.fillStyle = "#5aa83c";
      ctx.beginPath();
      ctx.arc(r.x + 32, y + size / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      for (const line of ls) {
        text(ctx, line, r.x + 46, y + size / 2, size, INK, "left", 600);
        y += size + 6;
      }
      y += 8;
    }
    button(ctx, close);
  }

  /** Why an online match ended, naming whoever lost it. */
  function overLine(winner: number | null, reason: OverReason | null): string {
    const t = tr();
    const loser = winner === null ? "" : nameOfSeat(1 - winner);
    if (reason === "resign") return t.resigned(loser);
    if (reason === "timeout") return t.timedOut(loser);
    if (reason === "away") return t.left(loser);
    return t.reason[reason ?? "den"];
  }

  function drawOnlineResult() {
    const t = tr();
    if (!match) return;
    const k = clamp((now - decidedAt - RESULT_DELAY) / 0.25, 0, 1);
    const rect = resultRect();
    const w = match.winner;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 24);
    const winSide = w === null ? null : match.seats[w].side;
    panel(ctx, rect, CREAM, winSide === null ? "#3f7f34" : sideDark(winSide));
    const title = w === null ? t.draw : w === me ? t.youWin : t.winOf(nameOfSeat(w));
    let line = overLine(w, match.reason);
    const mine = results?.find((x) => x.seat === me);
    if (mine && mine.score > 0) line = `${line}, ${mine.score}`;
    const color = winSide === null ? INK : sideDark(winSide);
    text(ctx, title, rect.x + rect.w / 2, rect.y + 42, fitSize(ctx, title, 36, rect.w - 40, 800), color, "center", 800);
    text(ctx, line, rect.x + rect.w / 2, rect.y + 86, fitSize(ctx, line, 19, rect.w - 36, 600), INK_SOFT, "center", 600);
    for (const b of resultButtons()) button(ctx, b);
    ctx.restore();
  }

  function drawResult() {
    const t = tr();
    if (online) return drawOnlineResult();
    const r = game.result;
    if (!r) return;
    const k = clamp((now - decidedAt - RESULT_DELAY) / 0.25, 0, 1);
    const rect = resultRect();
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 24);
    panel(ctx, rect, CREAM, r.winner === 0 ? "#3f7f34" : sideDark(r.winner));
    let title: string;
    let line: string;
    if (r.winner === 0) {
      title = t.draw;
      line = t.reason[r.reason];
    } else if (mode === "hot") {
      title = t.winOf(t.side(r.winner === RED));
      line = t.reason[r.reason];
    } else if (r.winner === human) {
      title = t.youWin;
      const n = humanMoves();
      line = `${t.reason[r.reason]}, ${t.winLine(n, runScore(n))}`;
    } else {
      title = t.youLose;
      line = t.loseLine;
    }
    const color = r.winner === 0 ? INK : sideDark(r.winner);
    text(ctx, title, rect.x + rect.w / 2, rect.y + 42, fitSize(ctx, title, 36, rect.w - 40, 800), color, "center", 800);
    text(ctx, line, rect.x + rect.w / 2, rect.y + 86, fitSize(ctx, line, 19, rect.w - 36, 600), INK_SOFT, "center", 600);
    for (const b of resultButtons()) button(ctx, b);
    ctx.restore();
  }

  let lastRender = performance.now();
  function render() {
    const nowMs = performance.now();
    const dt = Math.min(0.05, (nowMs - lastRender) / 1000);
    lastRender = nowMs;
    const l = layout();
    fitScene(l);
    board3d?.render(dt);
    stage.begin();
    if (!board3d) {
      const v = stage.view;
      ctx.fillStyle = "#bfe8d8";
      ctx.fillRect(v.x, v.y, v.w, v.h);
      const s = tr().noWebgl;
      text(ctx, s, W / 2, l.board.y + l.board.h / 2, fitSize(ctx, s, 20, W - 40, 700), INK, "center", 700);
    }
    drawCards(l);
    if (showResult()) drawResult();
    else drawStatus(l);
    for (const b of l.buttons) button(ctx, b);
    if (overlay === "menu") drawMenu();
    else if (overlay === "legend") drawLegend();
    stage.end();
  }

  return {
    update,
    render,
    pointer,
    keydown(e) {
      if (online && e.code === "Escape") {
        if (overlay === "legend") overlay = null;
      } else if (e.code === "Escape") {
        if (overlay === "legend") overlay = legendFrom;
        else if (overlay === "menu" && canResume()) overlay = null;
        else if (!overlay) {
          pickSide = human;
          overlay = "menu";
        }
      } else if (e.code === "KeyH" && overlay !== "menu") {
        legendFrom = null;
        overlay = overlay === "legend" ? null : "legend";
      }
    },
    dispose() {
      save();
      stopListening?.();
      observer.disconnect();
      probe.remove();
      board3d?.dispose();
      board3d = null;
      stage.canvas.style.position = "";
      stage.canvas.style.zIndex = "";
      root.style.position = restorePosition;
    },
  };
}
