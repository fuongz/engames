import { BOARD, type Difficulty, GROUPS, JAIL_FINE, MIN_BID, SQUARES, TRANSPORT_GROUP, ownable } from "./config";
import {
  type Action,
  type Bundle,
  type Game,
  type Offer,
  alive,
  canBuild,
  canMortgage,
  canSell,
  canUnmortgage,
  liquidValue,
  minBid,
  offerOk,
  rentOf,
  unmortgageCost,
} from "./logic";

// The computer player, pure: given the table and a seat, the next action. It
// only ever proposes actions a person could take; logic.ts checks them all.
//
// Easy  buys on a whim, bids low, builds late and seldom proposes a trade.
// Normal keeps a cash cushion, values colour sets, builds evenly to hotels.
// Hard  pays up to complete or block a set, builds three houses fast, keeps a
//       cushion sized to the worst rent on the board, and trades for sets.

export type Rand = () => number;

/** How much more a deed is worth inside a complete set, by level. */
const SET_MULT: Record<Difficulty, number> = { easy: 1.3, normal: 2, hard: 2.4 };
/** How much a player minds the other side gaining from a trade. */
const WARY: Record<Difficulty, number> = { easy: 0, normal: 0.5, hard: 0.7 };
/** Net value a trade must bring before it is accepted. */
const ACCEPT_AT: Record<Difficulty, number> = { easy: -10, normal: 20, hard: 40 };
/** Chance per turn (after the cool-down) that a computer looks for a trade. */
const OFFER_CHANCE: Record<Difficulty, number> = { easy: 0.08, normal: 0.25, hard: 0.45 };

/** A fixed 0..1 per (seat, square, roll), so a computer's whim doesn't change between calls. */
const whim = (s: Game, seat: number, sq: number) => (((seat + 1) * 7919 + sq * 104729 + s.rolls * 31) % 1000) / 1000;

/** The worst rent an opponent could charge right now (with an average roll). */
function danger(s: Game, seat: number): number {
  let worst = 0;
  for (let q = 0; q < SQUARES; q++) {
    const o = s.owner[q];
    if (o >= 0 && o !== seat) worst = Math.max(worst, rentOf(s, q, 7));
  }
  return worst;
}

/** Cash a computer likes to keep in hand. */
export function reserveOf(s: Game, seat: number, level: Difficulty): number {
  const d = danger(s, seat);
  if (level === "easy") return 120;
  if (level === "normal") return Math.min(450, 100 + d * 0.3);
  return Math.min(650, 60 + d * 0.45);
}

/** What `seat` thinks its deeds are worth under a what-if ownership. */
function holdingValue(s: Game, owner: readonly number[], seat: number, level: Difficulty): number {
  let v = 0;
  for (let q = 0; q < SQUARES; q++) {
    if (owner[q] !== seat) continue;
    const sq = BOARD[q];
    const group = GROUPS[sq.group];
    const n = group.filter((x) => owner[x] === seat).length;
    let base = s.mortgaged[q] ? sq.price - unmortgageCost(q) : sq.price;
    if (sq.kind === "prop") {
      if (n === group.length) base *= SET_MULT[level];
      else if (n === group.length - 1) base *= level === "easy" ? 1 : 1.25;
    } else if (sq.kind === "transport") base *= 1 + 0.3 * (n - 1);
    else if (n === 2) base *= 1.3;
    v += base + s.houses[q] * sq.house;
  }
  return v;
}

/** Net value of `offer` for `seat` (either side of it), as a `level` player sees it. */
export function tradeValue(s: Game, offer: Offer, seat: number, level: Difficulty): number {
  const other = seat === offer.from ? offer.to : offer.from;
  const after = s.owner.slice();
  for (const q of offer.give.sqs) after[q] = offer.to;
  for (const q of offer.get.sqs) after[q] = offer.from;
  const cashIn = seat === offer.to ? offer.give.cash - offer.get.cash : offer.get.cash - offer.give.cash;
  const cardsIn = seat === offer.to ? offer.give.cards - offer.get.cards : offer.get.cards - offer.give.cards;
  const mine = holdingValue(s, after, seat, level) - holdingValue(s, s.owner, seat, level) + cashIn + cardsIn * 40;
  const theirs = holdingValue(s, after, other, level) - holdingValue(s, s.owner, other, level) - cashIn - cardsIn * 40;
  return mine - WARY[level] * Math.max(0, theirs);
}

/** Would `seat` say yes to the offer on the table? */
export function wouldAccept(s: Game, offer: Offer, seat: number, level: Difficulty): boolean {
  const pays = seat === offer.to ? offer.get.cash : offer.give.cash;
  if (pays > 0 && s.players[seat].cash - pays < reserveOf(s, seat, level) * 0.5) return false;
  return tradeValue(s, offer, seat, level) > ACCEPT_AT[level];
}

