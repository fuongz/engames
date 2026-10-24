import { describe, expect, it } from "vitest";
import {
  BOX_SIZES,
  BOX_TIP,
  CLOSE_AT,
  FRESH_DAYS,
  MARKET_TRIP,
  OPEN_AT,
  BEDTIME,
  COFFEE_ENERGY,
  LATEST_BED,
  NAP_ENERGY,
  OPEN,
  SELL_ENERGY,
  START_ENERGY,
  WAKE,
  RECIPES,
  type RecipeId,
  START_COINS,
  VIP_TIP,
} from "./config";
import {
  type Cart,
  type Ledger,
  type Piece,
  type SaveData,
  type StepResult,
  type Visitor,
  arrive,
  assets,
  bakeResult,
  batchMinutes,
  boxFit,
  buyIngredients,
  buyRecipe,
  buyUpgrade,
  canBake,
  clockAt,
  closeDay,
  dayInfo,
  emptyLedger,
  fastBake,
  finishBatch,
  gradeAmount,
  gradeMix,
  gradeOven,
  advance,
  canOpen,
  drinkCoffee,
  elapsed,
  goToBed,
  mustOpen,
  ovens,
  gradePick,
  nap,
  patienceFactor,
  shake,
  ingredient,
  missing,
  needs,
  newGame,
  orderTotal,
  pantryQty,
  payment,
  planDay,
  recipe,
  reserve,
  settle,
  startBatch,
  stockCount,
} from "./logic";
import { parseSave, plausible } from "./save";

const stocked = (save: SaveData, packs = 3): SaveData => {
  const cart: Cart = {
    flour: packs,
    sugar: packs,
    butter: packs,
    eggs: packs,
    milk: packs,
    bakingPowder: 1,
    vanilla: 1,
  };
  const r = buyIngredients({ ...save, coins: 10_000 }, cart);
  if (!r.ok) throw new Error(r.why);
  return { ...r.save, coins: save.coins };
};

describe("the night's work", () => {
  it("starts with 250 coins, two free recipes and a full night", () => {
    const s = newGame(1);
    expect(s.coins).toBe(START_COINS);
    expect(s.recipes).toEqual(["cookie", "cupcake"]);
    expect(clockAt(0)).toBe(CLOSE_AT);
    expect(clockAt(BEDTIME)).toBe(22 * 60);
    expect(clockAt(LATEST_BED)).toBe(60);
    expect(clockAt(WAKE)).toBe(5 * 60 + 30);
    expect(clockAt(OPEN)).toBe(OPEN_AT);
  });

  it("shops in packs and spends a market trip", () => {
    const r = buyIngredients(newGame(1), { flour: 2, eggs: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.coins).toBe(START_COINS - 24 - 15);
    expect(pantryQty(r.save, "flour")).toBe(2000);
    expect(r.save.pantry.eggs?.[0]).toEqual({ qty: 10, days: FRESH_DAYS });
    expect(r.save.night).toBe(MARKET_TRIP);
    expect(buyIngredients(newGame(1), { butter: 99 })).toEqual({
      ok: false,
      why: "coins",
    });
  });

  it("bakes from the pantry, oldest fresh lot first, and counts mastery by hand only", () => {
    let s = stocked(newGame(1));
    s = {
      ...s,
      pantry: {
        ...s.pantry,
        eggs: [
          { qty: 10, days: 3 },
          { qty: 1, days: 1 },
        ],
      },
    };
    const started = startBatch(s, "cookie");
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.save.pantry.eggs).toEqual([{ qty: 10, days: 3 }]);
    // The clock runs on its own now: starting a batch takes no time up front
    expect(started.save.night).toBe(s.night);
    const done = finishBatch(
      started.save,
      "cookie",
      { stars: 3 },
      started.cost,
      true,
    );
    expect(done.stock).toEqual([
      { recipe: "cookie", stars: 3, count: 12, cost: started.cost / 12 },
    ]);
    expect(done.mastery.cookie).toBe(1);
    expect(
      finishBatch(started.save, "cookie", { fail: "burnt" }, started.cost, true)
        .stock,
    ).toEqual([]);
  });

  it("refuses a batch without ingredients, time or display room", () => {
    const s = newGame(1);
    expect(canBake(s, "cookie")).toBe("ingredients");
    expect(missing(s, recipe("cookie")).map((m) => m.ing)).toEqual(
      Object.keys(needs(recipe("cookie"))),
    );
    expect(canBake({ ...stocked(s), energy: 0 }, "cookie")).toBe("tired");
    expect(
      canBake(
        {
          ...stocked(s),
          stock: [{ recipe: "cupcake", stars: 2, count: 45, cost: 1 }],
        },
        "cookie",
      ),
    ).toBe("display");
    expect(canBake(stocked(s), "flan")).toBe("owned");
  });

  it("only quick-bakes a mastered recipe, at 2★", () => {
    const s = stocked(newGame(1));
    expect(fastBake(s, "cookie").ok).toBe(false);
    const r = fastBake({ ...s, mastery: { cookie: 3 } }, "cookie");
    expect(r.ok && r.save.stock[0]).toMatchObject({
      recipe: "cookie",
      stars: 2,
      count: 12,
    });
  });

  it("upgrades change the kitchen", () => {
    const s = { ...newGame(1), coins: 5000 };
    const r = recipe("shortcake");
    const plain = batchMinutes(s, r);
    const kitted = ["mixer", "oven2"].reduce((x, id) => {
      const b = buyUpgrade(x, id as "mixer");
      return b.ok ? b.save : x;
    }, s);
    expect(batchMinutes(kitted, r)).toBe(plain - 10);
    expect(ovens(kitted)).toBe(2);
    expect(buyRecipe(s, "shortcake").ok).toBe(true);
    expect(buyRecipe(newGame(1), "shortcake")).toEqual({
      ok: false,
      why: "coins",
    });
  });
});

