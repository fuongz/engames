import { nextRandom } from "@web-games/core/math";
import { DECKS, type Deck } from "./cards";
import {
  BOARD,
  DICE_TIME,
  type Difficulty,
  GROUPS,
  HOP_TIME,
  HOTEL,
  HOTELS,
  HOUSES,
  JAIL,
  JAIL_FINE,
  JAIL_TRIES,
  MAX_DOUBLES,
  MIN_BID,
  MORTGAGE_INTEREST,
  OFFERS_PER_TURN,
  SALARY,
  SQUARES,
  START_CASH,
  TRANSPORT_RENT,
  TURN_CAP,
  UTILITY_MULT,
  ownable,
} from "./config";

// The rules of Cờ Tỷ Phú, pure. One `Game` is the whole table: players, the
// deeds, the bank's buildings, the decks, and whose decision it is now.
//
// Every decision is an `Action` checked by `act(game, seat, action)`; nothing
// else changes money. The flow is a small state machine:
//   turn    → the current player rolls, manages, trades, ends the turn
//   buy     → landed on a free deed: buy it or send it to auction
//   auction → everyone still in bids in turn, or passes
//   debt    → someone owes more than they hold: sell, mortgage, or go bankrupt
//   trade   → an offer waits for its answer
//   over
// Who decides is `decider(game)`. Computer players and timeouts are driven
// from sim.ts with the same actions, so they can't do anything a person can't.

// ---------------------------------------------------------------- types

export interface Player {
  name: string;
  cash: number;
  pos: number;
  /** Computer level, or null for a person. */
  bot: Difficulty | null;
  /** A person who dropped (online): the computer plays their seat until they return. */
  away: boolean;
  inJail: boolean;
  /** Failed doubles attempts this stay. */
  jailTries: number;
  /** Out-of-jail cards held, by the deck each came from. */
  freeCards: Deck[];
  out: boolean;
  /** 1 for the first player out, 2 for the next... (placings). */
  outRank: number;
  /** Turn number of their last trade offer (computer cool-down). */
  lastOffer: number;
  /** Ran out of time on their last decision: the next ones get a short clock. */
  idle: boolean;
}

export interface Bundle {
  cash: number;
  sqs: number[];
  /** Out-of-jail cards. */
  cards: number;
}

export interface Offer {
  from: number;
  to: number;
  /** What `from` hands over. */
  give: Bundle;
  /** What `from` asks for. */
  get: Bundle;
}

export interface Auction {
  sq: number;
  bid: number;
  /** Highest bidder, or -1 before the first bid. */
  leader: number;
  /** Seats still bidding, in turn order. */
  active: number[];
  /** Index into `active` of whoever bids now. */
  turn: number;
}

export type DebtWhy = "rent" | "tax" | "card" | "jail" | "repairs";

export interface Debt {
  from: number;
  /** A seat, or -1 for the bank. */
  to: number;
  amount: number;
  why: DebtWhy;
  sq: number;
}

export type Phase = "turn" | "buy" | "auction" | "debt" | "trade" | "over";
export type EndReason = "last" | "time" | "cap";

export type GameEvent =
  | { type: "turn"; seat: number }
  | { type: "roll"; seat: number; dice: [number, number] }
  | { type: "move"; seat: number; from: number; to: number; steps: number; direct: boolean }
  | { type: "salary"; seat: number; amount: number }
  | { type: "buy"; seat: number; sq: number; price: number }
  | { type: "rent"; from: number; to: number; sq: number; amount: number }
  | { type: "pay"; from: number; to: number; amount: number; why: DebtWhy }
  | { type: "gain"; seat: number; amount: number }
  | { type: "card"; seat: number; deck: Deck; card: number }
  | { type: "jail"; seat: number; why: "square" | "card" | "doubles" }
  | { type: "free"; seat: number; how: "pay" | "card" | "doubles" | "fine" }
  | { type: "stay"; seat: number }
  | { type: "again"; seat: number }
  | { type: "auction"; sq: number }
  | { type: "bid"; seat: number; amount: number }
  | { type: "pass"; seat: number }
  | { type: "won"; seat: number; sq: number; amount: number }
  | { type: "unsold"; sq: number }
  | { type: "build"; seat: number; sq: number; houses: number }
  | { type: "sell"; seat: number; sq: number; houses: number; amount: number }
  | { type: "mortgage"; seat: number; sq: number; amount: number }
  | { type: "unmortgage"; seat: number; sq: number; amount: number }
  | { type: "offer"; from: number; to: number }
  | { type: "answer"; from: number; to: number; accepted: boolean }
  | { type: "debt"; seat: number; amount: number }
  | { type: "bankrupt"; seat: number; to: number }
  | { type: "over"; winner: number; reason: EndReason };

