import "@fontsource/baloo-2/800.css";
import "@fontsource/mali/600.css";
import "@fontsource/mali/700.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, easeOutCubic, inRect } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import {
  BOARD_PX,
  type ButtonKind,
  FONT,
  GOLD,
  GOLD_DARK,
  INK,
  INK_SOFT,
  JADE,
  PAPER,
  RED,
  TITLE_FONT,
  drawBoard,
  drawButton,
  drawDeedChip,
  drawDie,
  drawPanel,
  drawTable,
  drawToken,
  fitSize,
  fitText,
  jailCell,
  roundRect,
  text,
  tileCenter,
  tokenSpot,
  tileRect,
  wrap,
} from "./art";
import { DECKS } from "./cards";
import {
  BEAT_BONUS,
  BOARD,
  DEFAULT_TIME_LIMIT,
  DICE_TIME,
  DIFFICULTIES,
  type Difficulty,
  GROUPS,
  GROUP_COLORS,
  HOP_TIME,
  JAIL,
  JAIL_FINE,
  LEVEL_MULT,
  MAX_PLAYERS,
  MIN_BID,
  OFFERS_PER_TURN,
  PLAYER_COLORS,
  SQUARES,
  TIME_LIMITS,
  TOKENS,
  W,
  ownable,
} from "./config";
import {
  type Action,
  type Bundle,
  type Game,
  type GameEvent,
  act,
  alive,
  canBuild,
  canManage,
  canMortgage,
  canSell,
  canUnmortgage,
  createGame,
  decider,
  deedsOf,
  minBid,
  mortgageValue,
  netWorth,
  offerOk,
  ownsGroup,
  placings,
  unmortgageCost,
} from "./logic";
import { BOT_NAMES } from "./online";
import { stepGame } from "./sim";
import { STRINGS, money } from "./strings";
import bannerArt from "./img/banner-art.webp";

// The imperative shell for Cờ Tỷ Phú: the setup menu, a pass-and-play table
// with computer players, and the online branch, which only sends decisions and
// draws the room's snapshots (docs/standards/online-multiplayer.md).
//
// The board is 1200 board-px square; a camera follows the token on the move
// (or shows the whole board), with a mini-map. Below it a panel holds the one
// decision that matters now; sheets open for assets, trades and deed cards.
// Events from the rules play back in order — dice, hops, then the toasts — so
// money never moves before the token gets there.

const SAVE_VERSION = 1;
const TAP_SLOP = 10;
const MAX_Z = 1.5;
const TOP_BAR = 56;
const STRIP_H = 82;
const PANEL_H = 290;
const TOAST_TIME = 3.2;
const CARD_TIME = 2.6;

interface Setup {
  players: number;
  humans: number;
  level: Difficulty;
  limit: number;
}

interface Saved {
  v: number;
  setup: Setup;
  game: Game;
  /** The last lines of the log, as shown. */
  log?: { text: string; color: string }[];
}

type Overlay = "menu" | "rules" | "assets" | "trade" | "deed" | "log" | null;

interface Hit {
  rect: Rect;
  fn: () => void;
}

interface Scroller {
  id: string;
  rect: Rect;
  max: number;
}

interface Toast {
  text: string;
  color: string;
  born: number;
}

interface Hop {
  seat: number;
  path: number[];
  t0: number;
}

