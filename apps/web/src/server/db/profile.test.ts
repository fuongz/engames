import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { BADGES, BADGE_IDS, computeXp, levelOf, titleOf, xpForLevel } from "#/lib/profile";
import { claimCheckin } from "./checkin";
import { forgetGameIds, gameIdOf } from "./games";
import { recordMatch, setConsent } from "./history";
import { type Db, saveScore } from "./leaderboard";
import { readProfile, setProfilePublic } from "./profile";
import * as schema from "./schema";
import { addPlay } from "./stats";
import { depositTickets } from "./tickets";

// Runs the real generated migrations on an in-memory SQLite, like allowance.test.ts.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");

let sqlite: Database;
let db: Db;

beforeEach(() => {
  forgetGameIds();
  sqlite = new Database(":memory:");
  sqlite.run("pragma foreign_keys = on");
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const stmt of readFileSync(join(MIGRATIONS, file), "utf8").split("--> statement-breakpoint"))
      if (stmt.trim()) sqlite.run(stmt);
  sqlite.run(
    "insert into user (id, name, email, created_at) values ('u1', 'An Nguyễn', 'an@x.vn', 1790000000000), ('u2', 'Bình', 'binh@x.vn', 1790000000000)",
  );
  db = drizzle(sqlite, { schema }) as unknown as Db;
});

/** A Vietnam wall-clock time as unix ms (UTC+7). */
const vn = (y: number, mo: number, d: number, h = 0) => Date.UTC(y, mo - 1, d, h - 7);
const NOW = vn(2026, 11, 20, 12);
const CATALOG = ["xu-vu-tru", "caro", "xep-tang", "dao-vang", "co-vua", "o-an-quan"];
const play = (slug: string, now: number, userId = "u1") => addPlay(db, slug, { userId, now });
const badge = async (id: string, viewer = "u1") =>
  (await readProfile(db, "u1", { viewer, catalog: CATALOG, now: NOW }))?.badges.find((b) => b.id === id);

describe("lib/profile", () => {
  it("levels follow 50·L·(L−1) and carry a title", () => {
    expect([1, 2, 5, 10, 30].map(xpForLevel)).toEqual([0, 100, 1_000, 4_500, 43_500]);
    expect(levelOf(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpToNext: 100, title: { vi: "Tân binh", en: "Rookie" } });
    expect(levelOf(99).level).toBe(1);
    expect(levelOf(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpToNext: 200 });
    expect(levelOf(43_500).title).toEqual({ vi: "Huyền thoại arcade", en: "Arcade legend" });
    expect(titleOf(9).en).toBe("Player");
    for (let xp = 0; xp < 60_000; xp += 37) {
      const l = levelOf(xp);
      expect(xpForLevel(l.level) <= xp && xp < xpForLevel(l.level + 1)).toBe(true);
    }
  });

  it("XP weighs every input", () => {
    expect(computeXp({ earnedTotal: 1_000, plays: 3, checkinDays: 2, gamesTried: 1, badges: 1 })).toBe(50 + 30 + 50 + 50 + 100);
    expect(computeXp({ earnedTotal: -5, plays: Number.NaN, checkinDays: 0, gamesTried: 0, badges: 0 })).toBe(0);
  });

  it("every badge has a unique id, both languages and an icon", () => {
    expect(BADGES.map((b) => b.id)).toEqual([...BADGE_IDS]);
    for (const b of BADGES) {
      expect(b.name.vi && b.name.en && b.hint.vi && b.hint.en && b.icon).toBeTruthy();
      expect(["bronze", "silver", "gold"]).toContain(b.tier);
    }
  });
});