describe("sleep, energy and mood", () => {
  it("goes to bed at 22:00 and wakes at 5:30 with energy back", () => {
    const tired = { ...newGame(1), night: BEDTIME, energy: 20, mood: 60 };
    const { save, hours } = goToBed(tired);
    expect(hours).toBe(7.5);
    expect(save.night).toBe(WAKE);
    expect(save.energy).toBeGreaterThan(80);
    expect(save.mood).toBe(68);
    expect(goToBed(save).hours).toBe(0);
  });

  it("staying up buys working time with a tired, gloomier morning", () => {
    const base = { ...newGame(1), energy: 20, mood: 60 };
    const late = goToBed({ ...base, night: LATEST_BED }).save;
    const normal = goToBed({ ...base, night: BEDTIME }).save;
    expect(late.energy).toBeLessThan(normal.energy - 30);
    expect(late.mood).toBeLessThan(base.mood);
    // A gloomy baker sleeps worse
    const gloomy = goToBed({ ...base, night: BEDTIME, mood: 0 }).save;
    expect(gloomy.energy).toBeLessThan(normal.energy);
  });

  it("work drains energy; exhausted, nothing but rest, coffee or bed", () => {
    const s = stocked(newGame(1));
    expect(s.energy).toBeCloseTo(START_ENERGY - 30 * 0.12);
    const spent = { ...s, energy: 0 };
    expect(canBake(spent, "cookie")).toBe("tired");
    expect(buyIngredients(spent, { flour: 1 })).toEqual({
      ok: false,
      why: "tired",
    });
    const rested = nap(spent);
    expect(rested.ok && rested.save.energy).toBe(NAP_ENERGY);
    expect(rested.ok && rested.save.night).toBe(spent.night + 30);
    expect(drinkCoffee(spent).ok).toBe(false);
    const withCup = {
      ...spent,
      pantry: { ...spent.pantry, coffee: [{ qty: 2, days: -1 }] },
    };
    const cup = drinkCoffee(withCup);
    expect(cup.ok && cup.save.energy).toBe(COFFEE_ENERGY);
    expect(cup.ok && cup.save.caffeine).toBe(1);
    expect(cup.ok && cup.save.pantry.coffee).toEqual([{ qty: 1, days: -1 }]);
    // and coffee costs sleep
    const after = cup.ok
      ? goToBed({ ...cup.save, night: BEDTIME }).save
      : spent;
    const without = goToBed({
      ...withCup,
      night: BEDTIME,
      energy: COFFEE_ENERGY,
    }).save;
    expect(after.energy).toBeLessThan(without.energy);
  });

  it("mood moves customers and the day; energy shakes the hands", () => {
    expect(patienceFactor(100)).toBeCloseTo(1.2);
    expect(patienceFactor(0)).toBeCloseTo(0.8);
    expect(shake(80)).toBe(0);
    expect(shake(0)).toBe(1);
    const s = { ...newGame(1), mood: 100, energy: 50 };
    const { next } = closeDay(s, { ...emptyLedger(), walked: 20 }, []);
    expect(next.rep).toBe(s.rep + 2);
    expect(next.energy).toBe(50 - SELL_ENERGY);
    expect(next.mood).toBe(100 + 4 - 8);
    expect(next.night).toBe(0);
    expect(finishBatch(s, "cookie", { fail: "burnt" }, 10, true).mood).toBe(96);
  });
});