const completesFor = (s: Game, seat: number, sq: number) => {
  const g = BOARD[sq].group;
  return BOARD[sq].kind === "prop" && GROUPS[g].every((q) => q === sq || s.owner[q] === seat);
};
/** Someone else holds all but this deed of its set. */
const blocksSet = (s: Game, seat: number, sq: number) =>
  alive(s).some((o) => o !== seat && BOARD[sq].kind === "prop" && GROUPS[BOARD[sq].group].every((q) => q === sq || s.owner[q] === o));

function wantsToBuy(s: Game, seat: number, sq: number, level: Difficulty, rand: Rand): boolean {
  const p = s.players[seat];
  const price = BOARD[sq].price;
  if (p.cash < price) return false;
  const left = p.cash - price;
  const keen = completesFor(s, seat, sq) || blocksSet(s, seat, sq);
  if (level === "easy") return left >= 60 && rand() < 0.8;
  if (left >= reserveOf(s, seat, level)) return true;
  if (keen) return left >= (level === "hard" ? 0 : 60);
  return level === "hard" && left >= 80 && BOARD[sq].group === TRANSPORT_GROUP;
}

/** The most `seat` will bid for `sq`. */
export function auctionCeiling(s: Game, seat: number, sq: number, level: Difficulty): number {
  const price = BOARD[sq].price;
  const keen = completesFor(s, seat, sq) ? 2 : blocksSet(s, seat, sq) ? 1 : 0;
  const mult = level === "hard" ? [1.05, 1.35, 1.8][keen] : level === "normal" ? [0.9, 1.15, 1.5][keen] : [0.5, 0.7, 0.9][keen] + whim(s, seat, sq) * 0.4;
  const cash = s.players[seat].cash - (level === "easy" ? 40 : reserveOf(s, seat, level) * 0.5);
  return Math.floor(Math.min(price * mult, cash));
}

function auctionMove(s: Game, seat: number, level: Difficulty): Action {
  const a = s.auction;
  if (!a) return { type: "pass" };
  const step = Math.max(MIN_BID, Math.round((BOARD[a.sq].price * (level === "hard" ? 0.05 : 0.1)) / 10) * 10);
  const low = minBid(a);
  const want = a.leader < 0 ? Math.max(low, Math.round((BOARD[a.sq].price * 0.4) / 10) * 10) : a.bid + step;
  const ceiling = auctionCeiling(s, seat, a.sq, level);
  if (want <= ceiling) return { type: "bid", amount: want };
  if (low <= ceiling) return { type: "bid", amount: low };
  return { type: "pass" };
}

/** Raise money when owing: mortgage loose deeds, then sell buildings, then mortgage the rest. Null = nothing left. */
export function raiseMoney(s: Game, seat: number): Action | null {
  const deeds = s.owner.flatMap((o, q) => (o === seat ? [q] : []));
  const loose = deeds.filter((q) => canMortgage(s, seat, q) && !(BOARD[q].kind === "prop" && GROUPS[BOARD[q].group].every((x) => s.owner[x] === seat)));
  loose.sort((a, b) => BOARD[a].price - BOARD[b].price);
  if (loose[0] !== undefined) return { type: "mortgage", sq: loose[0] };
  const sellable = deeds.filter((q) => canSell(s, seat, q)).sort((a, b) => BOARD[a].house - BOARD[b].house);
  if (sellable[0] !== undefined) return { type: "sell", sq: sellable[0] };
  const rest = deeds.filter((q) => canMortgage(s, seat, q)).sort((a, b) => BOARD[a].price - BOARD[b].price);
  if (rest[0] !== undefined) return { type: "mortgage", sq: rest[0] };
  return null;
}

/** A house worth building now, or -1. */
function buildChoice(s: Game, seat: number, level: Difficulty, rand: Rand): number {
  const cash = s.players[seat].cash;
  const reserve = reserveOf(s, seat, level) * (level === "easy" ? 2.5 : 1);
  let best = -1;
  let bestScore = 0;
  for (let q = 0; q < SQUARES; q++) {
    if (!canBuild(s, seat, q) || cash - BOARD[q].house < reserve) continue;
    const h = s.houses[q];
    if (level === "easy" && (h >= 3 || rand() < 0.4)) continue;
    const rent = BOARD[q].rent;
    // Rent gained per đồng spent; the jump to three houses is the best buy in the genre
    let score = (rent[h + 1] - rent[h]) / BOARD[q].house;
    if (level === "hard" && h < 3) score *= 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = q;
    }
  }
  return best;
}

