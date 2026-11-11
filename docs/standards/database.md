# Database

The portal's D1 database: where games live in it, and how to change a table that
already holds data. The schema itself is `apps/web/src/server/db/schema.ts`;
coupons have their own doc ([`coupons.md`](coupons.md)).

---

## The `game` table

| Column | |
| --- | --- |
| `id` | integer primary key, autoincrement |
| `slug` | text, unique: the folder name under `packages/games/src/`, or an online board key (`"caro:versus"`, see [`online-multiplayer.md`](online-multiplayer.md) §9) |
| `created_at` | unix ms, defaults to now |

No other table stores a slug. `score`, `game_save`, `game_stat`, `online_match`,
`favorite`, `coupon`, `coupon_redemption`, `allowance_grant` and `ticket_ledger`
each have a `game_id` referencing `game(id)` (`coupon.game_id` may be NULL: any
game). See [`allowance.md`](allowance.md) and [`tickets.md`](tickets.md) for the
last two.

**A new game gets its row by itself.** `gameIdOf(db, slug)`
(`apps/web/src/server/db/games.ts`) looks the slug up, inserts it with
`INSERT OR IGNORE` on a miss, and caches the id for the life of the isolate. The
first score, save, play count or favourite of a new game creates the row, so
adding a game needs no migration and no seed. The same goes for a new online
board key.

Rules for server code:

- **Callers keep passing slugs.** Every query function in `server/db/` takes a
  slug and resolves it with `gameIdOf`; reads that hand a slug back (favourites,
  play counts, match history) join `game`. The boundary files and every type a
  client sees speak slugs only.
- **Only validated slugs reach `gameIdOf`.** Each new slug becomes a row, so the
  boundary checks it against the catalogue (`findGame`, `findOnlineGame`) first,
  as it already does.
- **Never delete or renumber a `game` row.** Other tables reference it, and the
  id cache assumes an id never changes. A game removed from the catalogue keeps
  its row and its data; the portal just stops listing it.
- **Tests** build a fresh database per case, so they call `forgetGameIds()` first.

For hand-written SQL (the admin, `wrangler d1 execute`), name a game by
`(SELECT id FROM game WHERE slug = 'xu-vu-tru')`, or join `game` to show the
slug:

```sql
SELECT g.slug, s.plays FROM game_stat s JOIN game g ON g.id = s.game_id ORDER BY s.plays DESC;
```

---

## Migrations that move data

`bun run db:generate` writes the SQL; `bun run db:migrate:local|remote` applies
it. A migration that has been applied is never edited. A new one that rebuilds a
table holding data may need hand-editing **before** it is applied, as 0007 (the
`game` table) was: drizzle-kit's rebuild copies columns by name and knows nothing
about the new ones. Things to get right, which 0007 shows:

- **D1 enforces foreign keys inside migrations.** It runs the file as one
  transaction, where `PRAGMA foreign_keys=OFF` (what drizzle-kit writes) does
  nothing. Use `PRAGMA defer_foreign_keys = on` at the top and `= off` at the end;
  that only postpones the checks to the commit.
- **`DROP TABLE` deletes every row first**, and that still fires `ON DELETE
  cascade` (deferring does not stop it) and still counts orphans at the commit.
  Before dropping a table other tables reference (`online_match`, `coupon`), set
  the child rows aside in a `__keep_` table, drop the child, rebuild the parent,
  then recreate the child and copy the rows back.
- **Fill new NOT NULL columns through a LEFT JOIN**, so a row that fails to map
  fails the migration loudly instead of being dropped by an inner join.
- **Recreate every index** of a table you rebuild: they go with `DROP TABLE`.
- **Test it with data.** `apps/web/src/server/db/migrate-game-id.test.ts` fills a
  database at 0006 with rows in every table, applies 0007 inside one transaction
  with foreign keys on (like D1) and checks that every row survived. Copy it for
  the next one.
