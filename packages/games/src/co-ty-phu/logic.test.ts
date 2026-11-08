import { describe, expect, it } from "vitest";
import { botAction, findOffer, wouldAccept } from "./ai";
import { CHANCE, CHEST } from "./cards";
import { BOARD, type Difficulty, GROUPS, HOTELS, HOUSES, JAIL, JAIL_FINE, ROOM_SETTINGS, SALARY, START_CASH, TURN_SECONDS } from "./config";
import {
  type Game,
  type SeatSpec,
  act,
  canBuild,
  createGame,
  decider,
  netWorth,
  placings,
  rentOf,
  roll,
  unmortgageCost,
} from "./logic";
import { coTyPhuOnline, parseAction, parseActions, settingsOf, snapshotOf } from "./online";
import { gameRand, setAway, stepGame } from "./sim";

const seats = (n: number, bot: Difficulty | null = null): SeatSpec[] => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, bot }));
/** A table with seat 0 to move and fixed decks (no randomness in what we check). */
const table = (n = 2): Game => createGame(1, seats(n), { first: 0 });
const own = (s: Game, seat: number, ...sqs: number[]) => {
  for (const q of sqs) s.owner[q] = seat;
};
/** Put the next card of a deck on top. */
const stack = (s: Game, deck: "chance" | "chest", card: number) => {
  s.decks[deck] = [card, ...s.decks[deck].filter((c) => c !== card)];
};
const cardOf = (deck: typeof CHANCE, kind: string, extra: (e: Record<string, unknown>) => boolean = () => true) =>
  deck.findIndex((c) => c.effect.kind === kind && extra(c.effect as unknown as Record<string, unknown>));

describe("the board", () => {
  it("has 40 squares, 8 colour groups cheap to dear, 4 transports and 2 utilities", () => {
    expect(BOARD).toHaveLength(40);
    for (let g = 0; g < 8; g++) expect(GROUPS[g].length).toBe(g === 0 || g === 7 ? 2 : 3);
    expect(GROUPS[8]).toEqual([5, 15, 25, 35]);
    expect(GROUPS[9]).toEqual([12, 28]);
    for (let g = 1; g < 8; g++) expect(BOARD[GROUPS[g][0]].price).toBeGreaterThan(BOARD[GROUPS[g - 1][0]].price);
    for (const sq of BOARD) if (sq.kind === "prop") expect(sq.rent).toHaveLength(6);
    expect(CHANCE.length).toBeGreaterThanOrEqual(14);
    expect(CHEST.length).toBeGreaterThanOrEqual(14);
  });
});

describe("rent", () => {
  it("charges the base rent, double for a full set, then by houses", () => {
    const s = table();
    own(s, 1, 37);
    expect(rentOf(s, 37)).toBe(36);
    own(s, 1, 39);
    expect(rentOf(s, 37)).toBe(72);
    s.houses[37] = 3;
    expect(rentOf(s, 37)).toBe(BOARD[37].rent[3]);
    s.houses[37] = 5;
    expect(rentOf(s, 37)).toBe(BOARD[37].rent[5]);
  });

  it("charges nothing on a mortgaged deed", () => {
    const s = table();
    own(s, 1, 39);
    s.mortgaged[39] = true;
    expect(rentOf(s, 39)).toBe(0);
  });

  it("charges transport rent by how many the owner has, and utilities by the dice", () => {
    const s = table();
    own(s, 1, 5);
    expect(rentOf(s, 5)).toBe(25);
    own(s, 1, 15, 25);
    expect(rentOf(s, 5)).toBe(100);
    own(s, 1, 35);
    expect(rentOf(s, 35)).toBe(200);
    own(s, 1, 12);
    expect(rentOf(s, 12, 8)).toBe(32);
    own(s, 1, 28);
    expect(rentOf(s, 12, 8)).toBe(80);
  });

  it("is paid when you land, and Start pays a salary on the way", () => {
    const s = table();
    own(s, 1, 6);
    s.players[0].pos = 38;
    roll(s, [3, 5]); // 38 → 6, passing Start
    expect(s.players[0].pos).toBe(6);
    expect(s.players[0].cash).toBe(START_CASH + SALARY - 7);
    expect(s.players[1].cash).toBe(START_CASH + 7);
    expect(s.phase).toBe("turn");
    expect(s.mustRoll).toBe(false);
  });
});

