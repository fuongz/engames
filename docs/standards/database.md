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

No other table stores a slug. `score`, `game_save`, `game_stat`,
`user_game_stat`, `online_match`, `favorite`, `coupon`, `coupon_redemption`,
`allowance_grant`, `ticket_ledger`, `pending_grant`, `jackpot_contribution` and
`jackpot_win` each have a `game_id` referencing `game(id)` (`coupon.game_id` may
be NULL: any game). See [`allowance.md`](allowance.md), [`tickets.md`](tickets.md)
and [`jackpot.md`](jackpot.md) for the last five, and [`checkin.md`](checkin.md)
§6 for `user_game_stat` (per-player play counts, migration 0011).

### The reserved `portal` row

Migration 0011 inserts one row that is not a game: slug **`portal`**
(`PORTAL_SLUG` in `apps/web/src/server/db/games.ts`). The portal's own ticket
payouts point at it: the daily check-in writes `ticket_ledger` rows (reasons
`checkin`, `checkin:milestone:<n>`, see [`checkin.md`](checkin.md)),
`ticket_ledger.game_id` is NOT NULL, and a check-in comes from no game.

Why a row and not a nullable column: dropping a NOT NULL in SQLite means
rebuilding `ticket_ledger` (copy every row, recreate both indexes, keep
`pending_grant.ledger_id` pointing at the right ids, all inside D1's one
migration transaction) for a column every existing query treats as required. A
reserved row changes no table. It is safe because **no query lists the `game`
table to players**: every read that hands slugs back starts from a per-game table
and joins `game` (`playCounts` from `game_stat`, `favoritesOf` from `favorite`,
`historyFor` from `online_match`, `jackpotState` from `jackpot_win`), and the
portal row never appears in those. The weekly board is only ever asked for a
catalogue slug, and the profile's per-game stats drop `portal` by name.

Rules:

- **Never add a game folder called `portal`.** The boundaries validate slugs
  against the catalogue, so `portal` is never accepted as a game today.
- **A new query that lists `game` rows directly filters `slug != 'portal'`.**
- **Another portal-level payout reuses this row** with its own `reason`.

### `user.profile_public`

Integer boolean, NOT NULL, default 1 (migration 0011): whether other players may
open the player's profile (`/u/<id>`). A Better Auth additional field with
`input: false`, so only `setProfilePublicFn` (`apps/web/src/server/profile.ts`)
changes it, never a client `updateUser`. Private: `getPublicProfileFn` returns
null to everyone but the owner, and the leaderboards report `profilePublic:
false` so the UI does not link the name. See [`checkin.md`](checkin.md) §6.

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

### `user_badge`

Badges a player has unlocked, kept forever (migration 0012):
`user_id` (`ON DELETE CASCADE`), `badge_id`, `unlocked_at` (unix ms), primary key
`(user_id, badge_id)`. Written only by `readProfile` when the owner views their
own profile, with `ON CONFLICT DO NOTHING`; see `checkin.md` §6 for the rules and
the SQL to inspect or reset one player's badges.

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
