# Allowance

A free, server-granted payout of a game's own currency: a **welcome** once per
account, then a **daily** once per Vietnam day. The server records every grant,
so a player cannot claim twice by reloading, racing two tabs or changing the
device clock.

---

## TL;DR

- **A game opts in** with `manifest.allowance = { kind, welcome, daily }` and calls
  `ctx.allowance.claim()` (signed-in players only, never online).
- **The first claim grants the welcome only.** The first daily comes the next
  Vietnam day, then one per Vietnam day (00:00 Asia/Ho_Chi_Minh, UTC+7).
- **The server decides and records.** `claimAllowance`
  (`apps/web/src/server/db/allowance.ts`) inserts the rows; only grants created
  by *this* call come back.
- **A game persists a grant immediately.** It is already recorded on the server
  and is never sent again.

---

## 1. The model

| Column of `allowance_grant` | |
| --- | --- |
| `user_id` | the player (`user.id`); rows go with the account (`ON DELETE CASCADE`) |
| `game_id` | the game (`game.id`, see [`database.md`](database.md)) |
| `type` | `welcome` or `daily` |
| `day` | `first` for the welcome; the Vietnam date `YYYY-MM-DD` for a daily |
| `kind` | the currency granted (`manifest.allowance.kind`), for reading the table by hand |
| `amount` | how much was granted |
| `granted_at` | unix **ms** |

The primary key is `(user_id, game_id, type, day)`: one welcome per player per
game, ever, and one daily per Vietnam day. A CHECK rejects any other `type`, a
welcome whose `day` is not `first`, and a daily whose `day` is not a date.

### Why the first claim is the welcome alone

Granting welcome + daily together hands a new player one bigger lump and makes
the daily feel like nothing new on day one. Starting the dailies the next Vietnam
day gives the player a reason to come back tomorrow, and `nextDailyAt` already
tells the game when.

### Race safety

Each grant is one `INSERT … ON CONFLICT DO NOTHING … RETURNING`. However many
claims race, exactly one row lands per key and only the call whose insert landed
sees it returned. The daily is an `INSERT … SELECT … FROM allowance_grant WHERE`
*a welcome exists that was granted before today's Vietnam midnight*, so the "no
daily on the welcome day" rule is decided inside the same statement that writes
the row: a racing first claim that loses the welcome cannot slip a daily in. The
comment above `claimAllowance` has the full argument; `allowance.test.ts` races it.

A game with `welcome: 0` still gets its welcome row (amount 0, not returned):
the dailies key off it.

---

## 2. How a game opts in

```ts
// packages/games/src/<slug>/manifest.ts
const manifest: GameManifest = {
  // …
  allowance: { kind: "coins", welcome: 100, daily: 50 },
};
```

```ts
// packages/games/src/<slug>/game.ts
export function setup(rt: Runtime): GameHooks {
  const { storage, allowance } = rt.game;

  // Missing signed out, outside the portal, and in an online match
  void allowance?.claim().then(({ grants, nextDailyAt }) => {
    for (const g of grants) if (g.kind === "coins") state.coins += g.amount;
    if (grants.length > 0) save(); // NOW: the server will never send these again
    state.nextDailyAt = nextDailyAt; // a countdown, if the game shows one
  });
  // …
}
```

- `claim()` is cheap and idempotent: call it at start, and again when the
  countdown reaches `nextDailyAt` if the game stays open.
- `grants` is empty when nothing is due. Each grant is
  `{ kind, amount, type: "welcome" | "daily" }`.
- The server refuses (`claimAllowanceFn`, `apps/web/src/server/allowance.ts`)
  any slug whose manifest has no `allowance`, and anyone signed out
  (`sign-in-required`).

---

## 3. Inspecting and resetting (SQL)

Run from `apps/web`. The database is `prod-engames`: `--local` for the dev
database, `--remote` for production. Pass SQL through a quoted heredoc (see
[`coupons.md`](coupons.md) §3 for why):

```sh
cd apps/web
bunx wrangler d1 migrations apply prod-engames --local   # once, for 0008
bunx wrangler d1 execute prod-engames --local --command "$(cat <<'SQL'
SELECT 1;
SQL
)"
# Same with --remote for production.
```

### One player's grants

```sql
SELECT g.slug, a.type, a.day, a.kind, a.amount,
       datetime(a.granted_at / 1000, 'unixepoch', '+7 hours') AS granted_vn
FROM allowance_grant a
JOIN game g ON g.id = a.game_id
JOIN user u ON u.id = a.user_id
WHERE u.email = 'player@example.com'
ORDER BY a.granted_at DESC;
```

### Today's dailies, per game

```sql
SELECT g.slug, count(*) AS players, sum(a.amount) AS granted
FROM allowance_grant a JOIN game g ON g.id = a.game_id
WHERE a.type = 'daily' AND a.day = date('now', '+7 hours')
GROUP BY g.slug;
```

### Reset

Deleting a row makes that grant due again. Deleting the welcome alone also
re-runs the "welcome day" rule: the next claim grants the welcome and no daily.

```sql
-- Let a player claim today's daily again in one game
DELETE FROM allowance_grant
WHERE user_id = (SELECT id FROM user WHERE email = 'player@example.com')
  AND game_id = (SELECT id FROM game WHERE slug = 'xu-vu-tru')
  AND type = 'daily' AND day = date('now', '+7 hours')
RETURNING type, day;

-- Start a player over in one game (welcome and every daily)
DELETE FROM allowance_grant
WHERE user_id = (SELECT id FROM user WHERE email = 'player@example.com')
  AND game_id = (SELECT id FROM game WHERE slug = 'xu-vu-tru')
RETURNING type, day;
```

Resetting the server does **not** take back what the game already saved: the
currency lives in the game's own save.