describe("buying and auctions", () => {
  it("offers a free deed, and buying it takes the price", () => {
    const s = table();
    roll(s, [1, 2]); // → 3 Cao Bằng
    expect(s.phase).toBe("buy");
    expect(act(s, 1, { type: "buy" })).toBe(false);
    expect(act(s, 0, { type: "buy" })).toBe(true);
    expect(s.owner[3]).toBe(0);
    expect(s.players[0].cash).toBe(START_CASH - BOARD[3].price);
    expect(s.phase).toBe("turn");
  });

  it("sends a declined deed to auction where everyone bids in turn", () => {
    const s = table(3);
    roll(s, [1, 2]);
    expect(act(s, 0, { type: "decline" })).toBe(true);
    expect(s.phase).toBe("auction");
    expect(decider(s)).toBe(0);
    expect(act(s, 0, { type: "bid", amount: 5 })).toBe(false); // under the minimum
    expect(act(s, 0, { type: "bid", amount: 20 })).toBe(true);
    expect(decider(s)).toBe(1);
    expect(act(s, 1, { type: "bid", amount: 20 })).toBe(false); // must beat the leader
    expect(act(s, 1, { type: "bid", amount: 40 })).toBe(true);
    expect(act(s, 2, { type: "pass" })).toBe(true);
    expect(act(s, 0, { type: "pass" })).toBe(true);
    expect(s.owner[3]).toBe(1);
    expect(s.players[1].cash).toBe(START_CASH - 40);
    expect(s.phase).toBe("turn");
    expect(decider(s)).toBe(0);
  });

  it("leaves the deed with the bank when nobody bids", () => {
    const s = table(2);
    roll(s, [1, 2]);
    act(s, 0, { type: "decline" });
    act(s, 0, { type: "pass" });
    act(s, 1, { type: "pass" });
    expect(s.owner[3]).toBe(-1);
    expect(s.phase).toBe("turn");
  });

  it("refuses a bid over your cash", () => {
    const s = table(2);
    roll(s, [1, 2]);
    act(s, 0, { type: "decline" });
    s.players[0].cash = 30;
    expect(act(s, 0, { type: "bid", amount: 40 })).toBe(false);
  });
});

describe("building", () => {
  const withSet = () => {
    const s = table();
    own(s, 0, ...GROUPS[1]);
    return s;
  };

  it("needs the whole set, unmortgaged", () => {
    const s = table();
    own(s, 0, 6, 8);
    expect(canBuild(s, 0, 6)).toBe(false);
    own(s, 0, 9);
    expect(canBuild(s, 0, 6)).toBe(true);
    s.mortgaged[9] = true;
    expect(canBuild(s, 0, 6)).toBe(false);
  });

  it("builds evenly across the set, then a hotel", () => {
    const s = withSet();
    expect(act(s, 0, { type: "build", sq: 6 })).toBe(true);
    expect(act(s, 0, { type: "build", sq: 6 })).toBe(false); // the others first
    expect(act(s, 0, { type: "build", sq: 8 })).toBe(true);
    expect(act(s, 0, { type: "build", sq: 9 })).toBe(true);
    expect(s.housesLeft).toBe(HOUSES - 3);
    for (let i = 0; i < 3; i++) for (const q of GROUPS[1]) act(s, 0, { type: "build", sq: q });
    expect(GROUPS[1].map((q) => s.houses[q])).toEqual([4, 4, 4]);
    expect(act(s, 0, { type: "build", sq: 6 })).toBe(true);
    expect(s.houses[6]).toBe(5);
    expect(s.hotelsLeft).toBe(HOTELS - 1);
    expect(s.housesLeft).toBe(HOUSES - 12 + 4);
    expect(s.players[0].cash).toBe(START_CASH - 13 * BOARD[6].house);
  });

  it("is limited by the bank's houses", () => {
    const s = withSet();
    s.housesLeft = 1;
    expect(act(s, 0, { type: "build", sq: 6 })).toBe(true);
    expect(act(s, 0, { type: "build", sq: 8 })).toBe(false);
  });

  it("sells back evenly at half price", () => {
    const s = withSet();
    for (const q of GROUPS[1]) act(s, 0, { type: "build", sq: q });
    act(s, 0, { type: "build", sq: 6 });
    const cash = s.players[0].cash;
    expect(act(s, 0, { type: "sell", sq: 8 })).toBe(false); // 6 has more
    expect(act(s, 0, { type: "sell", sq: 6 })).toBe(true);
    expect(s.players[0].cash).toBe(cash + BOARD[6].house / 2);
    expect(s.houses[6]).toBe(1);
  });

  it("selling a hotel needs four houses back from the bank", () => {
    const s = withSet();
    for (const q of GROUPS[1]) s.houses[q] = 5;
    s.housesLeft = 2;
    const cash = s.players[0].cash;
    expect(act(s, 0, { type: "sell", sq: 6 })).toBe(true);
    expect(s.houses[6]).toBe(2);
    expect(s.housesLeft).toBe(0);
    expect(s.players[0].cash).toBe(cash + (3 * BOARD[6].house) / 2);
  });

  it("only on your turn", () => {
    const s = withSet();
    s.current = 1;
    expect(act(s, 0, { type: "build", sq: 6 })).toBe(false);
  });
});

