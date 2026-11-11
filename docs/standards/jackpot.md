# Lucky Jar (Hũ may mắn)

One jackpot shared by every arcade game that opts in. Games feed the jar as
players spend their in-game coins; now and then a game asks for a roll, and the
server decides, server-side, whether that player wins the whole jar. A win is
paid in **shared arcade tickets** ([`tickets.md`](tickets.md)), and the jar
starts over at its seed.

Keep the wording soft and non-casino: a jar that fills and tips, not "bets",
"odds" or "payouts". The UI says "Hũ may mắn" / "Lucky Jar" and "Đại sảnh Hũ may
mắn" / "Lucky Jar Hall".

---

## TL;DR

- **A game opts in** with `manifest.jackpot = true` (and `tickets: true`, which
  `conventions.test.ts` requires) and uses `ctx.jackpot`: `contribute(coins)`,
  `roll()`, `state()`, `onState(cb)`. Never in an online match.
- **One pool** (`jackpot_pool`, row `'arcade'`): starts at the **seed (5,000)**,
  grows **2 tickets per coin**, never passes the **cap (50,000)**.
- **Caps** (`apps/web/src/lib/jackpot.ts`): one player feeds at most **2,000
  tickets per game per Vietnam day**, and rolls at most **8 times per Vietnam
  day** across every game.
- **The chance** of a roll is `p = 0.005 + 0.995 · fill³`, `fill = (pool − seed)
  / (cap − seed)`; `p = 1` at the cap, so a full jar always tips.
- **A win** is claimed with one atomic `UPDATE … WHERE round = :round`: two
  racing rolls can never both win. The winner's tickets land in the shared
  wallet as a `ticket_ledger` row with reason **`jackpot`**, which is **not
  earnings**: it never counts toward the daily earn cap, `earned_total` or the
  weekly board.
- **The portal** shows a ticker in the top bar (pool + recent winners, a crawl
  announcing a new win once) and the Lucky Jar Hall (pool, cap, last 20
  winners). Hidden until some game has `jackpot: true`. Works signed out.

---

## 1. The model

| Table | What it holds |
| --- | --- |
| `jackpot_pool` | `id` (`'arcade'`, the one row, inserted by migration 0010), `pool`, `seed` (default 5,000), `cap` (default 50,000), `round` (default 1: the jackpot being played for), `updated_at` (unix **ms**). A CHECK refuses `pool > cap`, `cap <= seed` and negatives |
| `jackpot_contribution` | `user_id`, `game_id`, `day` (Vietnam `YYYY-MM-DD`), `tickets`. Primary key `(user_id, game_id, day)`: the daily contribution cap's ledger |
| `jackpot_roll` | `user_id`, `day`, `count`. Primary key `(user_id, day)`: the roll rate limit |
| `jackpot_win` | `id`, `round` (unique: one winner per round), `user_id`, `game_id`, `amount`, `won_at` (unix **ms**). Indexed on `won_at`: the Hall |

Every `user_id` cascades on account deletion (a deleted player's wins leave the
Hall). The day is the Vietnam day, as for the allowance and tickets.

**Where the tickets come from.** Contributions are paid by the house: feeding
the jar takes nothing from the player's wallet. The game decides what counts as
"coins eaten by the jar" (for example every coin a machine swallows); the
portal turns coins into tickets (×2) and the server caps them.

### Query functions (`apps/web/src/server/db/jackpot.ts`)

All take `db` as a parameter, and are tested on bun:sqlite with the real
migrations (`jackpot.test.ts`).

| Function | Returns |
| --- | --- |
| `contribute(db, { userId, slug, coins, now })` | `{ accepted, pool }`: `accepted` is the tickets that counted (`coins × 2`, less near the daily cap, 0 once it is used up) |
| `roll(db, { userId, slug, now, rand? })` | `{ won, amount?, pool, round, limited? }`. `rand` defaults to `crypto.getRandomValues`; `limited` is set when today's 8 rolls were already used (nothing was drawn) |
| `jackpotState(db, { limit })` | `{ pool, seed, cap, round, recent: [{ name, amount, gameSlug, wonAt }] }`, newest first. `name` is `publicName(user.name)`: the first word, at most 12 characters, `""` when the name looks like an email (the portal shows "a player") |

### Why the statements run in this order (D1)

D1 has no interactive transactions, so each rule is enforced by the single
statement that writes what it guards (SQLite runs a statement atomically):

**contribute**