describe("readProfile", () => {
  it("is null for an unknown player", async () => {
    expect(await readProfile(db, "nobody", { viewer: null })).toBeNull();
  });

  it("starts at level 1 with every badge locked", async () => {
    const p = await readProfile(db, "u1", { viewer: "u1", catalog: CATALOG, now: NOW });
    expect(p).toMatchObject({
      userId: "u1",
      name: "An Nguyễn",
      joinedAt: 1790000000000,
      level: 1,
      xp: 0,
      xpToNext: 100,
      tickets: { balance: 0, earnedTotal: 0 },
      checkin: { streakDay: 0, todayClaimed: false, totalCheckinDays: 0, shieldAvailableThisWeek: true },
      games: [],
      isOwner: true,
      owner: { email: "an@x.vn", profilePublic: true },
    });
    expect(p?.badges.every((b) => !b.unlocked)).toBe(true);
    expect(p?.badges.map((b) => b.id)).toEqual([...BADGE_IDS]);
  });

  it("never shows a private profile to others, and never an email to anyone but the owner", async () => {
    const pub = await readProfile(db, "u1", { viewer: "u2", now: NOW });
    expect(pub?.isOwner).toBe(false);
    expect(pub?.owner).toBeUndefined();
    expect(JSON.stringify(pub)).not.toContain("an@x.vn");
    expect(JSON.stringify(await readProfile(db, "u1", { viewer: null, now: NOW }))).not.toContain("an@x.vn");

    expect(await setProfilePublic(db, "u1", false)).toBe(false);
    expect(await readProfile(db, "u1", { viewer: "u2", now: NOW })).toBeNull();
    expect(await readProfile(db, "u1", { viewer: null, now: NOW })).toBeNull();
    expect((await readProfile(db, "u1", { viewer: "u1", now: NOW }))?.owner).toEqual({ email: "an@x.vn", profilePublic: false });
    expect(await setProfilePublic(db, "u1", true)).toBe(true);
    expect(await readProfile(db, "u1", { viewer: "u2", now: NOW })).not.toBeNull();
  });

  it("builds per-game stats from plays, scores, saves, online matches and tickets", async () => {
    await play("xep-tang", vn(2026, 11, 10));
    await play("xep-tang", vn(2026, 11, 12));
    await play("xep-tang", vn(2026, 11, 11), "u2"); // someone else's
    await saveScore(db, { gameSlug: "xep-tang", score: 1200, detail: null, name: "An", userId: "u1" });
    // An online board folds into its game without lending it a best score
    await saveScore(db, { gameSlug: "caro:versus", score: 9999, detail: null, name: "An", userId: "u1" });
    await depositTickets(db, { userId: "u1", slug: "xu-vu-tru", tickets: true, amount: 50, now: vn(2026, 11, 9) });
    // A game the catalogue no longer lists is left out
    await play("old-game", vn(2026, 11, 9));
    // The check-in's portal row is never a game
    await claimCheckin(db, "u1", NOW);

    const p = await readProfile(db, "u1", { viewer: null, catalog: CATALOG, now: NOW });
    const games = Object.fromEntries((p?.games ?? []).map((g) => [g.slug, g]));
    expect(Object.keys(games).sort()).toEqual(["caro", "xep-tang", "xu-vu-tru"]);
    expect(games["xep-tang"]).toMatchObject({ plays: 2, bestScore: 1200, firstPlayedAt: vn(2026, 11, 10) });
    expect(games.caro).toMatchObject({ plays: 0, bestScore: null });
    expect(games["xu-vu-tru"]).toMatchObject({ plays: 0, bestScore: null, firstPlayedAt: vn(2026, 11, 9), lastPlayedAt: vn(2026, 11, 9) });
    // Most recent activity first
    const lasts = (p?.games ?? []).map((g) => g.lastPlayedAt);
    expect(lasts).toEqual([...lasts].sort((a, b) => b - a));
    // Without a catalogue every game row the player touched comes back, still never the portal
    const all = await readProfile(db, "u1", { viewer: null, now: NOW });
    expect(all?.games.map((g) => g.slug)).toContain("old-game");
    expect(all?.games.map((g) => g.slug)).not.toContain("portal");
  });

  it("unlocks the play and explorer badges", async () => {
    await play("xu-vu-tru", vn(2026, 11, 1));
    expect(await badge("first-play")).toEqual({ id: "first-play", unlocked: true, unlockedAt: vn(2026, 11, 1) });
    for (const [i, slug] of ["caro", "xep-tang", "dao-vang", "co-vua"].entries()) await play(slug, vn(2026, 11, 2 + i));
    expect(await badge("explorer-5")).toEqual({ id: "explorer-5", unlocked: true, unlockedAt: vn(2026, 11, 5) });
    expect((await badge("explorer-all"))?.unlocked).toBe(false);
    await play("o-an-quan", vn(2026, 11, 6));
    expect(await badge("explorer-all")).toEqual({ id: "explorer-all", unlocked: true, unlockedAt: vn(2026, 11, 6) });
    expect((await badge("plays-100"))?.unlocked).toBe(false);
    for (let i = 0; i < 94; i++) await play("caro", vn(2026, 11, 7));
    expect((await badge("plays-100"))?.unlocked).toBe(true);
  });

  it("unlocks the ticket, jar, favourite and purchase badges", async () => {
    await depositTickets(db, { userId: "u1", slug: "xu-vu-tru", tickets: true, amount: 999, now: vn(2026, 11, 9) });
    expect((await badge("tickets-1k"))?.unlocked).toBe(false);
    await depositTickets(db, { userId: "u1", slug: "xu-vu-tru", tickets: true, amount: 1, now: vn(2026, 11, 9) });
    expect((await badge("tickets-1k"))?.unlocked).toBe(true);
    expect((await badge("tickets-10k"))?.unlocked).toBe(false);

    const gid = await gameIdOf(db, "xu-vu-tru");
    sqlite.run(`insert into jackpot_win (round, user_id, game_id, amount, won_at) values (1, 'u1', ${gid}, 7000, 1793000000000)`);
    expect(await badge("lucky-jar")).toEqual({ id: "lucky-jar", unlocked: true, unlockedAt: 1793000000000 });
    sqlite.run(`insert into favorite (user_id, game_id, created_at) values ('u1', ${gid}, 1793000000)`);
    expect(await badge("first-favorite")).toEqual({ id: "first-favorite", unlocked: true, unlockedAt: 1793000000000 });
    sqlite.run(
      `insert into ticket_ledger (user_id, game_id, delta, reason, created_at) values ('u1', ${gid}, -300, 'shop:xu-vu-tru:coins10', 1793000000500)`,
    );
    expect(await badge("first-purchase")).toEqual({ id: "first-purchase", unlocked: true, unlockedAt: 1793000000500 });
  });

  it("unlocks online-win only for a won match the player kept", async () => {
    await setConsent(db, "u1", true);
    const match = (outcome: "win" | "loss", postedAt: number) =>
      recordMatch(db, {
        gameSlug: "caro",
        mode: "versus",
        roomCode: "ABCD",
        settings: {},
        postedAt,
        players: [
          { seat: 0, name: "An", userId: "u1", score: 1, detail: "", outcome },
          { seat: 1, name: "Khách", userId: null, score: 0, detail: "", outcome: outcome === "win" ? "loss" : "win" },
        ],
      });
    await match("loss", 1);
    expect((await badge("online-win"))?.unlocked).toBe(false);
    await match("win", 2);
    expect((await badge("online-win"))?.unlocked).toBe(true);
  });

  it("unlocks top-10 while a score of theirs sits in a top 10", async () => {
    for (let i = 0; i < 10; i++)
      await saveScore(db, { gameSlug: "xep-tang", score: 1000 + i, detail: null, name: `K${i}`, userId: null });
    await saveScore(db, { gameSlug: "xep-tang", score: 500, detail: null, name: "An", userId: "u1" });
    expect((await badge("top-10"))?.unlocked).toBe(false);
    await saveScore(db, { gameSlug: "xep-tang", score: 1005, detail: null, name: "An", userId: "u1" });
    expect((await badge("top-10"))?.unlocked).toBe(true);
  });

  it("unlocks the streak and shield badges from the check-in, and counts it in XP", async () => {
    const day = (n: number) => vn(2026, 11, 9 + n, 12); // Monday 2026-11-09 + n
    await claimCheckin(db, "u1", day(0));
    await claimCheckin(db, "u1", day(1));
    await claimCheckin(db, "u1", day(3)); // the shield covers Wednesday
    for (let n = 4; n <= 7; n++) await claimCheckin(db, "u1", day(n)); // streak day 7 on n = 7

    const p = await readProfile(db, "u1", { viewer: "u1", catalog: CATALOG, now: day(7) });
    const got = Object.fromEntries((p?.badges ?? []).map((b) => [b.id, b]));
    expect(got["shield-saved"]).toEqual({ id: "shield-saved", unlocked: true, unlockedAt: day(3) });
    expect(got["streak-7"]).toEqual({ id: "streak-7", unlocked: true, unlockedAt: day(7) });
    expect(got["streak-30"]?.unlocked).toBe(false);
    expect(p?.checkin).toMatchObject({ streakDay: 7, todayClaimed: true, totalCheckinDays: 7, nextMilestone: { days: 30, daysLeft: 23 } });
    // Check-in tickets are in the balance, never in earned_total
    expect(p?.tickets).toEqual({ balance: 300 + 100, earnedTotal: 0 });
    // 7 check-ins × 25 + 2 badges × 100
    expect(p?.xp).toBe(7 * 25 + 2 * 100);
    expect(p?.level).toBe(levelOf(375).level);
  });

  describe("permanent badges", () => {
    const stored = () => sqlite.query("select badge_id, unlocked_at from user_badge where user_id = 'u1' order by badge_id").all();
    const topTen = async () => {
      for (let i = 0; i < 10; i++)
        await saveScore(db, { gameSlug: "xep-tang", score: 1000 + i, detail: null, name: `K${i}`, userId: null });
      await saveScore(db, { gameSlug: "xep-tang", score: 1005, detail: null, name: "An", userId: "u1" });
    };

    it("keeps a top-10 badge, its date and its XP after the player falls out of every top 10", async () => {
      await topTen();
      const before = await readProfile(db, "u1", { viewer: "u1", catalog: CATALOG, now: NOW });
      expect(before?.badges.find((b) => b.id === "top-10")?.unlocked).toBe(true);
      const at = before?.badges.find((b) => b.id === "top-10")?.unlockedAt;
      expect(at).toBeGreaterThan(0);
      // Ten better scores push theirs out
      for (let i = 0; i < 10; i++)
        await saveScore(db, { gameSlug: "xep-tang", score: 5000 + i, detail: null, name: `L${i}`, userId: null });
      const after = await readProfile(db, "u1", { viewer: "u1", catalog: CATALOG, now: NOW + 1000 });
      expect(after?.badges.find((b) => b.id === "top-10")).toEqual({ id: "top-10", unlocked: true, unlockedAt: at });
      expect(after?.xp).toBe(before?.xp ?? 0);
      // Even a public visitor sees it
      const pub = await readProfile(db, "u1", { viewer: null, catalog: CATALOG, now: NOW });
      expect(pub?.badges.find((b) => b.id === "top-10")?.unlocked).toBe(true);
      expect(pub?.xp).toBe(before?.xp ?? 0);
    });

    it("never writes for a public viewer, and only the owner's view records", async () => {
      await topTen();
      await readProfile(db, "u1", { viewer: null, catalog: CATALOG, now: NOW });
      await readProfile(db, "u1", { viewer: "u2", catalog: CATALOG, now: NOW });
      expect(stored()).toEqual([]);
      await readProfile(db, "u1", { viewer: "u1", catalog: CATALOG, now: NOW });
      expect(stored().map((r) => (r as { badge_id: string }).badge_id)).toEqual(["first-play", "top-10"]);
    });

    it("is harmless when views race, and never rewrites a stored date", async () => {
      await topTen();
      await Promise.all([1, 2, 3].map((n) => readProfile(db, "u1", { viewer: "u1", catalog: CATALOG, now: NOW + n })));
      const rows = stored();
      expect(rows).toHaveLength(2); // first-play and top-10
      await readProfile(db, "u1", { viewer: "u1", catalog: CATALOG, now: NOW + 99_999 });
      expect(stored()).toEqual(rows);
    });

    it("cascades with the user", async () => {
      await topTen();
      await readProfile(db, "u1", { viewer: "u1", catalog: CATALOG, now: NOW });
      expect(stored()).toHaveLength(2);
      sqlite.run("delete from user where id = 'u1'");
      expect(stored()).toEqual([]);
    });
  });
});
