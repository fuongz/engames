import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { consentOf, historyFor, type MatchInput, recordMatch, setConsent } from "./history";
import type { Db } from "./leaderboard";
import * as schema from "./schema";
import { addPlay, playCounts } from "./stats";

// Real migrations on an in-memory SQLite, as in leaderboard.test.ts.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");

function freshDb(): Db {
  const sqlite = new Database(":memory:");
  sqlite.run("pragma foreign_keys = on");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) sqlite.run(stmt);
    }
  }
  sqlite.run("insert into user (id, name, email) values ('u1', 'An', 'an@x.vn'), ('u2', 'Bình', 'binh@x.vn')");
  return drizzle(sqlite, { schema }) as unknown as Db;
}

let db: Db;
beforeEach(() => {
  db = freshDb();
});

const caroMatch = (postedAt: number, u2: string | null = "u2"): MatchInput => ({
  gameSlug: "caro",
  mode: "versus",
  roomCode: "ABC234",
  settings: { bestOf: "5" },
  postedAt,
  players: [
    { seat: 0, name: "An", userId: "u1", score: 1200, detail: "Thắng 3–1 với Bình", outcome: "win" },
    { seat: 1, name: "Bình", userId: u2, score: 250, detail: "Thua 1–3 với An", outcome: "loss" },
  ],
});

describe("play counts", () => {
  it("counts plays per game", async () => {
    expect(await playCounts(db)).toEqual({});
    await addPlay(db, "caro");
    expect(await addPlay(db, "caro")).toBe(2);
    await addPlay(db, "noi-thu");
    expect(await playCounts(db)).toEqual({ caro: 2, "noi-thu": 1 });
  });
});

describe("match history", () => {
  it("remembers whether a player agreed", async () => {
    expect(await consentOf(db, "u1")).toBeNull();
    await setConsent(db, "u1", false);
    expect(await consentOf(db, "u1")).toBe(false);
    await setConsent(db, "u1", true);
    expect(await consentOf(db, "u1")).toBe(true);
  });

  it("saves nothing when no player agreed", async () => {
    await setConsent(db, "u2", false);
    expect(await recordMatch(db, caroMatch(1))).toBeNull();
    expect(await historyFor(db, "u1", 10)).toEqual([]);
  });

  it("keeps the match only for players who agreed, with everyone's names", async () => {
    await setConsent(db, "u1", true);
    await setConsent(db, "u2", false);
    expect(await recordMatch(db, caroMatch(1))).not.toBeNull();
    const [entry] = await historyFor(db, "u1", 10);
    expect(entry).toMatchObject({
      gameSlug: "caro",
      mode: "versus",
      settings: { bestOf: "5" },
      you: { seat: 0, score: 1200, outcome: "win" },
      others: [{ seat: 1, name: "Bình", outcome: "loss" }],
    });
    expect(await historyFor(db, "u2", 10)).toEqual([]);
  });

  it("ignores a replayed post and pages newest first", async () => {
    await setConsent(db, "u1", true);
    await recordMatch(db, caroMatch(1, null));
    expect(await recordMatch(db, caroMatch(1, null))).toBeNull();
    await recordMatch(db, caroMatch(2, null));
    const page = await historyFor(db, "u1", 1);
    expect(page).toHaveLength(1);
    const next = await historyFor(db, "u1", 10, page[0].id);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBeLessThan(page[0].id);
  });
});

describe("favourites", () => {
  it("adds once, lists newest first, and removes", async () => {
    const { favoritesOf, setFavorite } = await import("./favorites");
    await setFavorite(db, "u1", "caro", true);
    await setFavorite(db, "u1", "caro", true);
    expect(await favoritesOf(db, "u1")).toEqual(["caro"]);
    await setFavorite(db, "u1", "noi-thu", true);
    expect((await favoritesOf(db, "u1")).sort()).toEqual(["caro", "noi-thu"]);
    await setFavorite(db, "u1", "caro", false);
    expect(await favoritesOf(db, "u1")).toEqual(["noi-thu"]);
    expect(await favoritesOf(db, "u2")).toEqual([]);
  });
});
