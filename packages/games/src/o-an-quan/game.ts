import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/800.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, easeOutCubic, inRect, mulberry32 } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import { chooseMove } from "./ai";
import {
  ARROW_H,
  ARROW_W,
  BACKDROP_FALLBACK,
  BOARD,
  BUTTON_H,
  BUTTON_Y,
  type Button,
  CARD_BOTTOM,
  CARD_TOP,
  NOTICE_Y,
  PEBBLE,
  QUAN_STONE,
  STATUS_Y,
  THEME,
  type Theme,
  drawArrow,
  drawBackdrop,
  drawBadge,
  drawBoard,
  drawButton,
  drawPebble,
  drawQuanStone,
  drawTitle,
  fitSize,
  haloText,
  hash,
  isBottomSlot,
  isTopSlot,
  lightPit,
  panel,
  pileSpot,
  ringPit,
  slotAt,
  slotCentre,
  stoneSpot,
  text,
  wrap,
} from "./art";
import {
  AI_DELAY,
  CAPTURE_STEP,
  DIFFICULTIES,
  type Difficulty,
  MARGIN_BONUS,
  PITS,
  RECONNECT_SECONDS,
  REFILL_STEP,
  SOW_STEP,
  SWEEP_STEP,
  TAKE_STEP,
  THEMES,
  TURN_SECONDS,
  type ThemeId,
  W,
  WIN_SCORE,
  winsNeeded,
} from "./config";
import bgDongHo from "./img/bg-dong-ho.webp";
import bgSanGach from "./img/bg-san-gach.webp";
import bgSonMai from "./img/bg-son-mai.webp";
import stonesDongHo from "./img/stones-dong-ho.webp";
import stonesSanGach from "./img/stones-san-gach.webp";
import stonesSonMai from "./img/stones-son-mai.webp";
import {
  type Dir,
  type Game,
  type Match,
  type MatchEvent,
  type Move,
  type Seat,
  type Step,
  canMove,
  cloneGame,
  createMatch,
  finalPoints,
  isQuanPit,
  newGame,
  otherSeat,
  ownerOf,
  play,
  pointsOf,
  rowOf,
} from "./logic";
import { bestOfOf, quanNonOf } from "./online";
import { STRINGS } from "./strings";

// The imperative shell for Ô Ăn Quan: the menu (level, theme, the young-quan
// rule), a game against the computer or a friend on the same phone, and the
// online branch, which only sends "sow pit N this way" and plays back what the
// room sends (docs/standards/online-multiplayer.md). Every move — offline or
// online — is a list of steps from logic.ts, played out one stone at a time on
// a copy of the board (`shown`), so both look the same.

const RESULT_DELAY = 0.7;
const SWIPE = 28;

type Mode = "ai" | "hot";
type Tally = Record<Difficulty, { w: number; l: number }>;

interface SavedRun {
  mode: Mode;
  level: Difficulty;
  first: Seat;
  quanNon: boolean;
  moves: Move[];
}

function parseRun(raw: unknown): SavedRun | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<SavedRun>;
  if ((r.mode !== "ai" && r.mode !== "hot") || !DIFFICULTIES.includes(r.level as Difficulty)) return null;
  if ((r.first !== 0 && r.first !== 1) || typeof r.quanNon !== "boolean" || !Array.isArray(r.moves)) return null;
  return r as SavedRun;
}