describe("the running clock", () => {
  it("runs while awake, draining energy, and stops at 1:00 or 9:30", () => {
    const s = { ...newGame(1), energy: 50 };
    const later = advance(s, 60);
    expect(later.night).toBe(60);
    expect(later.energy).toBeCloseTo(50 - 60 * 0.12);
    expect(advance({ ...s, night: LATEST_BED - 5 }, 60).night).toBe(LATEST_BED);
    const morning = { ...s, night: WAKE };
    expect(advance(morning, 10_000).night).toBe(OPEN + 30);
    expect(canOpen({ ...s, night: OPEN - 1 })).toBe(false);
    expect(canOpen({ ...s, night: OPEN })).toBe(true);
    expect(mustOpen({ ...s, night: OPEN + 30 })).toBe(true);
  });

  it("times background batches on the night clock, through sleep too", () => {
    const job = { start: 300 };
    expect(elapsed({ ...newGame(1), night: 320 }, job)).toBe(20);
    // Left in the oven over night: hours have passed by morning
    const slept = goToBed({ ...newGame(1), night: 330 }).save;
    expect(elapsed(slept, job)).toBe(WAKE - 300);
    const { next } = closeDay(
      {
        ...newGame(1),
        jobs: [
          {
            id: 1,
            recipe: "cookie",
            cost: 1,
            step: 6,
            results: [],
            kind: "oven",
            start: 300,
            temp: 180,
          },
        ],
      },
      emptyLedger(),
      [],
    );
    expect(next.jobs).toEqual([]);
  });
});

describe("grading the steps", () => {
  it("weighs within bands, counts eggs exactly", () => {
    expect(gradeAmount("flour", 200, 204).grade).toBe("perfect");
    expect(gradeAmount("flour", 200, 220).grade).toBe("good");
    expect(gradeAmount("flour", 200, 245)).toMatchObject({
      grade: "minor",
      note: "tooMuch",
    });
    expect(gradeAmount("flour", 200, 120)).toMatchObject({
      grade: "major",
      fail: "flat",
      note: "tooLittle",
    });
    expect(gradeAmount("eggs", 2, 2).grade).toBe("perfect");
    expect(gradeAmount("eggs", 2, 3).grade).toBe("major");
    expect(gradeAmount("eggs", 4, 3).grade).toBe("minor");
    expect(gradeAmount("bakingPowder", 5, 10).grade).toBe("major");
  });

  it("picking off the shelf: out of order costs a star, a stranger ruins it", () => {
    const cup = recipe("cupcake");
    expect(gradePick(cup, 0, "butter")).toBeNull();
    expect(gradePick(cup, 0, "eggs")).toMatchObject({
      grade: "minor",
      note: "outOfOrder",
    });
    expect(gradePick(cup, 0, "yeast")).toMatchObject({
      grade: "major",
      note: "wrongIngredient",
    });
  });

  it("times mixing and the oven", () => {
    expect(gradeMix(4, 4).grade).toBe("perfect");
    expect(gradeMix(4, 7)).toMatchObject({ grade: "major", note: "overmixed" });
    const oven = { kind: "oven" as const, temp: 180, minutes: 20 };
    expect(gradeOven(oven, 180, 20).grade).toBe("perfect");
    expect(gradeOven(oven, 190, 20).grade).toBe("good");
    expect(gradeOven(oven, 230, 20)).toMatchObject({
      grade: "major",
      fail: "burnt",
    });
    expect(gradeOven(oven, 180, 9)).toMatchObject({
      grade: "major",
      fail: "raw",
    });
    expect(gradeOven(oven, 180, 40)).toMatchObject({
      grade: "major",
      fail: "burnt",
    });
  });

  it("every oven temperature can be dialled exactly (150°C start, 10° steps)", () => {
    for (const r of RECIPES)
      for (const s of r.steps)
        if (s.kind === "oven") expect((s.temp - 150) % 10, r.id).toBe(0);
  });

  it("turns the steps into stars or a failed batch", () => {
    const p: StepResult = { grade: "perfect", note: "exact" };
    const g: StepResult = { grade: "good", note: "tooMuch" };
    const m: StepResult = { grade: "minor", note: "tooMuch" };
    expect(bakeResult([p, p, p])).toEqual({ stars: 3 });
    expect(bakeResult([p, g, g])).toEqual({ stars: 3 });
    expect(bakeResult([g, g, g])).toEqual({ stars: 2 });
    expect(bakeResult([m, m, m, m])).toEqual({ stars: 1 });
    expect(
      bakeResult([p, { grade: "major", note: "overdone", fail: "burnt" }]),
    ).toEqual({ fail: "burnt" });
  });
});