/** A mortgaged deed worth buying back, or -1. */
function unmortgageChoice(s: Game, seat: number, level: Difficulty): number {
  const cash = s.players[seat].cash;
  const reserve = reserveOf(s, seat, level) * 2 + 100;
  let best = -1;
  for (let q = 0; q < SQUARES; q++) {
    if (!canUnmortgage(s, seat, q) || cash - unmortgageCost(q) < reserve) continue;
    if (best < 0 || BOARD[q].price > BOARD[best].price) best = q;
  }
  return best;
}

const bundle = (cash: number, sqs: number[] = []): Bundle => ({ cash, sqs, cards: 0 });

/** A trade that would complete one of `seat`'s sets on terms the other side should take, or null. */
export function findOffer(s: Game, seat: number, level: Difficulty): Offer | null {
  const me = s.players[seat];
  const reserve = reserveOf(s, seat, level);
  for (let g = 0; g < 8; g++) {
    const group = GROUPS[g];
    const missing = group.filter((q) => s.owner[q] !== seat);
    if (missing.length !== 1 || group.some((q) => s.houses[q] > 0)) continue;
    const want = missing[0];
    const them = s.owner[want];
    if (them < 0 || s.players[them].out) continue;
    const theirLevel = s.players[them].bot ?? "normal";
    // A swap where both sides finish a set is the best kind
    const mine = s.owner.flatMap((o, q) => (o === seat && ownable(q) && q !== want ? [q] : []));
    for (const q of mine) {
      if (!completesFor(s, them, q) || GROUPS[BOARD[q].group].some((x) => s.houses[x] > 0)) continue;
      for (let cash = 0; cash <= 300 && cash <= me.cash - reserve; cash += 20) {
        const offer: Offer = { from: seat, to: them, give: bundle(cash, [q]), get: bundle(0, [want]) };
        if (!offerOk(s, seat, them, offer.give, offer.get)) break;
        if (tradeValue(s, offer, seat, level) <= 0) break;
        if (wouldAccept(s, offer, them, theirLevel)) return offer;
      }
    }
    // Otherwise cash for the deed
    const price = BOARD[want].price;
    for (let cash = price; cash <= price * 3.5 && cash <= me.cash - reserve; cash += 10 * Math.ceil(price / 100)) {
      const offer: Offer = { from: seat, to: them, give: bundle(cash), get: bundle(0, [want]) };
      if (!offerOk(s, seat, them, offer.give, offer.get)) break;
      if (tradeValue(s, offer, seat, level) <= 0) break;
      if (wouldAccept(s, offer, them, theirLevel)) return offer;
    }
  }
  return null;
}

/** Turns between a computer's trade offers. */
const offerCooldown = (s: Game) => 3 * s.players.length;

/**
 * The next action for `seat`, whose decision it is. `timeout` = a person ran
 * out of time: keep it simple and safe (no spending on their behalf beyond what
 * the turn needs).
 */
export function botAction(s: Game, seat: number, level: Difficulty, rand: Rand, timeout = false): Action {
  const p = s.players[seat];
  switch (s.phase) {
    case "turn": {
      if (timeout) return s.mustRoll ? { type: "roll" } : { type: "end" };
      if (p.inJail && s.mustRoll) {
        const free = s.owner.filter((o, q) => o < 0 && ownable(q)).length;
        const early = free > 8;
        if (p.freeCards.length > 0 && (early || level === "easy")) return { type: "useCard" };
        if (early && p.cash >= JAIL_FINE + reserveOf(s, seat, level) && level !== "easy") return { type: "payJail" };
        if (level === "easy" && p.cash > 300 && rand() < 0.5) return { type: "payJail" };
        return { type: "roll" };
      }
      const um = unmortgageChoice(s, seat, level);
      if (um >= 0) return { type: "unmortgage", sq: um };
      const b = buildChoice(s, seat, level, rand);
      if (b >= 0) return { type: "build", sq: b };
      if (s.mustRoll) return { type: "roll" };
      if (s.offersThisTurn === 0 && s.turnNo - p.lastOffer >= offerCooldown(s) && rand() < OFFER_CHANCE[level]) {
        const offer = findOffer(s, seat, level);
        if (offer) return { type: "offer", to: offer.to, give: offer.give, get: offer.get };
      }
      return { type: "end" };
    }
    case "buy":
      return wantsToBuy(s, seat, s.buySq, level, rand) ? { type: "buy" } : { type: "decline" };
    case "auction":
      return timeout ? { type: "pass" } : auctionMove(s, seat, level);
    case "trade":
      return !timeout && s.offer && wouldAccept(s, s.offer, seat, level) ? { type: "accept" } : { type: "reject" };
    case "debt": {
      // Nothing to save when even selling everything can't cover it
      if (liquidValue(s, seat) < (s.debts[0]?.amount ?? 0)) return { type: "bankrupt" };
      return raiseMoney(s, seat) ?? { type: "bankrupt" };
    }
    default:
      return { type: "end" };
  }
}
