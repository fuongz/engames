import { describe, expect, it } from "vitest";
import { CHARM_MAX_BOOST, START_COINS, type Placed } from "./config";
import {
  arrange,
  buyFurniture,
  charm,
  charmBoost,
  charmTier,
  type Decor,
  layoutOk,
  receive,
  seatPatience,
  startDecor,
  stored,
} from "./furniture";
import { assets, closeDay, dayInfo, emptyLedger, newGame } from "./logic";
import { parseSave } from "./save";

const decor = (placed: Placed[], owned = placed.map((p) => p.id)): Decor => ({
  owned: [...owned, "wall-plain", "floor-plain"],
  placed,
  wall: "wall-plain",
  floor: "floor-plain",
});
const at = (id: Placed["id"], x: number, y: number): Placed => ({
  id,
  x,
  y,
  flip: false,
});

describe("charm", () => {
  it("counts repeats of one piece less and less", () => {
    const one = charm(decor([at("pink-candy", 0, 2)]));
    const four = charm(
      decor([
        at("pink-candy", 0, 2),
        at("pink-candy", 0, 3),
        at("pink-candy", 5, 2),
        at("pink-candy", 5, 3),
      ]),
    );
    // 100% + 50% + 25% + nothing, plus the set bonus for 3+ sweet pieces
    expect(one).toBe(5);
    expect(four).toBeCloseTo(5 * 1.75 * 1.1, 1);
  });

  it("gives a theme bonus at 3 and 5 pieces, never to the basic set", () => {
    const sweet3 = decor([
      at("pink-table", 0, 2),
      at("pink-chair", 0, 3),
      at("pink-candy", 5, 2),
    ]);
    expect(charm(sweet3)).toBeCloseTo((4 + 3 + 5) * 1.1, 1);
    const basic3 = decor([
      at("basic-table", 0, 2),
      at("basic-plant", 0, 3),
      at("basic-chair", 5, 2),
    ]);
    expect(charm(basic3)).toBe(1.5 + 1.5 + 0.5);
  });

  it("counts nothing for pieces in storage", () => {
    const d = decor([], ["pink-candy", "glass-case"]);
    expect(charm(d)).toBe(0);
    expect(stored(d)).toEqual(["pink-candy", "glass-case"]);
  });

  it("boosts customers with diminishing returns, at most +50%", () => {
    expect(charmBoost(0)).toBe(1);
    expect(charmBoost(30)).toBeGreaterThan(charmBoost(15));
    expect(charmBoost(30) - charmBoost(15)).toBeLessThan(
      charmBoost(15) - charmBoost(0),
    );
    expect(charmBoost(10_000)).toBeLessThanOrEqual(1 + CHARM_MAX_BOOST);
    expect(charmTier(0)).toBe(0);
    expect(charmTier(8)).toBe(1);
    expect(charmTier(55)).toBe(3);
  });

  it("brings more customers and shows them on the day report", () => {
    const s = newGame(7);
    const plain = { ...s, decor: decor([]) };
    const fancy = {
      ...s,
      decor: decor([
        at("pink-table", 0, 2),
        at("pink-chair", 0, 3),
        at("pink-candy", 5, 2),
        at("glass-case", 4, 0),
        at("glass-fridge", 2, 0),
      ]),
    };
    expect(dayInfo(plain).charmCustomers).toBe(0);
    expect(dayInfo(fancy).customers).toBeGreaterThan(dayInfo(plain).customers);
    const { report } = closeDay(fancy, emptyLedger(), []);
    expect(report.charm).toBe(charm(fancy.decor));
    expect(report.charmCustomers).toBe(dayInfo(fancy).charmCustomers);
  });

  it("makes queuers more patient with seats, up to a cap", () => {
    expect(seatPatience(decor([]))).toBe(1);
    expect(seatPatience(startDecor())).toBeCloseTo(1.16);
    const many = decor(
      [0, 1, 2, 3, 4, 5].flatMap((x) => [
        at("basic-chair", x, 2),
        at("basic-chair", x, 3),
      ]),
    );
    expect(seatPatience(many)).toBeCloseTo(1.2);
  });
});

