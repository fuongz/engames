import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Migration 0007 moves every game slug into the `game` table. This fills a
// database at 0006 with realistic rows in all seven tables, applies 0007, and
// checks that every row survived and points at the game it named before.
const MIGRATIONS = join(import.meta.dir, "../../../drizzle");
const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const GAME_ID = files.findIndex((f) => f.startsWith("0007_"));

const statements = (file: string) =>
  readFileSync(join(MIGRATIONS, file), "utf8")
    .split("--> statement-breakpoint")
    .filter((s) => s.trim());

/** The catalogue as 0007 seeds it (packages/games/src on the day it shipped). */
const CATALOGUE = [
  "caro",
  "co-ca-ngua",
  "co-lat",
  "co-ty-phu",
  "co-vua",
  "dao-vang",
  "khu-cach-ly",
  "ky-tuc-xa",
  "meo-vu-tru",
  "noi-thu",
  "o-an-quan",
  "phi-doi",
  "rot-nuoc",
  "tiem-banh-may",
  "xep-tang",
  "xu-vu-tru",
];

function atSix() {
  const sqlite = new Database(":memory:");
  sqlite.run("pragma foreign_keys = on");
  for (const file of files.slice(0, GAME_ID))
    for (const stmt of statements(file)) sqlite.run(stmt);
  return sqlite;
}

/** Rows a live database at 0006 could hold: archived games, an online board, a slug nobody knows, a coupon for any game. */
function fill(sqlite: Database) {
  sqlite.run(`insert into user (id, name, email) values
    ('u1', 'An', 'an@x.vn'), ('u2', 'Bình', 'binh@x.vn'), ('u3', 'Chi', 'chi@x.vn')`);
  sqlite.run(`insert into score (id, game_slug, user_id, name, score, detail, created_at) values
    (1, 'xep-tang', 'u1', 'An', 900, 'Tầng 12', 1790000000),
    (2, 'xep-tang', null, 'Khách', 300, null, 1790000100),
    (3, 'xep-tang', null, 'Khách', 300, null, 1790000200),
    (4, 'tinh-tu', 'u1', 'An', 1500, '3★', 1780000000),
    (5, 'caro:versus', 'u2', 'Bình', 1200, 'Thắng 3–1', 1791000000),
    (7, 'ghost-game', 'u3', 'Chi', 42, null, 1791000500)`);
  sqlite.run(`insert into game_save (user_id, game_slug, slot, data, version, updated_at) values
    ('u1', 'tiem-banh-may', 0, '{"day":4}', 3, 1791000000),
    ('u1', 'tiem-banh-may', 2, '{"day":9}', 1, 1791000001),
    ('u2', 'tiem-banh-may', 0, '{"day":1}', 1, 1791000002),
    ('u1', 'ghost-game', 0, '"x"', 7, 1791000003)`);
  sqlite.run(`insert into game_stat (game_slug, plays) values
    ('caro', 1200), ('xep-tang', 3), ('tinh-tu', 40), ('ghost-game', 1)`);
  sqlite.run(`insert into online_match (id, game_slug, mode, room_code, settings, posted_at, played_at) values
    (1, 'caro', 'versus', 'ABC234', '{"bestOf":"5"}', 1791000000000, 1791000000),
    (2, 'caro', 'versus', 'ABC234', '{"bestOf":"3"}', 1791000900000, 1791000900),
    (5, 'vo-dai', 'coop', 'XYZ789', '{}', 1785000000000, 1785000000)`);
  sqlite.run(`insert into online_match_player (match_id, seat, name, user_id, score, detail, outcome) values
    (1, 0, 'An', 'u1', 1200, 'Thắng 3–1 với Bình', 'win'),
    (1, 1, 'Bình', null, 250, 'Thua 1–3 với An', 'loss'),
    (2, 0, 'An', 'u1', 500, 'Hoà', 'draw'),
    (2, 1, 'Chi', 'u3', 500, 'Hoà', 'draw'),
    (5, 0, 'An', 'u1', 800, 'Đợt 12', null),
    (5, 1, 'Bot', null, 0, '', null)`);
  sqlite.run(`insert into favorite (user_id, game_slug, created_at) values
    ('u1', 'caro', 1791000000), ('u1', 'tinh-tu', 1781000000), ('u2', 'xu-vu-tru', 1791000000)`);
  sqlite.run(`insert into coupon (code, game, rewards, max_uses, uses, expires_at, disabled, note, created_at) values
    ('XUONLY', 'xu-vu-tru', '[{"kind":"coins","amount":100}]', 5, 1, null, 0, 'fanpage', 1791000000000),
    ('TET2027', null, '[{"kind":"coins","amount":50}]', 100, 2, 1803833999000, 0, 'Tết', 1791000000001),
    ('OLD', 'tinh-tu', '[{"kind":"stars","amount":3}]', 1, 1, null, 1, null, 1781000000000)`);
  sqlite.run(`insert into coupon_redemption (code, user_id, game, rewards, redeemed_at) values
    ('XUONLY', 'u1', 'xu-vu-tru', '[{"kind":"coins","amount":100}]', 1791000000500),
    ('TET2027', 'u1', 'xep-tang', '[{"kind":"coins","amount":50}]', 1791000000600),
    ('TET2027', 'u2', 'xu-vu-tru', '[{"kind":"coins","amount":50}]', 1791000000700),
    ('OLD', 'u3', 'tinh-tu', '[{"kind":"stars","amount":3}]', 1781000000500)`);
}

