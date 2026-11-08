import "@fontsource/baloo-2/800.css";
import "@fontsource/mali/600.css";
import "@fontsource/mali/700.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, easeOutCubic, inRect, mulberry32 } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import { chooseMove } from "./ai";
import {
  AMBER,
  BOARD,
  BOTTOM_CARD,
  BUTTON_H,
  BUTTON_Y,
  type Button,
  CREAM,
  CREAM_SOFT,
  FONT,
  MOVES_Y,
  PANEL,
  PANEL_HI,
  RED,
  SQ,
  STATUS_Y,
  TOP_CARD,
  drawBackdrop,
  drawBoard,
  drawButton,
  drawCheck,
  drawCoords,
  drawPanel,
  drawPiece,
  drawTarget,
  drawTitle,
  fitSize,
  squareAt,
  squareRect,
  text,
  tint,
  wrap,
} from "./art";
import {
  AI_DELAY,
  AWAY_SECONDS,
  COLOR_CHOICES,
  type ColorChoice,
  DIFFICULTIES,
  type Difficulty,
  QUICK_WIN_BONUS,
  QUICK_WIN_MOVES,
  UNDOS_PER_GAME,
  W,
  WIN_SCORE,
} from "./config";
import {
  BLACK,
  type Color,
  type Game,
  KING,
  KNIGHT,
  type Match,
  type MatchEvent,
  PAWN,
  PROMOS,
  QUEEN,
  ROOK,
  WHITE,
  canOffer,
  checkedKing,
  createMatch,
  fileOf,
  isPromotion,
  mFrom,
  mPromo,
  mTo,
  material,
  movesBy,
  newGame,
  playMove,
  replay,
  seatOf,
  takeBack,
  targetsFrom,
} from "./logic";
import { STRINGS } from "./strings";

// The imperative shell for Cờ Vua: menu, play against the computer or a friend
// on the same phone, and the online branch, which only sends "move from→to"
// (or resign / draw offers) and draws what the room sends back
// (docs/standards/online-multiplayer.md).

const SLIDE_TIME = 0.17;
const RESULT_DELAY = 0.9;
const DRAG_SLOP = 8;

type Mode = "ai" | "hot";
type Tally = Record<Difficulty, { w: number; l: number }>;

interface SavedRun {
  mode: Mode;
  level: Difficulty;
  human: Color;
  history: number[];
  undos: number;
  flipped: boolean;
}

function parseRun(raw: unknown): SavedRun | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<SavedRun>;
  if ((r.mode !== "ai" && r.mode !== "hot") || !DIFFICULTIES.includes(r.level as Difficulty)) return null;
  if ((r.human !== WHITE && r.human !== BLACK) || !Array.isArray(r.history) || typeof r.undos !== "number") return null;
  if (!r.history.every((m) => Number.isInteger(m))) return null;
  return { ...r, flipped: r.flipped === true } as SavedRun;
}

interface Slide {
  piece: number;
  from: number;
  to: number;
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
  const savedChoice = storage.get<ColorChoice>("color", "white");
  let colorChoice: ColorChoice = COLOR_CHOICES.includes(savedChoice) ? savedChoice : "white";
  /** The colour the human plays against the computer. */
  let human: Color = WHITE;
  let game: Game = newGame();
  let undos = UNDOS_PER_GAME;
  let reported = false;
  const tally: Tally = {
    easy: { w: 0, l: 0 },
    normal: { w: 0, l: 0 },
    hard: { w: 0, l: 0 },
    ...storage.get<Partial<Tally>>("tally", {}),
  };
  /** Hot-seat wins this session, by colour. */
  const hotWins = { white: 0, black: 0 };
  let overlay: "menu" | "rules" | null = online ? null : "menu";
  let rulesFrom: "menu" | null = null;
  let aiAt: number | null = null;
  const rand = mulberry32((Date.now() ^ 0xc0ffee) >>> 0);
  let flipped = false;

  const saved = online ? null : parseRun(storage.get<unknown>("run", null));
  if (saved) {
    mode = saved.mode;
    level = saved.level;
    human = saved.human;
    game = replay(saved.history);
    undos = saved.undos;
    flipped = saved.flipped;
    if (!game.result && game.history.length > 0) overlay = null;
  }
  const save = () => {
    if (online) return;
    storage.set("run", game.result ? null : ({ mode, level, human, history: game.history, undos, flipped } satisfies SavedRun));
  };

  // ---------------------------------------------------------------- online state