describe("the shop", () => {
  const v = (
    lines: Visitor["lines"],
    rolls: Visitor["rolls"] = [0, 0.9, 0],
    kind: Visitor["kind"] = "regular",
  ): Visitor => ({
    id: 0,
    customer: "cat",
    at: OPEN_AT,
    lines,
    kind,
    rolls,
  });

  it("plans the same day the same way, busier at the weekend", () => {
    const s = {
      ...newGame(42),
      recipes: ["cookie", "cupcake", "flan"] as RecipeId[],
    };
    expect(planDay(s)).toEqual(planDay(s));
    const plan = planDay(s);
    expect(plan.filter((x) => !x.rush)).toHaveLength(dayInfo(s).customers);
    expect(plan.every((x) => x.at >= OPEN_AT && x.at <= CLOSE_AT)).toBe(true);
    expect(dayInfo({ ...s, day: 6 }).customers).toBeGreaterThan(
      dayInfo({ ...s, day: 1 }).customers * 1.1 * 0.7,
    );
  });

  it("shrinks, swaps or drops what is not on display", () => {
    const stock = [
      { recipe: "cupcake" as RecipeId, stars: 2 as const, count: 1, cost: 2 },
    ];
    expect(arrive(stock, v([{ recipe: "cupcake", qty: 2 }]))).toEqual({
      lines: [{ recipe: "cupcake", qty: 1 }],
      lost: [{ recipe: "cupcake", qty: 1 }],
    });
    expect(arrive(stock, v([{ recipe: "cookie", qty: 3 }])).lines).toEqual([
      { recipe: "cupcake", qty: 1 },
    ]);
    expect(
      arrive(stock, v([{ recipe: "cookie", qty: 3 }], [0.99, 0, 0])).lines,
    ).toEqual([]);
  });

  it("holds pre-ordered cakes back at opening, 2★ or better", () => {
    const stock = [
      { recipe: "flan" as RecipeId, stars: 1 as const, count: 8, cost: 2 },
      { recipe: "flan" as RecipeId, stars: 3 as const, count: 3, cost: 2 },
    ];
    const held = reserve(stock, [
      { id: 7, customer: "pig", recipe: "flan", qty: 3, at: 660 },
    ]);
    expect(held.held.get(7)?.map((p) => p.stars)).toEqual([3, 3, 3]);
    expect(stockCount(held.stock)).toBe(8);
    expect(
      reserve(stock, [
        { id: 8, customer: "pig", recipe: "flan", qty: 4, at: 660 },
      ]).held.size,
    ).toBe(0);
  });

  it("charges, takes notes and checks the change", () => {
    const pieces: Piece[] = [
      { recipe: "cupcake", stars: 3, cost: 2 },
      { recipe: "cupcake", stars: 2, cost: 2 },
    ];
    const total = orderTotal(pieces, false, false);
    expect(total).toBe(18);
    const visitor = v([{ recipe: "cupcake", qty: 2 }]);
    expect(payment(total, visitor)).toBe(20);
    expect(settle(visitor, pieces, 20, total, 2, null)).toMatchObject({
      coins: 18,
      short: 0,
      over: 0,
      mood: "happy",
      tip: 1,
    });
    expect(settle(visitor, pieces, 20, total, 1, null)).toMatchObject({
      coins: 19,
      short: 1,
      mood: "angry",
      tip: 0,
    });
    expect(settle(visitor, pieces, 20, total, 5, null)).toMatchObject({
      coins: 15,
      over: 3,
    });
    expect(orderTotal(pieces, true, false)).toBe(13);
  });

  it("tips a snug box and judges the critic on 3★ only", () => {
    expect(boxFit(4, 4)).toBe("snug");
    expect(boxFit(5, BOX_SIZES[2])).toBe("loose");
    expect(boxFit(7, 6)).toBe("small");
    const four: Piece[] = Array.from({ length: 4 }, () => ({
      recipe: "cookie" as RecipeId,
      stars: 2 as const,
      cost: 1,
    }));
    expect(settle(v([]), four, 12, 12, 0, 4).tip).toBe(BOX_TIP);
    const critic = v([], [0, 0, 0], "vip");
    const best: Piece[] = [{ recipe: "cupcake", stars: 3, cost: 2 }];
    expect(settle(critic, best, 10, 10, 0, null)).toMatchObject({
      vip: "happy",
      tip: 1 + VIP_TIP,
    });
    expect(settle(critic, [{ ...best[0], stars: 2 }], 8, 8, 0, null).vip).toBe(
      "sad",
    );
  });
});