/**
 * Every row of the seven tables, with the game written as a slug under its old
 * column name. Before 0007 that is the column itself; after, the join on game.
 */
const QUERIES = {
  before: {
    score: "select id, game_slug, user_id, name, score, detail, created_at from score order by id",
    game_save: "select user_id, game_slug, slot, data, version, updated_at from game_save order by user_id, game_slug, slot",
    game_stat: "select game_slug, plays from game_stat order by game_slug",
    online_match: "select id, game_slug, mode, room_code, settings, posted_at, played_at from online_match order by id",
    online_match_player: "select * from online_match_player order by match_id, seat",
    favorite: "select user_id, game_slug, created_at from favorite order by user_id, game_slug",
    coupon: "select code, game, rewards, max_uses, uses, expires_at, disabled, note, created_at from coupon order by code",
    coupon_redemption: "select code, user_id, game, rewards, redeemed_at from coupon_redemption order by code, user_id",
  },
  after: {
    score:
      "select s.id, g.slug as game_slug, s.user_id, s.name, s.score, s.detail, s.created_at from score s left join game g on g.id = s.game_id order by s.id",
    game_save:
      "select s.user_id, g.slug as game_slug, s.slot, s.data, s.version, s.updated_at from game_save s left join game g on g.id = s.game_id order by s.user_id, g.slug, s.slot",
    game_stat:
      "select g.slug as game_slug, s.plays from game_stat s left join game g on g.id = s.game_id order by g.slug",
    online_match:
      "select m.id, g.slug as game_slug, m.mode, m.room_code, m.settings, m.posted_at, m.played_at from online_match m left join game g on g.id = m.game_id order by m.id",
    online_match_player: "select * from online_match_player order by match_id, seat",
    favorite:
      "select f.user_id, g.slug as game_slug, f.created_at from favorite f left join game g on g.id = f.game_id order by f.user_id, g.slug",
    coupon:
      "select c.code, g.slug as game, c.rewards, c.max_uses, c.uses, c.expires_at, c.disabled, c.note, c.created_at from coupon c left join game g on g.id = c.game_id order by c.code",
    coupon_redemption:
      "select r.code, r.user_id, g.slug as game, r.rewards, r.redeemed_at from coupon_redemption r left join game g on g.id = r.game_id order by r.code, r.user_id",
  },
} as const;

type Table = keyof typeof QUERIES.before;
const TABLES = Object.keys(QUERIES.before) as Table[];

const dump = (sqlite: Database, when: "before" | "after") =>
  Object.fromEntries(TABLES.map((t) => [t, sqlite.query(QUERIES[when][t]).all()])) as Record<Table, Record<string, unknown>[]>;

/** 0007 the way D1 runs it: one transaction, foreign keys enforced (PRAGMA foreign_keys is a no-op inside it). */
function applyLikeD1(sqlite: Database) {
  sqlite.run("begin");
  for (const stmt of statements(files[GAME_ID])) sqlite.run(stmt);
  sqlite.run("commit");
}

/** 0007 statement by statement in autocommit, the way the other tests apply migrations. */
function applyAutocommit(sqlite: Database) {
  for (const stmt of statements(files[GAME_ID])) sqlite.run(stmt);
}

