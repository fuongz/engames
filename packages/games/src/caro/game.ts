import "@fontsource/baloo-2/800.css";
import "@fontsource/mali/600.css";
import "@fontsource/mali/700.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, inRect, mulberry32 } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import { chooseMove } from "./ai";
import {
  BOARD_PX,
  BUTTON_H,
  BUTTON_Y,
  type Button,
  CELL,
  type Camera,
  FONT,
  INK,
  INK_SOFT,
  NOTE,
  NOTE_BLUE,
  NOTE_PINK,
  PAPER,
  RED,
  STATUS_Y,
  VP,
  cellCenter,
  drawBoard,
  drawButton,
  drawHighlight,
  drawMark,
  drawNote,
  drawPaper,
  drawTitle,
  fitSize,
  markColor,
  text,
} from "./art";
import {
  AI_DELAY,
  DIFFICULTIES,
  type Difficulty,
  QUICK_WIN_BONUS,
  QUICK_WIN_MOVES,
  RECONNECT_SECONDS,
  SIZE,
  TURN_SECONDS,
  UNDOS_PER_GAME,
  W,
  WIN_SCORE,
  winsNeeded,
} from "./config";
import { type Game, type Match, type MatchEvent, type Side, canPlay, createMatch, movesBy, newGame, other, play, seatOf, undo } from "./logic";
import { bestOfOf } from "./online";
import { STRINGS } from "./strings";

// The imperative shell for Caro: menu, play against the computer or a friend
// on the same phone, and the online branch, which only sends "play square N"
// and draws what the room sends back (docs/standards/online-multiplayer.md).

const MAX_ZOOM = 2.6;
const ZOOM_STEP = 2;
const INK_TIME = 0.22;
const TAP_SLOP = 10;
const RESULT_DELAY = 1.1;

type Mode = "ai" | "hot";
type Tally = Record<Difficulty, { w: number; l: number }>;

interface SavedRun {
  mode: Mode;
  level: Difficulty;
  first: Side;
  moves: number[];
  undos: number;
}