function parseSaved(raw: unknown): Saved | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<Saved>;
  if (r.v !== SAVE_VERSION || !r.game || !r.setup || !Array.isArray(r.game.players) || r.game.phase === "over") return null;
  return r as Saved;
}

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const loc = () => rt.locale();
  const online = rt.game.online ?? null;
  const me = online ? online.seat : -1;

  // ---------------------------------------------------------------- state

  const defaults: Setup = { players: 4, humans: 1, level: "normal", limit: DEFAULT_TIME_LIMIT };
  const stored = storage.get<Partial<Setup>>("setup", {});
  const menuSetup: Setup = {
    players: clamp(Number(stored.players) || defaults.players, 2, MAX_PLAYERS),
    humans: clamp(Number(stored.humans) || defaults.humans, 1, MAX_PLAYERS),
    level: DIFFICULTIES.includes(stored.level as Difficulty) ? (stored.level as Difficulty) : defaults.level,
    limit: (TIME_LIMITS as readonly number[]).includes(Number(stored.limit)) ? Number(stored.limit) : defaults.limit,
  };
  menuSetup.humans = Math.min(menuSetup.humans, menuSetup.players);
  let current: Setup = { ...menuSetup };

  let game: Game | null = null;
  let saved = online ? null : parseSaved(storage.get<unknown>("run", null));
  let overlay: Overlay = online ? null : "menu";
  // A long game in progress picks up where it was left (the menu is one tap away)
  let rulesFrom: Overlay = null;
  let reported = false;
  const wins = storage.get<Record<Difficulty, number>>("wins", { easy: 0, normal: 0, hard: 0 });

  // Online
  let results: SeatResult[] | null = null;
  let seq = 0;
  let pendingSeq = -1;
  let pendingUntil = 0;

  // View
  let now = 0;
  const queue: GameEvent[] = [];
  let busyUntil = 0;
  let hop: Hop | null = null;
  const tokenAt: number[] = [];
  const shownCash: number[] = [];
  const cashDisp: number[] = [];
  let dice: { d: [number, number]; t0: number } | null = null;
  let cardShow: { deck: "chance" | "chest"; card: number; t0: number } | null = null;
  const toasts: Toast[] = [];
  const log: { text: string; color: string }[] = [];
  const floaters: { text: string; seat: number; color: string; born: number }[] = [];
  let hits: Hit[] = [];
  let scrollers: Scroller[] = [];
  const scroll: Record<string, number> = {};
  let deedSq = -1;
  let assetsSeat = -1;
  let confirmBankrupt = -10;
  /** Trade being built. */
  const draft = { to: -1, give: new Set<number>(), get: new Set<number>(), giveCash: 0, getCash: 0, giveCards: 0, getCards: 0 };

  // Camera: board px at the viewport's top-left, and zoom (logical px per board px)
  const cam = { z: 0.45, ox: 0, oy: 0 };
  let camMode: "follow" | "full" | "free" = "follow";
  let camSnap = true;
  /** Board-view controls (mini-map, camera button, toasts) at the top instead of the bottom. */
  let ctrlTop = false;

  // ---------------------------------------------------------------- names and control

  const humansLocal = () => (game ? game.players.filter((p) => p.bot === null).length : 1);
  function nameOf(seat: number): string {
    const t = tr();
    const p = game?.players[seat];
    if (!p) return "";
    if (online) return seat === me ? t.you : p.name;
    if (p.bot !== null) return p.name;
    return humansLocal() === 1 ? t.you : t.player(seat + 1);
  }
  const sqName = (sq: number) => BOARD[sq]?.name[loc()] ?? "";
  /** Can this device act for `seat`? */
  const controls = (seat: number) => (online ? seat === me && me >= 0 : !!game?.players[seat] && game.players[seat].bot === null);
  let lastHuman = 0;
  /** Whose money and deeds "you" means right now. */
  function viewer(): number {
    if (!game) return -1;
    if (online) return me;
    const d = decider(game);
    if (d >= 0 && controls(d)) lastHuman = d;
    return lastHuman;
  }
  const busy = () => queue.length > 0 || now < busyUntil || hop !== null;
  const waiting = () => online !== null && now < pendingUntil && game !== null && game.seq === pendingSeq;

  // ---------------------------------------------------------------- sound

  const sfx = {
    pick: () => audio.tone({ freq: 760, dur: 0.035, type: "triangle", vol: 0.05 }),
    roll: () => {
      for (let i = 0; i < 6; i++) audio.tone({ freq: 300 + ((i * 137) % 400), dur: 0.03, type: "square", vol: 0.025, delay: i * 0.07 });
    },
    hop: () => audio.tone({ freq: 620, to: 700, dur: 0.04, type: "triangle", vol: 0.04 }),
    coin: () => {
      audio.tone({ freq: 1320, dur: 0.06, type: "triangle", vol: 0.06 });
      audio.tone({ freq: 1760, dur: 0.09, type: "triangle", vol: 0.05, delay: 0.06 });
    },
    pay: () => audio.tone({ freq: 520, to: 360, dur: 0.14, type: "sine", vol: 0.07 }),
    jail: () => {
      for (const [i, f] of [330, 262, 196].entries()) audio.tone({ freq: f, dur: 0.16, type: "square", vol: 0.04, delay: i * 0.12 });
    },
    build: () => audio.tone({ freq: 440, to: 880, dur: 0.12, type: "triangle", vol: 0.06 }),
    card: () => audio.tone({ freq: 980, to: 1240, dur: 0.1, type: "sine", vol: 0.05 }),
    win: () => {
      for (const [i, f] of [523, 659, 784, 1047].entries()) audio.tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.1, delay: i * 0.11 });
    },
    lose: () => {
      for (const [i, f] of [392, 330, 262].entries()) audio.tone({ freq: f, dur: 0.22, type: "sine", vol: 0.08, delay: i * 0.15 });
    },
    nope: () => audio.tone({ freq: 180, dur: 0.08, type: "square", vol: 0.03 }),
  };

  // ---------------------------------------------------------------- game start / save

  function resetView(g: Game) {
    queue.length = 0;
    busyUntil = 0;
    hop = null;
    dice = null;
    cardShow = null;
    toasts.length = 0;
    floaters.length = 0;
    log.length = 0;
    g.players.forEach((p, i) => {
      tokenAt[i] = p.pos;
      shownCash[i] = p.cash;
      cashDisp[i] = p.cash;
    });
    camMode = "follow";
    camSnap = true;
    lastHuman = Math.max(
      0,
      g.players.findIndex((p) => p.bot === null),
    );
  }

  function startGame(su: Setup) {
    current = { ...su };
    storage.set("setup", su);
    const names = [...BOT_NAMES];
    const seats = Array.from({ length: su.players }, (_, i) =>
      i < su.humans ? { name: "", bot: null } : { name: names[(i - su.humans) % names.length], bot: su.level },
    );
    game = createGame((Date.now() ^ 0x7a3c5) >>> 0, seats, { limitMin: su.limit, turnSeconds: 0 });
    reported = false;
    resetView(game);
    flush();
    overlay = null;
    save();
  }

  function resume(s: Saved) {
    current = { ...s.setup };
    game = s.game;
    game.events = [];
    reported = false;
    resetView(game);
    if (Array.isArray(s.log)) log.push(...s.log.filter((l) => typeof l?.text === "string").slice(0, 40));
    overlay = null;
  }

  function save() {
    if (online || !game) return;
    storage.set("run", game.phase === "over" ? null : ({ v: SAVE_VERSION, setup: current, game: { ...game, events: [] }, log: log.slice(0, 40) } satisfies Saved));
  }

  /** Move the rules' new events onto the playback queue. */
  function flush() {
    if (!game) return;
    queue.push(...game.events);
    game.events.length = 0;
  }

  /** Make a decision for the seat whose turn it is (offline), or send it to the room. */
  function send(a: Action) {
    if (!game) return;
    if (online) {
      if (waiting()) return;
      online.send({ seq: ++seq, move: { x: 0, y: 0 }, actions: [a] });
      pendingSeq = game.seq;
      pendingUntil = now + 1.5;
      sfx.pick();
      return;
    }
    const who = decider(game);
    if (who < 0 || !controls(who)) return;
    if (act(game, who, a)) {
      sfx.pick();
      flush();
      save();
    } else sfx.nope();
  }

  // ---------------------------------------------------------------- event playback

  function addToast(textStr: string, color = "#fff1d2", toastIt = true) {
    log.unshift({ text: textStr, color });
    if (log.length > 120) log.length = 120;
    if (!toastIt) return;
    toasts.push({ text: textStr, color, born: now });
    if (toasts.length > 3) toasts.shift();
  }

  function cashDelta(seat: number, amount: number) {
    if (seat < 0 || amount === 0) return;
    shownCash[seat] = (shownCash[seat] ?? 0) + amount;
    floaters.push({ text: `${amount > 0 ? "+" : "−"}${money(Math.abs(amount))}`, seat, color: amount > 0 ? "#7be3a6" : "#ff8a7a", born: now });
  }

  const colorOf = (seat: number) => PLAYER_COLORS[seat] ?? "#fff1d2";

  function play(e: GameEvent) {
    const t = tr();
    const ev = t.ev;
    let wait = 0.06;
    switch (e.type) {
      case "turn":
        addToast(ev.turn(nameOf(e.seat)), colorOf(e.seat), false);
        if (camMode !== "full") camMode = "follow";
        wait = 0.2;
        break;
      case "roll":
        dice = { d: e.dice, t0: now };
        sfx.roll();
        wait = DICE_TIME;
        break;
      case "move":
        if (e.direct) {
          tokenAt[e.seat] = e.to;
          wait = 0.35;
        } else {
          const path: number[] = [];
          const dir = Math.sign(e.steps);
          for (let k = 1; k <= Math.abs(e.steps); k++) path.push((((e.from + dir * k) % SQUARES) + SQUARES) % SQUARES);
          hop = { seat: e.seat, path, t0: now };
          tokenAt[e.seat] = e.from;
          wait = Math.abs(e.steps) * HOP_TIME + 0.1;
        }
        if (camMode !== "full") camMode = "follow";
        break;
      case "salary":
        cashDelta(e.seat, e.amount);
        sfx.coin();
        addToast(ev.salary(nameOf(e.seat), e.amount), "#9be7b9");
        break;
      case "buy":
        cashDelta(e.seat, -e.price);
        sfx.coin();
        addToast(ev.buy(nameOf(e.seat), sqName(e.sq), e.price), colorOf(e.seat));
        break;
      case "rent":
        cashDelta(e.from, -e.amount);
        cashDelta(e.to, e.amount);
        sfx.pay();
        addToast(ev.rent(nameOf(e.from), e.amount, nameOf(e.to)), "#ffd27a");
        wait = 0.25;
        break;
      case "pay":
        cashDelta(e.from, -e.amount);
        cashDelta(e.to, e.amount);
        sfx.pay();
        addToast(
          e.why === "tax" ? ev.tax(nameOf(e.from), e.amount) : e.to >= 0 ? ev.payTo(nameOf(e.from), e.amount, nameOf(e.to)) : ev.payBank(nameOf(e.from), e.amount),
          "#ffd27a",
        );
        wait = 0.2;
        break;
      case "gain":
        cashDelta(e.seat, e.amount);
        sfx.coin();
        addToast(ev.gain(nameOf(e.seat), e.amount), "#9be7b9");
        break;
      case "card":
        cardShow = { deck: e.deck, card: e.card, t0: now };
        sfx.card();
        addToast(`${t.cardTitle[e.deck]}: ${DECKS[e.deck][e.card].text[loc()]}`, "#fff1d2", false);
        wait = 1.1;
        break;
      case "jail":
        sfx.jail();
        addToast(e.why === "doubles" ? ev.jailDoubles(nameOf(e.seat)) : ev.jail(nameOf(e.seat)), "#ff9a8a");
        break;
      case "free":
        if (e.how === "pay") cashDelta(e.seat, -JAIL_FINE);
        addToast(
          e.how === "pay" ? ev.freePay(nameOf(e.seat)) : e.how === "card" ? ev.freeCard(nameOf(e.seat)) : e.how === "doubles" ? ev.freeDoubles(nameOf(e.seat)) : ev.freeFine(nameOf(e.seat)),
          "#9be7b9",
        );
        break;
      case "stay":
        addToast(ev.stay(nameOf(e.seat)), "#ffd27a");
        wait = 0.3;
        break;
      case "again":
        addToast(ev.again(nameOf(e.seat)), "#fff1d2");
        break;
      case "auction":
        addToast(ev.auction(sqName(e.sq)), GOLD);
        wait = 0.2;
        break;
      case "bid":
        addToast(ev.bid(nameOf(e.seat), e.amount), colorOf(e.seat), false);
        break;
      case "pass":
        addToast(ev.pass(nameOf(e.seat)), colorOf(e.seat), false);
        break;
      case "won":
        cashDelta(e.seat, -e.amount);
        sfx.coin();
        addToast(ev.won(nameOf(e.seat), sqName(e.sq), e.amount), colorOf(e.seat));
        wait = 0.2;
        break;
      case "unsold":
        addToast(ev.unsold(sqName(e.sq)), "#fff1d2");
        break;
      case "build":
        cashDelta(e.seat, -BOARD[e.sq].house);
        sfx.build();
        addToast(e.houses === 5 ? ev.hotel(nameOf(e.seat), sqName(e.sq)) : ev.build(nameOf(e.seat), sqName(e.sq)), colorOf(e.seat));
        break;
      case "sell":
        cashDelta(e.seat, e.amount);
        addToast(ev.sell(nameOf(e.seat), sqName(e.sq)), colorOf(e.seat));
        break;
      case "mortgage":
        cashDelta(e.seat, e.amount);
        addToast(ev.mortgage(nameOf(e.seat), sqName(e.sq)), colorOf(e.seat));
        break;
      case "unmortgage":
        cashDelta(e.seat, -e.amount);
        addToast(ev.unmortgage(nameOf(e.seat), sqName(e.sq)), colorOf(e.seat));
        break;
      case "offer":
        addToast(ev.offer(nameOf(e.from), nameOf(e.to)), GOLD);
        break;
      case "answer":
        addToast(e.accepted ? ev.accepted(nameOf(e.to), nameOf(e.from)) : ev.rejected(nameOf(e.to)), e.accepted ? "#9be7b9" : "#ffd27a");
        wait = 0.3;
        break;
      case "debt":
        addToast(ev.debt(nameOf(e.seat), e.amount), "#ff9a8a");
        break;
      case "bankrupt":
        sfx.lose();
        addToast(ev.bankrupt(nameOf(e.seat)), "#ff9a8a");
        wait = 0.6;
        break;
      case "over":
        addToast(ev.over(nameOf(e.winner)), GOLD);
        wait = 0.4;
        break;
    }
    busyUntil = now + wait;
  }

  function pump() {
    if (hop) {
      const k = (now - hop.t0) / HOP_TIME;
      const done = Math.min(hop.path.length, Math.floor(k));
      if (done > 0 && tokenAt[hop.seat] !== hop.path[done - 1]) {
        tokenAt[hop.seat] = hop.path[done - 1];
        sfx.hop();
      }
      if (k >= hop.path.length) hop = null;
    }
    while (queue.length > 0 && now >= busyUntil && !hop) {
      const e = queue.shift();
      if (e) play(e);
    }
    if (!busy() && game) {
      // Settled: the HUD matches the rules exactly again
      game.players.forEach((p, i) => {
        shownCash[i] = p.cash;
        if (tokenAt[i] !== p.pos) tokenAt[i] = p.pos;
      });
    }
  }

  // ---------------------------------------------------------------- online

  const stopListening = online?.onMessage((m) => {
    if (m.t === "snap" && m.state) {
      const first = game === null;
      game = m.state as Game;
      if (first) resetView(game);
    } else if (m.t === "ev") {
      for (const e of m.events as GameEvent[]) queue.push(e);
    } else if (m.t === "end") {
      results = m.results;
    }
  });

  // ---------------------------------------------------------------- layout

  const view = () => stage.view;
  const top = () => view().y + 8;
  const bottom = () => view().y + view().h;
  const panelRect = (): Rect => ({ x: 8, y: bottom() - PANEL_H - 8, w: W - 16, h: PANEL_H });
  const vpRect = (): Rect => {
    const y = top() + TOP_BAR + STRIP_H + 6;
    return { x: 0, y, w: W, h: panelRect().y - 6 - y };
  };
  const fitZ = (vp: Rect) => Math.min(vp.w, vp.h) / (BOARD_PX + 40);
  const followZ = (vp: Rect) => clamp(vp.w / 690, fitZ(vp), MAX_Z);

  /** Where a seat's token is drawn now (board px), hops included. */
  function tokenPos(g: Game, seat: number): { x: number; y: number; lift: number } {
    if (hop && hop.seat === seat) {
      const k = (now - hop.t0) / HOP_TIME;
      const i = clamp(Math.floor(k), 0, hop.path.length - 1);
      const a = tokenSpot(i === 0 ? prevOf(hop.path[0], hop.path) : hop.path[i - 1]);
      const b = tokenSpot(hop.path[i]);
      const f = clamp(k - i, 0, 1);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, lift: Math.sin(f * Math.PI) * 26 };
    }
    const sq = tokenAt[seat] ?? g.players[seat].pos;
    const p = g.players[seat];
    if (sq === JAIL && p.inJail && !busy()) {
      const c = jailCell();
      return { ...spread(g, seat, sq, c), lift: 0 };
    }
    if (sq === JAIL) {
      const r = tileRect(JAIL);
      return { ...spread(g, seat, sq, { x: r.x + 22, y: r.y + r.h - 50 }), lift: 0 };
    }
    return { ...spread(g, seat, sq, tokenSpot(sq)), lift: 0 };
  }
  /** The square before the first hop. */
  const prevOf = (first: number, path: number[]) => {
    const dir = path.length > 1 ? Math.sign(((path[1] - path[0] + SQUARES + 20) % SQUARES) - 20) || 1 : 1;
    return (first - dir + SQUARES) % SQUARES;
  };
  /** Several tokens on one square sit side by side. */
  function spread(g: Game, seat: number, sq: number, c: { x: number; y: number }) {
    const here = g.players.flatMap((p, i) => (!p.out && (tokenAt[i] ?? p.pos) === sq && !(hop && hop.seat === i) ? [i] : []));
    const k = here.indexOf(seat);
    if (here.length <= 1 || k < 0) return c;
    const offs = [
      [-17, -15],
      [17, -15],
      [-17, 15],
      [17, 15],
    ];
    return { x: c.x + offs[k][0], y: c.y + offs[k][1] };
  }

  function clampCam(vp: Rect) {
    const span = BOARD_PX + 60;
    const w = vp.w / cam.z;
    const h = vp.h / cam.z;
    cam.ox = w >= span ? (BOARD_PX - w) / 2 : clamp(cam.ox, -30, BOARD_PX + 30 - w);
    cam.oy = h >= span ? (BOARD_PX - h) / 2 : clamp(cam.oy, -30, BOARD_PX + 30 - h);
  }

  function updateCamera(dt: number) {
    if (!game) return;
    const vp = vpRect();
    let goal: { z: number; ox: number; oy: number } | null = null;
    if (camMode === "full") {
      const z = fitZ(vp);
      goal = { z, ox: (BOARD_PX - vp.w / z) / 2, oy: (BOARD_PX - vp.h / z) / 2 };
    } else if (camMode === "follow") {
      const seat = hop ? hop.seat : game.phase === "auction" && game.auction ? -1 : game.current;
      const z = followZ(vp);
      const c = seat >= 0 ? tokenPos(game, seat) : tileCenter(game.auction?.sq ?? 0);
      goal = { z, ox: c.x - vp.w / z / 2, oy: c.y - vp.h / z / 2 };
    }
    if (goal) {
      const k = camSnap ? 1 : 1 - Math.exp(-dt * 6);
      cam.z += (goal.z - cam.z) * k;
      cam.ox += (goal.ox - cam.ox) * k;
      cam.oy += (goal.oy - cam.oy) * k;
      camSnap = false;
    }
    cam.z = clamp(cam.z, fitZ(vp), MAX_Z);
    clampCam(vp);
  }

  function squareAt(p: { x: number; y: number }): number {
    const vp = vpRect();
    const bx = (p.x - vp.x) / cam.z + cam.ox;
    const by = (p.y - vp.y) / cam.z + cam.oy;
    for (let sq = 0; sq < SQUARES; sq++) if (inRect({ x: bx, y: by }, tileRect(sq))) return sq;
    return -1;
  }

  // ---------------------------------------------------------------- input

  const hit = (rect: Rect, fn: () => void) => hits.push({ rect, fn });
  const button = (b: { rect: Rect; label: string; kind?: ButtonKind; disabled?: boolean; sub?: string; on?: boolean; size?: number }, fn: () => void) => {
    drawButton(ctx, b);
    hit(b.rect, () => {
      if (b.disabled) return sfx.nope();
      fn();
    });
  };

  function tap(p: { x: number; y: number }) {
    for (let i = hits.length - 1; i >= 0; i--) {
      if (inRect(p, hits[i].rect)) {
        hits[i].fn();
        return;
      }
    }
    if (overlay || !game) return;
    const vp = vpRect();
    if (!inRect(p, vp)) return;
    if (cardShow) {
      cardShow = null;
      return;
    }
    const sq = squareAt(p);
    if (sq >= 0 && ownable(sq)) {
      deedSq = sq;
      overlay = "deed";
      sfx.pick();
    }
  }

  const pointers = new Map<number, { x: number; y: number }>();
  type Gesture =
    | { kind: "none" }
    | { kind: "press"; id: number; sx: number; sy: number; moved: boolean; mode: "none" | "pan" | "scroll"; target: string; s0: number; ox0: number; oy0: number }
    | { kind: "pinch"; d0: number; z0: number; fx: number; fy: number };
  let gesture: Gesture = { kind: "none" };

  const pointer = {
    down(p: PointerInfo) {
      pointers.set(p.id, { x: p.x, y: p.y });
      if (pointers.size === 1) {
        gesture = { kind: "press", id: p.id, sx: p.x, sy: p.y, moved: false, mode: "none", target: "", s0: 0, ox0: cam.ox, oy0: cam.oy };
      } else if (pointers.size === 2 && !overlay) {
        const [a, b] = [...pointers.values()];
        const vp = vpRect();
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        gesture = { kind: "pinch", d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), z0: cam.z, fx: (mx - vp.x) / cam.z + cam.ox, fy: (my - vp.y) / cam.z + cam.oy };
        camMode = "free";
      }
    },
    move(p: PointerInfo) {
      if (!pointers.has(p.id)) return;
      pointers.set(p.id, { x: p.x, y: p.y });
      const vp = vpRect();
      if (gesture.kind === "pinch" && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        cam.z = clamp((gesture.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / gesture.d0, fitZ(vp), MAX_Z);
        cam.ox = gesture.fx - ((a.x + b.x) / 2 - vp.x) / cam.z;
        cam.oy = gesture.fy - ((a.y + b.y) / 2 - vp.y) / cam.z;
        clampCam(vp);
        return;
      }
      if (gesture.kind !== "press" || gesture.id !== p.id) return;
      if (!gesture.moved && Math.hypot(p.x - gesture.sx, p.y - gesture.sy) > TAP_SLOP) {
        gesture.moved = true;
        const start = { x: gesture.sx, y: gesture.sy };
        const sc = [...scrollers].reverse().find((s) => inRect(start, s.rect));
        if (sc) {
          gesture.mode = "scroll";
          gesture.target = sc.id;
          gesture.s0 = scroll[sc.id] ?? 0;
        } else if (!overlay && inRect(start, vp)) {
          gesture.mode = "pan";
          camMode = "free";
          gesture.ox0 = cam.ox;
          gesture.oy0 = cam.oy;
        }
      }
      if (gesture.mode === "scroll") {
        const sc = scrollers.find((s) => s.id === (gesture as { target: string }).target);
        scroll[gesture.target] = clamp(gesture.s0 - (p.y - gesture.sy), 0, sc?.max ?? 0);
      } else if (gesture.mode === "pan") {
        cam.ox = gesture.ox0 - (p.x - gesture.sx) / cam.z;
        cam.oy = gesture.oy0 - (p.y - gesture.sy) / cam.z;
        clampCam(vp);
      }
    },
    up(p: PointerInfo) {
      if (!pointers.delete(p.id)) return;
      if (gesture.kind === "press" && gesture.id === p.id && !gesture.moved) tap(p);
      if (gesture.kind === "pinch" || pointers.size === 0) gesture = { kind: "none" };
    },
  };

  // ---------------------------------------------------------------- update

  function update(dt: number) {
    now += dt;
    pump();
    if (game && !online && overlay !== "menu" && overlay !== "rules") {
      if (busy()) {
        if (game.phase !== "over") game.elapsed += dt;
      } else {
        stepGame(game, dt, []);
        if (game.events.length > 0) {
          flush();
          save();
        }
      }
    }
    if (game && online && !busy() && game.phase !== "over") {
      // The room's clocks, run down between snapshots
      game.elapsed += dt;
      if (game.hold > 0) game.hold = Math.max(0, game.hold - dt);
      else game.clock = Math.max(0, game.clock - dt);
    }
    for (let i = 0; i < cashDisp.length; i++) cashDisp[i] += ((shownCash[i] ?? 0) - cashDisp[i]) * (1 - Math.exp(-dt * 8));
    while (toasts.length > 0 && now - toasts[0].born > TOAST_TIME) toasts.shift();
    while (floaters.length > 0 && now - floaters[0].born > 1.4) floaters.shift();
    if (cardShow && now - cardShow.t0 > CARD_TIME) cardShow = null;
    if (game && game.phase === "over" && !busy()) gameOver(game);
    updateCamera(dt);
  }

  function gameOver(g: Game) {
    if (reported || online) return;
    reported = true;
    save();
    const humans = g.players.flatMap((p, i) => (p.bot === null ? [i] : []));
    const bots = g.players.length - humans.length;
    const human = humans[0];
    if (humans.length === 1 && g.winner === human && bots > 0) {
      sfx.win();
      const worth = netWorth(g, human);
      const score = Math.floor((worth / 10) * LEVEL_MULT[current.level]) + BEAT_BONUS[current.level] * bots;
      reportScore?.({ score, detail: tr().detail(current.level, worth) });
      wins[current.level]++;
      storage.set("wins", wins);
      const best = [...DIFFICULTIES].reverse().find((d) => wins[d] > 0) ?? current.level;
      storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(best, wins[best]), en: STRINGS.en.summary(best, wins[best]) });
    } else if (humans.length === 1 && bots > 0) sfx.lose();
    else sfx.win();
  }

  // ---------------------------------------------------------------- render: HUD

  function drawTopBar(g: Game | null) {
    const t = tr();
    const y = top();
    if (!online)
      button({ rect: { x: 10, y, w: 96, h: 46 }, label: t.menu, kind: "ghost", size: 18 }, () => {
        overlay = "menu";
      });
    if (g) {
      button({ rect: { x: W - 106, y, w: 96, h: 46 }, label: t.log, kind: "ghost", size: 18 }, () => {
        overlay = "log";
        scroll.log = 0;
      });
      if (g.limit > 0) {
        const left = Math.max(0, g.limit - g.elapsed);
        const label = t.timeLeft(Math.floor(left / 60), Math.floor(left % 60));
        clockIcon(W / 2 - 52, y + 23, left < 300 ? "#ff8a7a" : GOLD);
        text(ctx, label, W / 2 + 12, y + 24, 28, left < 300 ? "#ff8a7a" : "#fff1d2", "center", 800, TITLE_FONT);
      } else text(ctx, tr().title, W / 2, y + 24, 26, GOLD, "center", 800, TITLE_FONT);
    }
  }

  function clockIcon(x: number, y: number, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 5, y + 3);
    ctx.stroke();
  }

  function drawStrip(g: Game) {
    const n = g.players.length;
    const gap = 8;
    const w = (W - 20 - gap * (n - 1)) / n;
    const y = top() + TOP_BAR;
    const who = decider(g);
    g.players.forEach((p, i) => {
      const r: Rect = { x: 10 + i * (w + gap), y, w, h: STRIP_H - 6 };
      const active = i === g.current && g.phase !== "over";
      ctx.save();
      if (p.out) ctx.globalAlpha = 0.45;
      roundRect(ctx, r, 14);
      ctx.fillStyle = active ? "#fff4d6" : "rgba(255,241,210,0.9)";
      ctx.fill();
      ctx.lineWidth = active ? 4 : 1.5;
      ctx.strokeStyle = active ? GOLD : "rgba(168,116,31,0.6)";
      ctx.stroke();
      ctx.fillStyle = colorOf(i);
      roundRect(ctx, { x: r.x + 4, y: r.y + 4, w: 7, h: r.h - 8 }, 3);
      ctx.fill();
      const big = n <= 2;
      drawToken(ctx, TOKENS[i], i, r.x + (big ? 36 : 30), r.y + r.h / 2 + 4, big ? 44 : 36, active && !p.out ? Math.abs(Math.sin(now * 4)) * 3 : 0);
      const tx = r.x + (big ? 64 : 52);
      const tw = r.w - (tx - r.x) - 6;
      fitText(ctx, nameOf(i), tx, r.y + 22, 18, tw, INK, "left", 700);
      const cash = p.out ? tr().bankrupt : money(Math.round(cashDisp[i] ?? p.cash));
      fitText(ctx, cash, tx, r.y + 52, 24, tw, p.out ? RED : JADE, "left", 800, TITLE_FONT);
      if (p.inJail && !p.out) bars(r.x + r.w - 22, r.y + 12);
      if (p.away) text(ctx, "⚠", r.x + r.w - 14, r.y + r.h - 14, 16, RED);
      if (i === who && who !== g.current && g.phase !== "over") {
        ctx.beginPath();
        ctx.arc(r.x + r.w - 12, r.y + r.h - 12, 7, 0, Math.PI * 2);
        ctx.fillStyle = GOLD;
        ctx.fill();
      }
      ctx.restore();
      hit(r, () => {
        if (p.out) return;
        assetsSeat = i;
        scroll.assets = 0;
        overlay = "assets";
        sfx.pick();
      });
    });
    // Money floaters rise from the chips
    for (const f of floaters) {
      const r = { x: 10 + f.seat * (w + gap), y, w };
      const k = (now - f.born) / 1.4;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(40,10,8,0.8)";
      ctx.font = `800 24px ${TITLE_FONT}`;
      ctx.textAlign = "center";
      ctx.strokeText(f.text, r.x + r.w / 2, y + STRIP_H + 10 - k * 30);
      text(ctx, f.text, r.x + r.w / 2, y + STRIP_H + 10 - k * 30, 24, f.color, "center", 800, TITLE_FONT);
      ctx.restore();
    }
  }

  function bars(x: number, y: number) {
    ctx.fillStyle = "#5a3a28";
    ctx.fillRect(x - 9, y - 7, 18, 14);
    ctx.fillStyle = "#e8c8a0";
    for (let i = 0; i < 3; i++) ctx.fillRect(x - 7 + i * 6, y - 5, 3, 10);
  }

  // ---------------------------------------------------------------- render: board

  function drawBoardView(g: Game) {
    const vp = vpRect();
    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.x, vp.y, vp.w, vp.h);
    ctx.clip();
    ctx.translate(vp.x, vp.y);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.ox, -cam.oy);
    const t = tr();
    const focus = g.phase === "buy" ? g.buySq : g.phase === "auction" && g.auction ? g.auction.sq : -1;
    drawBoard(ctx, { owner: g.owner, houses: g.houses, mortgaged: g.mortgaged, focus, now }, sqName, { title: t.title, chance: t.cardTitle.chance, chest: t.cardTitle.chest, mortgaged: t.mortgaged }, {
      x: cam.ox,
      y: cam.oy,
      w: vp.w / cam.z,
      h: vp.h / cam.z,
    });
    // Tokens, the one moving last (on top)
    const order = g.players.map((_, i) => i).sort((a, b) => (a === hop?.seat ? 1 : b === hop?.seat ? -1 : a === g.current ? 1 : b === g.current ? -1 : 0));
    for (const i of order) {
      const p = g.players[i];
      if (p.out) continue;
      const pos = tokenPos(g, i);
      const bob = i === g.current && !hop ? Math.abs(Math.sin(now * 3)) * 4 : 0;
      drawToken(ctx, TOKENS[i], i, pos.x, pos.y, 58, pos.lift + bob);
    }
    ctx.restore();
    // Controls sit at the bottom of the board view, or the top when the token on the move is down there
    const focusSeat = hop ? hop.seat : g.current;
    const fp = g.players[focusSeat] && !g.players[focusSeat].out ? tokenPos(g, focusSeat) : null;
    ctrlTop = camMode !== "full" && fp !== null && vp.y + (fp.y - cam.oy) * cam.z > vp.y + vp.h * 0.55;
    drawDice(vp);
    drawToasts(vp);
    drawMiniMap(g, vp);
    const label = camMode === "full" ? t.follow : t.board;
    button({ rect: { x: vp.x + vp.w - 128, y: ctrlTop ? vp.y + 10 : vp.y + vp.h - 54, w: 118, h: 46 }, label, kind: "ghost", size: 18 }, () => {
      camMode = camMode === "full" ? "follow" : "full";
    });
    if (cardShow) drawCard(vp);
  }

  function drawDice(vp: Rect) {
    if (!dice) return;
    const age = now - dice.t0;
    const fade = clamp(2.4 - age, 0, 1);
    if (fade <= 0) return;
    const rolling = age < DICE_TIME;
    const k = easeOutCubic(age / DICE_TIME);
    const s = 64;
    const cx = vp.x + vp.w / 2;
    const cy = vp.y + vp.h / 2 + (rolling ? -40 * (1 - k) : 0);
    ctx.save();
    ctx.globalAlpha = fade;
    for (let i = 0; i < 2; i++) {
      const face = rolling ? 1 + Math.floor((now * 18 + i * 3) % 6) : dice.d[i];
      const rot = rolling ? (1 - k) * (i ? -6 : 7) : i ? 0.12 : -0.1;
      drawDie(ctx, face, cx + (i ? 42 : -42), cy, s, rot);
    }
    if (!rolling) {
      const total = dice.d[0] + dice.d[1];
      text(ctx, String(total), cx, cy + 58, 28, "#fff6dc", "center", 800, TITLE_FONT);
    }
    ctx.restore();
  }

  function drawToasts(vp: Rect) {
    // Newest at the bottom, just above the mini-map and the camera button
    let y = ctrlTop ? vp.y + 140 : vp.y + vp.h - 140 - 44 * toasts.length;
    for (const tt of toasts) {
      const age = now - tt.born;
      const a = clamp(Math.min(age * 6, (TOAST_TIME - age) * 3), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      const size = fitSize(ctx, tt.text, 20, W - 60, 700);
      ctx.font = `700 ${size}px ${FONT}`;
      const w = Math.min(W - 30, ctx.measureText(tt.text).width + 30);
      const r = { x: vp.x + (vp.w - w) / 2, y, w, h: 38 };
      roundRect(ctx, r, 19);
      ctx.fillStyle = "rgba(30,10,8,0.85)";
      ctx.fill();
      text(ctx, tt.text, r.x + w / 2, y + 20, size, tt.color, "center", 700);
      ctx.restore();
      y += 44;
    }
  }

  function drawMiniMap(g: Game, vp: Rect) {
    if (camMode === "full") return;
    const size = 112;
    const r: Rect = { x: vp.x + 14, y: ctrlTop ? vp.y + 14 : vp.y + vp.h - size - 14, w: size, h: size };
    const k = size / BOARD_PX;
    ctx.save();
    roundRect(ctx, { x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 }, 8);
    ctx.fillStyle = "rgba(30,10,8,0.75)";
    ctx.fill();
    ctx.fillStyle = "#1f6b51";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    for (let sq = 0; sq < SQUARES; sq++) {
      const tr2 = tileRect(sq);
      const o = g.owner[sq];
      ctx.fillStyle = o >= 0 ? colorOf(o) : BOARD[sq].kind === "prop" ? GROUP_COLORS[BOARD[sq].group] : PAPER;
      ctx.globalAlpha = o >= 0 || BOARD[sq].kind !== "prop" ? 1 : 0.55;
      ctx.fillRect(r.x + tr2.x * k + 0.5, r.y + tr2.y * k + 0.5, tr2.w * k - 1, tr2.h * k - 1);
    }
    ctx.globalAlpha = 1;
    g.players.forEach((p, i) => {
      if (p.out) return;
      const pos = tokenPos(g, i);
      ctx.beginPath();
      ctx.arc(r.x + pos.x * k, r.y + pos.y * k, 5, 0, Math.PI * 2);
      ctx.fillStyle = colorOf(i);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + cam.ox * k, r.y + cam.oy * k, (vp.w / cam.z) * k, (vp.h / cam.z) * k);
    ctx.restore();
    hit(r, () => {
      camMode = "full";
      sfx.pick();
    });
  }

  function drawCard(vp: Rect) {
    if (!cardShow) return;
    const t = tr();
    const age = now - cardShow.t0;
    const k = easeOutCubic(age / 0.3);
    const a = clamp((CARD_TIME - age) * 3, 0, 1);
    const w = 380;
    const h = 220;
    const r: Rect = { x: vp.x + (vp.w - w) / 2, y: vp.y + vp.h / 2 - h / 2 + (1 - k) * 60, w, h };
    ctx.save();
    ctx.globalAlpha = a * k;
    drawPanel(ctx, r, PAPER, 18);
    const color = cardShow.deck === "chance" ? "#d9473b" : "#2a6fc2";
    roundRect(ctx, { x: r.x + 10, y: r.y + 10, w: r.w - 20, h: 52 }, 12);
    ctx.fillStyle = color;
    ctx.fill();
    text(ctx, t.cardTitle[cardShow.deck], r.x + r.w / 2, r.y + 37, 26, "#fff3d6", "center", 800, TITLE_FONT);
    const lines = wrap(ctx, DECKS[cardShow.deck][cardShow.card].text[loc()], r.w - 50, 22);
    for (const [i, l] of lines.slice(0, 4).entries()) text(ctx, l, r.x + r.w / 2, r.y + 96 + i * 30 + (4 - Math.min(4, lines.length)) * 12, 22, INK, "center", 700);
    ctx.restore();
  }

  // ---------------------------------------------------------------- render: the decision panel

  function drawDecision(g: Game) {
    const r = panelRect();
    drawPanel(ctx, r);
    const t = tr();
    const who = decider(g);
    const mine = who >= 0 && controls(who) && !busy() && !waiting();
    const x0 = r.x + 20;
    const iw = r.w - 40;
    // Header: whose decision, and the clock online
    if (who >= 0) drawToken(ctx, TOKENS[who], who, x0 + 20, r.y + 40, 38);
    const title = headline(g, who, mine);
    fitText(ctx, title, x0 + 48, r.y + 38, 24, iw - 130, INK, "left", 700);
    if (online && who >= 0 && g.turnSeconds > 0 && !g.players[who].bot && g.phase !== "over") {
      const left = Math.ceil(g.clock);
      const f = clamp(g.clock / g.turnSeconds, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      roundRect(ctx, { x: r.x + 20, y: r.y + 64, w: r.w - 40, h: 6 }, 3);
      ctx.fill();
      ctx.fillStyle = f < 0.3 ? RED : GOLD;
      roundRect(ctx, { x: r.x + 20, y: r.y + 64, w: (r.w - 40) * f, h: 6 }, 3);
      ctx.fill();
      text(ctx, `${left}s`, r.x + r.w - 30, r.y + 38, 22, f < 0.3 ? RED : INK_SOFT, "right", 800, TITLE_FONT);
    } else if (dice && g.phase === "turn" && !g.mustRoll && who === g.current) {
      drawDie(ctx, dice.d[0], r.x + r.w - 92, r.y + 38, 34, -0.08);
      drawDie(ctx, dice.d[1], r.x + r.w - 48, r.y + 38, 34, 0.1);
    }
    const body: Rect = { x: x0, y: r.y + 78, w: iw, h: 112 };
    const row1: Rect = { x: x0, y: r.y + 156, w: iw, h: 62 };
    const row2: Rect = { x: x0, y: r.y + 226, w: iw, h: 50 };
    if (!mine) {
      drawLogLines(body.y, r.y + r.h - 14, x0, iw);
      return;
    }
    const p = g.players[who];
    switch (g.phase) {
      case "turn": {
        if (p.inJail && g.mustRoll) {
          text(ctx, t.inJail(p.jailTries), x0, body.y + 18, 20, INK_SOFT, "left", 600);
          const w3 = (iw - 20) / 3;
          button({ rect: { x: x0, y: row1.y, w: w3, h: row1.h }, label: t.rollJail, kind: "primary", size: 20 }, () => send({ type: "roll" }));
          button({ rect: { x: x0 + w3 + 10, y: row1.y, w: w3, h: row1.h }, label: t.payJail(JAIL_FINE), disabled: p.cash < JAIL_FINE, size: 20 }, () => send({ type: "payJail" }));
          button({ rect: { x: x0 + 2 * (w3 + 10), y: row1.y, w: w3, h: row1.h }, label: t.useCard, disabled: p.freeCards.length === 0, sub: p.freeCards.length ? `× ${p.freeCards.length}` : undefined, size: 20 }, () =>
            send({ type: "useCard" }),
          );
        } else {
          text(ctx, t.at(sqName(p.pos)), x0, body.y + 18, 20, INK_SOFT, "left", 600);
          text(ctx, t.cashNow(p.cash), x0, body.y + 48, 20, JADE, "left", 700);
          const label = g.mustRoll ? (g.doubles > 0 ? t.rollAgain : t.roll) : t.endTurn;
          button({ rect: row1, label, kind: g.mustRoll ? "primary" : "gold" }, () => send(g.mustRoll ? { type: "roll" } : { type: "end" }));
        }
        const w2 = (iw - 12) / 2;
        button({ rect: { x: x0, y: row2.y, w: w2, h: row2.h }, label: t.assets }, () => openAssets(who));
        const canTrade = g.offersThisTurn < OFFERS_PER_TURN && alive(g).length > 1;
        button({ rect: { x: x0 + w2 + 12, y: row2.y, w: w2, h: row2.h }, label: t.trade, disabled: !canTrade }, () => openTrade(g, who));
        break;
      }
      case "buy": {
        drawDeedMini(g.buySq, { x: x0, y: body.y - 4, w: 230, h: 66 });
        const price = BOARD[g.buySq].price;
        text(ctx, t.cashNow(p.cash), x0 + 246, body.y + 14, 19, JADE, "left", 700);
        if (p.cash < price) for (const [i, l] of wrap(ctx, t.cantAfford, iw - 250, 16, 600).slice(0, 2).entries()) text(ctx, l, x0 + 246, body.y + 40 + i * 20, 16, RED, "left", 600);
        const w2 = (iw - 12) / 2;
        button({ rect: { x: x0, y: row1.y, w: w2, h: row1.h }, label: t.buy(price), kind: "primary", disabled: p.cash < price }, () => send({ type: "buy" }));
        button({ rect: { x: x0 + w2 + 12, y: row1.y, w: w2, h: row1.h }, label: t.toAuction }, () => send({ type: "decline" }));
        button({ rect: row2, label: t.assets }, () => openAssets(who));
        break;
      }
      case "auction": {
        const a = g.auction;
        if (!a) break;
        drawDeedMini(a.sq, { x: x0, y: body.y - 4, w: 230, h: 66 });
        const status = a.leader >= 0 ? t.bidNow(a.bid, nameOf(a.leader)) : t.noBids;
        fitText(ctx, status, x0 + 246, body.y + 14, 20, iw - 250, a.leader >= 0 ? colorOf(a.leader) : INK_SOFT, "left", 700);
        text(ctx, t.cashNow(p.cash), x0 + 246, body.y + 44, 18, JADE, "left", 600);
        const base = a.leader >= 0 ? a.bid : 0;
        const incs = [MIN_BID, 50, 100];
        const w4 = (iw - 30) / 4;
        incs.forEach((inc, i) => {
          const amount = Math.max(minBid(a), base + inc);
          button({ rect: { x: x0 + i * (w4 + 10), y: row1.y, w: w4, h: row1.h }, label: money(amount), sub: `+${inc}`, kind: "primary", disabled: amount > p.cash, size: 22 }, () =>
            send({ type: "bid", amount }),
          );
        });
        button({ rect: { x: x0 + 3 * (w4 + 10), y: row1.y, w: w4, h: row1.h }, label: t.passBid, size: 22 }, () => send({ type: "pass" }));
        bidders(g, x0, row2.y + 24);
        break;
      }
      case "debt": {
        const d = g.debts[0];
        if (!d) break;
        text(ctx, t.cashNow(p.cash), x0, body.y + 18, 20, JADE, "left", 700);
        text(ctx, t.oweHint, x0, body.y + 48, 18, INK_SOFT, "left", 600);
        button({ rect: row1, label: t.assets, kind: "primary" }, () => openAssets(who));
        const confirming = now - confirmBankrupt < 3;
        button({ rect: row2, label: confirming ? t.confirmBankrupt : t.bankrupt, kind: "danger" }, () => {
          if (confirming) {
            confirmBankrupt = -10;
            send({ type: "bankrupt" });
          } else confirmBankrupt = now;
        });
        break;
      }
      case "trade": {
        const o = g.offer;
        if (!o) break;
        const half = (iw - 12) / 2;
        offerColumn(t.youGet, o.give, o.from, { x: x0, y: body.y - 6, w: half, h: 128 });
        offerColumn(t.youGive, o.get, o.to, { x: x0 + half + 12, y: body.y - 6, w: half, h: 128 });
        const w2 = (iw - 12) / 2;
        button({ rect: { x: x0, y: row2.y - 8, w: w2, h: 58 }, label: t.accept, kind: "primary" }, () => send({ type: "accept" }));
        button({ rect: { x: x0 + w2 + 12, y: row2.y - 8, w: w2, h: 58 }, label: t.reject }, () => send({ type: "reject" }));
        break;
      }
    }
  }

  function headline(g: Game, who: number, mine: boolean): string {
    // "you" = this phone's only person (or this seat online), whatever the animation is doing
    const t = tr();
    if (who < 0) return "";
    const name = nameOf(who);
    const solo = !online && humansLocal() === 1;
    const you = online ? who === me : solo && controls(who);
    switch (g.phase) {
      case "turn":
        if (you) return t.yourTurn;
        if (mine) return t.turnOf(name);
        return g.players[who].bot !== null || g.players[who].away ? t.thinking(name) : t.turnOf(name);
      case "buy":
        return mine ? `${t.forSale}: ${sqName(g.buySq)}` : t.thinking(name);
      case "auction":
        return mine ? `${t.auction}: ${sqName(g.auction?.sq ?? 0)}` : t.waitBid(name);
      case "debt": {
        const d = g.debts[0];
        const to = d && d.to >= 0 ? nameOf(d.to) : t.bank;
        return mine ? t.owe(d?.amount ?? 0, to) : t.thinking(name);
      }
      case "trade":
        return mine ? t.offerFrom(nameOf(g.offer?.from ?? 0)) : t.waitAnswer(name);
      default:
        return "";
    }
  }

  function drawLogLines(y0: number, y1: number, x0: number, w: number) {
    let y = y0 + 12;
    for (const l of log) {
      if (y > y1 - 10) break;
      fitText(ctx, l.text, x0, y, 18, w, INK_SOFT, "left", 600);
      y += 30;
    }
  }

  function bidders(g: Game, x: number, y: number) {
    const a = g.auction;
    if (!a) return;
    a.active.forEach((seat, i) => {
      drawToken(ctx, TOKENS[seat], seat, x + 18 + i * 44, y, 34, i === a.turn ? 4 : 0, false);
    });
  }

  function drawDeedMini(sq: number, r: Rect) {
    const square = BOARD[sq];
    if (!square) return;
    roundRect(ctx, r, 12);
    ctx.fillStyle = "#fffaf0";
    ctx.fill();
    ctx.strokeStyle = "#d8c39a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = GROUP_COLORS[square.group] ?? "#999";
    roundRect(ctx, { x: r.x + 6, y: r.y + 6, w: r.w - 12, h: 22 }, 6);
    ctx.fill();
    fitText(ctx, sqName(sq), r.x + r.w / 2, r.y + 17, 17, r.w - 24, "#fff", "center", 700);
    const t = tr();
    const rent = square.kind === "prop" ? `${t.rent} ${money(square.rent[0])} · ${t.rentSet} ${money(square.rent[0] * 2)}` : square.kind === "transport" ? t.transportRent : t.utilityRent;
    fitText(ctx, rent, r.x + r.w / 2, r.y + 46, 15, r.w - 14, INK_SOFT, "center", 600);
  }

  function offerColumn(title: string, b: Bundle, _from: number, r: Rect) {
    const t = tr();
    text(ctx, title, r.x, r.y + 10, 18, INK, "left", 700);
    let y = r.y + 30;
    const items: (() => void)[] = [];
    for (const q of b.sqs) items.push(() => drawDeedChip(ctx, { x: r.x, y, w: r.w, h: 30 }, q, sqName(q)));
    if (b.cash > 0) items.push(() => text(ctx, money(b.cash), r.x + 4, y + 15, 20, JADE, "left", 800, TITLE_FONT));
    if (b.cards > 0) items.push(() => text(ctx, t.cards(b.cards), r.x + 4, y + 15, 17, INK, "left", 700));
    if (items.length === 0) items.push(() => text(ctx, t.nothing, r.x + 4, y + 15, 17, INK_SOFT, "left", 600));
    for (const draw of items.slice(0, 3)) {
      draw();
      y += 34;
    }
    if (items.length > 3) text(ctx, `+${items.length - 3}`, r.x + r.w - 4, r.y + 10, 16, INK_SOFT, "right", 700);
  }

  // ---------------------------------------------------------------- sheets

  function openAssets(seat: number) {
    assetsSeat = seat;
    scroll.assets = 0;
    overlay = "assets";
    sfx.pick();
  }

  function openTrade(g: Game, seat: number) {
    const others = alive(g).filter((i) => i !== seat);
    if (others.length === 0) return;
    if (!others.includes(draft.to)) draft.to = others[0];
    draft.give.clear();
    draft.get.clear();
    draft.giveCash = 0;
    draft.getCash = 0;
    draft.giveCards = 0;
    draft.getCards = 0;
    scroll.tradeGive = 0;
    scroll.tradeGet = 0;
    overlay = "trade";
    sfx.pick();
  }

  function sheetRect(maxH: number): Rect {
    const v = view();
    const h = Math.min(maxH, v.h - 70);
    return { x: 0, y: v.y + v.h - h, w: W, h: h + 30 };
  }

  function dim() {
    const v = view();
    ctx.fillStyle = "rgba(20,6,4,0.6)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function backdrop(close: () => void) {
    hits = [];
    scrollers = [];
    dim();
    const v = view();
    hit({ x: v.x, y: v.y, w: v.w, h: v.h }, close);
  }

  function drawAssets(g: Game) {
    const t = tr();
    const seat = assetsSeat;
    const p = g.players[seat];
    if (!p) {
      overlay = null;
      return;
    }
    backdrop(() => {
      overlay = null;
    });
    const r = sheetRect(780);
    drawPanel(ctx, r, PAPER, 26);
    hit(r, () => {});
    const editable = controls(seat) && canManage(g, seat) && !busy() && !waiting();
    const title = controls(seat) && (online || humansLocal() === 1) ? t.yourDeeds : t.deedsOf(nameOf(seat));
    drawToken(ctx, TOKENS[seat], seat, r.x + 40, r.y + 44, 40);
    fitText(ctx, title, r.x + 72, r.y + 36, 24, 280, INK, "left", 700);
    text(ctx, t.cashNow(p.cash), r.x + 72, r.y + 64, 18, JADE, "left", 700);
    button({ rect: { x: r.x + r.w - 130, y: r.y + 18, w: 110, h: 52 }, label: t.done, kind: "gold" }, () => {
      overlay = null;
    });
    const deeds = deedsOf(g, seat).sort((a, b) => BOARD[a].group - BOARD[b].group || a - b);
    const list: Rect = { x: r.x + 14, y: r.y + 92, w: r.w - 28, h: r.h - 30 - 92 - 56 };
    const rowH = 70;
    const max = Math.max(0, deeds.length * rowH - list.h);
    scrollers.push({ id: "assets", rect: list, max });
    const off = clamp(scroll.assets ?? 0, 0, max);
    ctx.save();
    ctx.beginPath();
    ctx.rect(list.x, list.y, list.w, list.h);
    ctx.clip();
    if (deeds.length === 0) text(ctx, t.noDeeds, list.x + list.w / 2, list.y + 50, 20, INK_SOFT, "center", 600);
    deeds.forEach((q, i) => {
      const y = list.y + i * rowH - off;
      if (y + rowH < list.y || y > list.y + list.h) return;
      const sq = BOARD[q];
      const h = g.houses[q];
      const status = g.mortgaged[q] ? t.mortgaged : h === 5 ? t.hotel : h > 0 ? t.withHouses(h) : sq.kind === "prop" && ownsGroup(g, seat, sq.group) ? t.rentSet : "";
      const chipW = editable ? 200 : list.w;
      drawDeedChip(ctx, { x: list.x, y: y + 6, w: chipW, h: rowH - 12 }, q, sqName(q), { mortgaged: g.mortgaged[q], right: editable ? undefined : status });
      if (!editable) {
        hitIn(list, { x: list.x, y: y + 6, w: chipW, h: rowH - 12 }, () => {
          deedSq = q;
          overlay = "deed";
        });
        return;
      }
      if (status) text(ctx, status, list.x + 30, y + rowH - 14, 13, INK_SOFT, "left", 600);
      const bx = list.x + chipW + 8;
      const bw = (list.w - chipW - 8 - 16) / 3;
      const bh = rowH - 16;
      const by = y + 8;
      if (sq.kind === "prop") {
        rowButton({ x: bx, y: by, w: bw, h: bh }, t.addHouse, canBuild(g, seat, q), list, () => send({ type: "build", sq: q }), money(sq.house));
        rowButton({ x: bx + bw + 8, y: by, w: bw, h: bh }, t.sellHouse, canSell(g, seat, q), list, () => send({ type: "sell", sq: q }), `+${money(sq.house / 2)}`);
      }
      if (g.mortgaged[q])
        rowButton({ x: bx + 2 * (bw + 8), y: by, w: bw, h: bh }, t.unmortgage(unmortgageCost(q)).split(" ")[0], canUnmortgage(g, seat, q), list, () => send({ type: "unmortgage", sq: q }), money(unmortgageCost(q)));
      else
        rowButton({ x: bx + 2 * (bw + 8), y: by, w: bw, h: bh }, t.mortgage(mortgageValue(q)).split(" ")[0], canMortgage(g, seat, q), list, () => send({ type: "mortgage", sq: q }), `+${money(mortgageValue(q))}`);
    });
    ctx.restore();
    const foot = r.y + r.h - 30 - 34;
    text(ctx, t.housesLeft(g.housesLeft, g.hotelsLeft), r.x + 24, foot, 17, INK_SOFT, "left", 600);
    if (p.freeCards.length > 0) text(ctx, t.cards(p.freeCards.length), r.x + r.w - 24, foot, 17, INK, "right", 700);
  }

  /** A hit inside a scrolled list only counts where the list is visible. */
  function hitIn(list: Rect, r: Rect, fn: () => void) {
    const y0 = Math.max(r.y, list.y);
    const y1 = Math.min(r.y + r.h, list.y + list.h);
    if (y1 > y0) hit({ x: r.x, y: y0, w: r.w, h: y1 - y0 }, fn);
  }

  function rowButton(r: Rect, label: string, enabled: boolean, list: Rect, fn: () => void, sub: string) {
    drawButton(ctx, { rect: r, label, disabled: !enabled, sub, size: 17, kind: "secondary" });
    hitIn(list, r, () => {
      if (!enabled) return sfx.nope();
      fn();
    });
  }

  function drawTrade(g: Game) {
    const t = tr();
    const seat = viewer();
    backdrop(() => {
      overlay = null;
    });
    const r = sheetRect(860);
    drawPanel(ctx, r, PAPER, 26);
    hit(r, () => {});
    text(ctx, t.tradeWith, r.x + 24, r.y + 34, 22, INK, "left", 700);
    // Partner tabs
    const others = alive(g).filter((i) => i !== seat);
    const tw = Math.min(160, (r.w - 48 - (others.length - 1) * 8) / Math.max(1, others.length));
    others.forEach((o, i) => {
      const rect = { x: r.x + 24 + i * (tw + 8), y: r.y + 56, w: tw, h: 50 };
      roundRect(ctx, rect, 14);
      ctx.fillStyle = draft.to === o ? "#ffe7a3" : "#fffaf0";
      ctx.fill();
      ctx.strokeStyle = draft.to === o ? GOLD_DARK : "#d8c39a";
      ctx.lineWidth = draft.to === o ? 3 : 1.5;
      ctx.stroke();
      drawToken(ctx, TOKENS[o], o, rect.x + 24, rect.y + 28, 30);
      fitText(ctx, nameOf(o), rect.x + 44, rect.y + 25, 18, rect.w - 50, INK, "left", 700);
      hit(rect, () => {
        if (draft.to === o) return;
        draft.to = o;
        draft.get.clear();
        draft.getCash = 0;
        draft.getCards = 0;
        sfx.pick();
      });
    });
    const half = (r.w - 60) / 2;
    const colTop = r.y + 122;
    const footH = 220;
    const colH = r.h - 30 - (colTop - r.y) - footH;
    tradeColumn(g, t.give, seat, draft.give, { x: r.x + 20, y: colTop, w: half, h: colH }, "tradeGive");
    tradeColumn(g, t.get, draft.to, draft.get, { x: r.x + 40 + half, y: colTop, w: half, h: colH }, "tradeGet");
    // Cash and cards
    const cy = colTop + colH + 14;
    cashStepper(t.give, { x: r.x + 20, y: cy, w: half }, g.players[seat]?.cash ?? 0, () => draft.giveCash, (v) => (draft.giveCash = v));
    cashStepper(t.get, { x: r.x + 40 + half, y: cy, w: half }, g.players[draft.to]?.cash ?? 0, () => draft.getCash, (v) => (draft.getCash = v));
    const myCards = g.players[seat]?.freeCards.length ?? 0;
    const theirCards = g.players[draft.to]?.freeCards.length ?? 0;
    if (myCards > 0)
      button({ rect: { x: r.x + 20, y: cy + 82, w: half, h: 40 }, label: t.freeCard, on: draft.giveCards > 0, size: 16 }, () => {
        draft.giveCards = draft.giveCards > 0 ? 0 : 1;
      });
    if (theirCards > 0)
      button({ rect: { x: r.x + 40 + half, y: cy + 82, w: half, h: 40 }, label: t.freeCard, on: draft.getCards > 0, size: 16 }, () => {
        draft.getCards = draft.getCards > 0 ? 0 : 1;
      });
    const give: Bundle = { cash: draft.giveCash, sqs: [...draft.give], cards: draft.giveCards };
    const get: Bundle = { cash: draft.getCash, sqs: [...draft.get], cards: draft.getCards };
    const valid = g.phase === "turn" && offerOk(g, seat, draft.to, give, get) && g.offersThisTurn < OFFERS_PER_TURN;
    const by = r.y + r.h - 30 - 70;
    const w2 = (r.w - 52) / 2;
    button({ rect: { x: r.x + 20, y: by, w: w2, h: 58 }, label: t.cancel }, () => {
      overlay = null;
    });
    button({ rect: { x: r.x + 32 + w2, y: by, w: w2, h: 58 }, label: t.send, kind: "primary", disabled: !valid }, () => {
      overlay = null;
      send({ type: "offer", to: draft.to, give, get });
    });
    text(ctx, t.offersLeft(OFFERS_PER_TURN - g.offersThisTurn), r.x + r.w / 2, by - 16, 15, INK_SOFT, "center", 600);
  }

  function tradeColumn(g: Game, title: string, seat: number, picked: Set<number>, r: Rect, id: string) {
    const t = tr();
    text(ctx, title, r.x, r.y + 10, 18, INK, "left", 700);
    const list: Rect = { x: r.x, y: r.y + 26, w: r.w, h: r.h - 26 };
    const deeds = seat >= 0 ? deedsOf(g, seat).sort((a, b) => BOARD[a].group - BOARD[b].group || a - b) : [];
    const rowH = 46;
    const max = Math.max(0, deeds.length * rowH - list.h);
    scrollers.push({ id, rect: list, max });
    const off = clamp(scroll[id] ?? 0, 0, max);
    ctx.save();
    ctx.beginPath();
    ctx.rect(list.x - 4, list.y, list.w + 8, list.h);
    ctx.clip();
    if (deeds.length === 0) text(ctx, t.noDeeds, list.x + list.w / 2, list.y + 30, 17, INK_SOFT, "center", 600);
    deeds.forEach((q, i) => {
      const y = list.y + i * rowH - off;
      if (y + rowH < list.y || y > list.y + list.h) return;
      const sq = BOARD[q];
      const built = sq.kind === "prop" && GROUPS[sq.group].some((x) => g.houses[x] > 0);
      const rr = { x: list.x, y: y + 3, w: list.w, h: rowH - 6 };
      drawDeedChip(ctx, rr, q, sqName(q), { on: picked.has(q), disabled: built, mortgaged: g.mortgaged[q], right: g.mortgaged[q] ? "⊘" : undefined });
      hitIn(list, rr, () => {
        if (built) return sfx.nope();
        if (picked.has(q)) picked.delete(q);
        else picked.add(q);
        sfx.pick();
      });
    });
    ctx.restore();
  }

  function cashStepper(label: string, at: { x: number; y: number; w: number }, max: number, get: () => number, set: (v: number) => void) {
    const t = tr();
    text(ctx, `${label} · ${t.cash}`, at.x, at.y + 10, 16, INK_SOFT, "left", 600);
    const v = get();
    const bw = 46;
    const y = at.y + 26;
    button({ rect: { x: at.x, y, w: bw, h: 46 }, label: "−", disabled: v <= 0, size: 24 }, () => set(Math.max(0, v - 50)));
    button({ rect: { x: at.x + at.w - bw, y, w: bw, h: 46 }, label: "+", disabled: v + 10 > max, size: 24 }, () => set(Math.min(max, v + 50)));
    text(ctx, money(v), at.x + at.w / 2, y + 24, 24, JADE, "center", 800, TITLE_FONT);
  }

  function drawDeedCard(g: Game) {
    const t = tr();
    const sq = BOARD[deedSq];
    if (!sq) {
      overlay = null;
      return;
    }
    backdrop(() => {
      overlay = null;
    });
    const v = view();
    const w = 380;
    const h = sq.kind === "prop" ? 520 : 330;
    const r: Rect = { x: (W - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    drawPanel(ctx, r, "#fffaf0", 20);
    roundRect(ctx, { x: r.x + 14, y: r.y + 14, w: r.w - 28, h: 76 }, 12);
    ctx.fillStyle = GROUP_COLORS[sq.group] ?? "#6b5a4a";
    ctx.fill();
    fitText(ctx, sqName(deedSq), r.x + r.w / 2, r.y + 52, 32, r.w - 50, "#fff", "center", 800, TITLE_FONT);
    let y = r.y + 122;
    const row = (a: string, b: string, color = INK) => {
      text(ctx, a, r.x + 34, y, 19, INK_SOFT, "left", 600);
      text(ctx, b, r.x + r.w - 34, y, 20, color, "right", 700);
      y += 34;
    };
    row(t.price, money(sq.price));
    if (sq.kind === "prop") {
      row(t.rent, money(sq.rent[0]));
      row(t.rentSet, money(sq.rent[0] * 2));
      for (let k = 1; k <= 4; k++) row(t.withHouses(k), money(sq.rent[k]));
      row(t.hotel, money(sq.rent[5]), RED);
      row(t.houseCost, money(sq.house));
    } else {
      wrap(ctx, sq.kind === "transport" ? t.transportRent : t.utilityRent, r.w - 60, 18, 600).forEach((l) => {
        text(ctx, l, r.x + 34, y, 18, INK, "left", 600);
        y += 28;
      });
      y += 6;
    }
    row(t.mortgageValue, money(mortgageValue(deedSq)));
    const o = g.owner[deedSq];
    const status = o >= 0 ? `${t.owner(nameOf(o))}${g.mortgaged[deedSq] ? ` · ${t.mortgaged}` : g.houses[deedSq] === 5 ? ` · ${t.hotel}` : g.houses[deedSq] > 0 ? ` · ${t.withHouses(g.houses[deedSq])}` : ""}` : t.noOwner;
    fitText(ctx, status, r.x + r.w / 2, r.y + r.h - 36, 19, r.w - 40, o >= 0 ? colorOf(o) : INK_SOFT, "center", 700);
  }

  function drawLog() {
    const t = tr();
    backdrop(() => {
      overlay = null;
    });
    const r = sheetRect(820);
    drawPanel(ctx, r, PAPER, 26);
    hit(r, () => {});
    text(ctx, t.log, r.x + 24, r.y + 40, 26, INK, "left", 700);
    button({ rect: { x: r.x + r.w - 130, y: r.y + 16, w: 110, h: 50 }, label: t.done, kind: "gold" }, () => {
      overlay = null;
    });
    const list: Rect = { x: r.x + 20, y: r.y + 80, w: r.w - 40, h: r.h - 30 - 100 };
    const rowH = 32;
    const max = Math.max(0, log.length * rowH - list.h);
    scrollers.push({ id: "log", rect: list, max });
    const off = clamp(scroll.log ?? 0, 0, max);
    ctx.save();
    ctx.beginPath();
    ctx.rect(list.x, list.y, list.w, list.h);
    ctx.clip();
    if (log.length === 0) text(ctx, "…", list.x + list.w / 2, list.y + 30, 22, INK_SOFT, "center", 700);
    log.forEach((l, i) => {
      const y = list.y + i * rowH - off + 16;
      if (y < list.y - rowH || y > list.y + list.h + rowH) return;
      fitText(ctx, l.text, list.x, y, 18, list.w, i === 0 ? INK : INK_SOFT, "left", 600);
    });
    ctx.restore();
  }

  // ---------------------------------------------------------------- menu, rules, result

  const banner = new Image();
  banner.src = bannerArt;

  function drawMenu() {
    const t = tr();
    hits = [];
    scrollers = [];
    dim();
    const v = view();
    const canResume = game !== null && game.phase !== "over";
    const h = canResume || saved ? 846 : 786;
    const r: Rect = { x: 12, y: v.y + Math.max(10, (v.h - h) / 2), w: W - 24, h };
    drawPanel(ctx, r, PAPER, 26);
    hit(r, () => {});
    // Key art header with the title
    const art: Rect = { x: r.x + 10, y: r.y + 10, w: r.w - 20, h: 170 };
    ctx.save();
    roundRect(ctx, art, 18);
    ctx.clip();
    ctx.fillStyle = "#7a2a1c";
    ctx.fillRect(art.x, art.y, art.w, art.h);
    if (banner.complete && banner.naturalWidth > 0) {
      const sw = banner.naturalWidth;
      const sh = banner.naturalHeight;
      const k = art.w / sw;
      ctx.drawImage(banner, 0, sh * 0.25, sw, art.h / k, art.x, art.y, art.w, art.h);
    }
    const g = ctx.createLinearGradient(art.x, 0, art.x + art.w * 0.7, 0);
    g.addColorStop(0, "rgba(60,14,10,0.75)");
    g.addColorStop(1, "rgba(60,14,10,0)");
    ctx.fillStyle = g;
    ctx.fillRect(art.x, art.y, art.w, art.h);
    ctx.restore();
    ctx.save();
    ctx.lineJoin = "round";
    const size = fitSize(ctx, t.title, 64, 300, 800, TITLE_FONT);
    ctx.font = `800 ${size}px ${TITLE_FONT}`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#5a140e";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.strokeText(t.title, art.x + 22, art.y + 70);
    ctx.fillStyle = GOLD;
    ctx.fillText(t.title, art.x + 22, art.y + 70);
    ctx.restore();
    fitText(ctx, t.subtitle, art.x + 22, art.y + 128, 19, 300, "#fff1d2", "left", 700);
    // Choices
    let y = art.y + art.h + 22;
    const row = (label: string, opts: { label: string; on: boolean; disabled?: boolean; fn: () => void }[], hint?: string) => {
      text(ctx, label, r.x + 28, y, 20, INK, "left", 700);
      if (hint) fitText(ctx, hint, r.x + r.w - 28, y, 16, 230, INK_SOFT, "right", 600);
      const gap = 10;
      const bw = (r.w - 56 - gap * (opts.length - 1)) / opts.length;
      for (const [i, o] of opts.entries())
        button({ rect: { x: r.x + 28 + i * (bw + gap), y: y + 18, w: bw, h: 52 }, label: o.label, on: o.on, disabled: o.disabled, size: 20 }, () => {
          sfx.pick();
          o.fn();
        });
      y += 100;
    };
    row(
      t.players,
      [2, 3, 4].map((n) => ({
        label: String(n),
        on: menuSetup.players === n,
        fn: () => {
          menuSetup.players = n;
          menuSetup.humans = Math.min(menuSetup.humans, n);
        },
      })),
    );
    row(
      t.onPhone,
      [1, 2, 3, 4].map((n) => ({ label: String(n), on: menuSetup.humans === n, disabled: n > menuSetup.players, fn: () => (menuSetup.humans = n) })),
      t.onPhoneHint(menuSetup.humans, menuSetup.players - menuSetup.humans),
    );
    row(
      t.computer,
      DIFFICULTIES.map((d) => ({ label: t.level[d], on: menuSetup.level === d, disabled: menuSetup.humans >= menuSetup.players, fn: () => (menuSetup.level = d) })),
    );
    row(
      t.timeLimit,
      TIME_LIMITS.map((m) => ({ label: m === 0 ? t.noLimit : t.minutes(m), on: menuSetup.limit === m, fn: () => (menuSetup.limit = m) })),
    );
    const by = y;
    button({ rect: { x: r.x + 28, y: by, w: r.w - 56, h: 68 }, label: t.start, kind: "primary" }, () => {
      saved = null;
      startGame({ ...menuSetup });
    });
    const w2 = (r.w - 68) / 2;
    if (canResume || saved)
      button({ rect: { x: r.x + 28, y: by + 80, w: r.w - 56, h: 50 }, label: t.resume, kind: "gold" }, () => {
        if (game && game.phase !== "over") overlay = null;
        else if (saved) {
          resume(saved);
          saved = null;
        }
      });
    button({ rect: { x: r.x + 28 + (r.w - 56 - w2) / 2, y: r.y + r.h - 70, w: w2, h: 50 }, label: t.rules, size: 18 }, () => {
      rulesFrom = "menu";
      overlay = "rules";
      scroll.rules = 0;
    });
  }

  function drawRules() {
    const t = tr();
    backdrop(() => {
      overlay = rulesFrom;
    });
    const v = view();
    const h = Math.min(900, v.h - 20);
    const r: Rect = { x: 12, y: v.y + (v.h - h) / 2, w: W - 24, h };
    drawPanel(ctx, r, PAPER, 26);
    hit(r, () => {});
    text(ctx, t.rules, r.x + r.w / 2, r.y + 44, 30, INK, "center", 700);
    const list: Rect = { x: r.x + 24, y: r.y + 80, w: r.w - 48, h: r.h - 80 - 96 };
    const lines: { s: string; bullet: boolean }[] = [];
    for (const l of t.rulesLines) for (const [i, s] of wrap(ctx, l, list.w - 28, 18, 600).entries()) lines.push({ s, bullet: i === 0 });
    const lh = 26;
    let total = 0;
    for (const l of lines) total += lh + (l.bullet ? 8 : 0);
    const max = Math.max(0, total - list.h);
    scrollers.push({ id: "rules", rect: list, max });
    const off = clamp(scroll.rules ?? 0, 0, max);
    ctx.save();
    ctx.beginPath();
    ctx.rect(list.x - 6, list.y, list.w + 12, list.h);
    ctx.clip();
    let y = list.y + 12 - off;
    for (const l of lines) {
      if (l.bullet) {
        y += 8;
        ctx.beginPath();
        ctx.arc(list.x + 6, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = RED;
        ctx.fill();
      }
      text(ctx, l.s, list.x + 22, y, 18, INK, "left", 600);
      y += lh;
    }
    ctx.restore();
    button({ rect: { x: r.x + r.w / 2 - 110, y: r.y + r.h - 80, w: 220, h: 60 }, label: t.close, kind: "gold" }, () => {
      overlay = rulesFrom;
    });
  }

  function drawResult(g: Game) {
    const t = tr();
    hits = [];
    scrollers = [];
    dim();
    const v = view();
    const order = placings(g);
    const h = 260 + order.length * 62;
    const r: Rect = { x: 20, y: v.y + (v.h - h) / 2, w: W - 40, h };
    drawPanel(ctx, r, PAPER, 26);
    const youWon = online ? g.winner === me : controls(g.winner) && humansLocal() === 1;
    const title = youWon ? t.youWin : t.winOf(nameOf(g.winner));
    fitText(ctx, title, r.x + r.w / 2, r.y + 50, 40, r.w - 40, youWon ? JADE : INK, "center", 800, TITLE_FONT);
    text(ctx, g.endReason === "last" ? t.byLast : t.byTime, r.x + r.w / 2, r.y + 92, 18, INK_SOFT, "center", 600);
    order.forEach((seat, i) => {
      const y = r.y + 124 + i * 62;
      roundRect(ctx, { x: r.x + 20, y, w: r.w - 40, h: 54 }, 14);
      ctx.fillStyle = i === 0 ? "#ffe7a3" : "#fffaf0";
      ctx.fill();
      text(ctx, String(i + 1), r.x + 42, y + 28, 26, i === 0 ? GOLD_DARK : INK_SOFT, "center", 800, TITLE_FONT);
      drawToken(ctx, TOKENS[seat], seat, r.x + 84, y + 30, 36, 0, g.players[seat].out);
      fitText(ctx, nameOf(seat), r.x + 112, y + 28, 20, 170, INK, "left", 700);
      const worth = g.players[seat].out ? t.bankrupt : money(netWorth(g, seat));
      text(ctx, worth, r.x + r.w - 36, y + 28, 22, g.players[seat].out ? RED : JADE, "right", 800, TITLE_FONT);
    });
    let line = "";
    if (online) {
      const mine = results?.find((x) => x.seat === me);
      if (mine && mine.score > 0) line = t.scoreLine(mine.score);
    } else if (youWon) {
      const human = g.players.findIndex((p) => p.bot === null);
      const bots = g.players.filter((p) => p.bot !== null).length;
      line = t.scoreLine(Math.floor((netWorth(g, human) / 10) * LEVEL_MULT[current.level]) + BEAT_BONUS[current.level] * bots);
    }
    const by = r.y + r.h - 82;
    if (line) text(ctx, line, r.x + r.w / 2, by - 20, 22, GOLD_DARK, "center", 800, TITLE_FONT);
    if (online) {
      button({ rect: { x: r.x + r.w / 2 - 120, y: by, w: 240, h: 60 }, label: t.backToLobby, kind: "primary" }, () => online.backToLobby());
      return;
    }
    const w2 = (r.w - 64) / 2;
    button({ rect: { x: r.x + 20, y: by, w: w2, h: 60 }, label: t.again, kind: "primary" }, () => startGame(current));
    button({ rect: { x: r.x + 44 + w2, y: by, w: w2, h: 60 }, label: t.menu }, () => {
      game = null;
      overlay = "menu";
    });
  }

  // ---------------------------------------------------------------- render

  function render() {
    stage.begin();
    hits = [];
    scrollers = [];
    drawTable(ctx, view());
    const g = game;
    drawTopBar(g);
    if (g) {
      drawStrip(g);
      drawBoardView(g);
      drawDecision(g);
    } else if (online) {
      text(ctx, tr().title, W / 2, view().y + view().h / 2, 40, GOLD, "center", 800, TITLE_FONT);
    }
    if (g && g.phase === "over" && !busy() && !overlay) drawResult(g);
    if (overlay === "menu") drawMenu();
    else if (overlay === "rules") drawRules();
    else if (g && overlay === "assets") drawAssets(g);
    else if (g && overlay === "trade") drawTrade(g);
    else if (g && overlay === "deed") drawDeedCard(g);
    else if (g && overlay === "log") drawLog();
    if (online && me < 0 && g) text(ctx, tr().watching, W / 2, top() + 24, 18, "#fff1d2");
    stage.end();
  }

  if (saved) {
    resume(saved);
    saved = null;
  }

  return {
    update,
    render,
    pointer,
    keydown(e) {
      if (e.code === "Escape") {
        if (overlay === "rules") overlay = rulesFrom;
        else if (overlay === "menu") overlay = game && game.phase !== "over" ? null : "menu";
        else if (overlay) overlay = null;
        else if (!online) overlay = "menu";
      } else if ((e.code === "Space" || e.code === "Enter") && game && !overlay) {
        const who = decider(game);
        if (game.phase === "turn" && controls(who) && !busy()) send(game.mustRoll ? { type: "roll" } : { type: "end" });
      }
    },
    dispose() {
      stopListening?.();
      save();
    },
  };
}