  const me = online ? online.seat : -1;
  const myColor: Color | 0 = me === 0 ? WHITE : me === 1 ? BLACK : 0;
  let match: Match | null = online ? createMatch(online.seats.map((s) => s.name)) : null;
  let results: SeatResult[] | null = null;
  let pending = false;
  let seq = 0;
  let notice: { text: string; until: number } | null = null;
  let confirmResign = -1;
  if (online) flipped = myColor === BLACK;

  // ---------------------------------------------------------------- shared view state

  let now = 0;
  let decidedAt = 0;
  let selected = -1;
  let targets: number[] = [];
  let promo: { from: number; to: number } | null = null;
  let slides: Slide[] = [];
  let slideAt = -1;
  let drag: { sq: number; x: number; y: number; sx: number; sy: number; moved: boolean; wasSelected: boolean } | null = null;

  const current = (): Game => (match ? match.game : game);

  // ---------------------------------------------------------------- sound

  const sfx = {
    pick: () => audio.tone({ freq: 760, dur: 0.03, type: "triangle", vol: 0.04 }),
    move: () => {
      // A wooden "tock"
      audio.tone({ freq: 340, to: 220, dur: 0.06, type: "triangle", vol: 0.12 });
      audio.tone({ freq: 1800, dur: 0.015, type: "square", vol: 0.012 });
    },
    capture: () => {
      audio.tone({ freq: 420, to: 180, dur: 0.09, type: "triangle", vol: 0.14 });
      audio.tone({ freq: 2600, dur: 0.02, type: "square", vol: 0.02, delay: 0.01 });
    },
    check: () => audio.tone({ freq: 988, dur: 0.18, type: "sine", vol: 0.08, delay: 0.05 }),
    win: () => {
      for (const [i, f] of [523, 659, 784, 1047].entries()) audio.tone({ freq: f, dur: 0.16, type: "triangle", vol: 0.1, delay: i * 0.1 });
    },
    lose: () => {
      for (const [i, f] of [392, 330, 262].entries()) audio.tone({ freq: f, dur: 0.2, type: "sine", vol: 0.08, delay: i * 0.14 });
    },
    draw: () => {
      for (const [i, f] of [523, 523].entries()) audio.tone({ freq: f, dur: 0.14, type: "sine", vol: 0.07, delay: i * 0.16 });
    },
    nope: () => audio.tone({ freq: 180, dur: 0.08, type: "square", vol: 0.03 }),
  };

  // ---------------------------------------------------------------- moves (shared)

  const clearPick = () => {
    selected = -1;
    targets = [];
    promo = null;
    drag = null;
  };

  /** Slides for from→to on `g` before it is played (the rook too when castling). */
  function slidesFor(g: Game, from: number, to: number): Slide[] {
    const piece = g.pos.b[from];
    const list: Slide[] = [{ piece, from, to }];
    if (Math.abs(piece) === KING && Math.abs(fileOf(to) - fileOf(from)) === 2) {
      const rookFrom = to > from ? to + 1 : to - 2;
      const rookTo = to > from ? to - 1 : to + 1;
      list.push({ piece: ROOK * Math.sign(piece), from: rookFrom, to: rookTo });
    }
    return list;
  }

  /** Play a move on `g`, with the slide and the sound. False if it was not legal. */
  function animateMove(g: Game, from: number, to: number, pr: number = QUEEN): boolean {
    const capture = g.pos.b[to] !== 0 || (Math.abs(g.pos.b[from]) === PAWN && fileOf(from) !== fileOf(to));
    const list = slidesFor(g, from, to);
    if (!playMove(g, from, to, pr)) return false;
    // A promoted pawn lands as its new piece
    list[0].piece = g.pos.b[to];
    slides = list;
    slideAt = now;
    if (checkedKing(g.pos) >= 0) sfx.check();
    if (capture) sfx.capture();
    else sfx.move();
    return true;
  }

  // ---------------------------------------------------------------- offline flow

  function startGame(m: Mode, lv: Difficulty = level) {
    mode = m;
    level = lv;
    storage.set("level", level);
    storage.set("color", colorChoice);
    human = colorChoice === "random" ? (rand() < 0.5 ? WHITE : BLACK) : colorChoice === "black" ? BLACK : WHITE;
    if (m === "hot") human = WHITE;
    flipped = m === "ai" && human === BLACK;
    game = newGame();
    undos = UNDOS_PER_GAME;
    reported = false;
    clearPick();
    slides = [];
    aiAt = null;
    overlay = null;
    save();
  }

  function playOffline(from: number, to: number, pr: number = QUEEN) {
    if (!animateMove(game, from, to, pr)) return;
    clearPick();
    if (game.result) decided();
    save();
  }

  const runScore = (moves: number) => WIN_SCORE[level] + Math.max(0, QUICK_WIN_MOVES - moves) * QUICK_WIN_BONUS[level];

