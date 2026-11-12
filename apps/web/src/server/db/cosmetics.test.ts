import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CosmeticItem } from "@web-games/core";
import { drizzle } from "drizzle-orm/bun-sqlite";
import {
  buyCosmetic,
  cosmeticInventory,
  equipCosmetic,
  ownedCosmetics,
} from "./cosmetics";
import { forgetGameIds } from "./games";
import type { Db } from "./leaderboard";
import * as schema from "./schema";
import { depositTickets, getTicketBalance } from "./tickets";

let sqlite: Database;
let db: Db;
const ITEMS: CosmeticItem[] = [
  { id: "classic", name: { vi: "Cổ điển", en: "Classic" }, price: 0 },
  { id: "dragon", name: { vi: "Rồng sét", en: "Storm Dragon" }, price: 2000 },
  { id: "moon", name: { vi: "Trăng", en: "Moon" }, price: 2000 },
];
const NOW = Date.UTC(2026, 10, 12);
beforeEach(() => {
  forgetGameIds();
  sqlite = new Database(":memory:");
  sqlite.run("pragma foreign_keys = on");
  const folder = join(import.meta.dir, "../../../drizzle");
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const stmt of readFileSync(join(folder, file), "utf8").split(
      "--> statement-breakpoint",
    ))
      if (stmt.trim()) sqlite.run(stmt);
  }
  sqlite.run(
    "insert into user (id, name, email) values ('u1', 'An', 'an@example.test'), ('u2', 'Binh', 'binh@example.test')",
  );
  db = drizzle(sqlite, { schema }) as unknown as Db;
});
afterEach(() => sqlite.close());
const earn = (amount: number) =>
  depositTickets(db, {
    userId: "u1",
    slug: "phi-dao",
    tickets: true,
    amount,
    now: NOW,
  });
const buy = (itemId = "dragon", userId = "u1") =>
  buyCosmetic(db, { userId, slug: "phi-dao", itemId, items: ITEMS, now: NOW });
const state = (userId: string | null = "u1") =>
  cosmeticInventory(db, userId, "phi-dao", ITEMS);
const consistent = () => {
  const row = sqlite
    .query(
      "select coalesce(sum(delta),0) balance from ticket_ledger where user_id='u1'",
    )
    .get() as { balance: number };
  const wallet = sqlite
    .query("select balance from ticket_wallet where user_id='u1'")
    .get() as { balance: number };
  expect(wallet.balance).toBe(row.balance);
  expect(wallet.balance).toBeGreaterThanOrEqual(0);
};

describe("permanent cosmetic shop", () => {
  it("gives guests the free default and no paid skins", async () => {
    expect(await state(null)).toEqual({
      signedIn: false,
      balance: null,
      owned: ["classic"],
      equipped: "classic",
    });
  });
  it("spends 2000 once and saves ownership with the ledger id", async () => {
    await earn(3000);
    expect(await buy()).toMatchObject({
      ok: true,
      inventory: {
        balance: 1000,
        owned: ["classic", "dragon"],
        equipped: "classic",
      },
    });
    const row = sqlite
      .query(
        "select c.price, l.delta, l.reason from game_cosmetic c join ticket_ledger l on l.id=c.ledger_id",
      )
      .get();
    expect(row).toEqual({
      price: 2000,
      delta: -2000,
      reason: "shop:phi-dao:skin-dragon",
    });
    expect(await buy()).toMatchObject({
      ok: true,
      reason: "already-owned",
      inventory: { balance: 1000 },
    });
    expect(await getTicketBalance(db, "u1")).toEqual({
      balance: 1000,
      earnedTotal: 3000,
    });
    consistent();
  });
  it("does not charge a free or unknown item", async () => {
    await earn(2000);
    expect(await buy("classic")).toMatchObject({
      ok: true,
      reason: "already-owned",
    });
    expect(await buy("fake")).toMatchObject({
      ok: false,
      reason: "unknown-item",
    });
    expect((await state()).balance).toBe(2000);
    expect(await ownedCosmetics(db, "u1", "phi-dao")).toEqual([]);
    consistent();
  });
  it("cannot equip a paid skin before buying; equipment follows the account", async () => {
    await earn(2000);
    await expect(
      equipCosmetic(db, "u1", "phi-dao", "dragon", ITEMS),
    ).rejects.toThrow("cosmetic-not-owned");
    await buy();
    expect(
      await equipCosmetic(db, "u1", "phi-dao", "dragon", ITEMS),
    ).toMatchObject({ equipped: "dragon" });
    expect((await state()).equipped).toBe("dragon");
    expect((await state("u2")).owned).toEqual(["classic"]);
    await equipCosmetic(db, "u1", "phi-dao", "classic", ITEMS);
    expect((await state()).equipped).toBe("classic");
    consistent();
  });
  it("rolls back ownership and ledger when tickets are insufficient", async () => {
    await earn(1999);
    expect(await buy()).toMatchObject({
      ok: false,
      reason: "insufficient",
      inventory: { balance: 1999, owned: ["classic"] },
    });
    expect(sqlite.query("select count(*) n from game_cosmetic").get()).toEqual({
      n: 0,
    });
    consistent();
  });
  it("racing purchases of the same knife charge once", async () => {
    await earn(5000);
    const results = await Promise.all(Array.from({ length: 6 }, () => buy()));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.reason === "already-owned")).toHaveLength(5);
    expect((await state()).balance).toBe(3000);
    consistent();
  });
  it("racing different purchases cannot overdraw the wallet", async () => {
    await earn(3000);
    const results = await Promise.all([buy("dragon"), buy("moon")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => r.reason === "insufficient")).toHaveLength(1);
    expect((await state()).balance).toBe(1000);
    consistent();
  });
  it("rolls back the debit and ownership if writing the ledger fails", async () => {
    await earn(3000);
    sqlite.run(
      "CREATE TRIGGER reject_cosmetic_ledger BEFORE INSERT ON ticket_ledger WHEN NEW.reason LIKE 'shop:%' BEGIN SELECT RAISE(ABORT, 'ledger-unavailable'); END",
    );
    await expect(buy()).rejects.toThrow();
    expect((await state()).balance).toBe(3000);
    expect((await state()).owned).toEqual(["classic"]);
    consistent();
  });
  it("removes owned cosmetics and equipment when an account is deleted", async () => {
    await earn(3000);
    await buy();
    await equipCosmetic(db, "u1", "phi-dao", "dragon", ITEMS);
    sqlite.run("delete from user where id='u1'");
    expect(sqlite.query("select count(*) n from game_cosmetic").get()).toEqual({
      n: 0,
    });
    expect(
      sqlite.query("select count(*) n from cosmetic_equipment").get(),
    ).toEqual({ n: 0 });
  });
});