describe("mortgages", () => {
  it("pays half the price, and costs 10% more to redeem", () => {
    const s = table();
    own(s, 0, 39);
    expect(act(s, 0, { type: "mortgage", sq: 39 })).toBe(true);
    expect(s.players[0].cash).toBe(START_CASH + 200);
    expect(act(s, 0, { type: "mortgage", sq: 39 })).toBe(false);
    expect(unmortgageCost(39)).toBe(220);
    expect(act(s, 0, { type: "unmortgage", sq: 39 })).toBe(true);
    expect(s.players[0].cash).toBe(START_CASH - 20);
  });

  it("can't mortgage a deed whose set has buildings", () => {
    const s = table();
    own(s, 0, ...GROUPS[0]);
    s.houses[1] = 1;
    expect(act(s, 0, { type: "mortgage", sq: 3 })).toBe(false);
  });
});

describe("jail", () => {
  it("the Go-to-jail square sends you there without salary", () => {
    const s = table();
    s.players[0].pos = 25;
    roll(s, [2, 3]);
    expect(s.players[0].pos).toBe(JAIL);
    expect(s.players[0].inJail).toBe(true);
    expect(s.players[0].cash).toBe(START_CASH);
    expect(s.mustRoll).toBe(false);
  });

  it("three doubles in a row is jail", () => {
    const s = table();
    roll(s, [5, 5]); // → 10, just visiting
    expect(s.mustRoll).toBe(true);
    roll(s, [5, 5]); // → 20, the tea stall
    roll(s, [3, 3]);
    expect(s.players[0].inJail).toBe(true);
    expect(s.players[0].pos).toBe(JAIL);
  });

  it("a doubles roll gets you out and moves you, without a second roll", () => {
    const s = table();
    Object.assign(s.players[0], { pos: JAIL, inJail: true });
    roll(s, [3, 3]);
    expect(s.players[0].inJail).toBe(false);
    expect(s.players[0].pos).toBe(16);
    expect(s.mustRoll).toBe(false);
  });

  it("a missed roll keeps you in; the third forces the fine and you move", () => {
    const s = table();
    Object.assign(s.players[0], { pos: JAIL, inJail: true });
    roll(s, [1, 2]);
    expect(s.players[0].inJail).toBe(true);
    expect(s.players[0].jailTries).toBe(1);
    s.players[0].jailTries = 2;
    s.mustRoll = true;
    roll(s, [1, 3]);
    expect(s.players[0].inJail).toBe(false);
    expect(s.players[0].pos).toBe(14);
    expect(s.players[0].cash).toBe(START_CASH - JAIL_FINE);
  });

  it("you can pay the fine or use a card before rolling", () => {
    const s = table();
    Object.assign(s.players[0], { pos: JAIL, inJail: true });
    expect(act(s, 0, { type: "useCard" })).toBe(false);
    expect(act(s, 0, { type: "payJail" })).toBe(true);
    expect(s.players[0].cash).toBe(START_CASH - JAIL_FINE);
    expect(s.players[0].inJail).toBe(false);
    expect(s.mustRoll).toBe(true);
    const t = table();
    Object.assign(t.players[0], { pos: JAIL, inJail: true, freeCards: ["chance"] });
    const before = t.decks.chance.length;
    expect(act(t, 0, { type: "useCard" })).toBe(true);
    expect(t.players[0].freeCards).toEqual([]);
    expect(t.decks.chance.length).toBe(before + 1);
  });
});

