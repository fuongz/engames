import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { forgetGameIds, gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import * as schema from "./schema";

// Real migrations on an in-memory SQLite, as in leaderboard.test.ts.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");

let sqlite: Database;
let db: Db;

beforeEach(() => {
  forgetGameIds();
  sqlite = new Database(":memory:");
  sqlite.run("pragma foreign_keys = on");
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const stmt of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) sqlite.run(stmt);
    }
  }
  db = drizzle(sqlite, { schema }) as unknown as Db;
});

const rowOf = (slug: string) => sqlite.query("select id from game where slug = ?").get(slug) as { id: number } | null;
const gameCount = () => (sqlite.query("select count(*) n from game").get() as { n: number }).n;

describe("gameIdOf", () => {
  it("finds a game the migration seeded, without adding a row", async () => {
    const before = gameCount();
    expect(await gameIdOf(db, "caro")).toBe(rowOf("caro")?.id as number);
    expect(gameCount()).toBe(before);
  });

  it("registers a new game on first use, once", async () => {
    expect(rowOf("tro-choi-moi")).toBeNull();
    const id = await gameIdOf(db, "tro-choi-moi");
    expect(rowOf("tro-choi-moi")).toEqual({ id });
    forgetGameIds();
    expect(await gameIdOf(db, "tro-choi-moi")).toBe(id);
    expect((sqlite.query("select count(*) n from game where slug = 'tro-choi-moi'").get() as { n: number }).n).toBe(1);
  });

  it("gives an online board its own id", async () => {
    const solo = await gameIdOf(db, "caro");
    const board = await gameIdOf(db, "caro:versus");
    expect(board).not.toBe(solo);
    expect(rowOf("caro:versus")).toEqual({ id: board });
  });

  it("answers repeat calls from the cache", async () => {
    const id = await gameIdOf(db, "xep-tang");
    // Were it asking the database, a renamed row would no longer be found
    sqlite.run("update game set slug = 'renamed' where slug = 'xep-tang'");
    expect(await gameIdOf(db, "xep-tang")).toBe(id);
    forgetGameIds();
    expect(await gameIdOf(db, "xep-tang")).not.toBe(id);
  });

  it("hands concurrent first calls the same id", async () => {
    const ids = await Promise.all(Array.from({ length: 5 }, () => gameIdOf(db, "dong-thoi")));
    expect(new Set(ids).size).toBe(1);
    expect(rowOf("dong-thoi")).toEqual({ id: ids[0] });
  });

  it("stamps created_at in unix ms", async () => {
    await gameIdOf(db, "dong-ho");
    const { created_at } = sqlite.query("select created_at from game where slug = 'dong-ho'").get() as { created_at: number };
    expect(Math.abs(created_at - Date.now())).toBeLessThan(5000);
  });
});
