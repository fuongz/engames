import "@fontsource/baloo-2/800.css";
import "@fontsource/mali/600.css";
import "@fontsource/mali/700.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, easeOutCubic, inRect } from "@web-games/core";
import type { SeatResult } from "@web-games/core/online";
import {
  type ButtonKind,
  FONT,
  GOLD,
  GOLD_DARK,
  INK,
  INK_SOFT,
  JADE,
  JADE_DARK,
  PAPER,
  RED,
  type Ring,
  TITLE_FONT,
  drawButton,
  drawDeedChip,
  drawDie,
  drawPanel,
  drawRing,
  drawTable,
  drawToken,
  fitSize,
  fitText,
  ringLayout,
  roundRect,
  squareAt,
  text,
  tokenSpot,
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
  SALARY,
  SQUARES,
  TIME_LIMITS,
  TOKENS,
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

// The imperative shell for Cờ Tỷ Phú, in landscape: the 40 squares run round
// the edge of the whole screen and the dashboard sits inside the ring — the
// player on the move, the dice, everyone's cash, and one dark panel with the
// decision that matters now. Sheets open for assets, trades and deed cards.
// Offline it runs the rules itself (with computer players and pass-and-play);
// online it only sends decisions and draws the room's snapshots
// (docs/standards/online-multiplayer.md). Events play back in order — dice,
// hops, then the lines — so money never moves before the token gets there.

const SAVE_VERSION = 1;
const TAP_SLOP = 10;
const TOKEN = 30;
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
  let rulesFrom: Overlay = null;
  let reported = false;
  const wins = storage.get<Record<Difficulty, number>>("wins", { easy: 0, normal: 0, hard: 0 });
  /** Offline playback speed (computers and animations). */
  let speed = storage.get<number>("speed", 1) === 2 ? 2 : 1;

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
  const log: { text: string; color: string; born: number }[] = [];
  const floaters: { text: string; seat: number; color: string; born: number }[] = [];
  let hits: Hit[] = [];
  let scrollers: Scroller[] = [];
  const scroll: Record<string, number> = {};
  let deedSq = -1;
  let assetsSeat = -1;
  let confirmBankrupt = -10;
  /** Trade being built. */
  const draft = { to: -1, give: new Set<number>(), get: new Set<number>(), giveCash: 0, getCash: 0, giveCards: 0, getCards: 0 };

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
  const colorOf = (seat: number) => PLAYER_COLORS[seat] ?? "#fff1d2";

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
    floaters.length = 0;
    log.length = 0;
    g.players.forEach((p, i) => {
      tokenAt[i] = p.pos;
      shownCash[i] = p.cash;
      cashDisp[i] = p.cash;
    });
    lastHuman = Math.max(
      0,
      g.players.findIndex((p) => p.bot === null),
    );
  }

  function startGame(su: Setup) {
    current = { ...su };
    storage.set("setup", su);
    const seats = Array.from({ length: su.players }, (_, i) =>
      i < su.humans ? { name: "", bot: null } : { name: BOT_NAMES[(i - su.humans) % BOT_NAMES.length], bot: su.level },
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
    if (Array.isArray(s.log)) for (const l of s.log.slice(0, 40)) if (typeof l?.text === "string") log.push({ text: l.text, color: l.color, born: -99 });
    overlay = null;
  }

  function save() {
    if (online || !game) return;
    const lines = log.slice(0, 40).map((l) => ({ text: l.text, color: l.color }));
    storage.set("run", game.phase === "over" ? null : ({ v: SAVE_VERSION, setup: current, game: { ...game, events: [] }, log: lines } satisfies Saved));
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

  function addLine(line: string, color = "#fff1d2") {
    log.unshift({ text: line, color, born: now });
    if (log.length > 120) log.length = 120;
  }

  function cashDelta(seat: number, amount: number) {
    if (seat < 0 || amount === 0) return;
    shownCash[seat] = (shownCash[seat] ?? 0) + amount;
    floaters.push({ text: `${amount > 0 ? "+" : "−"}${money(Math.abs(amount))}`, seat, color: amount > 0 ? "#7be3a6" : "#ff8a7a", born: now });
  }

  function play(e: GameEvent) {
    const t = tr();
    const ev = t.ev;
    let wait = 0.06;
    switch (e.type) {
      case "turn":
        addLine(ev.turn(nameOf(e.seat)), GOLD);
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
        break;
      case "salary":
        cashDelta(e.seat, e.amount);
        sfx.coin();
        addLine(ev.salary(nameOf(e.seat), e.amount), "#9be7b9");
        break;
      case "buy":
        cashDelta(e.seat, -e.price);
        sfx.coin();
        addLine(ev.buy(nameOf(e.seat), sqName(e.sq), e.price), colorOf(e.seat));
        break;
      case "rent":
        cashDelta(e.from, -e.amount);
        cashDelta(e.to, e.amount);
        sfx.pay();
        addLine(ev.rent(nameOf(e.from), e.amount, nameOf(e.to)), "#ffd27a");
        wait = 0.25;
        break;
      case "pay":
        cashDelta(e.from, -e.amount);
        cashDelta(e.to, e.amount);
        sfx.pay();
        addLine(
          e.why === "tax" ? ev.tax(nameOf(e.from), e.amount) : e.to >= 0 ? ev.payTo(nameOf(e.from), e.amount, nameOf(e.to)) : ev.payBank(nameOf(e.from), e.amount),
          "#ffd27a",
        );
        wait = 0.2;
        break;
      case "gain":
        cashDelta(e.seat, e.amount);
        sfx.coin();
        addLine(ev.gain(nameOf(e.seat), e.amount), "#9be7b9");
        break;
      case "card":
        cardShow = { deck: e.deck, card: e.card, t0: now };
        sfx.card();
        addLine(`${t.cardTitle[e.deck]}: ${DECKS[e.deck][e.card].text[loc()]}`, "#fff1d2");
        wait = 1.1;
        break;
      case "jail":
        sfx.jail();
        addLine(e.why === "doubles" ? ev.jailDoubles(nameOf(e.seat)) : ev.jail(nameOf(e.seat)), "#ff9a8a");
        break;
      case "free":
        if (e.how === "pay") cashDelta(e.seat, -JAIL_FINE);
        addLine(
          e.how === "pay" ? ev.freePay(nameOf(e.seat)) : e.how === "card" ? ev.freeCard(nameOf(e.seat)) : e.how === "doubles" ? ev.freeDoubles(nameOf(e.seat)) : ev.freeFine(nameOf(e.seat)),
          "#9be7b9",
        );
        break;
      case "stay":
        addLine(ev.stay(nameOf(e.seat)), "#ffd27a");
        wait = 0.3;
        break;
      case "again":
        addLine(ev.again(nameOf(e.seat)), "#fff1d2");
        break;
      case "auction":
        addLine(ev.auction(sqName(e.sq)), GOLD);
        wait = 0.2;
        break;
      case "bid":
        addLine(ev.bid(nameOf(e.seat), e.amount), colorOf(e.seat));
        break;
      case "pass":
        addLine(ev.pass(nameOf(e.seat)), colorOf(e.seat));
        break;
      case "won":
        cashDelta(e.seat, -e.amount);
        sfx.coin();
        addLine(ev.won(nameOf(e.seat), sqName(e.sq), e.amount), colorOf(e.seat));
        wait = 0.2;
        break;
      case "unsold":
        addLine(ev.unsold(sqName(e.sq)), "#fff1d2");
        break;
      case "build":
        cashDelta(e.seat, -BOARD[e.sq].house);
        sfx.build();
        addLine(e.houses === 5 ? ev.hotel(nameOf(e.seat), sqName(e.sq)) : ev.build(nameOf(e.seat), sqName(e.sq)), colorOf(e.seat));
        break;
      case "sell":
        cashDelta(e.seat, e.amount);
        addLine(ev.sell(nameOf(e.seat), sqName(e.sq)), colorOf(e.seat));
        break;
      case "mortgage":
        cashDelta(e.seat, e.amount);
        addLine(ev.mortgage(nameOf(e.seat), sqName(e.sq)), colorOf(e.seat));
        break;
      case "unmortgage":
        cashDelta(e.seat, -e.amount);
        addLine(ev.unmortgage(nameOf(e.seat), sqName(e.sq)), colorOf(e.seat));
        break;
      case "offer":
        addLine(ev.offer(nameOf(e.from), nameOf(e.to)), GOLD);
        break;
      case "answer":
        addLine(e.accepted ? ev.accepted(nameOf(e.to), nameOf(e.from)) : ev.rejected(nameOf(e.to)), e.accepted ? "#9be7b9" : "#ffd27a");
        wait = 0.3;
        break;
      case "debt":
        addLine(ev.debt(nameOf(e.seat), e.amount), "#ff9a8a");
        break;
      case "bankrupt":
        sfx.lose();
        addLine(ev.bankrupt(nameOf(e.seat)), "#ff9a8a");
        wait = 0.6;
        break;
      case "over":
        addLine(ev.over(nameOf(e.winner)), GOLD);
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
  const ring = (): Ring => ringLayout(view());

  /** Where a seat's token is drawn now, hops included. */
  function tokenPos(g: Game, L: Ring, seat: number): { x: number; y: number; lift: number } {
    if (hop && hop.seat === seat) {
      const k = (now - hop.t0) / HOP_TIME;
      const i = clamp(Math.floor(k), 0, hop.path.length - 1);
      const a = tokenSpot(L, i === 0 ? prevOf(hop.path) : hop.path[i - 1]);
      const b = tokenSpot(L, hop.path[i]);
      const f = clamp(k - i, 0, 1);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, lift: Math.sin(f * Math.PI) * 16 };
    }
    const sq = tokenAt[seat] ?? g.players[seat].pos;
    const jailed = sq === JAIL && g.players[seat].inJail && !busy();
    return { ...spread(g, seat, sq, tokenSpot(L, sq, jailed)), lift: 0 };
  }
  /** The square before the first hop. */
  const prevOf = (path: number[]) => {
    const dir = path.length > 1 ? Math.sign(((path[1] - path[0] + SQUARES + 20) % SQUARES) - 20) || 1 : 1;
    return (path[0] - dir + SQUARES) % SQUARES;
  };
  /** Several tokens on one square sit in a little cluster. */
  function spread(g: Game, seat: number, sq: number, c: { x: number; y: number }) {
    const here = g.players.flatMap((p, i) => (!p.out && (tokenAt[i] ?? p.pos) === sq && !(hop && hop.seat === i) ? [i] : []));
    const k = here.indexOf(seat);
    if (here.length <= 1 || k < 0) return c;
    const d = TOKEN * 0.42;
    const offs = [
      [-d, -d * 0.6],
      [d, -d * 0.6],
      [-d, d * 0.6],
      [d, d * 0.6],
    ];
    return { x: c.x + offs[k][0], y: c.y + offs[k][1] };
  }

  /** The dashboard's pieces inside the ring. */
  function dash(L: Ring) {
    const I = L.inner;
    const pad = 22;
    const panelH = Math.min(176, I.h * 0.44);
    const panel: Rect = { x: I.x + pad, y: I.y + I.h - panelH - 16, w: I.w - 2 * pad, h: panelH };
    const top: Rect = { x: I.x + pad, y: I.y + 18, w: I.w - 2 * pad, h: panel.y - I.y - 26 };
    return { I, panel, top };
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
    if (cardShow) {
      cardShow = null;
      return;
    }
    const sq = squareAt(ring(), p);
    if (sq >= 0 && ownable(sq)) {
      deedSq = sq;
      overlay = "deed";
      sfx.pick();
    }
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let press: { id: number; sx: number; sy: number; moved: boolean; target: string; s0: number } | null = null;

  const pointer = {
    down(p: PointerInfo) {
      pointers.set(p.id, { x: p.x, y: p.y });
      press = pointers.size === 1 ? { id: p.id, sx: p.x, sy: p.y, moved: false, target: "", s0: 0 } : null;
    },
    move(p: PointerInfo) {
      if (!pointers.has(p.id) || !press || press.id !== p.id) return;
      if (!press.moved && Math.hypot(p.x - press.sx, p.y - press.sy) > TAP_SLOP) {
        press.moved = true;
        const start = { x: press.sx, y: press.sy };
        const sc = [...scrollers].reverse().find((s) => inRect(start, s.rect));
        if (sc) {
          press.target = sc.id;
          press.s0 = scroll[sc.id] ?? 0;
        }
      }
      if (press.moved && press.target) {
        const id = press.target;
        const sc = scrollers.find((s) => s.id === id);
        scroll[id] = clamp(press.s0 - (p.y - press.sy), 0, sc?.max ?? 0);
      }
    },
    up(p: PointerInfo) {
      if (!pointers.delete(p.id)) return;
      if (press && press.id === p.id && !press.moved) tap(p);
      if (pointers.size === 0) press = null;
    },
  };

  // ---------------------------------------------------------------- update

  function update(rawDt: number) {
    const dt = online ? rawDt : rawDt * speed;
    now += dt;
    pump();
    if (game && !online && overlay !== "menu" && overlay !== "rules") {
      if (busy()) {
        if (game.phase !== "over") game.elapsed += rawDt;
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
    while (floaters.length > 0 && now - floaters[0].born > 1.4) floaters.shift();
    if (cardShow && now - cardShow.t0 > CARD_TIME) cardShow = null;
    if (game && game.phase === "over" && !busy()) gameOver(game);
  }

  const soloScore = (g: Game, human: number) =>
    Math.floor((netWorth(g, human) / 10) * LEVEL_MULT[current.level]) + BEAT_BONUS[current.level] * g.players.filter((p) => p.bot !== null).length;

  function gameOver(g: Game) {
    if (reported || online) return;
    reported = true;
    save();
    const humans = g.players.flatMap((p, i) => (p.bot === null ? [i] : []));
    const bots = g.players.length - humans.length;
    const human = humans[0];
    if (humans.length === 1 && g.winner === human && bots > 0) {
      sfx.win();
      reportScore?.({ score: soloScore(g, human), detail: tr().detail(current.level, netWorth(g, human)) });
      wins[current.level]++;
      storage.set("wins", wins);
      const best = [...DIFFICULTIES].reverse().find((d) => wins[d] > 0) ?? current.level;
      storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(best, wins[best]), en: STRINGS.en.summary(best, wins[best]) });
    } else if (humans.length === 1 && bots > 0) sfx.lose();
    else sfx.win();
  }

  // ---------------------------------------------------------------- render: the ring

  function drawBoard(g: Game, L: Ring) {
    const t = tr();
    const focus = g.phase === "buy" ? g.buySq : g.phase === "auction" && g.auction ? g.auction.sq : -1;
    drawRing(ctx, L, { owner: g.owner, houses: g.houses, mortgaged: g.mortgaged, focus, now }, sqName, { mortgaged: t.mortgaged, salary: `+${money(SALARY)}` });
  }

  function drawTokens(g: Game, L: Ring) {
    const order = g.players.map((_, i) => i).sort((a, b) => (a === hop?.seat ? 1 : b === hop?.seat ? -1 : a === g.current ? 1 : b === g.current ? -1 : 0));
    for (const i of order) {
      const p = g.players[i];
      if (p.out) continue;
      const pos = tokenPos(g, L, i);
      const bob = i === g.current && !hop && g.phase !== "over" ? Math.abs(Math.sin(now * 3)) * 3 : 0;
      drawToken(ctx, TOKENS[i], i, pos.x, pos.y, TOKEN, pos.lift + bob);
    }
  }

  // ---------------------------------------------------------------- render: the dashboard

  function drawInner(I: Rect) {
    const g = ctx.createRadialGradient(I.x + I.w / 2, I.y + I.h / 2, 40, I.x + I.w / 2, I.y + I.h / 2, Math.max(I.w, I.h) * 0.7);
    g.addColorStop(0, "#2a8c69");
    g.addColorStop(1, JADE_DARK);
    ctx.fillStyle = g;
    ctx.fillRect(I.x, I.y, I.w, I.h);
    // A faint gold lotus behind everything
    ctx.save();
    ctx.translate(I.x + I.w / 2, I.y + I.h * 0.36);
    ctx.strokeStyle = "rgba(233,185,73,0.16)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.ellipse(0, -70, 18, 44, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = GOLD_DARK;
    ctx.lineWidth = 3;
    ctx.strokeRect(I.x + 1.5, I.y + 1.5, I.w - 3, I.h - 3);
  }

  /** A small round button with a short label under it. */
  function roundButton(x: number, y: number, glyph: string, label: string, fn: () => void) {
    const r = 18;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20,40,32,0.55)";
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    if (glyph === "menu") {
      ctx.fillStyle = "#fff1d2";
      for (let i = -1; i <= 1; i++) ctx.fillRect(x - 9, y + i * 6 - 1.5, 18, 3);
    } else if (glyph === "log") {
      ctx.fillStyle = "#fff1d2";
      for (let i = -1; i <= 1; i++) {
        ctx.fillRect(x - 9, y + i * 6 - 1.2, 3, 2.6);
        ctx.fillRect(x - 4, y + i * 6 - 1.2, 13, 2.6);
      }
    } else text(ctx, glyph, x, y + 1, 18, "#fff1d2", "center", 800, TITLE_FONT);
    fitText(ctx, label, x, y + r + 9, 11, 62, "#fff1d2", "center", 700);
    hit({ x: x - 30, y: y - r - 4, w: 60, h: 2 * r + 20 }, () => {
      sfx.pick();
      fn();
    });
  }

  function drawDashboard(g: Game, L: Ring) {
    const t = tr();
    const { I, panel, top } = dash(L);
    drawInner(I);
    // Round buttons down the left
    const bx = top.x + 16;
    let by = top.y + 18;
    const step = Math.max(56, Math.min(66, (top.h - 30) / 3));
    if (!online) {
      roundButton(bx, by, "menu", t.menu, () => {
        overlay = "menu";
      });
      by += step;
      roundButton(bx, by, `${speed}×`, t.speed, () => {
        speed = speed === 1 ? 2 : 1;
        storage.set("speed", speed);
      });
      by += step;
    }
    roundButton(bx, by, "log", t.log, () => {
      overlay = "log";
      scroll.log = 0;
    });
    // The player on the move: token, name and cash, big
    const who = g.phase === "over" ? g.winner : g.current;
    const ax = top.x + 64 + Math.min(80, top.w * 0.1);
    const avatarS = Math.min(74, top.h * 0.42);
    fitText(ctx, nameOf(who), ax, top.y + 14, 22, 170, "#fff1d2", "center", 700);
    drawToken(ctx, TOKENS[who], who, ax, top.y + 30 + avatarS * 0.62, avatarS, Math.abs(Math.sin(now * 2.5)) * 3);
    fitText(ctx, money(Math.round(cashDisp[who] ?? 0)), ax, top.y + top.h - 14, 32, 180, GOLD, "center", 800, TITLE_FONT);
    // Players and their cash, ▶ on whose turn it is
    const listW = Math.min(250, top.w * 0.34);
    const lx = top.x + top.w - listW;
    const rowH = Math.min(36, top.h / Math.max(4, g.players.length));
    const decides = decider(g);
    g.players.forEach((p, i) => {
      const y = top.y + i * rowH;
      const mid = y + rowH / 2;
      if (i === g.current && g.phase !== "over") text(ctx, "▶", lx + 8, mid, 16, GOLD, "center", 800, TITLE_FONT);
      drawToken(ctx, TOKENS[i], i, lx + 34, mid + 2, rowH * 0.72, 0, p.out);
      ctx.save();
      if (p.out) ctx.globalAlpha = 0.5;
      fitText(ctx, nameOf(i), lx + 54, mid, 17, listW - 150, "#fff1d2", "left", 700);
      const cash = p.out ? t.bankrupt : money(Math.round(cashDisp[i] ?? p.cash));
      text(ctx, cash, lx + listW - 4, mid, 20, p.out ? "#ff9a8a" : i === g.current ? GOLD : "#fff1d2", "right", 800, TITLE_FONT);
      ctx.restore();
      if (p.out) {
        ctx.strokeStyle = "#ff9a8a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx + 52, mid);
        ctx.lineTo(lx + listW, mid);
        ctx.stroke();
      }
      const tag = p.inJail && !p.out ? "⛓" : p.away ? "⚠" : i === decides && decides !== g.current && g.phase !== "over" ? "●" : "";
      if (tag) text(ctx, tag, lx + listW - 82, mid, 13, tag === "●" ? GOLD : "#ffb3a6", "center", 700);
      hit({ x: lx, y, w: listW, h: rowH }, () => {
        if (p.out) return;
        openAssets(i);
      });
    });
    // Money floaters rise from the list
    for (const f of floaters) {
      const k = (now - f.born) / 1.4;
      const y = top.y + f.seat * rowH + rowH / 2 - k * 22;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(20,8,6,0.85)";
      ctx.font = `800 20px ${TITLE_FONT}`;
      ctx.textAlign = "right";
      ctx.strokeText(f.text, lx - 6, y);
      text(ctx, f.text, lx - 6, y, 20, f.color, "right", 800, TITLE_FONT);
      ctx.restore();
    }
    // Time left, above the dice
    const dcx = (ax + 90 + lx - 10) / 2;
    if (g.limit > 0) {
      const left = Math.max(0, g.limit - g.elapsed);
      const label = `⏱ ${t.timeLeft(Math.floor(left / 60), Math.floor(left % 60))}`;
      text(ctx, label, dcx, top.y + 12, 18, left < 300 ? "#ff9a8a" : "#fff1d2", "center", 800, TITLE_FONT);
    }
    drawDice(dcx, top.y + top.h * 0.5 + 6, Math.min(64, top.h * 0.36));
    // The latest line, fading, between the dice and the panel
    const last = log[0];
    if (last && now - last.born < TOAST_TIME) {
      ctx.save();
      ctx.globalAlpha = clamp((TOAST_TIME - (now - last.born)) * 2, 0, 1);
      fitText(ctx, last.text, dcx, top.y + top.h - 4, 17, lx - ax - 120, last.color, "center", 700);
      ctx.restore();
    }
    drawDecision(g, panel);
  }

  function drawDice(cx: number, cy: number, s: number) {
    const age = dice ? now - dice.t0 : 99;
    const rolling = age < DICE_TIME;
    const k = easeOutCubic(age / DICE_TIME);
    for (let i = 0; i < 2; i++) {
      const face = !dice ? 6 - i * 2 : rolling ? 1 + Math.floor((now * 18 + i * 3) % 6) : dice.d[i];
      const rot = rolling ? (1 - k) * (i ? -6 : 7) : i ? 0.12 : -0.1;
      drawDie(ctx, face, cx + (i ? 1 : -1) * s * 0.62, cy - (rolling ? (1 - k) * 18 : 0), s, rot);
    }
  }

  // ---------------------------------------------------------------- render: the decision panel

  function drawDecision(g: Game, r: Rect) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 12;
    roundRect(ctx, r, 16);
    ctx.fillStyle = "rgba(28,10,8,0.92)";
    ctx.fill();
    ctx.restore();
    roundRect(ctx, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, 13);
    ctx.strokeStyle = GOLD_DARK;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (g.phase === "over") {
      drawLines(r, r.y + 26);
      return;
    }
    const t = tr();
    const who = decider(g);
    const mine = who >= 0 && controls(who) && !busy() && !waiting();
    const x0 = r.x + 18;
    const iw = r.w - 36;
    if (who >= 0) drawToken(ctx, TOKENS[who], who, x0 + 14, r.y + 28, 28);
    const title = headline(g, who, mine);
    let right = "";
    let rightColor = "#cfe9dc";
    if (online && who >= 0 && g.turnSeconds > 0 && !g.players[who].bot) {
      const f = clamp(g.clock / g.turnSeconds, 0, 1);
      right = `${Math.ceil(g.clock)}s`;
      rightColor = f < 0.3 ? "#ff8a7a" : GOLD;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(x0, r.y + 48, iw, 4);
      ctx.fillStyle = rightColor;
      ctx.fillRect(x0, r.y + 48, iw * f, 4);
    } else if (who >= 0 && mine) right = t.cashNow(g.players[who].cash);
    fitText(ctx, title, x0 + 36, r.y + 26, 22, iw - 60 - (right ? 160 : 0), "#fff1d2", "left", 700);
    if (right) text(ctx, right, x0 + iw, r.y + 26, 18, rightColor, "right", 800, TITLE_FONT);
    const row: Rect = { x: x0, y: r.y + r.h - 64, w: iw, h: 52 };
    const bodyY = r.y + 60 + (r.h - 64 - 60) / 2 - 2;
    if (!mine) {
      drawLines(r, r.y + 62);
      return;
    }
    const p = g.players[who];
    /** Buttons laid out left to right; `grow` ones share the leftover width. */
    const rowOf = (items: { label: string; kind?: ButtonKind; disabled?: boolean; sub?: string; grow?: boolean; fn: () => void }[]) => {
      const gap = 10;
      const fixed = 150;
      const growers = items.filter((b) => b.grow).length;
      const fixedW = items.filter((b) => !b.grow).length * fixed;
      const growW = growers ? (row.w - fixedW - gap * (items.length - 1)) / growers : 0;
      const each = growers ? 0 : (row.w - gap * (items.length - 1)) / items.length;
      let x = row.x;
      for (const b of items) {
        const w = growers ? (b.grow ? growW : fixed) : each;
        button({ rect: { x, y: row.y, w, h: row.h }, label: b.label, kind: b.kind, disabled: b.disabled, sub: b.sub, size: 20 }, b.fn);
        x += w + gap;
      }
    };
    const assets = { label: t.assets, fn: () => openAssets(who) };
    const trade = { label: t.trade, disabled: g.offersThisTurn >= OFFERS_PER_TURN || alive(g).length < 2, fn: () => openTrade(g, who) };
    switch (g.phase) {
      case "turn": {
        if (p.inJail && g.mustRoll) {
          text(ctx, t.inJail(p.jailTries), x0, bodyY, 17, "#cfe9dc", "left", 600);
          rowOf([
            { label: t.rollJail, kind: "primary", grow: true, fn: () => send({ type: "roll" }) },
            { label: t.payJail(JAIL_FINE), disabled: p.cash < JAIL_FINE, fn: () => send({ type: "payJail" }) },
            { label: t.useCard, disabled: p.freeCards.length === 0, sub: p.freeCards.length ? `× ${p.freeCards.length}` : undefined, fn: () => send({ type: "useCard" }) },
            assets,
          ]);
        } else {
          text(ctx, t.at(sqName(p.pos)), x0, bodyY, 17, "#cfe9dc", "left", 600);
          const main = g.mustRoll
            ? { label: g.doubles > 0 ? t.rollAgain : t.roll, kind: "primary" as const, grow: true, fn: () => send({ type: "roll" }) }
            : { label: t.endTurn, kind: "gold" as const, grow: true, fn: () => send({ type: "end" }) };
          rowOf([assets, trade, main]);
        }
        break;
      }
      case "buy": {
        const price = BOARD[g.buySq].price;
        deedLine(g.buySq, x0, bodyY, iw);
        if (p.cash < price) fitText(ctx, t.cantAfford, x0 + iw, bodyY, 15, iw * 0.45, "#ff9a8a", "right", 600);
        rowOf([
          { label: t.buy(price), kind: "primary", grow: true, disabled: p.cash < price, fn: () => send({ type: "buy" }) },
          { label: t.toAuction, grow: true, fn: () => send({ type: "decline" }) },
          assets,
        ]);
        break;
      }
      case "auction": {
        const a = g.auction;
        if (!a) break;
        const status = a.leader >= 0 ? t.bidNow(a.bid, nameOf(a.leader)) : t.noBids;
        fitText(ctx, status, x0, bodyY, 19, iw * 0.55, a.leader >= 0 ? "#ffd27a" : "#cfe9dc", "left", 700);
        for (const [i, seat] of a.active.entries()) drawToken(ctx, TOKENS[seat], seat, x0 + iw - 14 - i * 34, bodyY + 4, 26, i === a.turn ? 3 : 0);
        const base = a.leader >= 0 ? a.bid : 0;
        rowOf([
          ...[MIN_BID, 50, 100].map((inc) => {
            const amount = Math.max(minBid(a), base + inc);
            return { label: money(amount), sub: `+${inc}`, kind: "primary" as const, disabled: amount > p.cash, grow: true, fn: () => send({ type: "bid", amount }) };
          }),
          { label: t.passBid, fn: () => send({ type: "pass" }) },
        ]);
        break;
      }
      case "debt": {
        text(ctx, t.oweHint, x0, bodyY, 17, "#cfe9dc", "left", 600);
        const confirming = now - confirmBankrupt < 3;
        rowOf([
          { label: t.assets, kind: "primary", grow: true, fn: () => openAssets(who) },
          {
            label: confirming ? t.confirmBankrupt : t.bankrupt,
            kind: "danger",
            grow: true,
            fn: () => {
              if (confirming) {
                confirmBankrupt = -10;
                send({ type: "bankrupt" });
              } else confirmBankrupt = now;
            },
          },
        ]);
        break;
      }
      case "trade": {
        const o = g.offer;
        if (!o) break;
        const line = (label: string, b: Bundle, y: number) => {
          text(ctx, label, x0, y, 16, "#cfe9dc", "left", 700);
          fitText(ctx, bundleText(b), x0 + 100, y, 17, iw - 100, "#fff1d2", "left", 700);
        };
        line(t.youGet, o.give, bodyY - 11);
        line(t.youGive, o.get, bodyY + 13);
        rowOf([
          { label: t.accept, kind: "primary", grow: true, fn: () => send({ type: "accept" }) },
          { label: t.reject, grow: true, fn: () => send({ type: "reject" }) },
        ]);
        break;
      }
    }
  }

  const bundleText = (b: Bundle) => {
    const t = tr();
    const parts = [...b.sqs.map(sqName)];
    if (b.cash > 0) parts.push(money(b.cash));
    if (b.cards > 0) parts.push(t.cards(b.cards));
    return parts.length ? parts.join(", ") : t.nothing;
  };

  /** One deed in a line: colour chip, name, rents. */
  function deedLine(sq: number, x: number, y: number, w: number) {
    const square = BOARD[sq];
    const t = tr();
    ctx.fillStyle = GROUP_COLORS[square.group] ?? "#999";
    roundRect(ctx, { x, y: y - 11, w: 22, h: 22 }, 5);
    ctx.fill();
    text(ctx, sqName(sq), x + 32, y, 19, "#fff1d2", "left", 700);
    ctx.font = `700 19px ${FONT}`;
    const nw = ctx.measureText(sqName(sq)).width;
    const rent = square.kind === "prop" ? `${t.rent} ${money(square.rent[0])}, ${t.rentSet} ${money(square.rent[0] * 2)}` : square.kind === "transport" ? t.transportRent : t.utilityRent;
    fitText(ctx, rent, x + 44 + nw, y, 15, w * 0.55 - nw, "#cfe9dc", "left", 600);
  }

  function drawLines(r: Rect, y0: number) {
    let y = y0;
    for (const l of log) {
      if (y > r.y + r.h - 12) break;
      fitText(ctx, l.text, r.x + 22, y, 17, r.w - 44, y === y0 ? l.color : "rgba(255,241,210,0.7)", "left", 600);
      y += 26;
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

  function drawCard(L: Ring) {
    if (!cardShow) return;
    const t = tr();
    const I = L.inner;
    const age = now - cardShow.t0;
    const k = easeOutCubic(age / 0.3);
    const a = clamp((CARD_TIME - age) * 3, 0, 1);
    const w = Math.min(420, I.w - 40);
    const h = 190;
    const r: Rect = { x: I.x + (I.w - w) / 2, y: I.y + (I.h - h) / 2 - 30 + (1 - k) * 40, w, h };
    ctx.save();
    ctx.globalAlpha = a * k;
    drawPanel(ctx, r, PAPER, 18);
    const color = cardShow.deck === "chance" ? "#d9473b" : "#2a6fc2";
    roundRect(ctx, { x: r.x + 10, y: r.y + 10, w: r.w - 20, h: 46 }, 12);
    ctx.fillStyle = color;
    ctx.fill();
    text(ctx, t.cardTitle[cardShow.deck], r.x + r.w / 2, r.y + 34, 24, "#fff3d6", "center", 800, TITLE_FONT);
    const lines = wrap(ctx, DECKS[cardShow.deck][cardShow.card].text[loc()], r.w - 50, 21).slice(0, 3);
    for (const [i, l] of lines.entries()) text(ctx, l, r.x + r.w / 2, r.y + 90 + i * 28 + (3 - lines.length) * 14, 21, INK, "center", 700);
    ctx.restore();
    hit(r, () => {
      cardShow = null;
    });
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

  /** A landscape sheet centred on screen. */
  function sheetRect(maxW: number): Rect {
    const v = view();
    const w = Math.min(maxW, v.w - 40);
    const h = v.h - 24;
    return { x: v.x + (v.w - w) / 2, y: v.y + 12, w, h };
  }

  function dim() {
    const v = view();
    ctx.fillStyle = "rgba(20,6,4,0.62)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
  }

  function backdrop(close: () => void) {
    hits = [];
    scrollers = [];
    dim();
    const v = view();
    hit({ x: v.x, y: v.y, w: v.w, h: v.h }, close);
  }

  function sheetHeader(r: Rect, title: string, seat: number, sub?: string) {
    const t = tr();
    let x = r.x + 26;
    if (seat >= 0) {
      drawToken(ctx, TOKENS[seat], seat, r.x + 40, r.y + 38, 36);
      x = r.x + 68;
    }
    fitText(ctx, title, x, sub ? r.y + 28 : r.y + 36, 24, r.w * 0.55, INK, "left", 700);
    if (sub) text(ctx, sub, x, r.y + 54, 17, JADE, "left", 700);
    button({ rect: { x: r.x + r.w - 136, y: r.y + 14, w: 116, h: 48 }, label: t.done, kind: "gold" }, () => {
      overlay = null;
    });
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
    const r = sheetRect(860);
    drawPanel(ctx, r, PAPER, 22);
    hit(r, () => {});
    const editable = controls(seat) && canManage(g, seat) && !busy() && !waiting();
    const title = controls(seat) && (online || humansLocal() === 1) ? t.yourDeeds : t.deedsOf(nameOf(seat));
    sheetHeader(r, title, seat, t.cashNow(p.cash));
    const deeds = deedsOf(g, seat).sort((a, b) => BOARD[a].group - BOARD[b].group || a - b);
    const list: Rect = { x: r.x + 18, y: r.y + 76, w: r.w - 36, h: r.h - 76 - 40 };
    const rowH = 58;
    const max = Math.max(0, deeds.length * rowH - list.h);
    scrollers.push({ id: "assets", rect: list, max });
    const off = clamp(scroll.assets ?? 0, 0, max);
    ctx.save();
    ctx.beginPath();
    ctx.rect(list.x - 4, list.y, list.w + 8, list.h);
    ctx.clip();
    if (deeds.length === 0) text(ctx, t.noDeeds, list.x + list.w / 2, list.y + 40, 20, INK_SOFT, "center", 600);
    deeds.forEach((q, i) => {
      const y = list.y + i * rowH - off;
      if (y + rowH < list.y || y > list.y + list.h) return;
      const sq = BOARD[q];
      const h = g.houses[q];
      const status = g.mortgaged[q] ? t.mortgaged : h === 5 ? t.hotel : h > 0 ? t.withHouses(h) : sq.kind === "prop" && ownsGroup(g, seat, sq.group) ? t.rentSet : "";
      const chipW = editable ? list.w - 3 * 138 - 10 : list.w;
      const chip = { x: list.x, y: y + 4, w: chipW, h: rowH - 8 };
      drawDeedChip(ctx, chip, q, sqName(q), { mortgaged: g.mortgaged[q], right: status });
      if (!editable) {
        hitIn(list, chip, () => {
          deedSq = q;
          overlay = "deed";
        });
        return;
      }
      const bx = list.x + chipW + 10;
      const bw = 128;
      const bh = rowH - 10;
      const by = y + 5;
      if (sq.kind === "prop") {
        rowButton({ x: bx, y: by, w: bw, h: bh }, t.addHouse, canBuild(g, seat, q), list, () => send({ type: "build", sq: q }), money(sq.house));
        rowButton({ x: bx + bw + 10, y: by, w: bw, h: bh }, t.sellHouse, canSell(g, seat, q), list, () => send({ type: "sell", sq: q }), `+${money(sq.house / 2)}`);
      }
      const mx = bx + 2 * (bw + 10);
      if (g.mortgaged[q])
        rowButton({ x: mx, y: by, w: bw, h: bh }, t.unmortgage(unmortgageCost(q)).split(" ")[0], canUnmortgage(g, seat, q), list, () => send({ type: "unmortgage", sq: q }), money(unmortgageCost(q)));
      else
        rowButton({ x: mx, y: by, w: bw, h: bh }, t.mortgage(mortgageValue(q)).split(" ")[0], canMortgage(g, seat, q), list, () => send({ type: "mortgage", sq: q }), `+${money(mortgageValue(q))}`);
    });
    ctx.restore();
    const foot = r.y + r.h - 20;
    text(ctx, t.housesLeft(g.housesLeft, g.hotelsLeft), r.x + 24, foot, 16, INK_SOFT, "left", 600);
    if (p.freeCards.length > 0) text(ctx, t.cards(p.freeCards.length), r.x + r.w - 24, foot, 16, INK, "right", 700);
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
    const r = sheetRect(900);
    drawPanel(ctx, r, PAPER, 22);
    hit(r, () => {});
    text(ctx, t.tradeWith, r.x + 24, r.y + 36, 22, INK, "left", 700);
    // Partner tabs
    const others = alive(g).filter((i) => i !== seat);
    const tabX = r.x + 190;
    const tw = Math.min(170, (r.w - 190 - 160 - (others.length - 1) * 8) / Math.max(1, others.length));
    others.forEach((o, i) => {
      const rect = { x: tabX + i * (tw + 8), y: r.y + 14, w: tw, h: 46 };
      roundRect(ctx, rect, 14);
      ctx.fillStyle = draft.to === o ? "#ffe7a3" : "#fffaf0";
      ctx.fill();
      ctx.strokeStyle = draft.to === o ? GOLD_DARK : "#d8c39a";
      ctx.lineWidth = draft.to === o ? 3 : 1.5;
      ctx.stroke();
      drawToken(ctx, TOKENS[o], o, rect.x + 22, rect.y + 25, 28);
      fitText(ctx, nameOf(o), rect.x + 42, rect.y + 23, 18, rect.w - 48, INK, "left", 700);
      hit(rect, () => {
        if (draft.to === o) return;
        draft.to = o;
        draft.get.clear();
        draft.getCash = 0;
        draft.getCards = 0;
        sfx.pick();
      });
    });
    const give: Bundle = { cash: draft.giveCash, sqs: [...draft.give], cards: draft.giveCards };
    const get: Bundle = { cash: draft.getCash, sqs: [...draft.get], cards: draft.getCards };
    const valid = g.phase === "turn" && offerOk(g, seat, draft.to, give, get) && g.offersThisTurn < OFFERS_PER_TURN;
    button({ rect: { x: r.x + r.w - 150, y: r.y + 14, w: 130, h: 46 }, label: t.cancel, size: 18 }, () => {
      overlay = null;
    });
    // Two columns: what you give, what you get
    const half = (r.w - 60) / 2;
    const colTop = r.y + 74;
    const footH = 118;
    const colH = r.h - (colTop - r.y) - footH;
    tradeColumn(g, t.give, seat, draft.give, { x: r.x + 20, y: colTop, w: half, h: colH }, "tradeGive");
    tradeColumn(g, t.get, draft.to, draft.get, { x: r.x + 40 + half, y: colTop, w: half, h: colH }, "tradeGet");
    const cy = colTop + colH + 8;
    cashStepper({ x: r.x + 20, y: cy, w: half }, g.players[seat]?.cash ?? 0, () => draft.giveCash, (v) => (draft.giveCash = v), (g.players[seat]?.freeCards.length ?? 0) > 0, () => draft.giveCards, (v) => (draft.giveCards = v));
    cashStepper({ x: r.x + 40 + half, y: cy, w: half }, g.players[draft.to]?.cash ?? 0, () => draft.getCash, (v) => (draft.getCash = v), (g.players[draft.to]?.freeCards.length ?? 0) > 0, () => draft.getCards, (v) => (draft.getCards = v));
    const by = r.y + r.h - 58;
    text(ctx, t.offersLeft(OFFERS_PER_TURN - g.offersThisTurn), r.x + 24, by + 24, 15, INK_SOFT, "left", 600);
    button({ rect: { x: r.x + r.w - 300, y: by, w: 280, h: 48 }, label: t.send, kind: "primary", disabled: !valid }, () => {
      overlay = null;
      send({ type: "offer", to: draft.to, give, get });
    });
  }

  function tradeColumn(g: Game, title: string, seat: number, picked: Set<number>, r: Rect, id: string) {
    const t = tr();
    text(ctx, title, r.x, r.y + 10, 18, INK, "left", 700);
    const list: Rect = { x: r.x, y: r.y + 24, w: r.w, h: r.h - 24 };
    const deeds = seat >= 0 ? deedsOf(g, seat).sort((a, b) => BOARD[a].group - BOARD[b].group || a - b) : [];
    const rowH = 42;
    const cols = r.w > 360 ? 2 : 1;
    const cw = (list.w - (cols - 1) * 8) / cols;
    const rows = Math.ceil(deeds.length / cols);
    const max = Math.max(0, rows * rowH - list.h);
    scrollers.push({ id, rect: list, max });
    const off = clamp(scroll[id] ?? 0, 0, max);
    ctx.save();
    ctx.beginPath();
    ctx.rect(list.x - 4, list.y, list.w + 8, list.h);
    ctx.clip();
    if (deeds.length === 0) text(ctx, t.noDeeds, list.x + list.w / 2, list.y + 28, 17, INK_SOFT, "center", 600);
    deeds.forEach((q, i) => {
      const y = list.y + Math.floor(i / cols) * rowH - off;
      if (y + rowH < list.y || y > list.y + list.h) return;
      const sq = BOARD[q];
      const built = sq.kind === "prop" && GROUPS[sq.group].some((x) => g.houses[x] > 0);
      const rr = { x: list.x + (i % cols) * (cw + 8), y: y + 3, w: cw, h: rowH - 6 };
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

  function cashStepper(at: { x: number; y: number; w: number }, max: number, get: () => number, set: (v: number) => void, hasCard: boolean, getCard: () => number, setCard: (v: number) => void) {
    const t = tr();
    const v = get();
    const y = at.y;
    text(ctx, t.cash, at.x, y + 22, 17, INK_SOFT, "left", 700);
    button({ rect: { x: at.x + 60, y, w: 46, h: 44 }, label: "−", disabled: v <= 0, size: 24 }, () => set(Math.max(0, v - 50)));
    text(ctx, money(v), at.x + 160, y + 23, 24, JADE, "center", 800, TITLE_FONT);
    button({ rect: { x: at.x + 214, y, w: 46, h: 44 }, label: "+", disabled: v + 10 > max, size: 24 }, () => set(Math.min(max, v + 50)));
    if (hasCard)
      button({ rect: { x: at.x + 272, y, w: Math.min(150, at.w - 272), h: 44 }, label: t.freeCard, on: getCard() > 0, size: 16 }, () => setCard(getCard() > 0 ? 0 : 1));
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
    const prop = sq.kind === "prop";
    const w = prop ? 520 : 380;
    const h = prop ? 330 : 280;
    const r: Rect = { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    drawPanel(ctx, r, "#fffaf0", 20);
    roundRect(ctx, { x: r.x + 14, y: r.y + 14, w: r.w - 28, h: 58 }, 12);
    ctx.fillStyle = GROUP_COLORS[sq.group] ?? "#6b5a4a";
    ctx.fill();
    fitText(ctx, sqName(deedSq), r.x + r.w / 2, r.y + 44, 30, r.w - 50, "#fff", "center", 800, TITLE_FONT);
    const rowsLeft: [string, string, string?][] = [[t.price, money(sq.price)]];
    const rowsRight: [string, string, string?][] = [];
    if (prop) {
      rowsLeft.push([t.rent, money(sq.rent[0])], [t.rentSet, money(sq.rent[0] * 2)], [t.houseCost, money(sq.house)], [t.mortgageValue, money(mortgageValue(deedSq))]);
      for (let k = 1; k <= 4; k++) rowsRight.push([t.withHouses(k), money(sq.rent[k])]);
      rowsRight.push([t.hotel, money(sq.rent[5]), RED]);
    } else rowsLeft.push([t.mortgageValue, money(mortgageValue(deedSq))]);
    const colW = prop ? (r.w - 70) / 2 : r.w - 60;
    const drawRows = (rows: [string, string, string?][], x: number) =>
      rows.forEach(([a, b, c], i) => {
        const y = r.y + 100 + i * 32;
        text(ctx, a, x, y, 18, INK_SOFT, "left", 600);
        text(ctx, b, x + colW, y, 19, c ?? INK, "right", 700);
      });
    drawRows(rowsLeft, r.x + 30);
    if (prop) drawRows(rowsRight, r.x + 40 + colW);
    else
      for (const [i, l] of wrap(ctx, sq.kind === "transport" ? t.transportRent : t.utilityRent, r.w - 60, 17, 600).entries())
        text(ctx, l, r.x + 30, r.y + 172 + i * 24, 17, INK, "left", 600);
    const o = g.owner[deedSq];
    const status = o >= 0 ? `${t.owner(nameOf(o))}${g.mortgaged[deedSq] ? `, ${t.mortgaged}` : g.houses[deedSq] === 5 ? `, ${t.hotel}` : g.houses[deedSq] > 0 ? `, ${t.withHouses(g.houses[deedSq])}` : ""}` : t.noOwner;
    fitText(ctx, status, r.x + r.w / 2, r.y + r.h - 28, 19, r.w - 40, o >= 0 ? colorOf(o) : INK_SOFT, "center", 700);
  }

  function drawLog() {
    const t = tr();
    backdrop(() => {
      overlay = null;
    });
    const r = sheetRect(760);
    drawPanel(ctx, r, PAPER, 22);
    hit(r, () => {});
    sheetHeader(r, t.log, -1);
    const list: Rect = { x: r.x + 24, y: r.y + 74, w: r.w - 48, h: r.h - 90 };
    const rowH = 30;
    const max = Math.max(0, log.length * rowH - list.h);
    scrollers.push({ id: "log", rect: list, max });
    const off = clamp(scroll.log ?? 0, 0, max);
    ctx.save();
    ctx.beginPath();
    ctx.rect(list.x, list.y, list.w, list.h);
    ctx.clip();
    if (log.length === 0) text(ctx, "…", list.x + list.w / 2, list.y + 30, 22, INK_SOFT, "center", 700);
    log.forEach((l, i) => {
      const y = list.y + i * rowH - off + 15;
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
    const w = Math.min(920, v.w - 30);
    const h = Math.min(v.h - 20, 510);
    const r: Rect = { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    drawPanel(ctx, r, PAPER, 24);
    hit(r, () => {});
    // Left: the key art with the title
    const art: Rect = { x: r.x + 12, y: r.y + 12, w: w * 0.42, h: h - 24 };
    ctx.save();
    roundRect(ctx, art, 18);
    ctx.clip();
    ctx.fillStyle = "#7a2a1c";
    ctx.fillRect(art.x, art.y, art.w, art.h);
    if (banner.complete && banner.naturalWidth > 0) {
      // Cover the panel with the right (busy) half of the banner
      const sw = banner.naturalWidth;
      const sh = banner.naturalHeight;
      const k = Math.max(art.w / (sw * 0.6), art.h / sh);
      const cw = art.w / k;
      const chh = art.h / k;
      ctx.drawImage(banner, sw - cw, (sh - chh) / 2, cw, chh, art.x, art.y, art.w, art.h);
    }
    const shade = ctx.createLinearGradient(0, art.y, 0, art.y + art.h * 0.5);
    shade.addColorStop(0, "rgba(60,14,10,0.8)");
    shade.addColorStop(1, "rgba(60,14,10,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(art.x, art.y, art.w, art.h);
    ctx.restore();
    ctx.save();
    ctx.lineJoin = "round";
    const size = fitSize(ctx, t.title, 56, art.w - 30, 800, TITLE_FONT);
    ctx.font = `800 ${size}px ${TITLE_FONT}`;
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#5a140e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(t.title, art.x + art.w / 2, art.y + 52);
    ctx.fillStyle = GOLD;
    ctx.fillText(t.title, art.x + art.w / 2, art.y + 52);
    ctx.restore();
    fitText(ctx, t.subtitle, art.x + art.w / 2, art.y + 96, 17, art.w - 30, "#fff1d2", "center", 700);
    // Right: the choices
    const cx = art.x + art.w + 22;
    const cwid = r.x + r.w - 22 - cx;
    let y = r.y + 30;
    const rowGap = (h - 30 - 140) / 4;
    const row = (label: string, opts: { label: string; on: boolean; disabled?: boolean; fn: () => void }[], hint?: string) => {
      text(ctx, label, cx, y, 18, INK, "left", 700);
      if (hint) fitText(ctx, hint, cx + cwid, y, 15, cwid * 0.45, INK_SOFT, "right", 600);
      const gap = 8;
      const bw = (cwid - gap * (opts.length - 1)) / opts.length;
      for (const [i, o] of opts.entries())
        button({ rect: { x: cx + i * (bw + gap), y: y + 14, w: bw, h: 44 }, label: o.label, on: o.on, disabled: o.disabled, size: 18 }, () => {
          sfx.pick();
          o.fn();
        });
      y += rowGap;
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
    const by = r.y + h - 120;
    const startW = canResume || saved ? cwid * 0.55 : cwid;
    button({ rect: { x: cx, y: by, w: startW, h: 58 }, label: t.start, kind: "primary" }, () => {
      saved = null;
      startGame({ ...menuSetup });
    });
    if (canResume || saved)
      button({ rect: { x: cx + startW + 10, y: by, w: cwid - startW - 10, h: 58 }, label: t.resume, kind: "gold", size: 18 }, () => {
        if (game && game.phase !== "over") overlay = null;
        else if (saved) {
          resume(saved);
          saved = null;
        }
      });
    button({ rect: { x: cx + cwid / 2 - 100, y: r.y + h - 54, w: 200, h: 42 }, label: t.rules, size: 17 }, () => {
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
    const r = sheetRect(880);
    drawPanel(ctx, r, PAPER, 22);
    hit(r, () => {});
    text(ctx, t.rules, r.x + 28, r.y + 38, 26, INK, "left", 700);
    button({ rect: { x: r.x + r.w - 170, y: r.y + 14, w: 150, h: 48 }, label: t.close, kind: "gold" }, () => {
      overlay = rulesFrom;
    });
    const list: Rect = { x: r.x + 28, y: r.y + 72, w: r.w - 56, h: r.h - 88 };
    const lines: { s: string; bullet: boolean }[] = [];
    for (const l of t.rulesLines) for (const [i, s] of wrap(ctx, l, list.w - 28, 18, 600).entries()) lines.push({ s, bullet: i === 0 });
    const lh = 25;
    let total = 0;
    for (const l of lines) total += lh + (l.bullet ? 6 : 0);
    const max = Math.max(0, total - list.h + 10);
    scrollers.push({ id: "rules", rect: list, max });
    const off = clamp(scroll.rules ?? 0, 0, max);
    ctx.save();
    ctx.beginPath();
    ctx.rect(list.x - 6, list.y, list.w + 12, list.h);
    ctx.clip();
    let y = list.y + 8 - off;
    for (const l of lines) {
      if (l.bullet) {
        y += 6;
        ctx.beginPath();
        ctx.arc(list.x + 6, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = RED;
        ctx.fill();
      }
      text(ctx, l.s, list.x + 22, y, 18, INK, "left", 600);
      y += lh;
    }
    ctx.restore();
  }

  function drawResult(g: Game) {
    const t = tr();
    hits = [];
    scrollers = [];
    dim();
    const v = view();
    const order = placings(g);
    const w = Math.min(600, v.w - 40);
    const h = 190 + order.length * 50;
    const r: Rect = { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    drawPanel(ctx, r, PAPER, 22);
    const youWon = online ? g.winner === me : controls(g.winner) && humansLocal() === 1;
    const title = youWon ? t.youWin : t.winOf(nameOf(g.winner));
    fitText(ctx, title, r.x + r.w / 2, r.y + 38, 36, r.w - 40, youWon ? JADE : INK, "center", 800, TITLE_FONT);
    let line = g.endReason === "last" ? t.byLast : t.byTime;
    if (online) {
      const mine = results?.find((x) => x.seat === me);
      if (mine && mine.score > 0) line = `${line}, ${t.scoreLine(mine.score)}`;
    } else if (youWon) line = `${line}, ${t.scoreLine(soloScore(g, g.winner))}`;
    fitText(ctx, line, r.x + r.w / 2, r.y + 74, 18, r.w - 40, GOLD_DARK, "center", 700);
    order.forEach((seat, i) => {
      const y = r.y + 98 + i * 50;
      roundRect(ctx, { x: r.x + 20, y, w: r.w - 40, h: 44 }, 12);
      ctx.fillStyle = i === 0 ? "#ffe7a3" : "#fffaf0";
      ctx.fill();
      text(ctx, String(i + 1), r.x + 42, y + 23, 24, i === 0 ? GOLD_DARK : INK_SOFT, "center", 800, TITLE_FONT);
      drawToken(ctx, TOKENS[seat], seat, r.x + 80, y + 25, 30, 0, g.players[seat].out);
      fitText(ctx, nameOf(seat), r.x + 104, y + 23, 19, r.w - 300, INK, "left", 700);
      const worth = g.players[seat].out ? t.bankrupt : money(netWorth(g, seat));
      text(ctx, worth, r.x + r.w - 36, y + 23, 21, g.players[seat].out ? RED : JADE, "right", 800, TITLE_FONT);
    });
    const by = r.y + r.h - 64;
    if (online) {
      button({ rect: { x: r.x + r.w / 2 - 120, y: by, w: 240, h: 50 }, label: t.backToLobby, kind: "primary" }, () => online.backToLobby());
      return;
    }
    const w2 = (r.w - 64) / 2;
    button({ rect: { x: r.x + 20, y: by, w: w2, h: 50 }, label: t.again, kind: "primary" }, () => startGame(current));
    button({ rect: { x: r.x + 44 + w2, y: by, w: w2, h: 50 }, label: t.menu }, () => {
      game = null;
      overlay = "menu";
    });
  }

  // ---------------------------------------------------------------- render

  function render() {
    stage.begin();
    hits = [];
    scrollers = [];
    const v = view();
    drawTable(ctx, v);
    const g = game;
    const L = ring();
    if (g) {
      drawBoard(g, L);
      drawDashboard(g, L);
      drawTokens(g, L);
      drawCard(L);
      if (online && me < 0) text(ctx, tr().watching, L.inner.x + L.inner.w / 2, L.inner.y + 14, 16, "#fff1d2");
    } else if (online) {
      text(ctx, tr().title, v.x + v.w / 2, v.y + v.h / 2, 44, GOLD, "center", 800, TITLE_FONT);
    }
    if (g && g.phase === "over" && !busy() && !overlay) drawResult(g);
    if (overlay === "menu") drawMenu();
    else if (overlay === "rules") drawRules();
    else if (g && overlay === "assets") drawAssets(g);
    else if (g && overlay === "trade") drawTrade(g);
    else if (g && overlay === "deed") drawDeedCard(g);
    else if (g && overlay === "log") drawLog();
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