describe("closing", () => {
  it("bins the leftovers, spoils old produce and starts the next night", () => {
    let s = stocked(newGame(9));
    s = {
      ...s,
      dayCost: 30,
      pantry: { ...s.pantry, milk: [{ qty: 500, days: 1 }] },
    };
    const ledger: Ledger = {
      ...emptyLedger(),
      revenue: 100,
      tips: 5,
      boxes: 2,
      served: 9,
      rep: 4,
    };
    const { report, next } = closeDay(s, ledger, [
      { recipe: "cookie", stars: 2, count: 3, cost: 1.5 },
    ]);
    expect(report.wasted).toEqual({ pieces: 3, cost: 4.5 });
    expect(report.profit).toBe(100 + 5 - 2 - 30);
    expect(report.spoiled).toBeCloseTo(5);
    expect(next).toMatchObject({
      day: 2,
      phase: "prep",
      night: 0,
      stock: [],
      dayCost: 0,
      coins: s.coins + 103,
      rep: 54,
    });
    expect(next.pantry.milk).toBeUndefined();
  });

  it("lends a hand to a broke bakery, now and then", () => {
    const broke = { ...newGame(1), coins: 10 };
    expect(closeDay(broke, emptyLedger(), []).report.bailout).toBe(100);
    expect(
      closeDay({ ...broke, bailoutDay: 1 }, emptyLedger(), []).report.bailout,
    ).toBe(0);
  });
});