function parseRun(raw: unknown): SavedRun | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<SavedRun>;
  if ((r.mode !== "ai" && r.mode !== "hot") || !DIFFICULTIES.includes(r.level as Difficulty)) return null;
  if ((r.first !== 1 && r.first !== 2) || !Array.isArray(r.moves) || typeof r.undos !== "number") return null;
  return r as SavedRun;
}

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const online = rt.game.online ?? null;

  // ---------------------------------------------------------------- offline state

  /** The human plays X against the computer; who opens alternates. */
  const HUMAN: Side = 1;
  let mode: Mode = "ai";
  const savedLevel = storage.get<Difficulty>("level", "normal");
  let level: Difficulty = DIFFICULTIES.includes(savedLevel) ? savedLevel : "normal";
  let first: Side = 1;
  let game: Game = newGame(first);
  let undos = UNDOS_PER_GAME;
  let reported = false;
  const tally: Tally = {
    easy: { w: 0, l: 0 },
    normal: { w: 0, l: 0 },
    hard: { w: 0, l: 0 },
    ...storage.get<Partial<Tally>>("tally", {}),
  };
  /** Hot-seat wins this session, by side. */
  const hotWins = { 1: 0, 2: 0 };
  let overlay: "menu" | "rules" | null = online ? null : "menu";
  let rulesFrom: "menu" | null = null;
  let aiAt: number | null = null;
  const rand = mulberry32((Date.now() ^ 0x5eed) >>> 0);

  const saved = online ? null : parseRun(storage.get<unknown>("run", null));
  if (saved) {
    mode = saved.mode;
    level = saved.level;
    first = saved.first;
    game = newGame(first);
    for (const at of saved.moves) if (!play(game, at)) break;
    undos = saved.undos;
    if (game.result === null && game.moves.length > 0) overlay = null;
  }
  const save = () => {
    if (online) return;
    storage.set("run", game.result === null ? ({ mode, level, first, moves: game.moves, undos } satisfies SavedRun) : null);
  };

  // ---------------------------------------------------------------- online state

  const me = online ? online.seat : -1;
  const mySide: Side | 0 = me === 0 ? 1 : me === 1 ? 2 : 0;
  let match: Match | null = online
    ? createMatch(
        online.seed,
        online.seats.map((s) => s.name),
        bestOfOf(online.settings),
      )
    : null;
  let results: SeatResult[] | null = null;
  let pending: number | null = null;
  let seq = 0;
  let notice: { text: string; until: number } | null = null;

  // ---------------------------------------------------------------- shared view state

  let now = 0;
  /** When each square's mark started inking. */
  const inked = new Map<number, number>();
  let winAt = 0;
  let decidedAt = 0;
  let selected: number | null = null;
  const cam: Camera = { z: 1, ox: 0, oy: 0 };
  let goal: Camera | null = null;

  const current = (): Game => (match ? match.game : game);

  // ---------------------------------------------------------------- camera

  const clampCam = (c: Camera) => {
    c.z = clamp(c.z, 1, MAX_ZOOM);
    const max = BOARD_PX - VP.w / c.z;
    c.ox = clamp(c.ox, 0, max);
    c.oy = clamp(c.oy, 0, max);
    return c;
  };
  /** A camera at zoom `z` centred on board point (fx, fy). */
  const centredOn = (z: number, fx: number, fy: number): Camera => clampCam({ z, ox: fx - VP.w / z / 2, oy: fy - VP.h / z / 2 });
  const squareCentre = (at: number) => ({
    x: ((at % SIZE) + 0.5) * CELL,
    y: (Math.floor(at / SIZE) + 0.5) * CELL,
  });

  function toggleZoom() {
    if (cam.z > 1.05) {
      goal = { z: 1, ox: 0, oy: 0 };
      return;
    }
    const g = current();
    const focus = selected ?? g.moves[g.moves.length - 1] ?? Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2);
    const c = squareCentre(focus);
    goal = centredOn(ZOOM_STEP, c.x, c.y);
  }

  /** Zoomed in and a move lands off screen: glide to it. */
  function follow(at: number) {
    if (cam.z <= 1.05) return;
    const p = cellCenter(cam, at);
    const m = CELL * cam.z;
    if (p.x > VP.x + m && p.x < VP.x + VP.w - m && p.y > VP.y + m && p.y < VP.y + VP.h - m) return;
    const c = squareCentre(at);
    goal = centredOn(cam.z, c.x, c.y);
  }

  function squareAt(p: { x: number; y: number }): number | null {
    if (!inRect(p, VP)) return null;
    const bx = (p.x - VP.x) / cam.z + cam.ox;
    const by = (p.y - VP.y) / cam.z + cam.oy;
    const x = Math.floor(bx / CELL);
    const y = Math.floor(by / CELL);
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE ? y * SIZE + x : null;
  }

  // ---------------------------------------------------------------- sound

  const sfx = {
    pick: () => audio.tone({ freq: 880, dur: 0.03, type: "triangle", vol: 0.04 }),
    place: (side: number) => {
      audio.tone({
        freq: side === 1 ? 520 : 430,
        to: side === 1 ? 470 : 390,
        dur: 0.07,
        type: "triangle",
        vol: 0.09,
      });
      audio.tone({ freq: 2400, dur: 0.02, type: "square", vol: 0.012 });
    },
    win: () => {
      for (const [i, f] of [523, 659, 784, 1047].entries())
        audio.tone({
          freq: f,
          dur: 0.16,
          type: "triangle",
          vol: 0.1,
          delay: i * 0.1,
        });
    },
    lose: () => {
      for (const [i, f] of [392, 330, 262].entries())
        audio.tone({
          freq: f,
          dur: 0.2,
          type: "sine",
          vol: 0.08,
          delay: i * 0.14,
        });
    },
    tick: () => audio.tone({ freq: 1200, dur: 0.02, type: "square", vol: 0.02 }),
    nope: () => audio.tone({ freq: 180, dur: 0.08, type: "square", vol: 0.03 }),
  };

  // ---------------------------------------------------------------- offline flow

  function startGame(m: Mode, lv: Difficulty = level) {
    // A rematch swaps who opens; a new opponent starts with X (you, against the computer)
    first = m === mode && lv === level && game.moves.length > 0 ? other(first) : 1;
    mode = m;
    level = lv;
    storage.set("level", level);
    game = newGame(first);
    undos = UNDOS_PER_GAME;
    reported = false;
    inked.clear();
    selected = null;
    aiAt = null;
    overlay = null;
    goal = { z: 1, ox: 0, oy: 0 };
    save();
  }

  function placeOffline(at: number) {
    if (!play(game, at)) return;
    inked.set(at, now);
    selected = null;
    sfx.place(game.cells[at]);
    follow(at);
    if (game.result !== null) decided();
    save();
  }

  function decided() {
    decidedAt = now;
    winAt = now + INK_TIME;
    const r = game.result;
    if (mode === "hot") {
      if (r === 1 || r === 2) hotWins[r]++;
      sfx.win();
      return;
    }
    if (r === HUMAN) {
      sfx.win();
      tally[level].w++;
      const moves = movesBy(game, HUMAN);
      const score = runScore(moves);
      if (!reported) {
        reported = true;
        reportScore?.({ score, detail: tr().detail(level, moves) });
      }
      // Card summary: the hardest level beaten
      const best = [...DIFFICULTIES].reverse().find((d) => tally[d].w > 0) ?? level;
      storage.set(SUMMARY_KEY, {
        vi: STRINGS.vi.summary(best, tally[best].w),
        en: STRINGS.en.summary(best, tally[best].w),
      });
    } else if (r === other(HUMAN)) {
      sfx.lose();
      tally[level].l++;
    } else sfx.win();
    storage.set("tally", tally);
  }

  /** Against the computer: your turn, a take-back left, and a move of yours to take back. */
  const canUndoAi = () => undos > 0 && game.result === null && game.turn === HUMAN && aiAt === null && movesBy(game, HUMAN) > 0;

  const runScore = (moves: number) => WIN_SCORE[level] + Math.max(0, QUICK_WIN_MOVES - moves) * QUICK_WIN_BONUS[level];

  function takeBack() {
    if (game.result !== null || game.moves.length === 0) return;
    if (mode === "hot") {
      const at = game.moves[game.moves.length - 1];
      undo(game);
      inked.delete(at);
    } else {
      if (!canUndoAi()) return sfx.nope();
      // Back to the human's previous turn: the computer's reply, then their move
      for (let i = 0; i < 2; i++) {
        const at = game.moves[game.moves.length - 1];
        undo(game);
        inked.delete(at);
      }
      undos--;
    }
    selected = null;
    sfx.pick();
    save();
  }

  // ---------------------------------------------------------------- online flow

  function onEvent(e: MatchEvent) {
    if (!match) return;
    switch (e.type) {
      case "place":
        if (match.game.cells[e.at] === 0) {
          match.game.cells[e.at] = e.side;
          match.game.moves.push(e.at);
          match.game.turn = other(e.side);
          match.clock = TURN_SECONDS;
        }
        inked.set(e.at, now);
        if (pending === e.at || e.side === mySide) pending = null;
        if (selected === e.at || e.side === mySide) selected = null;
        sfx.place(e.side);
        follow(e.at);
        if (e.auto && e.side === mySide) notice = { text: tr().timedOut, until: now + 2.5 };
        break;
      case "win":
        match.game.result = e.side;
        match.game.line = e.line;
        decidedAt = now;
        winAt = now + INK_TIME;
        if (e.side === mySide) sfx.win();
        else if (mySide) sfx.lose();
        else sfx.win();
        break;
      case "draw":
        match.game.result = 0;
        decidedAt = now;
        break;
      case "game": {
        inked.clear();
        selected = null;
        pending = null;
        goal = { z: 1, ox: 0, oy: 0 };
        const name = match.seats[seatOf(e.first)]?.name ?? "";
        notice = {
          text: `${tr().gameN(e.n)} · ${tr().firstMove(e.first === mySide ? tr().you : name)}`,
          until: now + 2.4,
        };
        break;
      }
      case "over":
        // A forfeit ends mid-game: show the result card straight away
        if (e.forfeit) decidedAt = now - RESULT_DELAY;
        break;
    }
  }

  const stopListening = online?.onMessage((m) => {
    if (m.t === "snap" && m.state) {
      const next = m.state as Match;
      // A snapshot can trail the events by a tick: keep marks we already inked
      match = next;
      if (pending !== null && (next.game.cells[pending] !== 0 || next.game.turn !== mySide)) pending = null;
    } else if (m.t === "ev") {
      for (const e of m.events as MatchEvent[]) onEvent(e);
    } else if (m.t === "end") {
      results = m.results;
    }
  });

  function myTurnOnline() {
    return match !== null && mySide !== 0 && match.phase === "play" && match.game.result === null && match.game.turn === mySide;
  }

  function sendPlace(at: number) {
    if (!online) return;
    pending = at;
    selected = null;
    online.send({
      seq: ++seq,
      move: { x: 0, y: 0 },
      actions: [{ type: "place", at }],
    });
  }

  // ---------------------------------------------------------------- input

  /** Can the player tap a square right now? */
  function canPick() {
    if (overlay) return false;
    if (online) return myTurnOnline() && pending === null;
    if (game.result !== null) return false;
    return mode === "hot" || (game.turn === HUMAN && aiAt === null);
  }

  function tapSquare(at: number) {
    const g = current();
    if (!canPick()) return;
    if (!canPlay(g, at)) {
      selected = null;
      return;
    }
    if (selected !== at) {
      selected = at;
      sfx.pick();
      return;
    }
    if (online) sendPlace(at);
    else placeOffline(at);
  }

  function buttons(): Button[] {
    const t = tr();
    const zoomed = cam.z > 1.05;
    const zoom: Button = {
      id: "zoom",
      rect: { x: 0, y: 0, w: 0, h: 0 },
      label: zoomed ? t.zoomOut : t.zoomIn,
      icon: zoomed ? "zoom-out" : "zoom-in",
      fill: NOTE_BLUE,
    };
    const list: Button[] = online
      ? [zoom]
      : [
          {
            id: "undo",
            rect: { x: 0, y: 0, w: 0, h: 0 },
            label: t.undo,
            icon: "undo",
            fill: NOTE_PINK,
            disabled: mode === "ai" ? !canUndoAi() : game.result !== null || game.moves.length === 0,
            badge: mode === "ai" ? String(undos) : undefined,
          },
          zoom,
          {
            id: "new",
            rect: { x: 0, y: 0, w: 0, h: 0 },
            label: t.newGame,
            icon: "new",
          },
          {
            id: "menu",
            rect: { x: 0, y: 0, w: 0, h: 0 },
            label: t.menu,
            icon: "menu",
            fill: "#e8f6d8",
          },
        ];
    const gap = 14;
    const w = online ? 150 : (W - 40 - gap * (list.length - 1)) / list.length;
    const total = w * list.length + gap * (list.length - 1);
    list.forEach((b, i) => {
      b.rect = {
        x: (W - total) / 2 + i * (w + gap),
        y: BUTTON_Y,
        w,
        h: BUTTON_H,
      };
    });
    return list;
  }

  function pressButton(id: string) {
    switch (id) {
      case "undo":
        return takeBack();
      case "zoom":
        sfx.pick();
        return toggleZoom();
      case "new":
        sfx.pick();
        return startGame(mode, level);
      case "menu":
        sfx.pick();
        overlay = "menu";
        return;
    }
  }

  // ---------------------------------------------------------------- overlays (layout shared by draw and tap)

  const MENU: Rect = { x: 40, y: 150, w: W - 80, h: 640 };
  function menuButtons(): Button[] {
    const t = tr();
    const x = MENU.x + 30;
    const w = MENU.w - 60;
    const lw = (w - 24) / 3;
    const list: Button[] = DIFFICULTIES.map((d, i) => ({
      id: `ai:${d}`,
      rect: { x: x + i * (lw + 12), y: MENU.y + 250, w: lw, h: 76 },
      label: t.level[d],
      fill: d === "easy" ? "#e8f6d8" : d === "normal" ? NOTE : NOTE_PINK,
    }));
    list.push({
      id: "hot",
      rect: { x, y: MENU.y + 400, w, h: 72 },
      label: t.hotseat,
      fill: NOTE_BLUE,
    });
    list.push({
      id: "rules",
      rect: { x: x + w / 2 - 110, y: MENU.y + 540, w: 220, h: 56 },
      label: t.rules,
      fill: "#f1ece0",
    });
    return list;
  }
  const canResume = () => !online && game.result === null && game.moves.length > 0;
  const CLOSE: Rect = { x: MENU.x + MENU.w - 56, y: MENU.y + 12, w: 44, h: 44 };

  const RULES: Rect = { x: 30, y: 170, w: W - 60, h: 600 };
  const rulesClose = (): Button => ({
    id: "close",
    rect: { x: W / 2 - 100, y: RULES.y + RULES.h - 84, w: 200, h: 60 },
    label: tr().close,
    fill: NOTE,
  });

  /** The result card sits under the board so the winning row stays in view. */
  const RESULT: Rect = { x: 20, y: VP.y + VP.h + 8, w: W - 40, h: 220 };
  function resultButtons(): Button[] {
    const t = tr();
    const y = RESULT.y + RESULT.h - 80;
    if (online)
      return [
        {
          id: "lobby",
          rect: { x: W / 2 - 110, y, w: 220, h: 62 },
          label: t.backToLobby,
          icon: undefined,
          fill: NOTE,
        },
      ];
    return [
      {
        id: "again",
        rect: { x: RESULT.x + 24, y, w: (RESULT.w - 72) / 2, h: 62 },
        label: t.again,
        fill: NOTE,
      },
      {
        id: "menu",
        rect: {
          x: RESULT.x + 48 + (RESULT.w - 72) / 2,
          y,
          w: (RESULT.w - 72) / 2,
          h: 62,
        },
        label: t.menu,
        fill: "#e8f6d8",
      },
    ];
  }
  const showResult = () => {
    if (online) return match?.phase === "over" && now - decidedAt > RESULT_DELAY * 0.6;
    return game.result !== null && overlay === null && now - decidedAt > RESULT_DELAY;
  };

  function tap(p: { x: number; y: number }) {
    if (overlay === "rules") {
      if (inRect(p, rulesClose().rect) || !inRect(p, RULES)) {
        sfx.pick();
        overlay = rulesFrom;
      }
      return;
    }
    if (overlay === "menu") {
      if (canResume() && inRect(p, CLOSE)) {
        sfx.pick();
        overlay = null;
        return;
      }
      const b = menuButtons().find((b) => inRect(p, b.rect));
      if (!b) return;
      sfx.pick();
      if (b.id === "rules") {
        rulesFrom = "menu";
        overlay = "rules";
      } else if (b.id === "hot") startGame("hot");
      else startGame("ai", b.id.slice(3) as Difficulty);
      return;
    }
    if (showResult()) {
      const b = resultButtons().find((b) => inRect(p, b.rect));
      if (b) {
        sfx.pick();
        if (b.id === "lobby") online?.backToLobby();
        else if (b.id === "again") startGame(mode, level);
        else overlay = "menu";
        return;
      }
    }
    const b = buttons().find((b) => inRect(p, b.rect));
    if (b) {
      if (b.disabled) return sfx.nope();
      return pressButton(b.id);
    }
    const at = squareAt(p);
    if (at !== null) tapSquare(at);
  }

  // Pointers: one finger taps or drags the board, two pinch to zoom
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture:
    | { kind: "none" }
    | {
        kind: "tap";
        id: number;
        sx: number;
        sy: number;
        ox: number;
        oy: number;
        moved: boolean;
      }
    | { kind: "pinch"; d0: number; z0: number; fx: number; fy: number } = {
    kind: "none",
  };

  const pinchStart = () => {
    const [a, b] = [...pointers.values()];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    gesture = {
      kind: "pinch",
      d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)),
      z0: cam.z,
      fx: (mx - VP.x) / cam.z + cam.ox,
      fy: (my - VP.y) / cam.z + cam.oy,
    };
  };

  const pointer = {
    down(p: PointerInfo) {
      pointers.set(p.id, { x: p.x, y: p.y });
      goal = null;
      if (pointers.size === 1)
        gesture = {
          kind: "tap",
          id: p.id,
          sx: p.x,
          sy: p.y,
          ox: cam.ox,
          oy: cam.oy,
          moved: false,
        };
      else if (pointers.size === 2 && !overlay) pinchStart();
    },
    move(p: PointerInfo) {
      if (!pointers.has(p.id)) return;
      pointers.set(p.id, { x: p.x, y: p.y });
      if (gesture.kind === "pinch" && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const z = clamp((gesture.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / gesture.d0, 1, MAX_ZOOM);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        cam.z = z;
        cam.ox = gesture.fx - (mx - VP.x) / z;
        cam.oy = gesture.fy - (my - VP.y) / z;
        clampCam(cam);
      } else if (gesture.kind === "tap" && gesture.id === p.id) {
        if (!gesture.moved && Math.hypot(p.x - gesture.sx, p.y - gesture.sy) > TAP_SLOP) gesture.moved = true;
        if (gesture.moved && !overlay && cam.z > 1.01 && inRect({ x: gesture.sx, y: gesture.sy }, VP)) {
          cam.ox = gesture.ox - (p.x - gesture.sx) / cam.z;
          cam.oy = gesture.oy - (p.y - gesture.sy) / cam.z;
          clampCam(cam);
        }
      }
    },
    up(p: PointerInfo) {
      const had = pointers.delete(p.id);
      if (!had) return;
      if (gesture.kind === "tap" && gesture.id === p.id && !gesture.moved) tap(p);
      if (gesture.kind === "pinch" || pointers.size === 0) gesture = { kind: "none" };
    },
  };

  // ---------------------------------------------------------------- update

  function update(dt: number) {
    now += dt;
    if (goal) {
      const k = 1 - Math.exp(-dt * 12);
      cam.z += (goal.z - cam.z) * k;
      cam.ox += (goal.ox - cam.ox) * k;
      cam.oy += (goal.oy - cam.oy) * k;
      if (Math.abs(goal.z - cam.z) < 0.002 && Math.abs(goal.ox - cam.ox) < 0.3 && Math.abs(goal.oy - cam.oy) < 0.3) {
        Object.assign(cam, goal);
        goal = null;
      }
      clampCam(cam);
    }
    if (match) {
      // The room's clock, run down locally between snapshots
      if (match.phase === "play" && match.game.result === null) {
        const before = Math.ceil(match.clock);
        match.clock = Math.max(0, match.clock - dt);
        if (myTurnOnline() && Math.ceil(match.clock) !== before && match.clock <= 5 && match.clock > 0) sfx.tick();
      }
      for (const s of match.seats) if (s.away !== null) s.away += dt;
      return;
    }
    if (overlay || mode !== "ai" || game.result !== null || game.turn === HUMAN) return;
    if (aiAt === null) aiAt = now + AI_DELAY;
    else if (now >= aiAt) {
      aiAt = null;
      const at = chooseMove(game.cells, game.turn, level, rand);
      if (at >= 0) placeOffline(at);
    }
  }

  // ---------------------------------------------------------------- render

  interface Card {
    side: Side;
    name: string;
    sub: string;
    active: boolean;
    clock: number | null;
    away: string | null;
  }

  function cards(): Card[] {
    const t = tr();
    if (match) {
      const g = match.game;
      return match.seats.map((s, i) => ({
        side: s.side,
        name: i === me ? t.you : s.name,
        sub: "",
        active: match?.phase === "play" && g.result === null && g.turn === s.side,
        clock: match?.phase === "play" && g.result === null && g.turn === s.side ? match.clock / TURN_SECONDS : null,
        away: s.away !== null ? t.away(i === me ? t.you : s.name, Math.max(0, Math.ceil(RECONNECT_SECONDS - s.away))) : null,
      }));
    }
    const thinking = game.result === null && overlay === null;
    if (mode === "hot")
      return ([1, 2] as Side[]).map((s) => ({
        side: s,
        name: t.player(s === 1 ? "X" : "O"),
        sub: t.wins(hotWins[s]),
        active: thinking && game.turn === s,
        clock: null,
        away: null,
      }));
    return [
      {
        side: HUMAN,
        name: t.you,
        sub: t.wins(tally[level].w),
        active: thinking && game.turn === HUMAN,
        clock: null,
        away: null,
      },
      {
        side: other(HUMAN),
        name: t.ai(level),
        sub: t.wins(tally[level].l),
        active: thinking && game.turn !== HUMAN,
        clock: null,
        away: null,
      },
    ];
  }

  function drawCards() {
    const list = cards();
    const w = (W - 60) / 2;
    list.forEach((c, i) => {
      const r: Rect = { x: 20 + i * (w + 20), y: 34, w, h: 92 };
      const lift = c.active ? 4 : 0;
      drawNote(ctx, r, c.side === 1 ? NOTE_PINK : NOTE_BLUE, (i === 0 ? -1 : 1) * 0.012, lift);
      const y = r.y - lift;
      drawMark(ctx, c.side, r.x + 44, y + r.h / 2, 58, c.side * 7);
      text(ctx, c.name, r.x + 82, y + 34, fitSize(ctx, c.name, 24, r.w - 96, 700), INK, "left", 700);
      if (match) {
        // Games won, as pips
        const s = match.seats[seatOf(c.side)];
        for (let k = 0; k < winsNeeded(match.bestOf); k++) {
          ctx.beginPath();
          ctx.arc(r.x + 92 + k * 24, y + 66, 8, 0, Math.PI * 2);
          ctx.fillStyle = k < (s?.wins ?? 0) ? markColor(c.side) : "rgba(42,45,56,0.12)";
          ctx.fill();
        }
      } else {
        text(ctx, c.sub, r.x + 82, y + 66, 22, markColor(c.side), "left", 700);
      }
      if (c.active) {
        drawHighlight(
          ctx,
          { x: r.x + 18, y: y + r.h + 10 },
          { x: r.x + r.w - 18, y: y + r.h + 10 },
          8,
          c.clock ?? 1,
          c.clock !== null && c.clock < 0.34 ? "rgba(230,60,50,0.55)" : "rgba(255,200,0,0.75)",
        );
        if (c.clock !== null)
          text(ctx, String(Math.ceil((c.clock ?? 0) * TURN_SECONDS)), r.x + r.w - 26, y + 66, 22, c.clock < 0.34 ? RED : INK_SOFT, "center", 700);
      }
    });
  }

  function drawMarks(g: Game) {
    const size = CELL * cam.z;
    ctx.save();
    ctx.beginPath();
    ctx.rect(VP.x, VP.y, VP.w, VP.h);
    ctx.clip();
    const last = g.moves[g.moves.length - 1];
    if (last !== undefined && g.result === null) {
      const p = cellCenter(cam, last);
      ctx.fillStyle = "rgba(255,226,80,0.45)";
      ctx.fillRect(p.x - size / 2 + 1, p.y - size / 2 + 1, size - 2, size - 2);
    }
    if (g.line && g.line.length > 1) {
      const a = cellCenter(cam, g.line[0]);
      const b = cellCenter(cam, g.line[g.line.length - 1]);
      drawHighlight(ctx, a, b, size * 0.8, clamp((now - winAt) / 0.45, 0, 1));
    }
    for (let at = 0; at < g.cells.length; at++) {
      const side = g.cells[at];
      if (!side) continue;
      const p = cellCenter(cam, at);
      if (p.x < VP.x - size || p.x > VP.x + VP.w + size || p.y < VP.y - size || p.y > VP.y + VP.h + size) continue;
      const t0 = inked.get(at);
      drawMark(ctx, side, p.x, p.y, size, at, t0 === undefined ? 1 : clamp((now - t0) / INK_TIME, 0, 1));
    }
    // The square the player is about to play, faint, with a pencil box
    const ghost = pending ?? selected;
    if (ghost !== null && !g.cells[ghost]) {
      const p = cellCenter(cam, ghost);
      const side = online ? mySide || 1 : g.turn;
      ctx.strokeStyle = markColor(side);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(p.x - size / 2 + 1.5, p.y - size / 2 + 1.5, size - 3, size - 3);
      ctx.setLineDash([]);
      drawMark(ctx, side, p.x, p.y, size, ghost, 1, pending !== null ? 0.7 : 0.35 + 0.15 * Math.sin(now * 6));
    }
    ctx.restore();
  }

  function statusLine(): string {
    const t = tr();
    if (match) {
      if (mySide === 0) return t.watching;
      if (match.phase !== "play" || match.game.result !== null) return "";
      if (match.game.turn === mySide) return selected !== null ? t.tapAgain : t.yourTurn;
      return t.turnOf(match.seats[seatOf(match.game.turn)]?.name ?? "");
    }
    if (game.result !== null) return "";
    if (mode === "ai" && game.turn !== HUMAN) return t.aiThinking;
    if (selected !== null) return t.tapAgain;
    if (mode === "hot") return `${t.turnOf(t.player(game.turn === 1 ? "X" : "O"))} · ${t.tapToPick}`;
    return game.moves.length < 2 ? t.tapToPick : t.yourTurn;
  }

  function drawStatus() {
    const s = statusLine();
    const away = cards().find((c) => c.away)?.away;
    if (away) text(ctx, away, W / 2, STATUS_Y, fitSize(ctx, away, 22, W - 40), RED);
    else if (notice && now < notice.until) text(ctx, notice.text, W / 2, STATUS_Y, fitSize(ctx, notice.text, 24, W - 40, 700), INK, "center", 700);
    else if (s) text(ctx, s, W / 2, STATUS_Y, fitSize(ctx, s, 24, W - 40), INK_SOFT);
    else if (match && match.phase === "play") text(ctx, tr().firstTo(winsNeeded(match.bestOf)), W / 2, STATUS_Y, 20, INK_SOFT);
  }

  function dim() {
    ctx.fillStyle = "rgba(40,30,20,0.35)";
    const v = stage.view;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function drawMenu() {
    dim();
    const t = tr();
    drawNote(ctx, MENU, PAPER, 0, 2);
    drawTitle(ctx, W / 2, MENU.y + 82, 92);
    text(ctx, t.subtitle, W / 2, MENU.y + 150, fitSize(ctx, t.subtitle, 20, MENU.w - 50), INK_SOFT);
    text(ctx, t.vsAi, W / 2, MENU.y + 220, 26, INK, "center", 700);
    const list = menuButtons();
    for (const b of list) drawButton(ctx, b);
    // Wins per level under each level button
    for (const d of DIFFICULTIES) {
      const b = list.find((x) => x.id === `ai:${d}`);
      if (b && tally[d].w > 0) text(ctx, `✓ ${tally[d].w}`, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h + 18, 16, INK_SOFT);
    }
    text(ctx, t.hotseatHint, W / 2, MENU.y + 494, fitSize(ctx, t.hotseatHint, 17, MENU.w - 60), INK_SOFT);
    if (canResume()) {
      ctx.strokeStyle = INK_SOFT;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      const c = { x: CLOSE.x + CLOSE.w / 2, y: CLOSE.y + CLOSE.h / 2 };
      ctx.moveTo(c.x - 10, c.y - 10);
      ctx.lineTo(c.x + 10, c.y + 10);
      ctx.moveTo(c.x + 10, c.y - 10);
      ctx.lineTo(c.x - 10, c.y + 10);
      ctx.stroke();
    }
  }

  function drawRules() {
    dim();
    const t = tr();
    drawNote(ctx, RULES, PAPER, 0, 2);
    text(ctx, t.rules, W / 2, RULES.y + 48, 32, INK, "center", 700);
    ctx.font = `600 20px ${FONT}`;
    let y = RULES.y + 100;
    for (const line of t.rulesLines) {
      // Wrap by words to the card width
      const words = line.split(" ");
      let cur = "";
      const lines: string[] = [];
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(test).width > RULES.w - 80 && cur) {
          lines.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(RULES.x + 34, y, 4, 0, Math.PI * 2);
      ctx.fill();
      for (const l of lines) {
        text(ctx, l, RULES.x + 50, y, 20, INK, "left", 600);
        y += 28;
      }
      y += 10;
    }
    drawButton(ctx, rulesClose());
  }

  function drawResult() {
    const t = tr();
    const k = clamp((now - decidedAt - RESULT_DELAY * (online ? 0.6 : 1)) / 0.25, 0, 1);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 30);
    drawNote(ctx, RESULT, PAPER, 0, 3);
    let title = "";
    let line = "";
    let color = INK;
    if (match) {
      const won = match.winner === me && me >= 0;
      title = match.winner === null ? t.matchDraw : mySide === 0 ? t.winOf(match.seats[match.winner]?.name ?? "") : won ? t.matchWin : t.matchLose;
      if (match.forfeit && mySide !== 0) line = won ? t.forfeitWin : t.forfeitLose;
      const mine = results?.find((r) => r.seat === me);
      if (mine && mine.score > 0) line = line ? `${line} · ${t.score(mine.score)}` : t.score(mine.score);
      if (!line) line = `${match.seats[0]?.wins ?? 0} – ${match.seats[1]?.wins ?? 0}`;
      color = match.winner === null ? INK : markColor(match.seats[match.winner]?.side ?? 1);
    } else {
      const r = game.result;
      if (r === 0) title = t.draw;
      else if (mode === "hot") {
        title = t.winOf(t.player(r === 1 ? "X" : "O"));
        line = `X ${t.tally(hotWins[1], hotWins[2])} O`;
      }
      else if (r === HUMAN) {
        title = t.youWin;
        const moves = movesBy(game, HUMAN);
        line = t.winLine(moves, runScore(moves));
      } else {
        title = t.youLose;
        line = t.loseLine;
      }
      color = r ? markColor(r) : INK;
    }
    text(ctx, title, W / 2, RESULT.y + 44, fitSize(ctx, title, 38, RESULT.w - 40, 700), color, "center", 700);
    if (line) text(ctx, line, W / 2, RESULT.y + 90, fitSize(ctx, line, 21, RESULT.w - 40), INK_SOFT);
    for (const b of resultButtons()) drawButton(ctx, b);
    ctx.restore();
  }

  function drawBetween() {
    if (match?.phase !== "between") return;
    const g = match.game;
    const t = tr();
    const msg = g.result === 0 ? t.draw : t.winOf(g.result === mySide ? t.you : (match.seats[seatOf(g.result as Side)]?.name ?? ""));
    const r: Rect = { x: 60, y: VP.y + VP.h / 2 - 50, w: W - 120, h: 100 };
    ctx.save();
    ctx.globalAlpha = clamp((now - decidedAt - 0.8) / 0.3, 0, 1);
    drawNote(ctx, r, NOTE, -0.02, 3);
    text(ctx, msg, W / 2, r.y + 40, fitSize(ctx, msg, 34, r.w - 30, 700), g.result ? markColor(g.result) : INK, "center", 700);
    text(ctx, `${match.seats[0]?.wins ?? 0} – ${match.seats[1]?.wins ?? 0}`, W / 2, r.y + 76, 20, INK_SOFT);
    ctx.restore();
  }

  function render() {
    stage.begin();
    drawPaper(ctx, stage.view);
    drawCards();
    drawBoard(ctx, cam);
    drawMarks(current());
    drawBetween();
    if (showResult()) drawResult();
    else {
      drawStatus();
      for (const b of buttons()) drawButton(ctx, b);
    }
    if (overlay === "menu") drawMenu();
    else if (overlay === "rules") drawRules();
    stage.end();
  }

  return {
    update,
    render,
    pointer,
    keydown(e) {
      if (e.code === "Escape" && !online) {
        if (overlay === "rules") overlay = rulesFrom;
        else if (overlay === "menu" && canResume()) overlay = null;
        else if (!overlay) overlay = "menu";
      } else if (e.code === "KeyZ") toggleZoom();
      else if (e.code === "KeyU" && !online) takeBack();
    },
    dispose() {
      stopListening?.();
      save();
    },
  };
}
