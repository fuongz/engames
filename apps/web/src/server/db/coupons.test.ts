import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import {
  normalizeCode,
  type RedeemFailure,
  type RedeemInput,
  redeemCoupon,
} from "./coupons";
import { forgetGameIds } from "./games";
import type { Db } from "./leaderboard";
import * as schema from "./schema";

// Runs the real generated migrations on an in-memory SQLite, like saves.test.ts.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");

let sqlite: Database;
let db: Db;

function freshDb() {
  forgetGameIds();
  sqlite = new Database(":memory:");
  sqlite.run("pragma foreign_keys = on");
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const stmt of readFileSync(join(MIGRATIONS, file), "utf8").split(
      "--> statement-breakpoint",
    )) {
      if (stmt.trim()) sqlite.run(stmt);
    }
  }
  for (let i = 1; i <= 5; i++)
    sqlite.run(
      `insert into user (id, name, email) values ('u${i}', 'P${i}', 'p${i}@x.vn')`,
    );
  db = drizzle(sqlite, { schema }) as unknown as Db;
}

beforeEach(freshDb);

const NOW = 1_800_000_000_000;
const COINS = '[{"kind":"coins","amount":100}]';

/**
 * Mint like the admin does: hand-written SQL, defaults for everything left out.
 * `game` is a slug, written as the docs do: (SELECT id FROM game WHERE slug = ?).
 */
function mint(
  code: string,
  { game, ...cols }: Record<string, string | number | null> = {},
) {
  const all = { code, rewards: COINS, ...cols };
  const keys = Object.keys(all);
  const values = keys.map(() => "?");
  if (game !== undefined) {
    keys.push("game_id");
    values.push("(select id from game where slug = ?)");
  }
  sqlite
    .query(
      `insert into coupon (${keys.join(", ")}) values (${values.join(", ")})`,
    )
    .run(...Object.values(all), ...(game === undefined ? [] : [game]));
}

/** The slug a redemption row points at, through the game table. */
const redeemedIn = (code: string, userId: string) =>
  (
    sqlite
      .query(
        "select g.slug from coupon_redemption r join game g on g.id = r.game_id where r.code = ? and r.user_id = ?",
      )
      .get(code, userId) as { slug: string } | null
  )?.slug;

const redeem = (code: string, over: Partial<RedeemInput> = {}) =>
  redeemCoupon(db, {
    code,
    userId: "u1",
    game: "xu-vu-tru",
    kinds: ["coins"],
    now: NOW,
    ...over,
  });

const usesOf = (code: string) =>
  (
    sqlite.query("select uses from coupon where code = ?").get(code) as {
      uses: number;
    }
  ).uses;

const fail = (reason: RedeemFailure) => ({ ok: false as const, reason });

describe("normalizeCode", () => {
  it("trims, uppercases and drops spaces and dashes", () => {
    expect(normalizeCode("  ab-cd ef-12 ")).toBe("ABCDEF12");
    expect(normalizeCode("abcd\tef")).toBe("ABCDEF");
    expect(normalizeCode(" - ")).toBe("");
  });

  it("is applied to what the player typed", async () => {
    mint("TET2027");
    expect(await redeem(" tet-20 27 ")).toEqual({
      ok: true,
      code: "TET2027",
      rewards: [{ kind: "coins", amount: 100 }],
    });
  });
});