describe.each([
  ["in one transaction, like D1", applyLikeD1],
  ["statement by statement", applyAutocommit],
])("migration 0007 (game table), %s", (_, apply) => {
  function migrated() {
    const sqlite = atSix();
    fill(sqlite);
    const before = dump(sqlite, "before");
    apply(sqlite);
    return { sqlite, before, after: dump(sqlite, "after") };
  }

  it("is the migration right after 0006", () => {
    expect(files[GAME_ID - 1]).toStartWith("0006_");
  });

  it("keeps every row of every table, each pointing at the game it named", () => {
    const { before, after } = migrated();
    for (const t of TABLES) {
      expect(before[t].length).toBeGreaterThan(0);
      expect({ [t]: after[t].length }).toEqual({ [t]: before[t].length });
      expect({ [t]: after[t] }).toEqual({ [t]: before[t] });
    }
    // The null "any game" coupon stays null
    expect(after.coupon.find((c) => c.code === "TET2027")?.game).toBeNull();
  });

  it("gives every slug in use, and the catalogue, exactly one row", () => {
    const { sqlite } = migrated();
    const slugs = (sqlite.query("select slug from game order by slug").all() as { slug: string }[]).map((r) => r.slug);
    const inUse = ["caro:versus", "ghost-game", "tinh-tu", "vo-dai"];
    expect(slugs).toEqual([...new Set([...CATALOGUE, ...inUse])].sort());
    const row = sqlite.query("select id, created_at from game where slug = 'rot-nuoc'").get() as { id: number; created_at: number };
    expect(row.id).toBeGreaterThan(0);
    expect(Math.abs(row.created_at - Date.now())).toBeLessThan(60_000);
  });

  it("leaves no slug column, no scratch table and no broken reference", () => {
    const { sqlite } = migrated();
    const tables = (sqlite.query("select name from sqlite_master where type = 'table'").all() as { name: string }[]).map((r) => r.name);
    expect(tables.filter((n) => n.startsWith("__"))).toEqual([]);
    for (const t of [...TABLES, "game"]) {
      const cols = (sqlite.query(`pragma table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
      expect({ [t]: cols.filter((c) => c === "game_slug" || c === "game") }).toEqual({ [t]: [] });
    }
    expect(sqlite.query("pragma foreign_key_check").all()).toEqual([]);
    expect(sqlite.query("pragma integrity_check").get()).toEqual({ integrity_check: "ok" });
  });

  it("keeps every index, now on game_id, and the coupon CHECKs", () => {
    const { sqlite } = migrated();
    const indexes = Object.fromEntries(
      (sqlite.query("select name, sql from sqlite_master where type = 'index' and sql is not null").all() as { name: string; sql: string }[]).map(
        (r) => [r.name, r.sql],
      ),
    );
    expect(Object.keys(indexes).sort()).toEqual(
      [
        "account_user_id_idx",
        "coupon_redemption_user_idx",
        "game_slug_unique",
        "online_match_player_user_idx",
        "online_match_post_uq",
        "score_game_rank_idx",
        "score_game_user_uq",
        "session_token_unique",
        "session_user_id_idx",
        "user_email_unique",
        "verification_identifier_idx",
      ].sort(),
    );
    expect(indexes.score_game_rank_idx).toContain("(`game_id`,`score`)");
    expect(indexes.score_game_user_uq).toContain("(`game_id`,`user_id`) WHERE user_id is not null");
    // The upsert target still refuses a second signed-in row on the same board
    const xep = (sqlite.query("select id from game where slug = 'xep-tang'").get() as { id: number }).id;
    expect(() => sqlite.run(`insert into score (game_id, user_id, name, score) values (${xep}, 'u1', 'An', 1)`)).toThrow();
    expect(() => sqlite.run(`insert into coupon (code, rewards) values ('lower', '[]')`)).toThrow();
    expect(() => sqlite.run(`insert into coupon (code, rewards) values ('OBJ', '{}')`)).toThrow();
    // A game_id must name a game
    expect(() => sqlite.run(`insert into game_stat (game_id, plays) values (9999, 1)`)).toThrow();
  });

  it("keeps the cascades: a match takes its players, an account its rows", () => {
    const { sqlite } = migrated();
    sqlite.run("delete from online_match where id = 1");
    expect(sqlite.query("select count(*) n from online_match_player where match_id = 1").get()).toEqual({ n: 0 });
    expect(sqlite.query("select count(*) n from online_match_player").get()).toEqual({ n: 4 });
    sqlite.run("delete from user where id = 'u3'");
    expect(sqlite.query("select count(*) n from coupon_redemption where user_id = 'u3'").get()).toEqual({ n: 0 });
    expect(sqlite.query("select user_id from online_match_player where match_id = 2 and seat = 1").get()).toEqual({ user_id: null });
  });

  it("keeps the ids counting up from the highest one", () => {
    const { sqlite } = migrated();
    const caro = (sqlite.query("select id from game where slug = 'caro'").get() as { id: number }).id;
    const { id } = sqlite.query(`insert into score (game_id, name, score) values (${caro}, 'Mới', 1) returning id`).get() as { id: number };
    expect(id).toBe(8);
    const match = sqlite
      .query(`insert into online_match (game_id, mode, room_code, posted_at) values (${caro}, 'versus', 'NEW234', 1) returning id`)
      .get() as { id: number };
    expect(match.id).toBe(6);
  });
});