export type Action =
  | { type: "roll" }
  | { type: "end" }
  | { type: "buy" }
  | { type: "decline" }
  | { type: "bid"; amount: number }
  | { type: "pass" }
  | { type: "build"; sq: number }
  | { type: "sell"; sq: number }
  | { type: "mortgage"; sq: number }
  | { type: "unmortgage"; sq: number }
  | { type: "payJail" }
  | { type: "useCard" }
  | { type: "offer"; to: number; give: Bundle; get: Bundle }
  | { type: "accept" }
  | { type: "reject" }
  | { type: "bankrupt" };

export interface Game {
  players: Player[];
  /** Per square: the owner's seat, or -1. */
  owner: number[];
  /** Per square: 0..4 houses, 5 = a hotel. */
  houses: number[];
  mortgaged: boolean[];
  housesLeft: number;
  hotelsLeft: number;
  current: number;
  phase: Phase;
  /** The current player still has a roll to make (start of turn, or after doubles). */
  mustRoll: boolean;
  /** Doubles rolled in a row this turn. */
  doubles: number;
  dice: [number, number];
  /** Rolls so far (the client keys its dice animation on it). */
  rolls: number;
  /** The free deed the current player is deciding on, or -1. */
  buySq: number;
  auction: Auction | null;
  /** Deeds of a player bankrupt to the bank, waiting for their auctions. */
  auctionQueue: number[];
  debts: Debt[];
  offer: Offer | null;
  offersThisTurn: number;
  /** Card indices in draw order (hidden from clients online). */
  decks: Record<Deck, number[]>;
  turnNo: number;
  outCount: number;
  /** Seconds played. */
  elapsed: number;
  /** Time limit in seconds; 0 for none. Checked between turns. */
  limit: number;
  /** Seconds a person has for each decision; 0 offline (no clock). */
  turnSeconds: number;
  /** Seconds left on the current decision. */
  clock: number;
  /** How long the computer has been "thinking" about the current decision. */
  botWait: number;
  /** Seconds of dice and token animation still playing; computers wait for it. */
  hold: number;
  /** RNG state (hidden from clients online). */
  rng: number;
  winner: number;
  endReason: EndReason | null;
  /** Successful actions so far (the client notices changes by it). */
  seq: number;
  events: GameEvent[];
}

export interface SeatSpec {
  name: string;
  bot: Difficulty | null;
}

export interface GameOptions {
  /** Minutes; 0 = no limit. */
  limitMin?: number;
  /** Seconds per decision for people; 0 = no clock. */
  turnSeconds?: number;
  /** Seat that rolls first; random when omitted. */
  first?: number;
}

// ---------------------------------------------------------------- setup

function random(s: Game): number {
  const st = { seed: s.rng };
  const r = nextRandom(st);
  s.rng = st.seed;
  return r;
}

