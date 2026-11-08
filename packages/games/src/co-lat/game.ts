import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/baloo-2/800.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, easeOutCubic, inRect, mulberry32 } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import { chooseMove } from "./ai";
import {
  BOARD,
  BUTTON_H,
  BUTTON_Y,
  type Button,
  CARD_H,
  CARD_Y,
  CELL,
  CREAM,
  FONT,
  GOLD,
  RED,
  SOFT,
  STATUS_Y,
  cellCenter,
  drawBoard,
  drawButton,
  drawDisc,
  drawHint,
  drawLastMarker,
  drawPanel,
  drawTable,
  drawTitle,
  fitSize,
  squareAt,
  text,
  wrap,
} from "./art";
import {
  AI_DELAY,
  CELLS,
  DIFFICULTIES,
  type Difficulty,
  FLIP_STAGGER,
  FLIP_TIME,
  MARGIN_BONUS,
  RECONNECT_SECONDS,
  TURN_SECONDS,
  UNDOS_PER_GAME,
  W,
  WIN_SCORE,
  winsNeeded,
} from "./config";
import {
  type Game,
  type Match,
  type MatchEvent,
  type Side,
  canPlay,
  countDiscs,
  createMatch,
  distance,
  legalMoves,
  newGame,
  other,
  play,
  replay,
  seatOfSide,
  undo,
} from "./logic";
import { bestOfOf } from "./online";
import { STRINGS } from "./strings";

// The imperative shell for Cờ Lật: menu, play against the computer (either
// colour) or a friend on the same phone, and the online branch, which only
// sends "play square N" and draws what the room sends back
// (docs/standards/online-multiplayer.md).

const TAP_SLOP = 12;
/** Pause after the last disc turns before the result card slides in. */
const RESULT_DELAY = 0.8;
/** How long the "no legal move" banner stays up. */
const PASS_TIME = 2.2;
/** A new disc lands a moment before its neighbours start turning. */
const DROP_TIME = 0.14;

type Mode = "ai" | "hot";
type Tally = Record<Difficulty, { w: number; l: number }>;

interface SavedRun {
  mode: Mode;
  level: Difficulty;
  human: Side;
  moves: number[];
  undos: number;
}