describe("saves", () => {
  it("round-trips a real save and rejects a doctored one", () => {
    const s = stocked(newGame(5));
    expect(parseSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
    // A version-1 save (no energy or mood, the old night count) is upgraded
    const { night, energy, mood, caffeine, ...v1 } = {
      ...s,
      v: 1,
      prepUsed: 400,
    } as Record<string, unknown>;
    void night;
    void energy;
    void mood;
    void caffeine;
    const up = parseSave(v1);
    expect(up).toMatchObject({
      v: 3,
      night: WAKE + 40,
      energy: 80,
      mood: 60,
      caffeine: 0,
      jobs: [],
    });
    // and a version-2 save just gains an empty job list
    const { jobs, ...v2 } = { ...s, v: 2 } as Record<string, unknown>;
    void jobs;
    expect(parseSave(v2)).toMatchObject({ v: 3, jobs: [] });
    expect(parseSave({ ...s, recipes: ["cookie", "macaron"] })).toBeNull();
    expect(parseSave({ ...s, coins: 1.5 })).toBeNull();
    expect(plausible(s, { ...s, day: 2, coins: s.coins + 500 })).toBe(true);
    expect(plausible(s, { ...s, coins: 999_999 })).toBe(false);
    expect(plausible({ ...s, day: 4 }, { ...s, day: 3 })).toBe(false);
  });
});

// ---------------------------------------------------------------- balance

/**
 * A sensible, not brilliant, baker: plans for the forecast, bakes 2★ batches,
 * serves everyone exactly, buys the next recipe once it can afford it with a
 * cushion. The game is tuned so this baker grows steadily.
 */
function playDay(save: SaveData) {
  let s = save;
  const info = dayInfo(s);
  // Buy recipes first: they draw customers
  for (const r of RECIPES) {
    if (!s.recipes.includes(r.id) && s.coins > r.cost + 300) {
      const b = buyRecipe(s, r.id);
      if (b.ok) s = b.save;
    }
  }
  const pieces = info.customers * 2.4;
  const plan: RecipeId[] = [];
  for (const id of s.recipes) {
    const share = pieces / s.recipes.length;
    for (let i = 0; i < Math.round(share / recipe(id).yield); i++)
      plan.push(id);
  }
  // One market trip for the whole plan
  const cart: Cart = {};
  const want: Cart = {};
  for (const id of plan)
    for (const [ing, n] of Object.entries(needs(recipe(id))))
      want[ing as keyof Cart] = (want[ing as keyof Cart] ?? 0) + (n ?? 0);
  for (const [ing, n] of Object.entries(want)) {
    const id = ing as keyof Cart;
    const short = (n ?? 0) - pantryQty(s, id);
    if (short > 0) cart[id] = Math.ceil(short / ingredient(id).pack);
  }
  const bought = buyIngredients(s, cart);
  if (bought.ok) s = bought.save;
  for (const id of plan) {
    const st = startBatch(s, id);
    if (!st.ok) continue;
    s = finishBatch(st.save, id, { stars: 2 }, st.cost, true);
  }
  // Sell: everyone gets what is there, exact change, snug boxes
  const opened = { ...goToBed(s).save, phase: "open" as const };
  const { stock, held } = reserve(opened.stock, opened.preorders);
  let display = stock;
  const ledger = emptyLedger();
  for (const vis of planDay(opened)) {
    if (vis.rush) continue;
    let got: Piece[] = [];
    if (vis.kind === "preorder") {
      got = held.get(vis.preorder ?? -1) ?? [];
      if (!got.length) {
        ledger.preorders.missed++;
        continue;
      }
      ledger.preorders.done++;
    } else {
      const { lines, lost } = arrive(display, vis);
      for (const l of lost)
        ledger.soldOut[l.recipe] = (ledger.soldOut[l.recipe] ?? 0) + l.qty;
      for (const l of lines) {
        for (let i = 0; i < l.qty; i++) {
          const item = display.find(
            (x) => x.recipe === l.recipe && x.count > 0,
          );
          if (!item) break;
          item.count--;
          got.push({ recipe: item.recipe, stars: item.stars, cost: item.cost });
        }
      }
      display = display.filter((x) => x.count > 0);
      if (!got.length) {
        ledger.walked++;
        continue;
      }
    }
    const total = orderTotal(got, false, vis.kind === "preorder");
    const paid = payment(total, vis);
    const box =
      got.length >= 4 ? (BOX_SIZES.find((b) => b >= got.length) ?? null) : null;
    const out = settle(vis, got, paid, total, paid - total, box);
    ledger.revenue += out.coins;
    ledger.tips += out.tip;
    ledger.boxes += out.boxCost;
    ledger.served++;
    ledger.rep += out.rep;
  }
  return closeDay(opened, ledger, display);
}

describe("balance", () => {
  it("a steady baker grows: never broke, a new recipe within a week, most of the book in four", () => {
    let s = newGame(2024);
    const log: string[] = [];
    let minCoins = Number.POSITIVE_INFINITY;
    let firstBuy = 0;
    for (let d = 0; d < 28; d++) {
      const { report, next } = playDay(s);
      log.push(
        `d${report.day} coins ${Math.round(next.coins)} profit ${Math.round(report.profit)} rep ${report.rep.after} served ${report.served} waste ${report.wasted.pieces} recipes ${next.recipes.length}`,
      );
      minCoins = Math.min(minCoins, next.coins);
      if (!firstBuy && next.recipes.length > 2) firstBuy = report.day;
      s = next;
    }
    const days = log.join("\n");
    expect(minCoins, days).toBeGreaterThan(0);
    expect(firstBuy, days).toBeGreaterThan(0);
    expect(firstBuy, days).toBeLessThanOrEqual(7);
    expect(s.recipes.length, days).toBeGreaterThanOrEqual(5);
    expect(assets(s), days).toBeGreaterThan(3000);
  });
});