describe("minting", () => {
  it("fills the defaults, created_at included", () => {
    mint("ABCD");
    const row = sqlite.query("select * from coupon").get() as Record<
      string,
      number | null
    >;
    expect(row).toMatchObject({
      max_uses: 1,
      uses: 0,
      disabled: 0,
      expires_at: null,
      game_id: null,
      note: null,
    });
    expect(Math.abs((row.created_at as number) - Date.now())).toBeLessThan(
      5000,
    );
  });

  it("rejects a code no player could ever type in, or rewards that aren't a JSON array", () => {
    expect(() => mint("lower")).toThrow();
    expect(() => mint("HAS-DASH")).toThrow();
    expect(() => mint("HAS SPACE")).toThrow();
    expect(() => mint("BADJSON", { rewards: "{coins:1" })).toThrow();
    expect(() => mint("OBJECT", { rewards: '{"kind":"coins"}' })).toThrow();
  });

  // The recipes in docs/standards/coupons.md §3, as written there
  const docsMint = (slug: string) =>
    sqlite
      .query(
        `INSERT INTO coupon (code, game_id, rewards, max_uses)
         SELECT upper(hex(randomblob(5))), id, '[{"kind":"coins","amount":100}]', 1
         FROM game WHERE slug = ?
         RETURNING code, game_id`,
      )
      .all(slug) as { code: string; game_id: number }[];

  it("random codes from the docs mint and redeem in their game only", async () => {
    const [{ code }] = docsMint("xu-vu-tru");
    expect(code).toMatch(/^[0-9A-F]{10}$/);
    expect(await redeem(code, { game: "xep-tang" })).toEqual(
      fail("wrong-game"),
    );
    expect(await redeem(code.toLowerCase())).toMatchObject({ ok: true });
  });

  it("the docs' recipe mints nothing for a slug with no game row", () => {
    expect(docsMint("xu-vu-truu")).toEqual([]);
    expect(sqlite.query("select count(*) n from coupon").get()).toEqual({
      n: 0,
    });
  });

  it("the docs' batch recipe mints 20 codes for one game", () => {
    const rows = sqlite
      .query(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 20)
         INSERT INTO coupon (code, game_id, rewards, max_uses, note)
         SELECT upper(hex(randomblob(5))), g.id, '[{"kind":"coins","amount":100}]', 1, 'Giveaway 2026-11'
         FROM n, game g WHERE g.slug = 'xu-vu-tru'
         RETURNING code, game_id`,
      )
      .all() as { code: string; game_id: number }[];
    expect(new Set(rows.map((r) => r.code)).size).toBe(20);
    expect(new Set(rows.map((r) => r.game_id))).toEqual(
      new Set([
        (sqlite.query("select id from game where slug = 'xu-vu-tru'").get() as {
          id: number;
        }).id,
      ]),
    );
  });
});

describe("redeemCoupon", () => {
  it("not-found for an unknown or empty code", async () => {
    expect(await redeem("NOPE")).toEqual(fail("not-found"));
    expect(await redeem(" -- ")).toEqual(fail("not-found"));
  });

  it("disabled", async () => {
    mint("OFF1", { disabled: 1 });
    expect(await redeem("OFF1")).toEqual(fail("disabled"));
    expect(usesOf("OFF1")).toBe(0);
  });

  it("expired: usable until expires_at, refused from then on", async () => {
    mint("SOON", { expires_at: NOW + 1, max_uses: 10 });
    expect((await redeem("SOON", { now: NOW })).ok).toBe(true);
    expect(await redeem("SOON", { userId: "u2", now: NOW + 1 })).toEqual(
      fail("expired"),
    );
    expect(usesOf("SOON")).toBe(1);
  });

  it("max_uses counts across players, then used-up", async () => {
    mint("THREE", { max_uses: 3 });
    for (const userId of ["u1", "u2", "u3"])
      expect((await redeem("THREE", { userId })).ok).toBe(true);
    expect(await redeem("THREE", { userId: "u4" })).toEqual(fail("used-up"));
    expect(usesOf("THREE")).toBe(3);
    const rows = await db
      .select()
      .from(schema.couponRedemption)
      .where(eq(schema.couponRedemption.code, "THREE"));
    expect(rows.map((r) => r.userId).sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("each player redeems a code once, even with uses to spare", async () => {
    mint("SHARED", { max_uses: 100 });
    expect((await redeem("SHARED")).ok).toBe(true);
    expect(await redeem("shared")).toEqual(fail("already-redeemed"));
    // Not in another game either
    expect(await redeem("SHARED", { game: "other" })).toEqual(
      fail("already-redeemed"),
    );
    expect(usesOf("SHARED")).toBe(1);
  });

  it("already-redeemed beats used-up for the player who took the last use", async () => {
    mint("SOLO");
    expect((await redeem("SOLO")).ok).toBe(true);
    expect(await redeem("SOLO")).toEqual(fail("already-redeemed"));
    expect(await redeem("SOLO", { userId: "u2" })).toEqual(fail("used-up"));
  });

  it("a code for one game is wrong-game anywhere else; a null game works in any", async () => {
    mint("XUONLY", { game: "xu-vu-tru", max_uses: 5 });
    mint("ANYGAME", { max_uses: 5 });
    expect(await redeem("XUONLY", { game: "xep-tang" })).toEqual(
      fail("wrong-game"),
    );
    expect(usesOf("XUONLY")).toBe(0);
    expect((await redeem("XUONLY", { game: "xu-vu-tru" })).ok).toBe(true);
    expect((await redeem("ANYGAME", { game: "xep-tang" })).ok).toBe(true);
    expect(
      (await redeem("ANYGAME", { game: "xu-vu-tru", userId: "u2" })).ok,
    ).toBe(true);
    expect(redeemedIn("ANYGAME", "u1")).toBe("xep-tang");
    expect(redeemedIn("ANYGAME", "u2")).toBe("xu-vu-tru");
    expect(redeemedIn("XUONLY", "u1")).toBe("xu-vu-tru");
  });

  it("grants only the kinds the game accepts, and records that snapshot", async () => {
    mint("MIX", {
      rewards:
        '[{"kind":"coins","amount":50},{"kind":"gems","amount":2},{"kind":"tickets","amount":30}]',
    });
    const result = await redeem("MIX", { kinds: ["coins", "tickets"] });
    expect(result).toEqual({
      ok: true,
      code: "MIX",
      rewards: [
        { kind: "coins", amount: 50 },
        { kind: "tickets", amount: 30 },
      ],
    });
    const [row] = await db.select().from(schema.couponRedemption);
    expect(JSON.parse(row.rewards)).toEqual([
      { kind: "coins", amount: 50 },
      { kind: "tickets", amount: 30 },
    ]);
    expect(row.redeemedAt).toBe(NOW);
  });

  it("nothing-for-this-game consumes nothing", async () => {
    mint("GEMS", { rewards: '[{"kind":"gems","amount":5}]' });
    mint("JUNK", { rewards: '[{"kind":"coins","amount":-5},{"amount":3}]' });
    expect(await redeem("GEMS")).toEqual(fail("nothing-for-this-game"));
    expect(await redeem("JUNK")).toEqual(fail("nothing-for-this-game"));
    expect(usesOf("GEMS")).toBe(0);
    expect(await db.select().from(schema.couponRedemption)).toEqual([]);
    // The player can still redeem it in a game that takes gems
    expect(
      (await redeem("GEMS", { game: "other", kinds: ["gems"] })).ok,
    ).toBe(true);
  });

  it("concurrent players never take more than max_uses", async () => {
    mint("RUSH", { max_uses: 3 });
    const results = await Promise.all(
      ["u1", "u2", "u3", "u4", "u5"].map((userId) =>
        redeem("RUSH", { userId }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok)).toEqual([
      fail("used-up"),
      fail("used-up"),
    ]);
    expect(usesOf("RUSH")).toBe(3);
  });

  it("one player's concurrent requests grant once and give the extra use back", async () => {
    mint("TWICE", { max_uses: 10 });
    // The requests interleave at every await, so both claim before either records
    const results = await Promise.all([
      redeem("TWICE"),
      redeem("TWICE"),
      redeem("TWICE"),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      fail("already-redeemed"),
      fail("already-redeemed"),
    ]);
    expect(usesOf("TWICE")).toBe(1);
  });

  it("a redemption goes with the player's account", async () => {
    mint("BYE", { max_uses: 2 });
    await redeem("BYE");
    await db.delete(schema.user).where(eq(schema.user.id, "u1"));
    expect(await db.select().from(schema.couponRedemption)).toEqual([]);
  });
});
