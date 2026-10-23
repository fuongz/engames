import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { type Db, saveScore, topScores } from "./leaderboard";
import * as schema from "./schema";

// Runs the real generated migrations on an in-memory SQLite, so the upsert SQL
// (partial unique index + CASE on the old row) is checked against an engine.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");

function freshDb(): Db {
  const sqlite = new Database(":memory:");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) sqlite.run(stmt);
    }
  }
  sqlite.run("insert into user (id, name, email) values ('u1', 'An', 'an@x.vn'), ('u2', 'Bình', 'binh@x.vn')");
  return drizzle(sqlite, { schema }) as unknown as Db;
}

const base = { gameSlug: "tinh-tu", detail: null };
let db: Db;
beforeEach(() => {
  db = freshDb();
});

describe("saveScore", () => {
  it("keeps only the best run per signed-in player", async () => {
    const first = await saveScore(db, { ...base, score: 900, name: "An", userId: "u1", detail: "2★" });
    const worse = await saveScore(db, { ...base, score: 400, name: "An", userId: "u1", detail: "1★" });
    expect(worse).toMatchObject({ id: first.id, best: 900, improved: false });
    const better = await saveScore(db, { ...base, score: 1500, name: "An", userId: "u1", detail: "3★" });
    expect(better).toMatchObject({ id: first.id, best: 1500, improved: true });
    const board = await topScores(db, "tinh-tu", 10);
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ name: "An", score: 1500, detail: "3★", signedIn: true });
  });

  it("stores every anonymous run separately", async () => {
    await saveScore(db, { ...base, score: 300, name: "Khách", userId: null });
    await saveScore(db, { ...base, score: 300, name: "Khách", userId: null });
    expect(await topScores(db, "tinh-tu", 10)).toHaveLength(2);
  });

  it("ranks by score, ties to the earlier run, per game", async () => {
    await saveScore(db, { ...base, score: 500, name: "Bình", userId: "u2" });
    await saveScore(db, { ...base, score: 800, name: "Khách", userId: null });
    const mine = await saveScore(db, { ...base, score: 500, name: "An", userId: "u1" });
    expect(mine.rank).toBe(2); // only the 800 is strictly ahead
    await saveScore(db, { gameSlug: "chien-thu", detail: null, score: 9999, name: "Khác", userId: null });
    const board = await topScores(db, "tinh-tu", 10);
    expect(board.map((e) => e.name)).toEqual(["Khách", "Bình", "An"]);
  });
});