  function decided() {
    decidedAt = now;
    const r = game.result;
    if (!r) return;
    if (mode === "hot") {
      if (r.winner === WHITE) hotWins.white++;
      else if (r.winner === BLACK) hotWins.black++;
      if (r.winner) sfx.win();
      else sfx.draw();
      return;
    }
    if (r.winner === human) {
      sfx.win();
      tally[level].w++;
      const moves = movesBy(game, human);
      if (!reported) {
        reported = true;
        reportScore?.({ score: runScore(moves), detail: tr().detail(level, moves) });
      }
      // Card summary: the hardest level beaten
      const best = [...DIFFICULTIES].reverse().find((d) => tally[d].w > 0) ?? level;
      storage.set(SUMMARY_KEY, {
        vi: STRINGS.vi.summary(best, tally[best].w),
        en: STRINGS.en.summary(best, tally[best].w),
      });
    } else if (r.winner) {
      sfx.lose();
      tally[level].l++;
    } else sfx.draw();
    storage.set("tally", tally);
  }

  /** Against the computer: your turn, a take-back left, and a move of yours to take back. */
  const canUndoAi = () => undos > 0 && !game.result && game.pos.turn === human && aiAt === null && movesBy(game, human) > 0;

  function undoOffline() {
    if (game.result || game.history.length === 0) return sfx.nope();
    if (mode === "hot") game = takeBack(game, 1);
    else {
      if (!canUndoAi()) return sfx.nope();
      // Back to your previous turn: the computer's reply, then your move
      game = takeBack(game, 2);
      undos--;
    }
    clearPick();
    slides = [];
    sfx.pick();
    save();
  }

  // ---------------------------------------------------------------- online flow

  const nameOf = (seat: number) => (seat === me ? tr().you : (match?.seats[seat]?.name ?? ""));

  function onEvent(e: MatchEvent) {
    if (!match) return;
    switch (e.type) {
      case "move": {
        const g = match.game;
        if (g.pos.turn === e.color && g.pos.b[e.from] * e.color > 0) animateMove(g, e.from, e.to, e.promo || QUEEN);
        else sfx.move();
        if (e.color === myColor) pending = false;
        clearPick();
        break;
      }
      case "offer":
        match.offer = e.seat;
        sfx.pick();
        break;
      case "decline":
        if (match.offer !== null && match.offer !== e.seat && e.seat !== me) notice = { text: tr().declined(nameOf(e.seat)), until: now + 2.6 };
        match.offer = null;
        break;
      case "over":
        match.phase = "over";
        match.winner = e.winner;
        match.reason = e.reason;
        match.offer = null;
        decidedAt = now;
        pending = false;
        clearPick();
        if (e.winner === null) sfx.draw();
        else if (e.winner === me || me < 0) sfx.win();
        else sfx.lose();
        break;
    }
  }

  const stopListening = online?.onMessage((m) => {
    if (m.t === "snap" && m.state) {
      const next = m.state as Match;
      // A snapshot can trail the events by a tick: never step back
      if (!match || next.game.san.length >= match.game.san.length || next.phase !== match.phase) {
        const turnChanged = match?.game.pos.turn !== next.game.pos.turn;
        match = next;
        if (turnChanged) {
          pending = false;
          clearPick();
        }
      }
    } else if (m.t === "ev") {
      for (const e of m.events as MatchEvent[]) onEvent(e);
    } else if (m.t === "end") {
      results = m.results;
    }
  });

  const myTurnOnline = () => match !== null && myColor !== 0 && match.phase === "play" && match.game.pos.turn === myColor;

  function send(action: Record<string, unknown>) {
    online?.send({ seq: ++seq, move: { x: 0, y: 0 }, actions: [action] });
  }

  function sendMove(from: number, to: number, pr?: number) {
    pending = true;
    selected = -1;
    targets = [];
    promo = null;
    send(pr ? { type: "move", from, to, promo: pr } : { type: "move", from, to });
  }

  // ---------------------------------------------------------------- input

  /** The colour the player may move right now, or 0. */
  function movable(): Color | 0 {
    if (overlay || promo) return 0;
    if (online) return myTurnOnline() && !pending ? (myColor as Color) : 0;
    if (game.result) return 0;
    if (mode === "hot") return game.pos.turn;
    return game.pos.turn === human && aiAt === null ? human : 0;
  }

  function select(sq: number) {
    selected = sq;
    targets = targetsFrom(current().pos, sq);
    sfx.pick();
  }