function parseRun(raw: unknown): SavedRun | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<SavedRun>;
  if ((r.mode !== "ai" && r.mode !== "hot") || !DIFFICULTIES.includes(r.level as Difficulty)) return null;
  if ((r.human !== 1 && r.human !== 2) || !Array.isArray(r.moves) || typeof r.undos !== "number") return null;
  if (!r.moves.every((m) => Number.isInteger(m) && m >= 0 && m < CELLS)) return null;
  return r as SavedRun;
}

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const online = rt.game.online ?? null;

  // ---------------------------------------------------------------- offline state

  let mode: Mode = "ai";
  const savedLevel = storage.get<Difficulty>("level", "normal");
  let level: Difficulty = DIFFICULTIES.includes(savedLevel) ? savedLevel : "normal";
  /** The colour the player takes against the computer. */
  let human: Side = storage.get<number>("human", 1) === 2 ? 2 : 1;
  let game: Game = newGame();
  let undos = UNDOS_PER_GAME;
  let reported = false;
  let hints = storage.get<boolean>("hints", true) !== false;
  const tally: Tally = {
    easy: { w: 0, l: 0 },
    normal: { w: 0, l: 0 },
    hard: { w: 0, l: 0 },
    ...storage.get<Partial<Tally>>("tally", {}),
  };
  /** Hot-seat wins this session, by colour. */
  const hotWins = { 1: 0, 2: 0 };
  let overlay: "menu" | "rules" | null = online ? null : "menu";
  let rulesFrom: "menu" | null = null;
  let aiAt: number | null = null;
  const rand = mulberry32((Date.now() ^ 0x5eed) >>> 0);

  const saved = online ? null : parseRun(storage.get<unknown>("run", null));
  if (saved) {
    mode = saved.mode;
    level = saved.level;
    human = saved.human;
    game = replay(saved.moves);
    undos = saved.undos;
    if (game.result === null && game.moves.length > 0) overlay = null;
  }
  const save = () => {
    if (online) return;
    storage.set("run", game.result === null ? ({ mode, level, human, moves: game.moves, undos } satisfies SavedRun) : null);
  };

  // ---------------------------------------------------------------- online state

  const me = online ? online.seat : -1;
  let match: Match | null = online
    ? createMatch(
        online.seed,
        online.seats.map((s) => s.name),
        bestOfOf(online.settings),
      )
    : null;
  /** This client's colour in the current game; 0 when watching. */
  const mySide = (): Side | 0 => (match && me >= 0 ? (match.seats[me]?.side ?? 0) : 0);
  let results: SeatResult[] | null = null;
  let lastResult: Extract<MatchEvent, { type: "result" }> | null = null;
  let pending: number | null = null;
  let seq = 0;
  let notice: { text: string; until: number } | null = null;

  // ---------------------------------------------------------------- view state

  let now = 0;
  /** Discs turning over: square → when it starts and the colour it had. */
  const flips = new Map<number, { start: number; from: Side }>();
  /** Discs being set down: square → when. */
  const drops = new Map<number, number>();
  /** When the last running animation ends. */
  let busyUntil = 0;
  let decidedAt = 0;
  let passNotice: { text: string; from: number } | null = null;

  const current = (): Game => (match ? match.game : game);

  // ---------------------------------------------------------------- sound

  const sfx = {
    place: (side: number) => {
      audio.tone({ freq: side === 1 ? 260 : 310, to: 180, dur: 0.07, type: "triangle", vol: 0.12 });
      audio.tone({ freq: 2200, dur: 0.015, type: "square", vol: 0.012 });
    },
    flip: (k: number, delay: number) => audio.tone({ freq: 620 + k * 45, to: 820 + k * 45, dur: 0.05, type: "sine", vol: 0.05, delay }),
    pass: (delay: number) => {
      for (const [i, f] of [330, 262].entries()) audio.tone({ freq: f, dur: 0.14, type: "triangle", vol: 0.07, delay: delay + i * 0.13 });
    },
    win: (delay = 0) => {
      for (const [i, f] of [523, 659, 784, 1047].entries()) audio.tone({ freq: f, dur: 0.16, type: "triangle", vol: 0.1, delay: delay + i * 0.1 });
    },
    lose: (delay = 0) => {
      for (const [i, f] of [392, 330, 262].entries()) audio.tone({ freq: f, dur: 0.2, type: "sine", vol: 0.08, delay: delay + i * 0.14 });
    },
    pick: () => audio.tone({ freq: 880, dur: 0.03, type: "triangle", vol: 0.04 }),
    tick: () => audio.tone({ freq: 1200, dur: 0.02, type: "square", vol: 0.02 }),
    nope: () => audio.tone({ freq: 180, dur: 0.08, type: "square", vol: 0.03 }),
  };

  // ---------------------------------------------------------------- animation

  /** A disc set down at `at` by `side`, then each flipped disc turning in a ripple outward. */
  function animate(at: number, side: Side, flipped: readonly number[]) {
    drops.set(at, now);
    busyUntil = Math.max(busyUntil, now + DROP_TIME);
    const from = other(side);
    for (const f of flipped) {
      const start = now + DROP_TIME + (distance(at, f) - 1) * FLIP_STAGGER;
      flips.set(f, { start, from });
      busyUntil = Math.max(busyUntil, start + FLIP_TIME);
    }
    sfx.place(side);
    const steps = new Set(flipped.map((f) => distance(at, f)));
    for (const d of steps) sfx.flip(d, DROP_TIME + (d - 1) * FLIP_STAGGER + FLIP_TIME * 0.5);
  }

  function clearAnimations() {
    flips.clear();
    drops.clear();
    busyUntil = now;
    passNotice = null;
  }

  /** The colour a square shows right now (a turning disc shows its old face until half way). */
  function shownSide(cells: readonly number[], sq: number): number {
    const f = flips.get(sq);
    if (f && now < f.start + FLIP_TIME / 2) return f.from;
    return cells[sq];
  }

  function shownCounts(cells: readonly number[]): [number, number] {
    let b = 0;
    let w = 0;
    for (let sq = 0; sq < CELLS; sq++) {
      const s = shownSide(cells, sq);
      if (s === 1) b++;
      else if (s === 2) w++;
    }
    return [b, w];
  }

  // ---------------------------------------------------------------- names

  function nameOf(side: Side): string {
    const t = tr();
    if (match) {
      const seat = seatOfSide(match, side);
      return seat === me ? t.you : (match.seats[seat]?.name ?? "");
    }
    if (mode === "hot") return t.player(side);
    return side === human ? t.you : t.ai(level);
  }

  function showPass(side: Side) {
    passNotice = { text: tr().pass(nameOf(side)), from: busyUntil };
    sfx.pass(Math.max(0, busyUntil - now));
  }

  // ---------------------------------------------------------------- offline flow

  function startGame(m: Mode, lv: Difficulty = level) {
    mode = m;
    level = lv;
    storage.set("level", level);
    storage.set("human", human);
    game = newGame();
    undos = UNDOS_PER_GAME;
    reported = false;
    aiAt = null;
    overlay = null;
    clearAnimations();
    save();
  }

  function placeOffline(at: number) {
    const side = game.turn;
    const flipped = play(game, at);
    if (!flipped) return sfx.nope();
    animate(at, side, flipped);
    if (game.passed) showPass(game.passed);
    if (game.result !== null) decided();
    save();
  }

  const runScore = (margin: number) => WIN_SCORE[level] + Math.max(0, margin) * MARGIN_BONUS[level];

  function decided() {
    decidedAt = busyUntil;
    const delay = Math.max(0, busyUntil - now);
    const r = game.result;
    if (mode === "hot") {
      if (r === 1 || r === 2) hotWins[r]++;
      sfx.win(delay);
      return;
    }
    const [b, w] = countDiscs(game.cells);
    const mine = human === 1 ? b : w;
    const theirs = human === 1 ? w : b;
    if (r === human) {
      sfx.win(delay);
      tally[level].w++;
      if (!reported) {
        reported = true;
        reportScore?.({ score: runScore(mine - theirs), detail: tr().detail(level, mine, theirs) });
      }
      // Card summary: the hardest level beaten
      const best = [...DIFFICULTIES].reverse().find((d) => tally[d].w > 0) ?? level;
      storage.set(SUMMARY_KEY, {
        vi: STRINGS.vi.summary(best, tally[best].w),
        en: STRINGS.en.summary(best, tally[best].w),
      });
    } else if (r === other(human)) {
      sfx.lose(delay);
      tally[level].l++;
    } else sfx.win(delay);
    storage.set("tally", tally);
  }

  /** Against the computer: your turn, a take-back left, and a move of yours to take back. */
  const canUndoAi = () => undos > 0 && game.result === null && game.turn === human && aiAt === null && game.movers.includes(human);

  function takeBack() {
    if (game.result !== null || game.moves.length === 0) return;
    if (mode === "hot") game = undo(game);
    else {
      if (!canUndoAi()) return sfx.nope();
      // Back to before your last move (the computer's replies, and any passes, go too)
      const last = game.movers.lastIndexOf(human);
      game = undo(game, game.moves.length - last);
      undos--;
    }
    clearAnimations();
    sfx.pick();
    save();
  }

  // ---------------------------------------------------------------- online flow

  function onEvent(e: MatchEvent) {
    if (!match) return;
    switch (e.type) {
      case "place": {
        const g = match.game;
        // The snapshot may already hold this move
        if (g.cells[e.at] === 0 && g.turn === e.side) play(g, e.at);
        match.clock = TURN_SECONDS;
        animate(e.at, e.side, e.flips);
        if (pending === e.at || e.side === mySide()) pending = null;
        if (e.auto && e.side === mySide()) notice = { text: tr().timedOut, until: now + 2.5 };
        break;
      }
      case "pass":
        showPass(e.side);
        break;
      case "result": {
        match.game.result = e.winner;
        lastResult = e;
        decidedAt = busyUntil;
        const delay = Math.max(0, busyUntil - now);
        const mine = mySide();
        if (e.winner === 0 || !mine || e.winner === mine) sfx.win(delay);
        else sfx.lose(delay);
        break;
      }
      case "game": {
        clearAnimations();
        pending = null;
        lastResult = null;
        match.n = e.n;
        match.phase = "play";
        match.game = newGame();
        for (const [i, s] of match.seats.entries()) s.side = i === e.black ? 1 : 2;
        const name = e.black === me ? tr().you : (match.seats[e.black]?.name ?? "");
        notice = { text: `${tr().gameN(e.n)} · ${tr().playsBlack(name)}`, until: now + 2.8 };
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
      match = next;
      if (pending !== null && (next.game.cells[pending] !== 0 || next.game.turn !== mySide())) pending = null;
    } else if (m.t === "ev") {
      for (const e of m.events as MatchEvent[]) onEvent(e);
    } else if (m.t === "end") {
      results = m.results;
    }
  });

  function myTurnOnline() {
    const side = mySide();
    return match !== null && side !== 0 && match.phase === "play" && match.game.result === null && match.game.turn === side;
  }

  function sendPlace(at: number) {
    if (!online) return;
    pending = at;
    online.send({ seq: ++seq, move: { x: 0, y: 0 }, actions: [{ type: "place", at }] });
  }

  // ---------------------------------------------------------------- input

  /** Can the player put a disc down right now? */
  function canMove() {
    if (overlay) return false;
    if (online) return myTurnOnline() && pending === null;
    if (game.result !== null) return false;
    return mode === "hot" || (game.turn === human && aiAt === null);
  }

  function tapSquare(at: number) {
    if (!canMove()) return;
    const g = current();
    if (!canPlay(g, at)) return sfx.nope();
    if (online) sendPlace(at);
    else placeOffline(at);
  }

  function toggleHints() {
    hints = !hints;
    storage.set("hints", hints);
    sfx.pick();
  }

  function layoutRow(list: Button[], width?: number) {
    const gap = 12;
    const w = width ?? (W - 40 - gap * (list.length - 1)) / list.length;
    const total = w * list.length + gap * (list.length - 1);
    list.forEach((b, i) => {
      b.rect = { x: (W - total) / 2 + i * (w + gap), y: BUTTON_Y, w, h: BUTTON_H };
    });
    return list;
  }

  const ZERO: Rect = { x: 0, y: 0, w: 0, h: 0 };

  function buttons(): Button[] {
    const t = tr();
    const hint: Button = { id: "hints", rect: ZERO, label: t.hints, icon: "hints", primary: hints };
    if (online) return layoutRow([hint], 170);
    return layoutRow([
      {
        id: "undo",
        rect: ZERO,
        label: t.undo,
        icon: "undo",
        disabled: mode === "ai" ? !canUndoAi() : game.result !== null || game.moves.length === 0,
        badge: mode === "ai" ? String(undos) : undefined,
      },
      hint,
      { id: "new", rect: ZERO, label: t.newGame, icon: "new" },
      { id: "menu", rect: ZERO, label: t.menu, icon: "menu" },
    ]);
  }

  function pressButton(id: string) {
    switch (id) {
      case "undo":
        return takeBack();
      case "hints":
        return toggleHints();
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

  const MENU: Rect = { x: 28, y: 86, w: W - 56, h: 808 };
  function menuButtons(): Button[] {
    const t = tr();
    const x = MENU.x + 28;
    const w = MENU.w - 56;
    const cw = (w - 14) / 2;
    const lw = (w - 24) / 3;
    const list: Button[] = ([1, 2] as Side[]).map((s, i) => ({
      id: `side:${s}`,
      rect: { x: x + i * (cw + 14), y: MENU.y + 262, w: cw, h: 64 },
      label: t.colour[s],
      disc: s,
      primary: human === s,
    }));
    for (const [i, d] of DIFFICULTIES.entries())
      list.push({
        id: `ai:${d}`,
        rect: { x: x + i * (lw + 12), y: MENU.y + 380, w: lw, h: 80 },
        label: t.level[d],
        primary: true,
      });
    list.push({ id: "hot", rect: { x, y: MENU.y + 548, w, h: 76 }, label: t.hotseat });
    list.push({ id: "rules", rect: { x: x + w / 2 - 120, y: MENU.y + 704, w: 240, h: 62 }, label: t.rules });
    return list;
  }
  const canResume = () => !online && game.result === null && game.moves.length > 0;
  const CLOSE: Rect = { x: MENU.x + MENU.w - 58, y: MENU.y + 10, w: 48, h: 48 };

  const RULES: Rect = { x: 22, y: 120, w: W - 44, h: 740 };
  const rulesClose = (): Button => ({
    id: "close",
    rect: { x: W / 2 - 110, y: RULES.y + RULES.h - 90, w: 220, h: 66 },
    label: tr().close,
    primary: true,
  });

  /** The result card sits under the board so the final position stays in view. */
  const RESULT: Rect = { x: 20, y: STATUS_Y - 26, w: W - 40, h: 228 };
  function resultButtons(): Button[] {
    const t = tr();
    const y = RESULT.y + RESULT.h - 86;
    if (online) return [{ id: "lobby", rect: { x: W / 2 - 120, y, w: 240, h: 66 }, label: t.backToLobby, primary: true }];
    const w = (RESULT.w - 72) / 2;
    return [
      { id: "again", rect: { x: RESULT.x + 24, y, w, h: 66 }, label: t.again, primary: true },
      { id: "menu", rect: { x: RESULT.x + 48 + w, y, w, h: 66 }, label: t.menu },
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
      else if (b.id.startsWith("side:")) {
        human = b.id === "side:2" ? 2 : 1;
        storage.set("human", human);
      } else startGame("ai", b.id.slice(3) as Difficulty);
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
      return;
    }
    const b = buttons().find((b) => inRect(p, b.rect));
    if (b) {
      if (b.disabled) return sfx.nope();
      return pressButton(b.id);
    }
    const at = squareAt(p);
    if (at !== null) tapSquare(at);
  }

  let press: { id: number; x: number; y: number } | null = null;
  const pointer = {
    down(p: PointerInfo) {
      if (!press) press = { id: p.id, x: p.x, y: p.y };
    },
    move() {},
    up(p: PointerInfo) {
      if (!press || press.id !== p.id) return;
      const near = Math.hypot(p.x - press.x, p.y - press.y) <= TAP_SLOP;
      press = null;
      if (near) tap(p);
    },
  };

  // ---------------------------------------------------------------- update

  function update(dt: number) {
    now += dt;
    for (const [sq, f] of flips) if (now > f.start + FLIP_TIME) flips.delete(sq);
    for (const [sq, t0] of drops) if (now > t0 + DROP_TIME) drops.delete(sq);
    if (passNotice && now > passNotice.from + PASS_TIME) passNotice = null;
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
    if (overlay || mode !== "ai" || game.result !== null || game.turn === human) return;
    // The computer waits for the discs to settle (and for a pass banner to be read)
    if (aiAt === null) aiAt = Math.max(now, busyUntil) + AI_DELAY + (passNotice ? 0.9 : 0);
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
    count: number;
    active: boolean;
    clock: number | null;
    away: string | null;
    wins: number;
  }

  function cards(): Card[] {
    const t = tr();
    const g = current();
    const [b, w] = shownCounts(g.cells);
    const countOf = (s: Side) => (s === 1 ? b : w);
    if (match) {
      const m = match;
      const playing = m.phase === "play" && g.result === null;
      // You on the left (seat 0 when watching); the disc shows this game's colour
      const order = me === 1 ? [1, 0] : [0, 1];
      return order.map((i) => {
        const s = m.seats[i];
        const name = i === me ? t.you : (s?.name ?? "");
        const side = s?.side ?? 1;
        return {
          side,
          name,
          sub: "",
          count: countOf(side),
          active: playing && g.turn === side,
          clock: playing && g.turn === side ? m.clock / TURN_SECONDS : null,
          away: s && s.away !== null ? t.away(name, Math.max(0, Math.ceil(RECONNECT_SECONDS - s.away))) : null,
          wins: s?.wins ?? 0,
        };
      });
    }
    const live = g.result === null && overlay === null;
    if (mode === "hot")
      return ([1, 2] as Side[]).map((s) => ({
        side: s,
        name: t.player(s),
        sub: t.wins(hotWins[s]),
        count: countOf(s),
        active: live && g.turn === s,
        clock: null,
        away: null,
        wins: 0,
      }));
    return [
      { side: human, name: t.you, sub: t.wins(tally[level].w), count: countOf(human), active: live && g.turn === human, clock: null, away: null, wins: 0 },
      {
        side: other(human),
        name: t.ai(level),
        sub: t.wins(tally[level].l),
        count: countOf(other(human)),
        active: live && g.turn !== human,
        clock: null,
        away: null,
        wins: 0,
      },
    ];
  }

  function drawCards() {
    const list = cards();
    const w = (W - 56) / 2;
    list.forEach((c, i) => {
      const r: Rect = { x: 20 + i * (w + 16), y: CARD_Y, w, h: CARD_H };
      drawPanel(ctx, r, c.active ? 0.6 + 0.4 * Math.sin(now * 3) ** 2 : 0);
      drawDisc(ctx, c.side, r.x + 38, r.y + 40, 22);
      text(ctx, c.name, r.x + 70, r.y + 36, fitSize(ctx, c.name, 24, r.w - 140), CREAM, "left");
      text(ctx, String(c.count), r.x + r.w - 18, r.y + 40, 44, GOLD, "right", 800);
      if (match) {
        // Games won, as pips
        for (let k = 0; k < winsNeeded(match.bestOf); k++) {
          ctx.beginPath();
          ctx.arc(r.x + 28 + k * 22, r.y + 86, 7, 0, Math.PI * 2);
          ctx.fillStyle = k < c.wins ? GOLD : "rgba(255,240,210,0.15)";
          ctx.fill();
        }
      } else text(ctx, c.sub, r.x + 20, r.y + 86, 19, SOFT, "left", 600);
      if (c.clock !== null) {
        const low = c.clock < 0.34;
        const bw = r.w - 130;
        ctx.fillStyle = "rgba(255,240,210,0.12)";
        ctx.fillRect(r.x + 90, r.y + 83, bw, 6);
        ctx.fillStyle = low ? RED : GOLD;
        ctx.fillRect(r.x + 90, r.y + 83, bw * clamp(c.clock, 0, 1), 6);
        text(ctx, String(Math.ceil(c.clock * TURN_SECONDS)), r.x + r.w - 20, r.y + 86, 20, low ? RED : SOFT, "right");
      }
    });
  }

  /** Should the side to move see dots on its legal squares? */
  function showHints(): boolean {
    if (!hints || now < busyUntil) return false;
    if (online) return myTurnOnline() && pending === null;
    return canMove();
  }

  function drawDiscs(g: Game) {
    const r = CELL * 0.4;
    // Discs at rest, then any lifted mid-flip on top so they overlap their neighbours
    const flying: number[] = [];
    for (let sq = 0; sq < CELLS; sq++) {
      const side = g.cells[sq];
      if (side !== 1 && side !== 2) continue;
      const p = cellCenter(sq);
      const f = flips.get(sq);
      if (f && now >= f.start && now < f.start + FLIP_TIME) {
        flying.push(sq);
        continue;
      }
      if (f && now < f.start) {
        drawDisc(ctx, f.from, p.x, p.y, r);
        continue;
      }
      const t0 = drops.get(sq);
      if (t0 !== undefined) {
        const k = clamp((now - t0) / DROP_TIME, 0, 1);
        drawDisc(ctx, side, p.x, p.y, r, 1, side, 1 + 0.3 * (1 - easeOutCubic(k)), 0.35 + 0.65 * k);
      } else drawDisc(ctx, side, p.x, p.y, r);
    }
    for (const sq of flying) {
      const f = flips.get(sq);
      if (!f) continue;
      const p = cellCenter(sq);
      const k = (now - f.start) / FLIP_TIME;
      drawDisc(ctx, g.cells[sq], p.x, p.y, r, k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2, f.from);
    }
    const last = g.moves[g.moves.length - 1];
    if (last !== undefined && !drops.has(last)) {
      const p = cellCenter(last);
      drawLastMarker(ctx, p.x, p.y);
    }
    if (showHints()) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 4);
      for (const sq of legalMoves(g.cells, g.turn)) {
        const p = cellCenter(sq);
        drawHint(ctx, g.turn, p.x, p.y, pulse);
      }
    }
    if (pending !== null && !g.cells[pending]) {
      const p = cellCenter(pending);
      drawDisc(ctx, mySide() || 1, p.x, p.y, r, 1, mySide() || 1, 1, 0.55);
    }
  }

  function statusLine(): string {
    const t = tr();
    if (match) {
      if (mySide() === 0) return t.watching;
      if (match.phase !== "play" || match.game.result !== null) return "";
      if (myTurnOnline()) return t.yourTurn;
      return t.turnOf(nameOf(match.game.turn));
    }
    if (game.result !== null) return "";
    if (mode === "ai" && game.turn !== human) return t.aiThinking;
    if (mode === "hot") return t.turnOf(t.player(game.turn));
    return t.yourTurn;
  }

  function drawStatus() {
    const s = statusLine();
    const away = cards().find((c) => c.away)?.away;
    if (away) text(ctx, away, W / 2, STATUS_Y, fitSize(ctx, away, 22, W - 40), RED);
    else if (notice && now < notice.until) text(ctx, notice.text, W / 2, STATUS_Y, fitSize(ctx, notice.text, 24, W - 40), GOLD);
    else if (s) text(ctx, s, W / 2, STATUS_Y, fitSize(ctx, s, 23, W - 40, 600), SOFT, "center", 600);
    else if (match && match.phase === "play") text(ctx, tr().firstTo(winsNeeded(match.bestOf)), W / 2, STATUS_Y, 20, SOFT, "center", 600);
  }

  /** A banner across the board: "no legal move, turn passes", or the game between online games. */
  function drawBanner(lines: { str: string; size: number; color: string; weight?: number }[], alpha: number, discs?: [number, number]) {
    if (alpha <= 0) return;
    const h = 36 + lines.length * 40 + (discs ? 44 : 0);
    const r: Rect = { x: 50, y: BOARD.y + BOARD.h / 2 - h / 2, w: W - 100, h };
    ctx.save();
    ctx.globalAlpha = alpha;
    drawPanel(ctx, r, 0.4, "rgba(24,14,8,0.92)");
    let y = r.y + 38;
    for (const l of lines) {
      text(ctx, l.str, W / 2, y, fitSize(ctx, l.str, l.size, r.w - 36, l.weight ?? 700), l.color, "center", l.weight ?? 700);
      y += 40;
    }
    if (discs) {
      drawDisc(ctx, 1, W / 2 - 88, y + 2, 15);
      drawDisc(ctx, 2, W / 2 + 88, y + 2, 15);
      text(ctx, `${discs[0]} – ${discs[1]}`, W / 2, y + 4, 30, CREAM, "center", 800);
    }
    ctx.restore();
  }

  function drawPass() {
    if (!passNotice || now < passNotice.from) return;
    const k = now - passNotice.from;
    const alpha = Math.min(1, k / 0.15, (PASS_TIME - k) / 0.3);
    drawBanner([{ str: passNotice.text, size: 24, color: CREAM }], alpha);
  }

  function drawBetween() {
    if (match?.phase !== "between" || !lastResult) return;
    const t = tr();
    const e = lastResult;
    const msg = e.winner === 0 ? t.draw : t.winOf(nameOf(e.winner));
    drawBanner([{ str: msg, size: 34, color: GOLD, weight: 800 }], clamp((now - decidedAt - 0.4) / 0.3, 0, 1), [e.black, e.white]);
  }

  function dim() {
    ctx.fillStyle = "rgba(10,5,2,0.6)";
    const v = stage.view;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function drawMenu() {
    dim();
    const t = tr();
    drawPanel(ctx, MENU, 0, "rgba(34,21,13,0.97)");
    drawTitle(ctx, t.title, W / 2, MENU.y + 92, 84, MENU.w - 60);
    text(ctx, t.subtitle, W / 2, MENU.y + 158, fitSize(ctx, t.subtitle, 21, MENU.w - 50, 600), SOFT, "center", 600);
    text(ctx, t.vsAi, W / 2, MENU.y + 214, 28, CREAM, "center", 800);
    text(ctx, t.playAs, W / 2, MENU.y + 246, 18, SOFT, "center", 600);
    const list = menuButtons();
    for (const b of list) drawButton(ctx, b);
    text(ctx, t.firstNote, W / 2, MENU.y + 346, 17, SOFT, "center", 600);
    // Wins per level under each level button
    for (const d of DIFFICULTIES) {
      const b = list.find((x) => x.id === `ai:${d}`);
      if (b && tally[d].w > 0) text(ctx, `✓ ${tally[d].w}`, b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h + 20, 17, GOLD, "center", 600);
    }
    ctx.strokeStyle = "rgba(195,154,78,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MENU.x + 60, MENU.y + 518);
    ctx.lineTo(MENU.x + MENU.w - 60, MENU.y + 518);
    ctx.stroke();
    text(ctx, t.hotseatHint, W / 2, MENU.y + 648, fitSize(ctx, t.hotseatHint, 18, MENU.w - 60, 600), SOFT, "center", 600);
    if (canResume()) {
      ctx.strokeStyle = SOFT;
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
    drawPanel(ctx, RULES, 0, "rgba(34,21,13,0.97)");
    text(ctx, t.rules, W / 2, RULES.y + 52, 34, GOLD, "center", 800);
    ctx.font = `600 21px ${FONT}`;
    let y = RULES.y + 108;
    for (const [i, line] of t.rulesLines.entries()) {
      drawDisc(ctx, i % 2 === 0 ? 1 : 2, RULES.x + 34, y, 8);
      for (const l of wrap(ctx, line, RULES.w - 84)) {
        text(ctx, l, RULES.x + 54, y, 21, CREAM, "left", 600);
        y += 29;
      }
      y += 12;
    }
    drawButton(ctx, rulesClose());
  }

  function drawResult() {
    const t = tr();
    const k = clamp((now - decidedAt - RESULT_DELAY * (online ? 0.6 : 1)) / 0.25, 0, 1);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 30);
    drawPanel(ctx, RESULT, 0.5, "rgba(34,21,13,0.96)");
    let title = "";
    let line = "";
    const g = current();
    const [b, w] = countDiscs(g.cells);
    if (match) {
      const won = match.winner === me && me >= 0;
      title = match.winner === null ? t.matchDraw : mySide() === 0 ? t.winOf(match.seats[match.winner]?.name ?? "") : won ? t.matchWin : t.matchLose;
      if (match.forfeit && mySide() !== 0) line = won ? t.forfeitWin : t.forfeitLose;
      const mine = results?.find((r) => r.seat === me);
      if (mine && mine.score > 0) line = line ? `${line} · ${t.score(mine.score)}` : t.score(mine.score);
      const mineWins = match.seats[Math.max(me, 0)]?.wins ?? 0;
      const theirWins = match.seats[me === 1 ? 0 : 1]?.wins ?? 0;
      if (!line) line = `${mineWins} – ${theirWins}`;
    } else {
      const r = g.result;
      if (r === 0) {
        title = t.draw;
        line = t.discs(b, w);
      } else if (mode === "hot") {
        title = t.winOf(t.player(r === 2 ? 2 : 1));
        line = `${t.discs(b, w)} · ${t.colour[1]} ${hotWins[1]} – ${hotWins[2]} ${t.colour[2]}`;
      } else {
        const mine = human === 1 ? b : w;
        const theirs = human === 1 ? w : b;
        if (r === human) {
          title = t.youWin;
          line = t.winLine(mine, theirs, runScore(mine - theirs));
        } else {
          title = t.youLose;
          line = t.loseLine(mine, theirs);
        }
      }
    }
    drawTitle(ctx, [title], W / 2, RESULT.y + 48, 42, RESULT.w - 40);
    if (line) text(ctx, line, W / 2, RESULT.y + 98, fitSize(ctx, line, 22, RESULT.w - 40, 600), CREAM, "center", 600);
    for (const btn of resultButtons()) drawButton(ctx, btn);
    ctx.restore();
  }

  function render() {
    stage.begin();
    drawTable(ctx, stage.view);
    drawCards();
    drawBoard(ctx);
    drawDiscs(current());
    drawPass();
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
      } else if (e.code === "KeyH" && !overlay) toggleHints();
      else if (e.code === "KeyU" && !online && !overlay) takeBack();
    },
    dispose() {
      stopListening?.();
      save();
    },
  };
}