describe("cards", () => {
  it("advance cards move you and pay the salary when you pass Start", () => {
    const s = table();
    s.players[0].pos = 3;
    stack(s, "chance", cardOf(CHANCE, "advance", (e) => e.to === 6));
    roll(s, [2, 2]); // → 7 Cơ hội → Sa Pa (6), passing Start
    expect(s.players[0].pos).toBe(6);
    expect(s.players[0].cash).toBe(START_CASH + SALARY);
    expect(s.phase).toBe("buy");
  });

  it("go back three squares", () => {
    const s = table();
    s.players[0].pos = 3;
    stack(s, "chance", cardOf(CHANCE, "back"));
    roll(s, [1, 3]); // → 7 → 4 (income tax)
    expect(s.players[0].pos).toBe(4);
    expect(s.players[0].cash).toBe(START_CASH - BOARD[4].price);
  });

  it("nearest transport pays double rent", () => {
    const s = table();
    own(s, 1, 15);
    s.players[0].pos = 3;
    stack(s, "chance", cardOf(CHANCE, "nearest", (e) => e.group === 8));
    roll(s, [1, 3]); // 7 → 15
    expect(s.players[0].pos).toBe(15);
    expect(s.players[1].cash).toBe(START_CASH + 50);
  });

  it("nearest utility pays ten times the dice", () => {
    const s = table();
    own(s, 1, 12);
    s.players[0].pos = 3;
    stack(s, "chance", cardOf(CHANCE, "nearest", (e) => e.group === 9));
    roll(s, [1, 3]);
    expect(s.players[0].pos).toBe(12);
    expect(s.players[1].cash).toBe(START_CASH + 40);
  });

  it("jail, keep-out-of-jail, money, pay each, collect from each, repairs", () => {
    const go = (deck: "chance" | "chest", card: number, setup: (s: Game) => void = () => {}) => {
      const s = table(3);
      setup(s);
      s.players[0].pos = deck === "chance" ? 3 : 0;
      stack(s, deck, card);
      roll(s, deck === "chance" ? [1, 3] : [1, 1]);
      return s;
    };
    expect(go("chance", cardOf(CHANCE, "jail")).players[0].inJail).toBe(true);
    const free = go("chest", cardOf(CHEST, "free"));
    expect(free.players[0].freeCards).toEqual(["chest"]);
    expect(free.decks.chest).not.toContain(cardOf(CHEST, "free"));
    expect(go("chest", cardOf(CHEST, "cash", (e) => e.amount === 200)).players[0].cash).toBe(START_CASH + 200);
    const each = go("chance", cardOf(CHANCE, "each"));
    expect(each.players.map((p) => p.cash)).toEqual([START_CASH - 100, START_CASH + 50, START_CASH + 50]);
    const bday = go("chest", cardOf(CHEST, "each"));
    expect(bday.players.map((p) => p.cash)).toEqual([START_CASH + 20, START_CASH - 10, START_CASH - 10]);
    const repairs = go("chance", cardOf(CHANCE, "repairs"), (s) => {
      own(s, 0, ...GROUPS[0]);
      s.houses[1] = 2;
      s.houses[3] = 5;
    });
    expect(repairs.players[0].cash).toBe(START_CASH - 2 * 25 - 100);
  });
});