  /** Move the selected piece to `to` (asking for a promotion first when needed). */
  function moveTo(to: number) {
    const from = selected;
    const g = current();
    if (isPromotion(g.pos, from, to)) {
      promo = { from, to };
      drag = null;
      return;
    }
    finish(from, to);
  }

  function finish(from: number, to: number, pr?: number) {
    if (online) sendMove(from, to, pr);
    else playOffline(from, to, pr ?? QUEEN);
  }

  function boardDown(p: { x: number; y: number }) {
    const color = movable();
    if (!color) return;
    const sq = squareAt(p, flipped);
    if (sq < 0) return;
    if (selected >= 0 && targets.includes(sq)) return moveTo(sq);
    const g = current();
    if (g.pos.b[sq] * color > 0) {
      const wasSelected = selected === sq;
      if (!wasSelected) select(sq);
      drag = { sq, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, wasSelected };
      return;
    }
    clearPick();
  }

  function boardUp(p: { x: number; y: number }) {
    const d = drag;
    drag = null;
    if (!d) return;
    if (!d.moved) {
      // Tap the chosen piece again to put it down
      if (d.wasSelected) clearPick();
      return;
    }
    const sq = squareAt(p, flipped);
    if (sq >= 0 && selected === d.sq && targets.includes(sq)) moveTo(sq);
  }

  function buttons(): Button[] {
    const t = tr();
    let list: Button[];
    const at = (): Rect => ({ x: 0, y: 0, w: 0, h: 0 });
    if (online) {
      if (!match || myColor === 0 || match.phase !== "play") return [];
      if (match.offer !== null && match.offer !== me)
        list = [
          { id: "accept", rect: at(), label: t.accept, icon: "check", tone: "primary" },
          { id: "decline", rect: at(), label: t.decline, icon: "cross" },
        ];
      else
        list = [
          { id: "resign", rect: at(), label: confirmResign > now ? t.sure : t.resign, icon: "flag", tone: confirmResign > now ? "danger" : undefined },
          {
            id: "draw",
            rect: at(),
            label: match.offer === me ? t.offered : t.offerDraw,
            icon: "hand",
            disabled: !canOffer(match, me),
          },
        ];
    } else
      list = [
        {
          id: "undo",
          rect: at(),
          label: t.undo,
          icon: "undo",
          disabled: mode === "ai" ? !canUndoAi() : !!game.result || game.history.length === 0,
          badge: mode === "ai" ? String(undos) : undefined,
        },
        { id: "flip", rect: at(), label: t.flip, icon: "flip" },
        { id: "new", rect: at(), label: t.newGame, icon: "new" },
        { id: "menu", rect: at(), label: t.menu, icon: "menu" },
      ];
    const gap = 12;
    const w = online ? 180 : (W - 40 - gap * (list.length - 1)) / list.length;
    const total = w * list.length + gap * (list.length - 1);
    list.forEach((b, i) => {
      b.rect = { x: (W - total) / 2 + i * (w + gap), y: BUTTON_Y, w, h: BUTTON_H };
    });
    return list;
  }

  function pressButton(id: string) {
    sfx.pick();
    switch (id) {
      case "undo":
        return undoOffline();
      case "flip":
        flipped = !flipped;
        save();
        return;
      case "new":
        return startGame(mode, level);
      case "menu":
        overlay = "menu";
        clearPick();
        return;
      case "resign":
        if (confirmResign > now) {
          confirmResign = -1;
          send({ type: "resign" });
        } else confirmResign = now + 3;
        return;
      case "draw":
        return send({ type: "draw" });
      case "accept":
        return send({ type: "accept" });
      case "decline":
        return send({ type: "decline" });
    }
  }

  // ---------------------------------------------------------------- overlays (layout shared by draw and tap)

  const MENU: Rect = { x: 30, y: 96, w: W - 60, h: 740 };
  function menuButtons(): Button[] {
    const t = tr();
    const x = MENU.x + 28;
    const w = MENU.w - 56;
    const third = (w - 24) / 3;
    const list: Button[] = COLOR_CHOICES.map((c, i) => ({
      id: `color:${c}`,
      rect: { x: x + i * (third + 12), y: MENU.y + 262, w: third, h: 58 },
      label: t.colorChoice[c],
      on: colorChoice === c,
    }));
    for (const [i, d] of DIFFICULTIES.entries())
      list.push({
        id: `ai:${d}`,
        rect: { x: x + i * (third + 12), y: MENU.y + 344, w: third, h: 76 },
        label: t.level[d],
        tone: d === "easy" ? "accent" : d === "normal" ? "primary" : "danger",
      });
    list.push({ id: "hot", rect: { x, y: MENU.y + 500, w, h: 72 }, label: t.hotseat });
    list.push({ id: "rules", rect: { x: x + w / 2 - 120, y: MENU.y + 650, w: 240, h: 56 }, label: t.rules });
    return list;
  }
  const canResume = () => !online && !game.result && game.history.length > 0;
  const CLOSE: Rect = { x: MENU.x + MENU.w - 58, y: MENU.y + 10, w: 48, h: 48 };