/** Seconds a step takes on screen (the same table as stepsTime in logic.ts). */
function stepDur(s: Step) {
  switch (s.k) {
    case "drop":
      return SOW_STEP;
    case "take":
      return TAKE_STEP;
    case "capture":
      return CAPTURE_STEP;
    case "refill":
      return REFILL_STEP;
    case "sweep":
      return SWEEP_STEP;
    default:
      return 0;
  }
}

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const online = rt.game.online ?? null;

  const load = (src: string) => {
    const img = new Image();
    img.src = src;
    return img;
  };
  const BG: Record<ThemeId, HTMLImageElement> = {
    "san-gach": load(bgSanGach),
    "son-mai": load(bgSonMai),
    "dong-ho": load(bgDongHo),
  };
  const STONES: Record<ThemeId, HTMLImageElement> = {
    "san-gach": load(stonesSanGach),
    "son-mai": load(stonesSonMai),
    "dong-ho": load(stonesDongHo),
  };
  const savedTheme = storage.get<ThemeId>("theme", "san-gach");
  let theme: ThemeId = THEMES.includes(savedTheme) ? savedTheme : "san-gach";
  const th = (): Theme => THEME[theme];

  // ---------------------------------------------------------------- offline state

  /** Against the computer you are seat 0 (the bottom row); who opens alternates. */
  const HUMAN: Seat = 0;
  let mode: Mode = "ai";
  const savedLevel = storage.get<Difficulty>("level", "normal");
  let level: Difficulty = DIFFICULTIES.includes(savedLevel) ? savedLevel : "normal";
  let quanNonPref = storage.get<boolean>("quanNon", false) === true;
  let first: Seat = 0;
  let game: Game = newGame(first, quanNonPref);
  let moves: Move[] = [];
  let decided = false;
  const tally: Tally = {
    easy: { w: 0, l: 0 },
    normal: { w: 0, l: 0 },
    hard: { w: 0, l: 0 },
    ...storage.get<Partial<Tally>>("tally", {}),
  };
  /** Hot-seat wins this session, by seat. */
  const hotWins = [0, 0];
  let overlay: "menu" | "rules" | null = online ? null : "menu";
  let aiAt: number | null = null;
  const rand = mulberry32((Date.now() ^ 0x0a9) >>> 0);

  const saved = online ? null : parseRun(storage.get<unknown>("run", null));
  if (saved) {
    mode = saved.mode;
    level = saved.level;
    first = saved.first;
    game = newGame(first, saved.quanNon);
    for (const m of saved.moves) {
      if (!play(game, m)) break;
      moves.push(m);
    }
    if (game.over) {
      game = newGame(first, quanNonPref);
      moves = [];
    } else if (moves.length > 0) overlay = null;
  }
  const save = () => {
    if (online) return;
    storage.set("run", game.over ? null : ({ mode, level, first, quanNon: game.quanNon, moves } satisfies SavedRun));
  };

  // ---------------------------------------------------------------- online state

  const me = online ? online.seat : -1;
  let match: Match | null = online
    ? createMatch(
        online.seed,
        online.seats.map((s) => s.name),
        bestOfOf(online.settings),
        quanNonOf(online.settings),
      )
    : null;
  let results: SeatResult[] | null = null;
  let pending: { move: Move; at: number } | null = null;
  let seq = 0;

  // ---------------------------------------------------------------- the view

  /** The player online sits at the bottom: seat 1's pits are turned half round. */
  const rot = me === 1 ? 6 : 0;
  const slotOf = (pit: number) => (pit + rot) % PITS;
  const pitOf = (slot: number) => (slot - rot + PITS) % PITS;
  const bottomSeat: Seat = me === 1 ? 1 : 0;
  const topSeat: Seat = otherSeat(bottomSeat);
  const cardOf = (s: Seat) => (s === bottomSeat ? CARD_BOTTOM : CARD_TOP);

  const authority = (): Game => (match ? match.game : game);
  /** The board as drawn: lags the rules while a move plays out. */
  let shown: Game = cloneGame(authority());

  type Queued = { kind: "steps"; steps: Step[]; seat: Seat } | { kind: "reset"; first: Seat; n: number };
  const queue: Queued[] = [];
  let anim: { steps: Step[]; seat: Seat; i: number; t: number } | null = null;
  /** Stones in hand: how many, and the pit it is moving from/to. */
  const hand = { n: 0, from: 0, to: 0, k: 1 };
  const pops = new Map<number, number>();
  interface Flyer {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    t0: number;
    dur: number;
    quan: number | null;
    variant: number;
  }
  let flyers: Flyer[] = [];
  let floaters: { text: string; x: number; y: number; t0: number; color: string }[] = [];
  let notice: { text: string; until: number } | null = null;
  let now = 0;
  let selected: number | null = null;
  let overAt: number | null = null;

  const busy = () => anim !== null || queue.length > 0;

  // ---------------------------------------------------------------- sound

  const sfx = {
    pick: () => audio.tone({ freq: 880, dur: 0.03, type: "triangle", vol: 0.04 }),
    take: () => audio.tone({ freq: 260, to: 420, dur: 0.09, type: "sine", vol: 0.06 }),
    drop: () => {
      audio.tone({ freq: 1500 + rand() * 500, dur: 0.025, type: "triangle", vol: 0.06 });
      audio.tone({ freq: 190 + rand() * 40, dur: 0.05, type: "sine", vol: 0.05 });
    },
    capture: (big: boolean) => {
      const notes = big ? [523, 659, 784, 1047] : [660, 880];
      for (const [i, f] of notes.entries()) audio.tone({ freq: f, dur: 0.14, type: "triangle", vol: 0.08, delay: i * 0.08 });
    },
    refill: () => audio.tone({ freq: 330, to: 262, dur: 0.25, type: "sine", vol: 0.06 }),
    win: () => {
      for (const [i, f] of [523, 659, 784, 1047].entries()) audio.tone({ freq: f, dur: 0.16, type: "triangle", vol: 0.1, delay: i * 0.1 });
    },
    lose: () => {
      for (const [i, f] of [392, 330, 262].entries()) audio.tone({ freq: f, dur: 0.2, type: "sine", vol: 0.08, delay: i * 0.14 });
    },
    tick: () => audio.tone({ freq: 1200, dur: 0.02, type: "square", vol: 0.02 }),
    nope: () => audio.tone({ freq: 180, dur: 0.08, type: "square", vol: 0.03 }),
  };

  // ---------------------------------------------------------------- names

  function nameOf(s: Seat): string {
    const t = tr();
    if (match) return s === me ? t.you : (match.seats[s]?.name ?? "");
    if (mode === "hot") return t.player(s === 0 ? 1 : 2);
    return s === HUMAN ? t.you : t.ai(level);
  }

  // ---------------------------------------------------------------- playing out steps

  /** Where captured stones fly to: the pile in the seat's card. */
  const pileAt = (s: Seat) => {
    const c = cardOf(s);
    return { x: c.x + c.w - 112, y: c.y + c.h / 2 };
  };

  function fly(from: { x: number; y: number }, to: { x: number; y: number }, count: number, quan: number | null, spread = 0.035) {
    for (let i = 0; i < count; i++) {
      flyers.push({
        x0: from.x + (hash(i, 7) - 0.5) * 22,
        y0: from.y + (hash(i, 9) - 0.5) * 26,
        x1: to.x + (hash(i, 3) - 0.5) * 40,
        y1: to.y + (hash(i, 5) - 0.5) * 30,
        t0: now + i * spread,
        dur: 0.45,
        quan,
        variant: Math.floor(hash(i, count) * 6),
      });
    }
  }

  function beginStep(s: Step) {
    const t = tr();
    switch (s.k) {
      case "take":
        shown.dan[s.pit] = 0;
        hand.n = s.n;
        hand.from = s.pit;
        hand.to = s.pit;
        sfx.take();
        break;
      case "drop":
        hand.from = hand.to;
        hand.to = s.pit;
        break;
      case "capture": {
        const c = slotCentre(slotOf(s.pit));
        fly(c, pileAt(s.seat), Math.min(s.dan, 24), null);
        if (s.quan) fly(c, pileAt(s.seat), 1, s.pit === 0 ? 0 : 1);
        shown.dan[s.pit] = 0;
        if (s.quan) shown.quan[s.pit === 0 ? 0 : 1] = false;
        const pts = s.dan + (s.quan ? 10 : 0);
        floaters.push({ text: t.captured(pts), x: c.x, y: c.y - 20, t0: now, color: th().seat[s.seat === bottomSeat ? 0 : 1] });
        if (s.quan) notice = { text: t.quanTaken, until: now + 1.6 };
        sfx.capture(s.quan);
        break;
      }
      case "stop":
        hand.n = 0;
        if (s.why === "young") notice = { text: t.youngQuan, until: now + 1.6 };
        break;
      case "refill":
        hand.n = 0;
        for (const p of rowOf(s.seat)) fly(pileAt(s.seat), slotCentre(slotOf(p)), 1, null, 0);
        notice = { text: t.refill(nameOf(s.seat), s.borrowed), until: now + 2.2 };
        sfx.refill();
        break;
      case "sweep":
        hand.n = 0;
        for (const p of rowOf(s.seat)) {
          if (shown.dan[p] > 0) fly(slotCentre(slotOf(p)), pileAt(s.seat), Math.min(shown.dan[p], 8), null);
          shown.dan[p] = 0;
        }
        notice = { text: t.sweep, until: now + 1.8 };
        break;
      case "end":
        hand.n = 0;
        break;
    }
  }

  function finishStep(s: Step) {
    switch (s.k) {
      case "drop":
        shown.dan[s.pit]++;
        hand.n = Math.max(0, hand.n - 1);
        pops.set(s.pit, now);
        sfx.drop();
        break;
      case "capture":
        shown.caps[s.seat] += s.dan;
        if (s.quan) shown.quans[s.seat]++;
        break;
      case "refill": {
        const o = otherSeat(s.seat);
        shown.caps[s.seat] -= s.own;
        shown.caps[o] -= s.borrowed;
        shown.debt[s.seat] += s.borrowed;
        for (const p of rowOf(s.seat)) {
          shown.dan[p] = 1;
          pops.set(p, now);
        }
        break;
      }
      case "sweep":
        shown.caps[s.seat] += s.dan;
        break;
      case "end":
        shown.over = true;
        shown.winner = s.winner;
        break;
    }
  }

  function enqueue(q: Queued) {
    queue.push(q);
  }

  function advance(dt: number) {
    if (!anim) {
      const next = queue.shift();
      if (!next) return;
      if (next.kind === "reset") {
        shown = newGame(next.first, match?.quanNon ?? false);
        selected = null;
        pending = null;
        overAt = null;
        notice = { text: `${tr().gameN(next.n)} · ${tr().firstMove(nameOf(next.first))}`, until: now + 2.4 };
        return;
      }
      anim = { steps: next.steps, seat: next.seat, i: 0, t: 0 };
      // Moves always start from the turn they were played in
      shown.turn = next.seat;
      if (anim.steps[0]) beginStep(anim.steps[0]);
    }
    anim.t += dt;
    for (;;) {
      const step = anim.steps[anim.i];
      if (!step) break;
      const d = stepDur(step);
      hand.k = d > 0 ? clamp(anim.t / d, 0, 1) : 1;
      if (anim.t < d) return;
      anim.t -= d;
      finishStep(step);
      anim.i++;
      const nextStep = anim.steps[anim.i];
      if (nextStep) beginStep(nextStep);
    }
    anim = null;
    hand.n = 0;
  }

  // ---------------------------------------------------------------- offline flow

  function startGame(m: Mode, lv: Difficulty = level) {
    // A rematch swaps who opens; a new opponent starts with you
    first = m === mode && lv === level && moves.length > 0 ? otherSeat(first) : 0;
    mode = m;
    level = lv;
    storage.set("level", level);
    game = newGame(first, quanNonPref);
    moves = [];
    decided = false;
    queue.length = 0;
    anim = null;
    hand.n = 0;
    flyers = [];
    floaters = [];
    notice = null;
    shown = cloneGame(game);
    selected = null;
    aiAt = null;
    overlay = null;
    overAt = null;
    save();
  }

  function playOffline(m: Move) {
    const seat = game.turn;
    const steps = play(game, m);
    if (!steps) return sfx.nope();
    moves.push(m);
    selected = null;
    enqueue({ kind: "steps", steps, seat });
    save();
  }

  /** Once the last move has played out: sounds, tallies, the score. */
  function decide() {
    decided = true;
    overAt = now;
    const w = game.winner;
    const [a, b] = finalPoints(game);
    if (mode === "hot") {
      if (w !== null) hotWins[w]++;
      sfx.win();
      return;
    }
    if (w === HUMAN) {
      sfx.win();
      tally[level].w++;
      const margin = a - b;
      reportScore?.({ score: winScore(margin), detail: tr().detail(level, margin) });
      const best = [...DIFFICULTIES].reverse().find((d) => tally[d].w > 0) ?? level;
      storage.set(SUMMARY_KEY, {
        vi: STRINGS.vi.summary(best, tally[best].w),
        en: STRINGS.en.summary(best, tally[best].w),
      });
    } else if (w !== null) {
      sfx.lose();
      tally[level].l++;
    } else sfx.win();
    storage.set("tally", tally);
  }

  const winScore = (margin: number) => WIN_SCORE[level] + Math.max(0, margin) * MARGIN_BONUS[level];

  // ---------------------------------------------------------------- online flow

  function onEvent(e: MatchEvent) {
    if (!match) return;
    switch (e.type) {
      case "move":
        enqueue({ kind: "steps", steps: e.steps, seat: e.seat });
        if (e.seat === me) {
          pending = null;
          selected = null;
          if (e.auto) notice = { text: tr().timedOut, until: now + 2.5 };
        }
        break;
      case "game":
        enqueue({ kind: "reset", first: e.first, n: e.n });
        break;
      case "over":
        break;
    }
  }

  const stopListening = online?.onMessage((m) => {
    if (m.t === "snap" && m.state) {
      match = m.state as Match;
      if (pending && match.game.turn !== me) pending = null;
    } else if (m.t === "ev") {
      for (const e of m.events as MatchEvent[]) onEvent(e);
    } else if (m.t === "end") {
      results = m.results;
    }
  });

  function sendMove(mv: Move) {
    if (!online) return;
    pending = { move: mv, at: now };
    online.send({ seq: ++seq, move: { x: 0, y: 0 }, actions: [{ type: "sow", pit: mv.pit, dir: mv.dir }] });
  }

  // ---------------------------------------------------------------- input

  /** The seat the person holding the phone can move for right now, or null. */
  function actor(): Seat | null {
    if (overlay || busy()) return null;
    if (match) {
      if (me < 0 || match.phase !== "play" || pending || match.game.over) return null;
      return match.game.turn === me ? (me as Seat) : null;
    }
    if (game.over) return null;
    if (mode === "hot") return game.turn;
    return game.turn === HUMAN ? HUMAN : null;
  }

  /** Ring direction for "sow towards screen right" from a pit. */
  const dirFor = (pit: number, right: boolean): Dir => {
    const bottom = isBottomSlot(slotOf(pit));
    return (bottom === right ? 1 : -1) as Dir;
  };

  function sow(pit: number, right: boolean) {
    const mv: Move = { pit, dir: dirFor(pit, right) };
    if (!canMove(authority(), mv)) return sfx.nope();
    selected = null;
    if (online) sendMove(mv);
    else playOffline(mv);
  }

  function arrowRects(pit: number): { left: Rect; right: Rect } {
    const slot = slotOf(pit);
    const c = slotCentre(slot);
    const y = isTopSlot(slot) ? BOARD.y - 12 - ARROW_H : BOARD.y + BOARD.h + 12;
    const lx = clamp(c.x - ARROW_W - 5, 8, W - 2 * ARROW_W - 18);
    return {
      left: { x: lx, y, w: ARROW_W, h: ARROW_H },
      right: { x: lx + ARROW_W + 10, y, w: ARROW_W, h: ARROW_H },
    };
  }

  function tapPit(pit: number) {
    const who = actor();
    if (who === null) return;
    if (ownerOf(pit) !== who || authority().dan[pit] === 0) {
      if (selected !== null) selected = null;
      else if (!isQuanPit(pit)) sfx.nope();
      return;
    }
    selected = selected === pit ? null : pit;
    sfx.pick();
  }

  function cycleTheme() {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    storage.set("theme", theme);
    sfx.pick();
  }

  function buttons(): Button[] {
    const t = tr();
    const themeBtn: Button = { id: "theme", rect: { x: 0, y: 0, w: 0, h: 0 }, label: t.themes[theme], sub: t.theme };
    const list: Button[] = online
      ? [themeBtn]
      : [{ id: "new", rect: { x: 0, y: 0, w: 0, h: 0 }, label: t.newGame }, themeBtn, { id: "menu", rect: { x: 0, y: 0, w: 0, h: 0 }, label: t.menu }];
    const gap = 14;
    const w = online ? 180 : (W - 40 - gap * (list.length - 1)) / list.length;
    const total = w * list.length + gap * (list.length - 1);
    list.forEach((b, i) => {
      b.rect = { x: (W - total) / 2 + i * (w + gap), y: BUTTON_Y, w, h: BUTTON_H };
    });
    return list;
  }

  function pressButton(id: string) {
    switch (id) {
      case "theme":
        return cycleTheme();
      case "new":
        sfx.pick();
        return startGame(mode, level);
      case "menu":
        sfx.pick();
        overlay = "menu";
        selected = null;
        return;
    }
  }

  // ---------------------------------------------------------------- overlays (layout shared by draw and tap)

  const MENU: Rect = { x: 26, y: 96, w: W - 52, h: 790 };
  function menuButtons(): Button[] {
    const t = tr();
    const x = MENU.x + 26;
    const w = MENU.w - 52;
    const lw = (w - 24) / 3;
    const list: Button[] = DIFFICULTIES.map((d, i) => ({
      id: `ai:${d}`,
      rect: { x: x + i * (lw + 12), y: MENU.y + 214, w: lw, h: 70 },
      label: t.level[d],
      primary: true,
      sub: tally[d].w > 0 ? `✓ ${tally[d].w}` : undefined,
    }));
    list.push({ id: "hot", rect: { x, y: MENU.y + 318, w, h: 66 }, label: t.hotseat });
    THEMES.forEach((id, i) => {
      list.push({ id: `theme:${id}`, rect: { x: x + i * (lw + 12), y: MENU.y + 486, w: lw, h: 112 }, label: t.themes[id], on: id === theme });
    });
    list.push({ id: "quanNon", rect: { x: x + w - 170, y: MENU.y + 624, w: 170, h: 52 }, label: t.quanNonValue(quanNonPref), on: quanNonPref });
    list.push({ id: "rules", rect: { x: x + w / 2 - 110, y: MENU.y + 704, w: 220, h: 56 }, label: t.rules });
    return list;
  }
  const canResume = () => !online && !game.over && moves.length > 0;
  const CLOSE: Rect = { x: MENU.x + MENU.w - 58, y: MENU.y + 12, w: 46, h: 46 };

  const RULES: Rect = { x: 22, y: 110, w: W - 44, h: 760 };
  const rulesClose = (): Button => ({
    id: "close",
    rect: { x: W / 2 - 100, y: RULES.y + RULES.h - 80, w: 200, h: 58 },
    label: tr().close,
    primary: true,
  });

  /** The result card sits under the board so the final position stays in view. */
  const RESULT: Rect = { x: 22, y: BOARD.y + BOARD.h + 20, w: W - 44, h: 262 };
  function resultButtons(): Button[] {
    const t = tr();
    const y = RESULT.y + RESULT.h - 82;
    if (online) return [{ id: "lobby", rect: { x: W / 2 - 120, y, w: 240, h: 62 }, label: t.backToLobby, primary: true }];
    const bw = (RESULT.w - 72) / 2;
    return [
      { id: "again", rect: { x: RESULT.x + 24, y, w: bw, h: 62 }, label: t.again, primary: true },
      { id: "menu", rect: { x: RESULT.x + 48 + bw, y, w: bw, h: 62 }, label: t.menu },
    ];
  }
  const showResult = () => overAt !== null && now - overAt > RESULT_DELAY && !overlay;

  function tap(p: { x: number; y: number }) {
    if (overlay === "rules") {
      if (inRect(p, rulesClose().rect) || !inRect(p, RULES)) {
        sfx.pick();
        overlay = online ? null : "menu";
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
      if (b.id === "rules") overlay = "rules";
      else if (b.id === "hot") startGame("hot");
      else if (b.id === "quanNon") {
        quanNonPref = !quanNonPref;
        storage.set("quanNon", quanNonPref);
      } else if (b.id.startsWith("theme:")) {
        theme = b.id.slice(6) as ThemeId;
        storage.set("theme", theme);
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
    }
    if (selected !== null && actor() !== null) {
      const a = arrowRects(selected);
      if (inRect(p, a.left)) return sow(selected, false);
      if (inRect(p, a.right)) return sow(selected, true);
    }
    if (!showResult()) {
      const b = buttons().find((b) => inRect(p, b.rect));
      if (b) {
        if (b.disabled) return sfx.nope();
        return pressButton(b.id);
      }
    }
    const slot = slotAt(p);
    if (slot !== null) tapPit(pitOf(slot));
    else selected = null;
  }

  // One finger: a tap picks a pit (then an arrow sows it); a sideways swipe on your own pit sows it straight away
  let press: { id: number; x: number; y: number } | null = null;
  const pointer = {
    down(p: PointerInfo) {
      if (!press) press = { id: p.id, x: p.x, y: p.y };
    },
    move(_p: PointerInfo) {},
    up(p: PointerInfo) {
      if (!press || press.id !== p.id) return;
      const start = press;
      press = null;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.2 && !overlay) {
        const slot = slotAt(start);
        const who = actor();
        if (slot !== null && who !== null) {
          const pit = pitOf(slot);
          if (ownerOf(pit) === who && authority().dan[pit] > 0) return sow(pit, dx > 0);
        }
        return;
      }
      if (Math.hypot(dx, dy) < 14) tap(p);
    },
  };

  // ---------------------------------------------------------------- update

  function update(dt: number) {
    now += dt;
    advance(dt);
    flyers = flyers.filter((f) => now < f.t0 + f.dur);
    floaters = floaters.filter((f) => now - f.t0 < 1.2);
    if (!busy()) {
      // In step with the rules whenever nothing is playing out
      shown = cloneGame(authority());
      hand.n = 0;
    }
    if (match) {
      if (pending && now - pending.at > 3) pending = null;
      if (match.phase === "play" && !match.game.over) {
        const before = Math.ceil(match.clock);
        match.clock = Math.max(0, match.clock - dt);
        if (actor() !== null && Math.ceil(match.clock) !== before && match.clock <= 5 && match.clock > 0) sfx.tick();
      }
      for (const s of match.seats) if (s.away !== null) s.away += dt;
      if (match.phase === "over" && !busy() && overAt === null) {
        overAt = now - (match.forfeit ? RESULT_DELAY : 0);
        if (match.winner === me) sfx.win();
        else if (me >= 0 && match.winner !== null) sfx.lose();
      }
      return;
    }
    if (game.over && !busy() && !decided) decide();
    if (overlay || mode !== "ai" || game.over || game.turn === HUMAN || busy()) {
      aiAt = null;
      return;
    }
    if (aiAt === null) aiAt = now + AI_DELAY;
    else if (now >= aiAt) {
      aiAt = null;
      const m = chooseMove(game, level, rand);
      if (m) playOffline(m);
    }
  }

  // ---------------------------------------------------------------- render

  function drawCard(s: Seat) {
    const t = tr();
    const T = th();
    const r = cardOf(s);
    const g = shown;
    const playing = match ? match.phase === "play" && !g.over : !g.over;
    const active = playing && g.turn === s && overlay === null;
    const lift = active ? 4 : 0;
    panel(ctx, T, r, 24, lift);
    const y = r.y - lift;
    const color = T.seat[s === bottomSeat ? 0 : 1];
    if (active) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(r.x + 3, y + 3, r.w - 6, r.h - 6, 21);
      ctx.stroke();
    }
    // Name and points
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(r.x + 30, y + 36, 9, 0, Math.PI * 2);
    ctx.fill();
    const name = nameOf(s);
    text(ctx, name, r.x + 48, y + 37, fitSize(ctx, name, 25, r.w - 290, 800), T.panelText, "left", 800);
    const pts = pointsOf(g, s);
    text(ctx, t.points(pts), r.x + 24, y + 84, 36, T.accent, "left", 800);
    const sub: string[] = [];
    if (g.debt[s] > 0) sub.push(t.debt(g.debt[s]));
    if (match) {
      // Games won, as pips
      const need = winsNeeded(match.bestOf);
      for (let k = 0; k < need; k++) {
        ctx.beginPath();
        ctx.arc(r.x + 30 + k * 22, y + r.h - 14, 7, 0, Math.PI * 2);
        ctx.fillStyle = k < (match.seats[s]?.wins ?? 0) ? color : "rgba(120,100,80,0.25)";
        ctx.fill();
      }
    } else if (mode === "hot") sub.push(t.wins(hotWins[s]));
    else sub.push(t.wins(s === HUMAN ? tally[level].w : tally[level].l));
    if (sub.length) text(ctx, sub.join(" · "), r.x + 168, y + 88, 17, T.panelSoft, "left", 600);
    // The captured pile
    const pile = pileAt(s);
    const pw = 170;
    const ph = r.h - 30;
    const img = STONES[theme];
    const n = Math.min(g.caps[s], 40);
    for (let i = 0; i < n; i++) {
      const q = pileSpot(i, pw, ph);
      drawPebble(ctx, T, img, Math.floor(hash(i, s + 11) * 6), pile.x + q.x, pile.y - lift + q.y, 19, hash(i, 2) * 6);
    }
    for (let k = 0; k < g.quans[s]; k++) drawQuanStone(ctx, T, img, k, pile.x - 50 + k * 44, pile.y - lift - 6, 46);
    // Online: the turn clock along the bottom edge
    if (active && match) {
      const k = clamp(match.clock / TURN_SECONDS, 0, 1);
      ctx.fillStyle = k < 0.25 ? "#d23a2a" : color;
      ctx.beginPath();
      ctx.roundRect(r.x + 120, y + r.h - 18, (r.w - 140) * k, 8, 4);
      ctx.fill();
    }
  }

  function drawStones() {
    const T = th();
    const img = STONES[theme];
    const g = shown;
    const who = actor();
    // The row to play lights up; the chosen pit gets a ring
    if (who !== null) for (const p of rowOf(who)) if (g.dan[p] > 0) lightPit(ctx, slotOf(p), T.glow);
    if (selected !== null) {
      lightPit(ctx, slotOf(selected), T.glow);
      ringPit(ctx, slotOf(selected), T.seat[ownerOf(selected) === bottomSeat ? 0 : 1]);
    }
    if (pending) lightPit(ctx, slotOf(pending.move.pit), T.glow);
    for (let p = 0; p < PITS; p++) {
      const slot = slotOf(p);
      const quanHere = isQuanPit(p) && g.quan[p === 0 ? 0 : 1];
      if (quanHere) {
        const c = slotCentre(slot);
        drawQuanStone(ctx, T, img, p === 0 ? 0 : 1, c.x, c.y, QUAN_STONE);
      }
      const n = g.dan[p];
      const shownN = Math.min(n, 40);
      const pop = pops.get(p);
      const k = pop === undefined ? 1 : clamp((now - pop) / 0.18, 0, 1);
      for (let i = 0; i < shownN; i++) {
        const s = stoneSpot(slot, i, shownN, quanHere);
        // The newest stone drops in
        const drop = i === shownN - 1 && k < 1 ? (1 - easeOutCubic(k)) * -16 : 0;
        drawPebble(ctx, T, img, Math.floor(hash(p * 97 + i, 13) * 6), s.x, s.y + drop, PEBBLE, hash(p, i) * 6);
      }
      if (n > 0) drawBadge(ctx, T, slot, n, pop === undefined ? 0 : 1 - k);
    }
  }

  function drawHand() {
    if (hand.n <= 0) return;
    const T = th();
    const a = slotCentre(slotOf(hand.from));
    const b = slotCentre(slotOf(hand.to));
    const k = easeOutCubic(hand.k);
    const x = a.x + (b.x - a.x) * k;
    const y = a.y + (b.y - a.y) * k - 30 - Math.sin(k * Math.PI) * 14;
    const img = STONES[theme];
    const shownN = Math.min(hand.n, 6);
    for (let i = 0; i < shownN; i++) {
      const q = pileSpot(i, 34, 24);
      drawPebble(ctx, T, img, i % 6, x + q.x, y + q.y, 20, i);
    }
    ctx.font = `800 16px "Baloo 2", sans-serif`;
    const label = `×${hand.n}`;
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = T.badge;
    ctx.beginPath();
    ctx.roundRect(x + 14, y - 30, w, 22, 11);
    ctx.fill();
    text(ctx, label, x + 14 + w / 2, y - 18, 16, T.badgeText, "center", 800);
  }

  function drawFlyers() {
    const T = th();
    const img = STONES[theme];
    for (const f of flyers) {
      if (now < f.t0) continue;
      const k = easeOutCubic(clamp((now - f.t0) / f.dur, 0, 1));
      const x = f.x0 + (f.x1 - f.x0) * k;
      const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 60;
      if (f.quan !== null) drawQuanStone(ctx, T, img, f.quan, x, y, 50);
      else drawPebble(ctx, T, img, f.variant, x, y, 20);
    }
    for (const f of floaters) {
      const k = (now - f.t0) / 1.2;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      haloText(ctx, T, f.text, f.x, f.y - k * 40, 30, 800, f.color);
      ctx.restore();
    }
  }

  function drawArrows() {
    if (selected === null || actor() === null) return;
    const a = arrowRects(selected);
    const pulse = 0.5 + 0.5 * Math.sin(now * 5);
    drawArrow(ctx, th(), a.left, false, pulse);
    drawArrow(ctx, th(), a.right, true, pulse);
  }

  function statusLine(): string {
    const t = tr();
    if (busy()) return "";
    if (match) {
      if (me < 0) return t.watching;
      if (match.phase !== "play" || match.game.over) return "";
      if (match.game.turn === me) return selected !== null ? t.pickDir : t.yourTurn;
      return t.turnOf(match.seats[match.game.turn]?.name ?? "");
    }
    if (game.over) return "";
    if (mode === "ai" && game.turn !== HUMAN) return t.aiThinking;
    if (selected !== null) return t.pickDir;
    if (mode === "hot") return `${t.turnOf(nameOf(game.turn))}`;
    return t.yourTurn;
  }

  function drawStatus() {
    const T = th();
    const t = tr();
    const away = match?.seats.findIndex((s) => s.away !== null) ?? -1;
    if (match && away >= 0) {
      const s = match.seats[away];
      const msg = t.away(away === me ? t.you : s.name, Math.max(0, Math.ceil(RECONNECT_SECONDS - (s.away ?? 0))));
      haloText(ctx, T, msg, W / 2, NOTICE_Y, fitSize(ctx, msg, 22, W - 40, 700), 700, "#ffb4a8");
    } else if (notice && now < notice.until) haloText(ctx, T, notice.text, W / 2, NOTICE_Y, fitSize(ctx, notice.text, 28, W - 40, 800), 800);
    else if (match && match.phase === "play" && !busy()) haloText(ctx, T, t.firstTo(winsNeeded(match.bestOf)), W / 2, NOTICE_Y, 20, 700);
    const s = statusLine();
    // The hint for the top player on a shared phone sits by their row
    if (!s) return;
    const y = !online && mode === "hot" && game.turn !== bottomSeat && !selected ? NOTICE_Y + 60 : STATUS_Y;
    haloText(ctx, T, s, W / 2, y, fitSize(ctx, s, 24, W - 40, 700), 700);
  }

  function dim() {
    ctx.fillStyle = "rgba(20,10,6,0.45)";
    const v = stage.view;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function drawMenu() {
    dim();
    const t = tr();
    const T = th();
    panel(ctx, T, MENU, 28);
    drawTitle(ctx, T, W / 2, MENU.y + 72, 66);
    text(ctx, t.subtitle, W / 2, MENU.y + 128, fitSize(ctx, t.subtitle, 19, MENU.w - 50), T.panelSoft);
    text(ctx, t.vsAi, W / 2, MENU.y + 186, 24, T.panelText, "center", 800);
    const list = menuButtons();
    for (const b of list) {
      if (b.id.startsWith("theme:")) drawThemeSwatch(b);
      else drawButton(ctx, T, b);
    }
    text(ctx, t.hotseatHint, W / 2, MENU.y + 404, fitSize(ctx, t.hotseatHint, 17, MENU.w - 60), T.panelSoft);
    text(ctx, t.theme, W / 2, MENU.y + 458, 24, T.panelText, "center", 800);
    text(ctx, t.quanNon, MENU.x + 30, MENU.y + 650, 22, T.panelText, "left", 800);
    if (canResume()) {
      ctx.strokeStyle = T.panelSoft;
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

  /** A theme choice: a crop of its backdrop with two of its stones. */
  function drawThemeSwatch(b: Button) {
    const id = b.id.slice(6) as ThemeId;
    const T = THEME[id];
    const r = b.rect;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 16);
    ctx.clip();
    const bg = BG[id];
    ctx.fillStyle = BACKDROP_FALLBACK[id];
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (bg.complete && bg.naturalWidth) {
      // The middle of the backdrop (its calm part)
      const sw = bg.naturalWidth * 0.5;
      const sh = (sw * r.h) / r.w;
      ctx.drawImage(bg, bg.naturalWidth * 0.25, bg.naturalHeight * 0.2, sw, sh, r.x, r.y, r.w, r.h);
    }
    drawQuanStone(ctx, T, STONES[id], 0, r.x + r.w / 2 - 20, r.y + 42, 40);
    drawPebble(ctx, T, STONES[id], 1, r.x + r.w / 2 + 16, r.y + 38, 22);
    drawPebble(ctx, T, STONES[id], 4, r.x + r.w / 2 + 26, r.y + 56, 22);
    ctx.fillStyle = "rgba(20,10,6,0.55)";
    ctx.fillRect(r.x, r.y + r.h - 34, r.w, 34);
    text(ctx, b.label, r.x + r.w / 2, r.y + r.h - 16, fitSize(ctx, b.label, 18, r.w - 10, 800), "#fff8ea", "center", 800);
    ctx.restore();
    ctx.lineWidth = b.on ? 5 : 2;
    ctx.strokeStyle = b.on ? th().accent : "rgba(120,90,60,0.4)";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 16);
    ctx.stroke();
  }

  function drawRules() {
    dim();
    const t = tr();
    const T = th();
    panel(ctx, T, RULES, 26);
    text(ctx, t.rules, W / 2, RULES.y + 46, 32, T.panelText, "center", 800);
    ctx.font = `600 19px "Baloo 2", sans-serif`;
    let y = RULES.y + 98;
    for (const line of t.rulesLines) {
      const lines = wrap(ctx, line, RULES.w - 76);
      ctx.fillStyle = T.accent;
      ctx.beginPath();
      ctx.arc(RULES.x + 30, y, 5, 0, Math.PI * 2);
      ctx.fill();
      for (const l of lines) {
        text(ctx, l, RULES.x + 46, y, 19, T.panelText, "left", 600);
        y += 26;
      }
      y += 10;
    }
    drawButton(ctx, T, rulesClose());
  }

  function drawResult() {
    const t = tr();
    const T = th();
    const k = clamp((now - (overAt ?? now) - RESULT_DELAY) / 0.25, 0, 1);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 30);
    panel(ctx, T, RESULT, 26);
    let title = "";
    let line = "";
    let color = T.panelText;
    const [a, b] = finalPoints(shown);
    if (match) {
      const won = match.winner === me && me >= 0;
      title = match.winner === null ? t.matchDraw : me < 0 ? t.winOf(match.seats[match.winner]?.name ?? "") : won ? t.matchWin : t.matchLose;
      if (match.forfeit && me >= 0) line = won ? t.forfeitWin : t.forfeitLose;
      const mine = results?.find((r) => r.seat === me);
      if (mine && mine.score > 0) line = line ? `${line} · ${t.score(mine.score)}` : t.score(mine.score);
      if (!line) line = `${match.seats[0]?.wins ?? 0} – ${match.seats[1]?.wins ?? 0}`;
      if (match.winner !== null) color = T.seat[match.winner === bottomSeat ? 0 : 1];
    } else {
      const w = game.winner;
      if (w === null) title = t.draw;
      else if (mode === "hot") title = t.winOf(nameOf(w));
      else title = w === HUMAN ? t.youWin : t.youLose;
      line = mode === "ai" && w === HUMAN ? t.winLine(a - b, winScore(a - b)) : "";
      if (w !== null) color = T.seat[w === bottomSeat ? 0 : 1];
    }
    text(ctx, title, W / 2, RESULT.y + 46, fitSize(ctx, title, 40, RESULT.w - 40, 800), color, "center", 800);
    const pts = bottomSeat === 0 ? t.finalLine(a, b) : t.finalLine(b, a);
    text(ctx, pts, W / 2, RESULT.y + 92, 24, T.panelText, "center", 800);
    if (line) text(ctx, line, W / 2, RESULT.y + 128, fitSize(ctx, line, 19, RESULT.w - 40), T.panelSoft);
    for (const btn of resultButtons()) drawButton(ctx, T, btn);
    ctx.restore();
  }

  function drawBetween() {
    if (match?.phase !== "between" || busy()) return;
    const t = tr();
    const T = th();
    const w = match.game.winner;
    const msg = w === null ? t.draw : t.winOf(nameOf(w));
    const r: Rect = { x: 70, y: BOARD.y + BOARD.h / 2 - 50, w: W - 140, h: 100 };
    panel(ctx, T, r, 22);
    text(ctx, msg, W / 2, r.y + 40, fitSize(ctx, msg, 32, r.w - 30, 800), w === null ? T.panelText : T.seat[w === bottomSeat ? 0 : 1], "center", 800);
    text(ctx, `${match.seats[0]?.wins ?? 0} – ${match.seats[1]?.wins ?? 0}`, W / 2, r.y + 76, 20, T.panelSoft);
  }

  function render() {
    stage.begin();
    drawBackdrop(ctx, stage.view, BG[theme], BACKDROP_FALLBACK[theme]);
    drawCard(topSeat);
    drawCard(bottomSeat);
    drawBoard(ctx, th());
    drawStones();
    drawHand();
    drawFlyers();
    drawBetween();
    if (showResult()) drawResult();
    else {
      drawArrows();
      drawStatus();
      for (const b of buttons()) drawButton(ctx, th(), b);
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
        if (overlay === "rules") overlay = "menu";
        else if (overlay === "menu" && canResume()) overlay = null;
        else if (!overlay) overlay = "menu";
        return;
      }
      if (e.code === "KeyT") return cycleTheme();
      // 1–5 pick a pit of the row you play from (left to right on screen), ←/→ sow it
      const who = actor();
      if (who === null) return;
      const digit = /^Digit([1-5])$/.exec(e.code);
      if (digit) {
        const bottom = who === bottomSeat;
        const slot = bottom ? Number(digit[1]) : 12 - Number(digit[1]);
        tapPit(pitOf(slot));
      } else if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && selected !== null) sow(selected, e.code === "ArrowRight");
    },
    dispose() {
      stopListening?.();
      save();
    },
  };
}
