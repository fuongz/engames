import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { Db } from "./leaderboard";
import { readSave, writeSave } from "./saves";
import * as schema from "./schema";

// Runs the real generated migrations on an in-memory SQLite, like leaderboard.test.ts.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");

function freshDb(): Db {
  const sqlite = new Database(":memory:");
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
  sqlite.run(
    "insert into user (id, name, email) values ('u1', 'An', 'an@x.vn'), ('u2', 'Bình', 'binh@x.vn')",
  );
  return drizzle(sqlite, { schema }) as unknown as Db;
}

const slot = { userId: "u1", gameSlug: "tiem-banh-may" };
const day = (n: number) => JSON.stringify({ day: n });
let db: Db;
beforeEach(() => {
  db = freshDb();
});

describe("game saves", () => {
  it("creates a slot at version 1 and bumps it on every write", async () => {
    expect(await readSave(db, "u1", "tiem-banh-may")).toBeNull();
    expect(await writeSave(db, { ...slot, json: day(1), expected: 0 })).toEqual(
      { ok: true, version: 1 },
    );
    expect(await writeSave(db, { ...slot, json: day(2), expected: 1 })).toEqual(
      { ok: true, version: 2 },
    );
    expect(await readSave(db, "u1", "tiem-banh-may")).toEqual({
      json: day(2),
      version: 2,
    });
  });

  it("refuses a write from an older copy and hands back the current one", async () => {
    await writeSave(db, { ...slot, json: day(1), expected: 0 });
    await writeSave(db, { ...slot, json: day(2), expected: 1 });
    expect(await writeSave(db, { ...slot, json: day(9), expected: 1 })).toEqual(
      { ok: false, conflict: { json: day(2), version: 2 } },
    );
    // A second "first save" (another device starting fresh) conflicts too
    expect(
      (await writeSave(db, { ...slot, json: day(1), expected: 0 })).ok,
    ).toBe(false);
  });

  it("keeps players and games apart, and goes with the account", async () => {
    await writeSave(db, { ...slot, json: '"an"', expected: 0 });
    await writeSave(db, {
      userId: "u2",
      gameSlug: "tiem-banh-may",
      json: '"binh"',
      expected: 0,
    });
    await writeSave(db, {
      userId: "u1",
      gameSlug: "other",
      json: '"an-other"',
      expected: 0,
    });
    expect((await readSave(db, "u2", "tiem-banh-may"))?.json).toBe('"binh"');
    expect((await readSave(db, "u1", "tiem-banh-may"))?.json).toBe('"an"');
    await db.delete(schema.user).where(eq(schema.user.id, "u1"));
    expect(await readSave(db, "u1", "tiem-banh-may")).toBeNull();
  });
});