  const RULES: Rect = { x: 22, y: 110, w: W - 44, h: 720 };
  const rulesClose = (): Button => ({
    id: "close",
    rect: { x: W / 2 - 100, y: RULES.y + RULES.h - 84, w: 200, h: 62 },
    label: tr().close,
    tone: "primary",
  });

  /** The promotion picker sits over the board. */
  const PROMO: Rect = { x: 50, y: BOARD.y + BOARD.h / 2 - 120, w: W - 100, h: 240 };
  const promoCells = (): Rect[] => PROMOS.map((_, i) => ({ x: PROMO.x + 22 + i * 102, y: PROMO.y + 76, w: 92, h: 92 }));

  /** The result card covers the area under the board, so the final position stays in view. */
  const RESULT: Rect = { x: 16, y: BOTTOM_CARD.y - 4, w: W - 32, h: 256 };
  function resultButtons(): Button[] {
    const t = tr();
    const y = RESULT.y + RESULT.h - 84;
    if (online) return [{ id: "lobby", rect: { x: W / 2 - 120, y, w: 240, h: 64 }, label: t.backToLobby, tone: "primary" }];
    const w = (RESULT.w - 72) / 2;
    return [
      { id: "again", rect: { x: RESULT.x + 24, y, w, h: 64 }, label: t.again, tone: "primary" },
      { id: "menu", rect: { x: RESULT.x + 48 + w, y, w, h: 64 }, label: t.menu },
    ];
  }
  const showResult = () => {
    if (online) return match?.phase === "over" && now - decidedAt > RESULT_DELAY * 0.6;
    return !!game.result && overlay === null && now - decidedAt > RESULT_DELAY;
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
      else if (b.id.startsWith("color:")) {
        colorChoice = b.id.slice(6) as ColorChoice;
        storage.set("color", colorChoice);
      } else startGame("ai", b.id.slice(3) as Difficulty);
      return;
    }
    if (promo) {
      const i = promoCells().findIndex((r) => inRect(p, r));
      if (i >= 0) {
        const { from, to } = promo;
        promo = null;
        finish(from, to, PROMOS[i]);
      } else promo = null;
      return;
    }
    if (showResult()) {
      const b = resultButtons().find((b) => inRect(p, b.rect));
      if (b) {
        sfx.pick();
        if (b.id === "lobby") online?.backToLobby();
        else if (b.id === "again") startGame(mode, level);
        else overlay = "menu";
      }
      return;
    }
    const b = buttons().find((b) => inRect(p, b.rect));
    if (b) {
      if (b.disabled) return sfx.nope();
      return pressButton(b.id);
    }
  }

  let downOnBoard = false;
  const pointer = {
    down(p: PointerInfo) {
      downOnBoard = !overlay && !promo && !showResult() && inRect(p, BOARD);
      if (downOnBoard) boardDown(p);
    },
    move(p: PointerInfo) {
      if (!drag) return;
      drag.x = p.x;
      drag.y = p.y;
      if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > DRAG_SLOP) drag.moved = true;
    },
    up(p: PointerInfo) {
      if (downOnBoard) {
        downOnBoard = false;
        boardUp(p);
        return;
      }
      tap(p);
    },
  };

  // ---------------------------------------------------------------- update

  function update(dt: number) {
    now += dt;
    if (match) {
      for (const s of match.seats) if (s.away !== null) s.away += dt;
      return;
    }
    if (overlay || mode !== "ai" || game.result || game.pos.turn === human) return;
    if (aiAt === null) aiAt = now + AI_DELAY;
    else if (now >= aiAt) {
      const m = chooseMove(game, level, rand);
      aiAt = null;
      if (m >= 0) playOffline(mFrom(m), mTo(m), mPromo(m) || QUEEN);
    }
  }

  // ---------------------------------------------------------------- render

  interface Card {
    color: Color;
    name: string;
    sub: string;
    active: boolean;
    away: string | null;
  }

  function card(color: Color): Card {
    const t = tr();
    const g = current();
    const live = !g.result && overlay === null && (!match || match.phase === "play");
    const active = live && g.pos.turn === color;
    if (match) {
      const seat = seatOf(color);
      const s = match.seats[seat];
      return {
        color,
        name: seat === me ? t.you : (s?.name ?? t.side(color === WHITE)),
        sub: "",
        active,
        away: s && s.away !== null ? t.away(seat === me ? t.you : s.name, Math.max(0, Math.ceil(AWAY_SECONDS - s.away))) : null,
      };
    }
    if (mode === "hot") return { color, name: t.side(color === WHITE), sub: t.wins(color === WHITE ? hotWins.white : hotWins.black), active, away: null };
    const mine = color === human;
    return { color, name: mine ? t.you : t.ai(level), sub: t.wins(mine ? tally[level].w : tally[level].l), active, away: null };
  }

  function drawCard(r: Rect, c: Card) {
    drawPanel(ctx, r, c.active ? PANEL_HI : PANEL, 18, c.active ? AMBER : null);
    // The side's king as its badge
    ctx.save();
    ctx.fillStyle = c.color === WHITE ? "rgba(255,240,210,0.12)" : "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(r.x + 46, r.y + r.h / 2, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPiece(ctx, KING * c.color, r.x + 14, r.y + r.h / 2 - 34, 64);
    const right = c.sub ? 120 : 20;
    text(ctx, c.name, r.x + 90, r.y + 28, fitSize(ctx, c.name, 24, r.w - 90 - right, 700), CREAM, "left", 700);
    if (c.sub) text(ctx, c.sub, r.x + r.w - 18, r.y + 28, fitSize(ctx, c.sub, 19, 110, 600), CREAM_SOFT, "right", 600);
    // Material: the pieces this side has taken, net of the other's, and the points lead
    const mat = material(current().pos.b);
    const list = c.color === WHITE ? mat.white : mat.black;
    let x = r.x + 90;
    for (const [i, t] of list.entries()) {
      drawPiece(ctx, t * -c.color, x, r.y + 44, 30);
      x += i + 1 < list.length && list[i + 1] === t ? 13 : 24;
    }
    const lead = c.color === WHITE ? mat.up : -mat.up;
    if (lead > 0) text(ctx, `+${lead}`, x + 10, r.y + 60, 18, CREAM_SOFT, "left", 700);
    if (c.active && mode === "ai" && !match && c.color !== human) {
      // Thinking dots
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(238,176,76,${0.35 + 0.65 * Math.max(0, Math.sin(now * 6 - i * 0.8))})`;
        ctx.beginPath();
        ctx.arc(r.x + r.w - 58 + i * 16, r.y + 60, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCards() {
    const topColor: Color = flipped ? WHITE : BLACK;
    drawCard(TOP_CARD, card(topColor));
    drawCard(BOTTOM_CARD, card(-topColor as Color));
  }

  function drawPosition() {
    const g = current();
    drawBoard(ctx, flipped);
    if (g.last) {
      tint(ctx, squareRect(g.last.from, flipped), "rgba(255,206,70,0.36)");
      tint(ctx, squareRect(g.last.to, flipped), "rgba(255,206,70,0.48)");
    }
    if (selected >= 0) tint(ctx, squareRect(selected, flipped), "rgba(58,143,134,0.55)");
    const k = checkedKing(g.pos);
    if (k >= 0) drawCheck(ctx, squareRect(k, flipped));
    if (g.result?.reason === "mate") {
      // The mated king stays lit
      const mated = g.pos.kings[g.pos.turn === WHITE ? 0 : 1];
      drawCheck(ctx, squareRect(mated, flipped));
    }
    const sliding = slideAt >= 0 && now - slideAt < SLIDE_TIME;
    const hidden = new Set<number>();
    if (sliding) for (const s of slides) hidden.add(s.to);
    if (drag?.moved) hidden.add(drag.sq);
    for (let sq = 0; sq < 64; sq++) {
      const v = g.pos.b[sq];
      if (!v || hidden.has(sq)) continue;
      const r = squareRect(sq, flipped);
      drawPiece(ctx, v, r.x, r.y, SQ);
    }
    for (const sq of targets) drawTarget(ctx, squareRect(sq, flipped), g.pos.b[sq] !== 0 || (Math.abs(g.pos.b[selected]) === PAWN && fileOf(sq) !== fileOf(selected)));
    if (sliding) {
      const e = easeOutCubic(clamp((now - slideAt) / SLIDE_TIME, 0, 1));
      for (const s of slides) {
        const a = squareRect(s.from, flipped);
        const b = squareRect(s.to, flipped);
        drawPiece(ctx, s.piece, a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, SQ);
      }
    }
    drawCoords(ctx, flipped);
    if (drag?.moved) {
      const v = g.pos.b[drag.sq];
      const size = SQ * 1.2;
      // Lifted above the finger so it isn't hidden under it
      if (v) drawPiece(ctx, v, drag.x - size / 2, drag.y - size * 0.85, size);
    }
  }

  /** The last moves in notation, newest on the right, in the player's piece letters. */
  function drawMoveStrip() {
    const g = current();
    if (!g.san.length) return;
    const t = tr();
    const local = (s: string) => s.replace(/[KQRBN]/g, (c) => t.letters[c] ?? c);
    const parts: string[] = [];
    for (let i = 0; i < g.san.length; i++) parts.push(i % 2 === 0 ? `${i / 2 + 1}. ${local(g.san[i])}` : local(g.san[i]));
    ctx.font = `600 18px ${FONT}`;
    let line = "";
    for (let i = parts.length - 1; i >= 0; i--) {
      const next = line ? `${parts[i]}  ${line}` : parts[i];
      if (ctx.measureText(next).width > W - 60) break;
      line = next;
    }
    text(ctx, line, W / 2, MOVES_Y, 18, CREAM_SOFT, "center", 600);
  }

  function statusLine(): { text: string; color: string } | null {
    const t = tr();
    const g = current();
    if (g.result) return null;
    if (match) {
      if (myColor === 0) return { text: t.watching, color: CREAM_SOFT };
      if (match.phase !== "play") return null;
      if (match.offer !== null && match.offer !== me) return { text: t.theyOffer(nameOf(match.offer)), color: AMBER };
      if (match.game.pos.turn === myColor) {
        if (checkedKing(g.pos) >= 0) return { text: t.check, color: RED };
        return { text: selected >= 0 ? t.tapTarget : t.yourTurn, color: CREAM };
      }
      return { text: t.turnOf(nameOf(seatOf(match.game.pos.turn))), color: CREAM_SOFT };
    }
    if (mode === "ai" && g.pos.turn !== human) return { text: t.aiThinking, color: CREAM_SOFT };
    if (checkedKing(g.pos) >= 0) return { text: t.check, color: RED };
    if (selected >= 0) return { text: t.tapTarget, color: CREAM };
    if (mode === "hot") return { text: t.turnOf(t.side(g.pos.turn === WHITE)), color: CREAM };
    return { text: g.history.length < 2 ? t.tapPiece : t.yourTurn, color: CREAM };
  }

  function drawStatus() {
    const away = [card(WHITE), card(BLACK)].find((c) => c.away)?.away;
    const s = statusLine();
    if (away) text(ctx, away, W / 2, STATUS_Y, fitSize(ctx, away, 22, W - 40), RED);
    else if (notice && now < notice.until) text(ctx, notice.text, W / 2, STATUS_Y, fitSize(ctx, notice.text, 22, W - 40, 700), AMBER, "center", 700);
    else if (s) text(ctx, s.text, W / 2, STATUS_Y, fitSize(ctx, s.text, 24, W - 40), s.color);
  }

  function dim(alpha = 0.55) {
    ctx.fillStyle = `rgba(14,8,4,${alpha})`;
    const v = stage.view;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function drawMenu() {
    dim();
    const t = tr();
    drawPanel(ctx, MENU, PANEL, 22);
    drawTitle(ctx, t.title, W / 2, MENU.y + 84, fitSize(ctx, t.title, 88, MENU.w - 60));
    // A pair of pieces either side of the title
    drawPiece(ctx, KNIGHT, MENU.x + 20, MENU.y + 40, 70);
    drawPiece(ctx, -QUEEN, MENU.x + MENU.w - 90, MENU.y + 40, 70);
    text(ctx, t.subtitle, W / 2, MENU.y + 148, fitSize(ctx, t.subtitle, 20, MENU.w - 50, 600), CREAM_SOFT, "center", 600);
    text(ctx, t.vsAi, W / 2, MENU.y + 202, 26, CREAM, "center", 700);
    text(ctx, t.playAs, W / 2, MENU.y + 240, 18, CREAM_SOFT, "center", 600);
    const list = menuButtons();
    for (const b of list) drawButton(ctx, b);
    for (const d of DIFFICULTIES) {
      const b = list.find((x) => x.id === `ai:${d}`);
      if (b && tally[d].w > 0) text(ctx, t.wins(tally[d].w), b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h + 18, 16, CREAM_SOFT, "center", 600);
    }
    ctx.strokeStyle = "rgba(247,232,201,0.14)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MENU.x + 40, MENU.y + 470);
    ctx.lineTo(MENU.x + MENU.w - 40, MENU.y + 470);
    ctx.stroke();
    text(ctx, t.hotseatHint, W / 2, MENU.y + 596, fitSize(ctx, t.hotseatHint, 17, MENU.w - 60, 600), CREAM_SOFT, "center", 600);
    if (canResume()) {
      ctx.strokeStyle = CREAM_SOFT;
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
    drawPanel(ctx, RULES, PANEL, 22);
    text(ctx, t.rules, W / 2, RULES.y + 46, 32, CREAM, "center", 700);
    let y = RULES.y + 100;
    for (const line of t.rulesLines) {
      ctx.fillStyle = AMBER;
      ctx.beginPath();
      ctx.arc(RULES.x + 30, y, 4, 0, Math.PI * 2);
      ctx.fill();
      for (const l of wrap(ctx, line, 19, RULES.w - 76)) {
        text(ctx, l, RULES.x + 46, y, 19, CREAM, "left", 600);
        y += 27;
      }
      y += 10;
    }
    drawButton(ctx, rulesClose());
  }

  function drawPromo() {
    if (!promo) return;
    const t = tr();
    const color = Math.sign(current().pos.b[promo.from]) || 1;
    ctx.fillStyle = "rgba(14,8,4,0.45)";
    ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
    drawPanel(ctx, PROMO, PANEL, 20, AMBER);
    text(ctx, t.promoteTo, W / 2, PROMO.y + 38, 24, CREAM, "center", 700);
    for (const [i, r] of promoCells().entries()) {
      drawPanel(ctx, r, i === 0 ? "#6a4a2e" : PANEL_HI, 14);
      drawPiece(ctx, PROMOS[i] * color, r.x + 6, r.y + 6, r.w - 12);
    }
    text(ctx, t.cancel, W / 2, PROMO.y + PROMO.h - 32, 17, CREAM_SOFT, "center", 600);
  }

  function drawResult() {
    const t = tr();
    const k = clamp((now - decidedAt - RESULT_DELAY * (online ? 0.6 : 1)) / 0.25, 0, 1);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 30);
    drawPanel(ctx, RESULT, PANEL, 22, AMBER);
    let title = "";
    let line = "";
    let color = CREAM;
    if (match) {
      const won = match.winner === me && me >= 0;
      title =
        match.winner === null ? t.draw : myColor === 0 ? t.winOf(match.seats[match.winner]?.name ?? "") : won ? t.matchWin : t.matchLose;
      const loser = match.winner === null ? -1 : 1 - match.winner;
      line =
        match.reason === "resign" && loser >= 0
          ? t.resignedBy(nameOf(loser))
          : match.reason === "forfeit" && loser >= 0
            ? t.leftBy(nameOf(loser))
            : match.reason
              ? t.reason[match.reason]
              : "";
      const mine = results?.find((r) => r.seat === me);
      if (mine && mine.score > 0) line = `${line} · ${t.score(mine.score)}`;
      color = match.winner === null ? CREAM : won || myColor === 0 ? AMBER : RED;
    } else {
      const r = game.result;
      if (!r) return ctx.restore();
      const why = t.reason[r.reason];
      if (r.winner === 0) {
        title = t.draw;
        line = why;
      } else if (mode === "hot") {
        title = t.winOf(t.side(r.winner === WHITE));
        line = `${why} · ${t.side(true)} ${hotWins.white} – ${hotWins.black} ${t.side(false)}`;
        color = AMBER;
      } else if (r.winner === human) {
        title = t.youWin;
        const moves = movesBy(game, human);
        line = `${why} · ${t.winLine(moves, runScore(moves))}`;
        color = AMBER;
      } else {
        title = t.youLose;
        line = `${why} · ${t.loseLine}`;
        color = RED;
      }
    }
    text(ctx, title, W / 2, RESULT.y + 50, fitSize(ctx, title, 40, RESULT.w - 40, 700), color, "center", 700);
    if (line) text(ctx, line, W / 2, RESULT.y + 104, fitSize(ctx, line, 21, RESULT.w - 40, 600), CREAM_SOFT, "center", 600);
    for (const b of resultButtons()) drawButton(ctx, b);
    ctx.restore();
  }

  function render() {
    stage.begin();
    drawBackdrop(ctx, stage.view);
    drawCards();
    drawPosition();
    if (showResult()) drawResult();
    else {
      drawStatus();
      drawMoveStrip();
      for (const b of buttons()) drawButton(ctx, b);
    }
    drawPromo();
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
        if (promo) promo = null;
        else if (overlay === "rules") overlay = rulesFrom;
        else if (overlay === "menu" && canResume()) overlay = null;
        else if (!overlay) overlay = "menu";
      } else if (e.code === "KeyU" && !online) undoOffline();
      else if (e.code === "KeyF" && !online) {
        flipped = !flipped;
        save();
      }
    },
    dispose() {
      stopListening?.();
      save();
    },
  };
}