describe("debts and bankruptcy", () => {
  it("someone who can't pay must raise money before play goes on", () => {
    const s = table();
    own(s, 1, 39);
    s.houses[39] = 5;
    own(s, 0, 1);
    s.players[0].cash = 100;
    s.players[0].pos = 35;
    roll(s, [1, 3]);
    expect(s.phase).toBe("debt");
    expect(decider(s)).toBe(0);
    expect(act(s, 0, { type: "end" })).toBe(false);
    expect(act(s, 0, { type: "mortgage", sq: 1 })).toBe(true);
    expect(s.phase).toBe("debt");
    expect(act(s, 0, { type: "bankrupt" })).toBe(true);
    // Everything goes to the creditor, and with one player left the game ends
    expect(s.owner[1]).toBe(1);
    expect(s.mortgaged[1]).toBe(true);
    expect(s.players[1].cash).toBe(START_CASH + 130);
    expect(s.phase).toBe("over");
    expect(s.winner).toBe(1);
  });

  it("raising enough pays the debt and the turn continues", () => {
    const s = table();
    own(s, 1, 39);
    s.players[0].cash = 20;
    own(s, 0, 37);
    s.players[0].pos = 35;
    roll(s, [1, 3]); // → 39 Hà Nội, rent 52
    expect(s.phase).toBe("debt");
    act(s, 0, { type: "mortgage", sq: 37 });
    expect(s.phase).toBe("turn");
    expect(s.players[0].cash).toBe(20 + 175 - 52);
  });

  it("bankrupt to the bank: buildings back to the bank, deeds auctioned", () => {
    const s = table(3);
    own(s, 0, ...GROUPS[0]);
    s.houses[1] = 1;
    s.houses[3] = 1;
    s.housesLeft -= 2;
    s.players[0].cash = 10;
    s.players[0].pos = 2;
    roll(s, [1, 1]); // → 4 income tax 200
    expect(s.phase).toBe("debt");
    act(s, 0, { type: "bankrupt" });
    expect(s.players[0].out).toBe(true);
    expect(s.housesLeft).toBe(HOUSES);
    expect(s.phase).toBe("auction");
    expect(s.auction?.sq).toBe(1);
    expect(s.auction?.active).toEqual([1, 2]);
    act(s, 1, { type: "bid", amount: 30 });
    act(s, 2, { type: "pass" });
    expect(s.owner[1]).toBe(1);
    expect(s.auction?.sq).toBe(3);
    act(s, 1, { type: "pass" });
    act(s, 2, { type: "pass" });
    expect(s.owner[3]).toBe(-1);
    // Then the next live player's turn
    expect(s.phase).toBe("turn");
    expect(s.current).toBe(1);
  });

  it("places: survivors by net worth, then the latest out", () => {
    const s = table(3);
    s.players[1].out = true;
    s.players[1].outRank = 1;
    s.players[2].cash = 9999;
    expect(placings(s)).toEqual([2, 0, 1]);
  });
});