describe("the storefront grid", () => {
  it("starts with a layout the shop can open with, one step from Ấm cúng", () => {
    expect(layoutOk(startDecor().placed)).toBe(true);
    // A plant and a table more reach the first tier with basic pieces alone
    const s = newGame(1);
    let d = receive(s.decor, ["basic-plant", "basic-table"]);
    expect(charmTier(charm(s.decor))).toBe(0);
    expect(charmTier(charm(d))).toBe(1);
    // and a full floor sends the rest to storage
    for (let i = 0; i < 30; i++) d = receive(d, ["basic-chair"]);
    expect(layoutOk(d.placed)).toBe(true);
    expect(stored(d).length).toBeGreaterThan(0);
  });

  it("refuses overlaps, the door, the till, and blocked paths", () => {
    expect(layoutOk([at("basic-table", 0, 2), at("basic-table", 0, 2)])).toBe(
      false,
    );
    expect(layoutOk([at("basic-table", 1, 0)])).toBe(false); // the door
    expect(layoutOk([at("basic-table", 2, 4)])).toBe(false); // the till
    expect(layoutOk([at("basic-stand", 5, 0)])).toBe(false); // off the floor
    // A wall of tables across row 2 cuts the door off from the till
    const wall = [0, 1, 2, 3, 4, 5].map((x) => at("basic-table", x, 2));
    expect(layoutOk(wall)).toBe(false);
    // A stand with nowhere to stand in front of it
    expect(
      layoutOk([
        at("basic-stand", 4, 0),
        at("basic-table", 4, 1),
        at("basic-table", 5, 1),
      ]),
    ).toBe(false);
  });
});

describe("buying and arranging", () => {
  it("buys into storage, refuses locked themes and empty purses", () => {
    const s = { ...newGame(1), coins: 1000 };
    const r = buyFurniture(s, "basic-plant");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.coins).toBe(920);
    // It stands in the first free spot, and the storefront gains its charm
    expect(stored(r.save.decor)).toEqual([]);
    expect(layoutOk(r.save.decor.placed)).toBe(true);
    expect(charm(r.save.decor)).toBeGreaterThan(charm(s.decor));
    expect(buyFurniture(s, "glass-case")).toEqual({ ok: false, why: "locked" });
    expect(buyFurniture({ ...s, coins: 10 }, "basic-plant")).toEqual({
      ok: false,
      why: "coins",
    });
    expect(buyFurniture(s, "wall-plain")).toEqual({ ok: false, why: "owned" });
    // Spent coins come back in the leaderboard worth
    expect(assets(r.save)).toBe(assets(s));
  });

  it("arranges only owned pieces into a valid layout", () => {
    const s = newGame(1);
    const moved = s.decor.placed.map((p) =>
      p.id === "basic-plant" ? { ...p, x: 5, y: 4 } : p,
    );
    expect(arrange(s, moved).ok).toBe(true);
    expect(arrange(s, [...s.decor.placed, at("pink-candy", 0, 3)])).toEqual({
      ok: false,
      why: "owned",
    });
    expect(arrange(s, [...s.decor.placed, at("basic-plant", 1, 0)])).toEqual({
      ok: false,
      why: "owned",
    });
    expect(
      arrange(
        s,
        s.decor.placed.filter((p) => p.id !== "basic-plant"),
      ).ok,
    ).toBe(true);
  });
});

describe("saves", () => {
  it("upgrades a version-4 save with the starting furniture", () => {
    const { decor: _, ...rest } = newGame(3);
    const up = parseSave({ ...rest, v: 4 });
    expect(up?.v).toBe(5);
    expect(up?.decor).toEqual(startDecor());
    expect(up && assets(up)).toBe(START_COINS + 0);
  });

  it("refuses a layout that could not be built", () => {
    const s = newGame(3);
    const bad = {
      ...s,
      decor: {
        ...s.decor,
        placed: [...s.decor.placed, at("pink-candy", 0, 3)],
      },
    };
    expect(parseSave(bad)).toBeNull();
    const blocked = {
      ...s,
      decor: { ...s.decor, placed: [at("basic-table", 1, 0)] },
    };
    expect(parseSave(blocked)).toBeNull();
    expect(parseSave(s)).not.toBeNull();
  });
});