1. *Cap ledger.* One upsert adds all of it `WHERE tickets + n <= 2000` (or
   inserts today's row). When that returns nothing, the cap is near: read the
   row, then upsert what is left `WHERE tickets = <what was read>`
   (compare-and-set), retrying if another request got there first. An upsert's
   `RETURNING` only sees the new value, so this is how `accepted` stays exact.
2. *Pool.* `pool = min(cap, pool + accepted)` in one `UPDATE`.

If the Worker dies between the two, the pool is short one contribution: house
tickets, nobody's loss.

**roll**

1. *Rate limit.* An upsert on `jackpot_roll` that adds 1 only `WHERE count < 8`.
2. *Read* the pool and round; *draw* `rand() < p` in the Worker.
3. *Claim.* `UPDATE jackpot_pool SET pool = …, round = round + 1 WHERE id =
   'arcade' AND round = :round RETURNING`. Only the statement that changed the
   row wins; a racing roll that drew a win for the same round matches nothing
   and answers `won: false`. Contributions that landed between 2 and 3 carry
   into the next round (`pool = seed + (pool − :pool)`), so the winner gets the
   pool they rolled against and nothing vanishes.
4. *Win row* in `jackpot_win` (its unique `round` is a second guard).
5. *Ledger:* `+amount`, reason `jackpot`, `created_at = won_at`.
6. *Wallet:* `balance = balance + amount` (`earned_total` untouched).

The claim goes first because everything after it only records it: a Worker
that dies after 3 leaves a round with no win row, after 4 a win with no ledger
row. §5 has the queries that find and pay both. Only one request can ever pass
3 for a round, so nothing is paid twice.

---

## 2. The curve and tuning

```
p(pool) = 0.005 + 0.995 · ((pool − seed) / (cap − seed))³      p = 1 when pool ≥ cap
```

| Pool (seed 5,000, cap 50,000) | fill | chance per roll |
| --- | --- | --- |
| 5,000 | 0 % | 0.5 % |
| 16,250 | 25 % | 2.1 % |
| 27,500 | 50 % | 12.9 % |
| 38,750 | 75 % | 42.5 % |
| 47,750 | 95 % | 85.8 % |
| 50,000 | 100 % | 100 % |

The cube keeps the jar quiet while it is low (it has to grow to be worth
winning) and makes it tip reliably as it nears the cap, so it rarely sits full.

What to turn, and where:

| Knob | Where | Effect |
| --- | --- | --- |
| `seed`, `cap` | the `jackpot_pool` row (SQL, §5) | Size of a jackpot. Changes apply to the next roll; no deploy |
| `BASE_CHANCE` (0.005) | `lib/jackpot.ts` | How often a near-empty jar tips |
| the exponent (3) | `jackpotChance` | Higher: quieter until near the cap |
| `TICKETS_PER_COIN` (2) | `lib/jackpot.ts` | How fast play fills the jar |
| `DAILY_CONTRIBUTION_CAP` (2,000) | `lib/jackpot.ts` | How much one player can fill per game per day |
| `DAILY_ROLLS` (8) | `lib/jackpot.ts` | Rolls per player per day: the main anti-farming lever |

A jackpot pays tickets into the same wallet the Prize Counter spends, so keep
`cap` in proportion to the counter's prices.

---

## 3. How a game opts in

```ts
// packages/games/src/<slug>/manifest.ts
const manifest: GameManifest = {
  // …
  category: "arcade",
  tickets: true,
  jackpot: true,
};
```

```ts
// packages/games/src/<slug>/game.ts
export function setup(rt: Runtime): GameHooks {
  const { jackpot } = rt.game;
  // Present signed out too (the pool is public); missing outside the portal and online
  const off = jackpot?.onState(({ pool, cap }) => (state.jar = { pool, cap }));
  void jackpot?.state().then(({ pool, cap }) => (state.jar = { pool, cap }));

  function onCoinsIntoJar(coins: number) {
    jackpot?.contribute(coins); // batched by the portal, a no-op signed out
  }

  function onSuperSpin() {
    jackpot
      ?.roll()
      .then(({ won, amount }) => {
        if (won) celebrate(amount!); // already in the player's ticket wallet
      })
      .catch(() => {}); // "sign-in-required" signed out, or offline
  }

  return { dispose: () => off?.() /* … */ };
}
```

- `contribute(coins)`: a positive integer of the game's own coins; fire and
  forget. The portal batches for about **3 s** and flushes on unmount and
  `pagehide` (keepalive).
- `roll()`: resolves `{ won, amount?, pool }`. Over the daily limit it resolves
  `won: false`. Signed out it **rejects** (`sign-in-required`). It flushes the
  waiting contributions first, then refreshes the ticker, the Hall and (on a
  win) the ticket chip.
- `state()` / `onState(cb)`: the pool, the cap and (for `state`) the latest
  winners. Work signed out.
- Roll on a real in-game event (a special spin, a bonus), not on a timer: the
  server's 8-a-day limit is a ceiling, not a target.

The server refuses (`contributeJackpotFn`, `rollJackpotFn`) any slug whose
manifest lacks `jackpot: true`, and anyone signed out.

---

## 4. The portal

| Piece | File |
| --- | --- |
| Boundary | `server/jackpot.ts`: `getJackpotFn` (GET, public), `contributeJackpotFn`, `rollJackpotFn` (POST, sign-in required) |
| Store | `stores/jackpot.ts`: polls every 30 s while a watcher is mounted and the tab is visible; refreshes at once after a roll; keeps the "new win" announcement (`localStorage` `engames:portal:jackpotSeen` holds the newest `wonAt` announced) |
| `ctx.jackpot` | `components/features/game-player/game-player.jackpot.ts` |
| Ticker | `components/features/jackpot/jackpot-ticker.tsx`, in `top-bar.tsx`: beside the search field on desktop, a slim strip under the bar on phones |
| Hall | `components/features/jackpot/jackpot-hall.tsx`: pool, cap, how full, the last 20 winners |

`getJackpotFn` sets no cache header: the codebase has no pattern for one, and
each visible tab asks at most every 30 s.

A new win (newer than the stored `wonAt`; on a first visit, one in the last
24 h) crawls across the ticker twice, then the ticker settles back to cycling
the recent winners. Under `prefers-reduced-motion` the text stays still.

---

## 5. Inspecting and adjusting (SQL)

From `apps/web`; `--local` for the dev database, `--remote` for production:

```sh
cd apps/web
bunx wrangler d1 migrations apply prod-engames --local   # once, for 0010
bunx wrangler d1 execute prod-engames --local --command "$(cat <<'SQL'
SELECT * FROM jackpot_pool;
SQL
)"
# Same with --remote for production.
```

### The pool and the latest wins

```sql
SELECT pool, seed, cap, round,
       round(100.0 * (pool - seed) / (cap - seed), 1) AS fill_pct,
       datetime(updated_at / 1000, 'unixepoch', '+7 hours') AS updated_vn
FROM jackpot_pool WHERE id = 'arcade';

SELECT w.round, u.name, u.email, g.slug, w.amount,
       datetime(w.won_at / 1000, 'unixepoch', '+7 hours') AS won_vn
FROM jackpot_win w
JOIN user u ON u.id = w.user_id
JOIN game g ON g.id = w.game_id
ORDER BY w.won_at DESC
LIMIT 20;
```

### Today's feeders and rollers

```sql
SELECT u.email, g.slug, c.tickets
FROM jackpot_contribution c
JOIN user u ON u.id = c.user_id JOIN game g ON g.id = c.game_id
WHERE c.day = date('now', '+7 hours')
ORDER BY c.tickets DESC LIMIT 20;

SELECT u.email, r.count
FROM jackpot_roll r JOIN user u ON u.id = r.user_id
WHERE r.day = date('now', '+7 hours')
ORDER BY r.count DESC LIMIT 20;
```

### Reset or adjust the pool

```sql
-- Back to the seed, same round (no one wins it)
UPDATE jackpot_pool SET pool = seed, updated_at = unixepoch() * 1000
WHERE id = 'arcade' RETURNING pool, round;

-- Top it up (a promotion); min() keeps it under the cap
UPDATE jackpot_pool SET pool = min(cap, pool + 10000), updated_at = unixepoch() * 1000
WHERE id = 'arcade' RETURNING pool;

-- Retune the size: the CHECK refuses a cap at or below the seed, or under the pool
UPDATE jackpot_pool SET seed = 8000, cap = 80000, pool = max(pool, 8000), updated_at = unixepoch() * 1000
WHERE id = 'arcade' RETURNING pool, seed, cap;

-- Let one player roll again today
DELETE FROM jackpot_roll
WHERE user_id = (SELECT id FROM user WHERE email = 'player@example.com')
  AND day = date('now', '+7 hours');
```

Never lower `round`: `jackpot_win.round` is unique, and a claim compares it.

### Find and pay an interrupted win

A round with no `jackpot_win` row means the Worker died right after a claim
(§1). The amount is lost from the record; look at the logs for the roll, then
pay by hand with the steps below. A win with no ledger row:

```sql
SELECT w.id, w.round, u.email, w.amount, w.won_at
FROM jackpot_win w JOIN user u ON u.id = w.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM ticket_ledger l
  WHERE l.user_id = w.user_id AND l.reason = 'jackpot' AND l.created_at = w.won_at
);
```

Pay one (by `jackpot_win.id`), ledger first, then the wallet, only if the first
printed a row:

```sql
INSERT INTO ticket_ledger (user_id, game_id, delta, reason, created_at)
SELECT w.user_id, w.game_id, w.amount, 'jackpot', w.won_at
FROM jackpot_win w
WHERE w.id = 7
  AND NOT EXISTS (SELECT 1 FROM ticket_ledger l
                  WHERE l.user_id = w.user_id AND l.reason = 'jackpot' AND l.created_at = w.won_at)
RETURNING id, delta;

INSERT INTO ticket_wallet (user_id, balance, earned_total, updated_at)
SELECT user_id, amount, 0, unixepoch() * 1000 FROM jackpot_win WHERE id = 7
ON CONFLICT (user_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = excluded.updated_at
RETURNING balance;
```

The tickets reconcile query in [`tickets.md`](tickets.md) §3 also repairs a
wallet that missed step 6: it sums every ledger row, `jackpot` included.