describe("trades", () => {
  it("swaps deeds, cash and cards when accepted", () => {
    const s = table();
    own(s, 0, 1);
    own(s, 1, 3);
    s.players[1].freeCards = ["chance"];
    expect(act(s, 0, { type: "offer", to: 1, give: { cash: 100, sqs: [1], cards: 0 }, get: { cash: 0, sqs: [3], cards: 1 } })).toBe(true);
    expect(s.phase).toBe("trade");
    expect(decider(s)).toBe(1);
    expect(act(s, 0, { type: "accept" })).toBe(false);
    expect(act(s, 1, { type: "accept" })).toBe(true);
    expect(s.owner[1]).toBe(1);
    expect(s.owner[3]).toBe(0);
    expect(s.players[0].cash).toBe(START_CASH - 100);
    expect(s.players[1].cash).toBe(START_CASH + 100);
    expect(s.players[0].freeCards).toEqual(["chance"]);
    expect(s.phase).toBe("turn");
  });

  it("refuses offers of what you don't have, buildings, or nothing at all", () => {
    const s = table();
    own(s, 0, ...GROUPS[0]);
    s.houses[1] = 1;
    own(s, 1, 6);
    const offer = (give: number[], get: number[], cash = 0) => act(s, 0, { type: "offer", to: 1, give: { cash, sqs: give, cards: 0 }, get: { cash: 0, sqs: get, cards: 0 } });
    expect(offer([3], [6])).toBe(false); // houses in the set
    expect(offer([], [8])).toBe(false); // not theirs
    expect(offer([], [], 0)).toBe(false);
    expect(offer([], [6], 99999)).toBe(false);
    expect(act(s, 0, { type: "offer", to: 0, give: { cash: 10, sqs: [], cards: 0 }, get: { cash: 0, sqs: [], cards: 0 } })).toBe(false);
  });

  it("a decline changes nothing, and offers per turn are limited", () => {
    const s = table();
    own(s, 1, 3);
    const o = { type: "offer" as const, to: 1, give: { cash: 10, sqs: [], cards: 0 }, get: { cash: 0, sqs: [3], cards: 0 } };
    for (let i = 0; i < 3; i++) {
      expect(act(s, 0, o)).toBe(true);
      expect(act(s, 1, { type: "reject" })).toBe(true);
    }
    expect(s.owner[3]).toBe(1);
    expect(act(s, 0, o)).toBe(false);
  });

  it("computers accept a fair swap that finishes both sets, and reject a giveaway", () => {
    const s = createGame(1, seats(2, "normal"), { first: 0 });
    own(s, 0, 1, 14);
    own(s, 1, 3, 11, 13);
    // 0 finishes Hà Giang–Cao Bằng, 1 finishes the Mekong set
    const fair = { from: 0, to: 1, give: { cash: 0, sqs: [14], cards: 0 }, get: { cash: 0, sqs: [3], cards: 0 } };
    expect(wouldAccept(s, fair, 1, "normal")).toBe(true);
    const giveaway = { from: 0, to: 1, give: { cash: 0, sqs: [], cards: 0 }, get: { cash: 0, sqs: [11, 13], cards: 0 } };
    expect(wouldAccept(s, giveaway, 1, "normal")).toBe(false);
    // And a computer finds a deal like it on its own
    const offer = findOffer(s, 0, "hard");
    expect(offer?.get.sqs).toEqual([3]);
  });
});

describe("computer players", () => {
  it("choose a legal action quickly in every phase", () => {
    for (const level of ["easy", "normal", "hard"] as Difficulty[]) {
      const s = createGame(42, seats(4, level));
      const rand = gameRand(s);
      let slowest = 0;
      for (let i = 0; i < 400 && s.phase !== "over"; i++) {
        const who = decider(s);
        const t0 = performance.now();
        const a = botAction(s, who, level, rand);
        slowest = Math.max(slowest, performance.now() - t0);
        if (!act(s, who, a)) throw new Error(`${level} chose an illegal ${JSON.stringify(a)} in ${s.phase}`);
      }
      expect(slowest).toBeLessThan(50);
    }
  });

  it.each([
    [2, "easy"],
    [3, "normal"],
    [4, "hard"],
    [4, "normal"],
    [2, "hard"],
  ] as [number, Difficulty][])("a seeded %i-player %s bot game plays to a winner", (n, level) => {
    for (const seed of [1, 2, 3]) {
      const s = createGame(seed * 977, seats(n, level));
      let steps = 0;
      const kinds = new Set<string>();
      while (s.phase !== "over" && steps < 400_000) {
        stepGame(s, 1, []);
        for (const e of s.events) kinds.add(e.type);
        s.events.length = 0;
        steps++;
      }
      expect(s.phase).toBe("over");
      expect(s.winner).toBeGreaterThanOrEqual(0);
      // Money is conserved apart from the bank: nobody below zero
      for (const p of s.players) expect(p.cash).toBeGreaterThanOrEqual(0);
      expect(kinds.has("rent")).toBe(true);
      expect(kinds.has("buy")).toBe(true);
    }
  });

  it("the time limit ends the game on net worth", () => {
    const s = createGame(5, seats(3, "normal"), { limitMin: 30 });
    while (s.phase !== "over") stepGame(s, 2, []);
    expect(s.endReason === "time" || s.endReason === "last").toBe(true);
    if (s.endReason === "time") {
      const worths = s.players.map((_, i) => netWorth(s, i));
      expect(worths[s.winner]).toBe(Math.max(...worths));
      expect(s.elapsed).toBeGreaterThanOrEqual(30 * 60);
    }
  });
});