function shuffled(s: Game, n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGame(seed: number, seats: SeatSpec[], opts: GameOptions = {}): Game {
  const s: Game = {
    players: seats.map((p) => ({
      name: p.name,
      cash: START_CASH,
      pos: 0,
      bot: p.bot,
      away: false,
      inJail: false,
      jailTries: 0,
      freeCards: [],
      out: false,
      outRank: 0,
      lastOffer: -99,
      idle: false,
    })),
    owner: new Array(SQUARES).fill(-1),
    houses: new Array(SQUARES).fill(0),
    mortgaged: new Array(SQUARES).fill(false),
    housesLeft: HOUSES,
    hotelsLeft: HOTELS,
    current: 0,
    phase: "turn",
    mustRoll: true,
    doubles: 0,
    dice: [1, 1],
    rolls: 0,
    buySq: -1,
    auction: null,
    auctionQueue: [],
    debts: [],
    offer: null,
    offersThisTurn: 0,
    decks: { chance: [], chest: [] },
    turnNo: 1,
    outCount: 0,
    elapsed: 0,
    limit: Math.max(0, (opts.limitMin ?? 0) * 60),
    turnSeconds: opts.turnSeconds ?? 0,
    clock: opts.turnSeconds ?? 0,
    botWait: 0,
    hold: 0,
    rng: seed >>> 0,
    winner: -1,
    endReason: null,
    seq: 0,
    events: [],
  };
  s.decks.chance = shuffled(s, DECKS.chance.length);
  s.decks.chest = shuffled(s, DECKS.chest.length);
  s.current = opts.first ?? Math.floor(random(s) * seats.length);
  s.events.push({ type: "turn", seat: s.current });
  return s;
}

// ---------------------------------------------------------------- queries

/** The seat whose decision it is, or -1 when the game is over. */
export function decider(s: Game): number {
  switch (s.phase) {
    case "turn":
    case "buy":
      return s.current;
    case "auction":
      return s.auction ? (s.auction.active[s.auction.turn] ?? -1) : -1;
    case "debt":
      return s.debts[0]?.from ?? -1;
    case "trade":
      return s.offer?.to ?? -1;
    default:
      return -1;
  }
}

export const alive = (s: Game) => s.players.flatMap((p, i) => (p.out ? [] : [i]));
export const groupOf = (sq: number) => BOARD[sq]?.group ?? -1;
/** Does `seat` own every deed of the group? */
export const ownsGroup = (s: Game, seat: number, group: number) => group >= 0 && GROUPS[group].every((q) => s.owner[q] === seat);
export const countOwned = (s: Game, seat: number, group: number) => GROUPS[group].filter((q) => s.owner[q] === seat).length;
const groupHasBuildings = (s: Game, group: number) => GROUPS[group].some((q) => s.houses[q] > 0);
export const unmortgageCost = (sq: number) => Math.ceil(((BOARD[sq].price / 2) * Math.round(100 * (1 + MORTGAGE_INTEREST))) / 100);
export const mortgageValue = (sq: number) => BOARD[sq].price / 2;
export const diceTotal = (s: Game) => s.dice[0] + s.dice[1];

/** Rent due for landing on `sq` with `dice` showing; `card` = sent by a "nearest" card. */
export function rentOf(s: Game, sq: number, dice = diceTotal(s), card = false): number {
  const owner = s.owner[sq];
  if (owner < 0 || s.mortgaged[sq]) return 0;
  const square = BOARD[sq];
  if (square.kind === "prop") {
    const h = s.houses[sq];
    if (h > 0) return square.rent[h];
    return square.rent[0] * (ownsGroup(s, owner, square.group) ? 2 : 1);
  }
  const n = countOwned(s, owner, square.group);
  if (square.kind === "transport") return TRANSPORT_RENT[n - 1] * (card ? 2 : 1);
  if (square.kind === "utility") return (card ? 10 : UTILITY_MULT[n - 1]) * dice;
  return 0;
}

/** Cash plus deeds at price (half if mortgaged) plus buildings at cost. */
export function netWorth(s: Game, seat: number): number {
  const p = s.players[seat];
  if (!p || p.out) return 0;
  let v = p.cash;
  for (let q = 0; q < SQUARES; q++) {
    if (s.owner[q] !== seat) continue;
    v += s.mortgaged[q] ? BOARD[q].price / 2 : BOARD[q].price;
    v += s.houses[q] * BOARD[q].house;
  }
  return v;
}

/** Cash a player could raise by selling every building and mortgaging every deed. */
export function liquidValue(s: Game, seat: number): number {
  const p = s.players[seat];
  let v = p.cash;
  for (let q = 0; q < SQUARES; q++) {
    if (s.owner[q] !== seat) continue;
    v += (s.houses[q] * BOARD[q].house) / 2;
    if (!s.mortgaged[q]) v += mortgageValue(q);
  }
  return v;
}

/** Seats from first to last place: survivors by net worth, then the knocked-out, latest first. */
export function placings(s: Game): number[] {
  const seats = s.players.map((_, i) => i);
  const live = seats.filter((i) => !s.players[i].out);
  live.sort((a, b) => netWorth(s, b) - netWorth(s, a) || s.players[b].cash - s.players[a].cash || a - b);
  if (s.winner >= 0 && live.includes(s.winner)) {
    live.splice(live.indexOf(s.winner), 1);
    live.unshift(s.winner);
  }
  const gone = seats.filter((i) => s.players[i].out).sort((a, b) => s.players[b].outRank - s.players[a].outRank);
  return [...live, ...gone];
}

/** Squares a player owns, in board order. */
export const deedsOf = (s: Game, seat: number) => s.owner.flatMap((o, q) => (o === seat ? [q] : []));

// ---------------------------------------------------------------- money

function charge(s: Game, from: number, to: number, amount: number, why: DebtWhy, sq = -1) {
  if (amount <= 0) return;
  s.debts.push({ from, to, amount, why, sq });
}

function settle(s: Game, d: Debt) {
  const p = s.players[d.from];
  p.cash -= d.amount;
  if (d.to >= 0) s.players[d.to].cash += d.amount;
  if (d.why === "rent") s.events.push({ type: "rent", from: d.from, to: d.to, sq: d.sq, amount: d.amount });
  else s.events.push({ type: "pay", from: d.from, to: d.to, amount: d.amount, why: d.why });
}

/**
 * After anything that may have finished a step: pay what can be paid, then run
 * the next auction, the buy decision, or hand the turn back.
 */
function proceed(s: Game) {
  if (s.phase === "over") return;
  while (s.debts.length > 0) {
    const d = s.debts[0];
    const p = s.players[d.from];
    if (p.out || (d.to >= 0 && s.players[d.to].out)) {
      s.debts.shift();
      continue;
    }
    if (p.cash >= d.amount) {
      settle(s, d);
      s.debts.shift();
      continue;
    }
    if (s.phase !== "debt") s.events.push({ type: "debt", seat: d.from, amount: d.amount });
    s.phase = "debt";
    return;
  }
  if (s.auction) {
    s.phase = "auction";
    return;
  }
  const next = s.auctionQueue.shift();
  if (next !== undefined) return startAuction(s, next);
  if (s.players[s.current].out) return nextTurn(s);
  if (s.buySq >= 0) {
    s.phase = "buy";
    return;
  }
  s.phase = "turn";
}

// ---------------------------------------------------------------- moving

function sendToJail(s: Game, seat: number, why: "square" | "card" | "doubles") {
  const p = s.players[seat];
  s.events.push({ type: "move", seat, from: p.pos, to: JAIL, steps: 0, direct: true });
  p.pos = JAIL;
  p.inJail = true;
  p.jailTries = 0;
  s.events.push({ type: "jail", seat, why });
  if (seat === s.current) {
    s.mustRoll = false;
    s.doubles = 0;
  }
  s.hold += 0.5;
}

/** Walk `steps` squares (negative walks back, no salary). */
function walk(s: Game, seat: number, steps: number, card = false) {
  const p = s.players[seat];
  const from = p.pos;
  const to = (((from + steps) % SQUARES) + SQUARES) % SQUARES;
  p.pos = to;
  s.events.push({ type: "move", seat, from, to, steps, direct: false });
  s.hold += Math.abs(steps) * HOP_TIME + 0.25;
  if (steps > 0 && to < from) {
    p.cash += SALARY;
    s.events.push({ type: "salary", seat, amount: SALARY });
  }
  land(s, seat, card);
}

const walkTo = (s: Game, seat: number, to: number, card = false) => walk(s, seat, (to - s.players[seat].pos + SQUARES) % SQUARES || SQUARES, card);

function land(s: Game, seat: number, card: boolean) {
  const p = s.players[seat];
  const sq = p.pos;
  const square = BOARD[sq];
  switch (square.kind) {
    case "prop":
    case "transport":
    case "utility": {
      const owner = s.owner[sq];
      if (owner < 0) s.buySq = sq;
      else if (owner !== seat) charge(s, seat, owner, rentOf(s, sq, diceTotal(s), card), "rent", sq);
      break;
    }
    case "tax":
      charge(s, seat, -1, square.price, "tax", sq);
      break;
    case "chance":
    case "chest":
      draw(s, seat, square.kind);
      break;
    case "gotojail":
      sendToJail(s, seat, "square");
      break;
    default:
      break;
  }
}

function draw(s: Game, seat: number, deck: Deck) {
  const pile = s.decks[deck];
  const card = pile.shift() ?? 0;
  const effect = DECKS[deck][card].effect;
  s.events.push({ type: "card", seat, deck, card });
  s.hold += 1.2;
  const p = s.players[seat];
  if (effect.kind === "free") p.freeCards.push(deck);
  else pile.push(card);
  switch (effect.kind) {
    case "advance":
      return walkTo(s, seat, effect.to);
    case "back":
      return walk(s, seat, -effect.steps);
    case "nearest": {
      let q = p.pos;
      do q = (q + 1) % SQUARES;
      while (BOARD[q].group !== effect.group);
      return walkTo(s, seat, q, true);
    }
    case "jail":
      return sendToJail(s, seat, "card");
    case "cash":
      if (effect.amount > 0) {
        p.cash += effect.amount;
        s.events.push({ type: "gain", seat, amount: effect.amount });
      } else charge(s, seat, -1, -effect.amount, "card");
      return;
    case "each":
      for (const o of alive(s)) {
        if (o === seat) continue;
        if (effect.amount < 0) charge(s, seat, o, -effect.amount, "card");
        else charge(s, o, seat, effect.amount, "card");
      }
      return;
    case "repairs": {
      let due = 0;
      for (let q = 0; q < SQUARES; q++) {
        if (s.owner[q] !== seat) continue;
        due += s.houses[q] === HOTEL ? effect.hotel : s.houses[q] * effect.house;
      }
      charge(s, seat, -1, due, "repairs");
      return;
    }
    default:
      return;
  }
}

/** Roll for the current player. `forced` dice are for tests. */
export function roll(s: Game, forced?: [number, number]) {
  const seat = s.current;
  const p = s.players[seat];
  const d1 = forced?.[0] ?? 1 + Math.floor(random(s) * 6);
  const d2 = forced?.[1] ?? 1 + Math.floor(random(s) * 6);
  s.dice = [d1, d2];
  s.rolls++;
  s.mustRoll = false;
  s.hold = DICE_TIME;
  s.events.push({ type: "roll", seat, dice: [d1, d2] });
  const double = d1 === d2;
  if (p.inJail) {
    if (double) {
      p.inJail = false;
      p.jailTries = 0;
      s.events.push({ type: "free", seat, how: "doubles" });
      walk(s, seat, d1 + d2);
    } else if (++p.jailTries >= JAIL_TRIES) {
      p.inJail = false;
      p.jailTries = 0;
      charge(s, seat, -1, JAIL_FINE, "jail");
      s.events.push({ type: "free", seat, how: "fine" });
      walk(s, seat, d1 + d2);
    } else s.events.push({ type: "stay", seat });
    return proceed(s);
  }
  if (double) {
    s.doubles++;
    if (s.doubles >= MAX_DOUBLES) {
      sendToJail(s, seat, "doubles");
      return proceed(s);
    }
    s.mustRoll = true;
    s.events.push({ type: "again", seat });
  }
  walk(s, seat, d1 + d2);
  proceed(s);
}

// ---------------------------------------------------------------- turns and the end

/** The winner by net worth among those still in (ties: more cash, then lower seat). */
function richest(s: Game): number {
  return placings(s)[0] ?? 0;
}

function finish(s: Game, reason: EndReason, winner = -1) {
  s.phase = "over";
  s.endReason = reason;
  s.winner = winner >= 0 ? winner : richest(s);
  s.auction = null;
  s.offer = null;
  s.debts = [];
  s.buySq = -1;
  s.events.push({ type: "over", winner: s.winner, reason });
}

function nextTurn(s: Game) {
  if (s.phase === "over") return;
  const live = alive(s);
  if (live.length <= 1) return finish(s, "last", live[0] ?? -1);
  if (s.limit > 0 && s.elapsed >= s.limit) return finish(s, "time");
  if (s.turnNo >= TURN_CAP) return finish(s, "cap");
  let next = s.current;
  do next = (next + 1) % s.players.length;
  while (s.players[next].out);
  s.current = next;
  s.turnNo++;
  s.mustRoll = true;
  s.doubles = 0;
  s.offersThisTurn = 0;
  s.buySq = -1;
  s.phase = "turn";
  s.events.push({ type: "turn", seat: next });
}

/** End the game now on net worth (the time limit ran out mid-turn and the clock is strict). */
export const endOnTime = (s: Game) => s.phase !== "over" && finish(s, "time");

// ---------------------------------------------------------------- auctions

function startAuction(s: Game, sq: number) {
  const n = s.players.length;
  const active: number[] = [];
  for (let k = 0; k < n; k++) {
    const seat = (s.current + k) % n;
    if (!s.players[seat].out) active.push(seat);
  }
  s.auction = { sq, bid: 0, leader: -1, active, turn: 0 };
  s.phase = "auction";
  s.events.push({ type: "auction", sq });
}

/** Smallest bid allowed right now. */
export const minBid = (a: Auction) => (a.leader < 0 ? MIN_BID : a.bid + MIN_BID);

function closeAuction(s: Game) {
  const a = s.auction;
  if (!a) return;
  s.auction = null;
  if (a.leader >= 0) {
    s.players[a.leader].cash -= a.bid;
    s.owner[a.sq] = a.leader;
    s.events.push({ type: "won", seat: a.leader, sq: a.sq, amount: a.bid });
  } else s.events.push({ type: "unsold", sq: a.sq });
  proceed(s);
}

function auctionMaybeDone(s: Game) {
  const a = s.auction;
  if (!a) return;
  if (a.active.length === 0 || (a.active.length === 1 && a.leader === a.active[0])) return closeAuction(s);
  a.turn %= a.active.length;
  // The leader never bids against themselves: skip to the next bidder
  if (a.active[a.turn] === a.leader) a.turn = (a.turn + 1) % a.active.length;
}

// ---------------------------------------------------------------- bankruptcy

function goBankrupt(s: Game, seat: number) {
  const d = s.debts[0];
  const to = d && d.from === seat ? d.to : -1;
  const p = s.players[seat];
  // Buildings go back to the bank at half price
  for (let q = 0; q < SQUARES; q++) {
    if (s.owner[q] !== seat || s.houses[q] === 0) continue;
    p.cash += (s.houses[q] * BOARD[q].house) / 2;
    if (s.houses[q] === HOTEL) s.hotelsLeft++;
    else s.housesLeft += s.houses[q];
    s.houses[q] = 0;
  }
  const deeds = deedsOf(s, seat);
  if (to >= 0) {
    const heir = s.players[to];
    heir.cash += Math.max(0, p.cash);
    for (const q of deeds) s.owner[q] = to;
    heir.freeCards.push(...p.freeCards);
  } else {
    for (const q of deeds) {
      s.owner[q] = -1;
      s.mortgaged[q] = false;
    }
    s.auctionQueue.push(...deeds);
    for (const deck of p.freeCards) s.decks[deck].push(DECKS[deck].findIndex((c) => c.effect.kind === "free"));
  }
  p.freeCards = [];
  p.cash = 0;
  p.out = true;
  p.inJail = false;
  p.outRank = ++s.outCount;
  s.debts = s.debts.filter((x) => x.from !== seat && x.to !== seat);
  if (s.offer && (s.offer.from === seat || s.offer.to === seat)) s.offer = null;
  if (seat === s.current) {
    s.buySq = -1;
    s.mustRoll = false;
  }
  s.events.push({ type: "bankrupt", seat, to });
  const live = alive(s);
  if (live.length <= 1) return finish(s, "last", live[0] ?? -1);
  s.phase = "turn";
  proceed(s);
}

// ---------------------------------------------------------------- property management

/** May `seat` build, sell, mortgage right now (on their turn, or when they owe)? */
export function canManage(s: Game, seat: number): boolean {
  if ((s.phase === "turn" || s.phase === "buy") && seat === s.current) return true;
  return s.phase === "debt" && s.debts[0]?.from === seat;
}

export function canBuild(s: Game, seat: number, sq: number): boolean {
  const square = BOARD[sq];
  if (square?.kind !== "prop" || s.owner[sq] !== seat || s.phase === "debt" || !canManage(s, seat)) return false;
  const group = GROUPS[square.group];
  if (!ownsGroup(s, seat, square.group) || group.some((q) => s.mortgaged[q])) return false;
  const h = s.houses[sq];
  if (h >= HOTEL || h !== Math.min(...group.map((q) => s.houses[q]))) return false;
  if (s.players[seat].cash < square.house) return false;
  return h === 4 ? s.hotelsLeft > 0 : s.housesLeft > 0;
}

export function canSell(s: Game, seat: number, sq: number): boolean {
  const square = BOARD[sq];
  if (square?.kind !== "prop" || s.owner[sq] !== seat || !canManage(s, seat)) return false;
  const h = s.houses[sq];
  return h > 0 && h === Math.max(...GROUPS[square.group].map((q) => s.houses[q]));
}

export function canMortgage(s: Game, seat: number, sq: number): boolean {
  if (!ownable(sq) || s.owner[sq] !== seat || s.mortgaged[sq] || !canManage(s, seat)) return false;
  return BOARD[sq].kind !== "prop" || !groupHasBuildings(s, BOARD[sq].group);
}

export function canUnmortgage(s: Game, seat: number, sq: number): boolean {
  if (!ownable(sq) || s.owner[sq] !== seat || !s.mortgaged[sq] || !canManage(s, seat) || s.phase === "debt") return false;
  return s.players[seat].cash >= unmortgageCost(sq);
}

function build(s: Game, seat: number, sq: number) {
  const square = BOARD[sq];
  s.players[seat].cash -= square.house;
  if (s.houses[sq] === 4) {
    s.hotelsLeft--;
    s.housesLeft += 4;
  } else s.housesLeft--;
  s.houses[sq]++;
  s.events.push({ type: "build", seat, sq, houses: s.houses[sq] });
}

function sell(s: Game, seat: number, sq: number) {
  const square = BOARD[sq];
  let sold = 1;
  if (s.houses[sq] === HOTEL) {
    s.hotelsLeft++;
    // Back to four houses if the bank has them; otherwise to as many as it has
    const keep = Math.min(4, s.housesLeft);
    s.housesLeft -= keep;
    sold = HOTEL - keep;
    s.houses[sq] = keep;
  } else {
    s.houses[sq]--;
    s.housesLeft++;
  }
  const amount = (sold * square.house) / 2;
  s.players[seat].cash += amount;
  s.events.push({ type: "sell", seat, sq, houses: s.houses[sq], amount });
}

// ---------------------------------------------------------------- trades

const emptyBundle = (b: Bundle) => b.cash === 0 && b.sqs.length === 0 && b.cards === 0;

function bundleOk(s: Game, seat: number, b: Bundle): boolean {
  const p = s.players[seat];
  if (!Number.isInteger(b.cash) || b.cash < 0 || b.cash > p.cash) return false;
  if (!Number.isInteger(b.cards) || b.cards < 0 || b.cards > p.freeCards.length) return false;
  if (new Set(b.sqs).size !== b.sqs.length) return false;
  return b.sqs.every((q) => ownable(q) && s.owner[q] === seat && (BOARD[q].kind !== "prop" || !groupHasBuildings(s, BOARD[q].group)));
}

/** Is this offer from `from` to `to` one the rules allow right now? */
export function offerOk(s: Game, from: number, to: number, give: Bundle, get: Bundle): boolean {
  if (to === from || !s.players[to] || s.players[to].out || s.players[from].out) return false;
  if (emptyBundle(give) && emptyBundle(get)) return false;
  return bundleOk(s, from, give) && bundleOk(s, to, get);
}

function transfer(s: Game, from: number, to: number, b: Bundle) {
  s.players[from].cash -= b.cash;
  s.players[to].cash += b.cash;
  for (const q of b.sqs) s.owner[q] = to;
  for (let i = 0; i < b.cards; i++) {
    const c = s.players[from].freeCards.pop();
    if (c) s.players[to].freeCards.push(c);
  }
}

// ---------------------------------------------------------------- the one door

const isSq = (q: unknown): q is number => Number.isInteger(q) && (q as number) >= 0 && (q as number) < SQUARES;

/** Apply `a` for `seat` if the rules allow it now. False (and no change) otherwise. */
export function act(s: Game, seat: number, a: Action): boolean {
  const ok = apply(s, seat, a);
  if (ok) {
    s.seq++;
    s.clock = s.turnSeconds;
    s.botWait = 0;
  }
  return ok;
}

function apply(s: Game, seat: number, a: Action): boolean {
  if (s.phase === "over" || !s.players[seat] || s.players[seat].out) return false;
  const p = s.players[seat];
  const mine = seat === s.current;
  switch (a.type) {
    case "roll":
      if (s.phase !== "turn" || !mine || !s.mustRoll) return false;
      roll(s);
      return true;
    case "end":
      if (s.phase !== "turn" || !mine || s.mustRoll) return false;
      nextTurn(s);
      return true;
    case "buy": {
      if (s.phase !== "buy" || !mine || s.buySq < 0) return false;
      const price = BOARD[s.buySq].price;
      if (p.cash < price) return false;
      p.cash -= price;
      s.owner[s.buySq] = seat;
      s.events.push({ type: "buy", seat, sq: s.buySq, price });
      s.buySq = -1;
      proceed(s);
      return true;
    }
    case "decline": {
      if (s.phase !== "buy" || !mine || s.buySq < 0) return false;
      const sq = s.buySq;
      s.buySq = -1;
      startAuction(s, sq);
      return true;
    }
    case "bid": {
      const au = s.auction;
      if (s.phase !== "auction" || !au || au.active[au.turn] !== seat) return false;
      if (!Number.isInteger(a.amount) || a.amount < minBid(au) || a.amount > p.cash) return false;
      au.bid = a.amount;
      au.leader = seat;
      au.turn = (au.turn + 1) % au.active.length;
      s.events.push({ type: "bid", seat, amount: a.amount });
      auctionMaybeDone(s);
      return true;
    }
    case "pass": {
      const au = s.auction;
      if (s.phase !== "auction" || !au || au.active[au.turn] !== seat) return false;
      au.active.splice(au.turn, 1);
      s.events.push({ type: "pass", seat });
      auctionMaybeDone(s);
      return true;
    }
    case "build":
      if (!isSq(a.sq) || !canBuild(s, seat, a.sq)) return false;
      build(s, seat, a.sq);
      return true;
    case "sell":
      if (!isSq(a.sq) || !canSell(s, seat, a.sq)) return false;
      sell(s, seat, a.sq);
      if (s.phase === "debt") proceed(s);
      return true;
    case "mortgage":
      if (!isSq(a.sq) || !canMortgage(s, seat, a.sq)) return false;
      s.mortgaged[a.sq] = true;
      p.cash += mortgageValue(a.sq);
      s.events.push({ type: "mortgage", seat, sq: a.sq, amount: mortgageValue(a.sq) });
      if (s.phase === "debt") proceed(s);
      return true;
    case "unmortgage": {
      if (!isSq(a.sq) || !canUnmortgage(s, seat, a.sq)) return false;
      const cost = unmortgageCost(a.sq);
      s.mortgaged[a.sq] = false;
      p.cash -= cost;
      s.events.push({ type: "unmortgage", seat, sq: a.sq, amount: cost });
      return true;
    }
    case "payJail":
      if (s.phase !== "turn" || !mine || !s.mustRoll || !p.inJail || p.cash < JAIL_FINE) return false;
      p.cash -= JAIL_FINE;
      p.inJail = false;
      p.jailTries = 0;
      s.events.push({ type: "free", seat, how: "pay" });
      return true;
    case "useCard": {
      if (s.phase !== "turn" || !mine || !s.mustRoll || !p.inJail || p.freeCards.length === 0) return false;
      const deck = p.freeCards.pop() as Deck;
      s.decks[deck].push(DECKS[deck].findIndex((c) => c.effect.kind === "free"));
      p.inJail = false;
      p.jailTries = 0;
      s.events.push({ type: "free", seat, how: "card" });
      return true;
    }
    case "offer":
      if (s.phase !== "turn" || !mine || s.offersThisTurn >= OFFERS_PER_TURN) return false;
      if (!offerOk(s, seat, a.to, a.give, a.get)) return false;
      s.offer = { from: seat, to: a.to, give: a.give, get: a.get };
      s.offersThisTurn++;
      p.lastOffer = s.turnNo;
      s.phase = "trade";
      s.events.push({ type: "offer", from: seat, to: a.to });
      return true;
    case "accept":
    case "reject": {
      const o = s.offer;
      if (s.phase !== "trade" || !o || o.to !== seat) return false;
      const accepted = a.type === "accept" && offerOk(s, o.from, o.to, o.give, o.get);
      if (accepted) {
        transfer(s, o.from, o.to, o.give);
        transfer(s, o.to, o.from, o.get);
      }
      s.offer = null;
      s.events.push({ type: "answer", from: o.from, to: o.to, accepted });
      s.phase = "turn";
      proceed(s);
      return true;
    }
    case "bankrupt":
      if (s.phase !== "debt" || s.debts[0]?.from !== seat) return false;
      goBankrupt(s, seat);
      return true;
    default:
      return false;
  }
}