describe("online", () => {
  const game = coTyPhuOnline;

  it("shares the lobby settings with the manifest's source", () => {
    expect(game.settings).toBe(ROOM_SETTINGS);
    expect(settingsOf({ players: "2", time: "30" }, 1)).toEqual({ players: 2, limitMin: 30 });
    expect(settingsOf({ players: "2" }, 3).players).toBe(3);
    expect(settingsOf({}, 1)).toEqual({ players: 4, limitMin: 60 });
  });

  it("drops garbage and keeps well-formed actions", () => {
    const parse = (actions: unknown[]) => game.parseInput({ move: { x: 0, y: 0 }, actions });
    expect(parse([])).toBeNull();
    expect(parse([null, 3, "roll", { type: "steal" }, { type: "bid", amount: -5 }, { type: "bid", amount: 1.5 }])).toBeNull();
    expect(parse([{ type: "build", sq: 40 }])).toBeNull();
    expect(parse([{ type: "offer", to: 1, give: { cash: 0, sqs: [1, 1], cards: 0 }, get: { cash: 0, sqs: [], cards: 0 } }])).toBeNull();
    expect(parse([{ type: "offer", to: 9, give: { cash: 0, sqs: [], cards: 0 }, get: { cash: 0, sqs: [], cards: 0 } }])).toBeNull();
    expect(parse([{ type: "nope" }, { type: "roll", extra: 1 }])).toEqual({ type: "roll" });
    expect(parseAction({ type: "bid", amount: 120 })).toEqual({ type: "bid", amount: 120 });
    expect(parseActions([{ type: "mortgage", sq: 39 }])).toEqual({ type: "mortgage", sq: 39 });
  });

  it("refuses actions that are not this seat's to make", () => {
    const sim = game.create(3, [{ name: "An" }, { name: "Bình" }], { players: "2", time: "0" });
    const snap = () => sim.snapshot() as Game;
    const first = snap().current;
    const other = 1 - first;
    sim.step(other === 0 ? [{ type: "roll" }, null] : [null, { type: "roll" }]);
    expect(snap().rolls).toBe(0);
    sim.step(first === 0 ? [{ type: "roll" }, null] : [null, { type: "roll" }]);
    expect(snap().rolls).toBe(1);
  });

  it("fills empty seats with the computer, hides the dice and decks, and plays a silent match to the end", () => {
    const sim = game.create(11, [{ name: "An" }, { name: "Bình" }], { players: "4", time: "30" });
    const snap = sim.snapshot() as Game;
    expect(snap.players.map((p) => p.bot)).toEqual([null, null, "normal", "normal"]);
    expect(snap.rng).toBe(0);
    expect(snap.decks.chance).toEqual([]);
    let ticks = 0;
    const seen = new Set<string>();
    sim.setAutopilot(1, true);
    while (!sim.over && ticks < game.tickRate * 60 * 60 * 3) {
      sim.step([null, null]);
      for (const e of sim.drainEvents() as { type: string }[]) seen.add(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    expect(seen.has("roll")).toBe(true);
    const results = sim.results();
    expect(results.map((r) => r.seat)).toEqual([0, 1]);
    for (const r of results) {
      expect(r.detail.length).toBeLessThanOrEqual(40);
      expect(["win", "loss", "draw"]).toContain(r.outcome);
    }
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({ phase: "over" });
  });

  it("a person who times out gets the computer's safe choice, then a short clock", () => {
    const sim = game.create(5, [{ name: "An" }, { name: "Bình" }], { players: "2", time: "0" });
    const s0 = sim.snapshot() as Game;
    const mover = s0.current;
    for (let i = 0; i < game.tickRate * (TURN_SECONDS + 2); i++) sim.step([null, null]);
    const s1 = sim.snapshot() as Game;
    expect(s1.rolls).toBeGreaterThan(0);
    expect(s1.players[mover].idle).toBe(true);
  });

  it("a dropped seat plays itself and comes back", () => {
    const s = createGame(1, seats(2), { first: 0 });
    setAway(s, 0, true);
    expect(s.players[0].away).toBe(true);
    for (let i = 0; i < 30; i++) stepGame(s, 0.5, []);
    expect(s.rolls).toBeGreaterThan(0);
    setAway(s, 0, false);
    expect(s.players[0].away).toBe(false);
    expect(snapshotOf(s).events).toEqual([]);
  });
});
