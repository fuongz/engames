# Arcade tickets

One ticket balance per player, shared by every arcade game that opts in. Games
pay tickets out; the player spends them at the **Prize Counter** on a game's own
currency; the server keeps the wallet, caps what a game can pay, and logs every
change. Ticket games also rank **this week's** earnings.

---

## TL;DR

- **A game opts in** with `manifest.tickets = true` and uses `ctx.tickets`
  (`balance()`, `deposit(n)`, `onBalance(cb)`), signed-in players only, never
  online.
- **One wallet** (`ticket_wallet`) per player; **every change** is a row in
  `ticket_ledger`.
- **Caps** (`apps/web/src/lib/tickets.ts`): one deposit is at most **5,000**;
  one game pays one player at most **50,000 per Vietnam day**. Over a cap, the
  deposit is clamped to what remains and the answer says so: `accepted` is
  what went in, `clamped` is `"deposit"` or `"daily"`. Nothing is dropped
  silently.
- **The portal batches** a game's deposits for about 2 s, and flushes on unmount
  and on `pagehide`.
- **The chip** in the sidebar (desktop) and top bar (phones) shows the balance;
  a small Zustand store (`stores/tickets.ts`) keeps it and every
  `onBalance` listener in step. Clicking it opens the Prize Counter.
- **The Prize Counter** (§4) sells `manifest.shop` items for tickets. A purchase
  is a negative ledger row plus a `pending_grant`, delivered by the game's next
  `ctx.allowance.claim()`. **Spends never count as earnings**: the daily earn cap
  and `earned_total` read `reason = 'earn'` rows only. The weekly board ranks
  **net** tickets: a game's earnings less what was spent on its own Prize
  Counter items. **Lucky Jar wins** (`reason = 'jackpot'`, see
  [`jackpot.md`](jackpot.md)) add to the balance and nothing else.
- **The weekly board** (§5): a ticket game's leaderboard opens on "This week"
  (tickets earned since Monday 00:00 Vietnam time, minus tickets spent at that
  game's Prize Counter, floored at 0), with "All time" (the score board) one tab
  away.

---

## 1. The model

| Table | What it holds |
| --- | --- |
| `ticket_wallet` | `user_id` (primary key, `ON DELETE CASCADE`), `balance`, `earned_total` (every ticket ever earned, never lowered by spending), `updated_at` (unix **ms**) |
| `ticket_ledger` | `id`, `user_id`, `game_id` (the game it came from, or the game a purchase was for), `delta` (+ earned, − spent), `reason`, `created_at` (unix **ms**). Indexed on `(user_id, created_at)` and `(game_id, created_at)` (the weekly board) |
| `pending_grant` | A purchase the game has not picked up yet: `id`, `user_id`, `game_id`, `kind`, `amount`, `source` (`shop:<itemId>`), `ledger_id` (the spend that paid for it), `created_at`, `claimed_at` (unix **ms**, NULL = waiting). Partial index on `(user_id, game_id) WHERE claimed_at IS NULL` |

| `reason` | Written by | Counts as earnings? |
| --- | --- | --- |
| `earn` | `depositTickets` (a game paid out) | **yes**: the daily cap, `earned_total`, the weekly board |
| `shop:<slug>:<itemId>` | `buyItem` (a Prize Counter purchase, negative) | no, but **subtracted** from `<slug>`'s weekly board (§5) |
| `jackpot` | `roll` (a Lucky Jar win, positive; `created_at` equals `jackpot_win.won_at`, see [`jackpot.md`](jackpot.md)) | no |
| `adjust`, `refund:<ledger id>` | an admin, by hand (§3) | no |

**The ledger is the record; the wallet is its running total.** For every player
`balance = SUM(delta)` over their ledger, and `earned_total = SUM(delta)` over
the `earn` rows.

**Only `earn` is earnings.** Every query that measures earning (the daily cap in
`depositTickets`, `earned_total`, `weeklyTicketBoard`) filters on
`reason = 'earn'`, never on `delta > 0`, so a jackpot win, a refund or a positive
`adjust` can never use up a player's cap or lift them on the weekly board.
`weeklyTicketBoard` also reads the game's `shop:<slug>:%` rows, and only to
subtract them. `tickets.test.ts` and `leaderboard.test.ts` hold that line. A new
kind of credit gets its own reason and changes none of them.

### How a deposit is written

`depositTickets` (`apps/web/src/server/db/tickets.ts`) runs two single-statement
guards, in this order:

1. **Ledger.** One `INSERT … SELECT` computes
   `min(amount, 50,000 − what this game paid this player today)` from the ledger
   itself and inserts only when that is positive. A statement is atomic, so
   concurrent deposits each count the others' rows and can never pass the cap.
2. **Wallet.** An upsert that **adds** the accepted amount
   (`balance = balance + n`), so concurrent deposits never overwrite each other.

Not a `db.batch`: the wallet update depends on how much the ledger statement
accepted, a batch cannot branch on that, and bun:sqlite (the tests) has no batch.
The ledger goes first because it is the record: if the Worker dies between the
two, the wallet is short one deposit, and the reconcile query below repairs it.
Nothing is ever credited without a ledger row.

The "day" is the Vietnam day (00:00 Asia/Ho_Chi_Minh, UTC+7), the same clock
as the [allowance](allowance.md).

---

## 2. How a game opts in

```ts
// packages/games/src/<slug>/manifest.ts
const manifest: GameManifest = {
  // …
  category: "arcade",
  tickets: true,
};
```

```ts
// packages/games/src/<slug>/game.ts
export function setup(rt: Runtime): GameHooks {
  const { tickets } = rt.game;
  // Missing signed out, outside the portal, and in an online match: hide the
  // ticket counter then.
  const off = tickets?.onBalance((b) => (state.tickets = b));
  void tickets?.balance().then((b) => (state.tickets = b));

  function onRunEnd(won: number) {
    // A positive integer. Batched by the portal; resolves when the server answers.
    void tickets?.deposit(won).then(({ accepted }) => {
      if (accepted < won) showToast(tr().ticketCapReached);
    });
  }

  return { dispose: () => off?.() /* … */ };
}
```

- `deposit(n)` rejects anything but a positive integer. Pay out per run or per
  milestone, not per frame: the portal batches, but the server still logs a row
  per request.
- `accepted` can be less than `n` (a cap). It is never more.
- The server refuses (`depositTicketsFn`, `apps/web/src/server/tickets.ts`) any
  slug whose manifest lacks `tickets: true`, and anyone signed out
  (`sign-in-required`). `getTicketBalanceFn` returns `null` when signed out.

---

## 3. Inspecting and adjusting (SQL)

Run from `apps/web`; `--local` for the dev database, `--remote` for production:

```sh
cd apps/web
bunx wrangler d1 migrations apply prod-engames --local   # once, for 0008 and 0009
bunx wrangler d1 execute prod-engames --local --command "$(cat <<'SQL'
SELECT 1;
SQL
)"
# Same with --remote for production.
```

### A player's wallet and recent history

```sql
SELECT w.balance, w.earned_total,
       datetime(w.updated_at / 1000, 'unixepoch', '+7 hours') AS updated_vn
FROM ticket_wallet w JOIN user u ON u.id = w.user_id
WHERE u.email = 'player@example.com';

SELECT g.slug, l.delta, l.reason,
       datetime(l.created_at / 1000, 'unixepoch', '+7 hours') AS at_vn
FROM ticket_ledger l
JOIN game g ON g.id = l.game_id
JOIN user u ON u.id = l.user_id
WHERE u.email = 'player@example.com'
ORDER BY l.created_at DESC
LIMIT 50;
```

### Who hit today's cap

```sql
SELECT u.email, g.slug, sum(l.delta) AS earned_today
FROM ticket_ledger l
JOIN user u ON u.id = l.user_id
JOIN game g ON g.id = l.game_id
WHERE l.reason = 'earn'
  AND l.created_at >= (unixepoch(date('now', '+7 hours'), '-7 hours')) * 1000
GROUP BY l.user_id, l.game_id
HAVING earned_today >= 50000;
```

### Adjusting a balance

Always through the ledger, so the wallet stays its total. Write the ledger row,
then the wallet (as the code does). Use a reason other than `earn`
(`adjust`), so a correction never counts toward the daily earn cap:

```sql
-- Give 500 tickets (use a negative delta to take some back)
INSERT INTO ticket_ledger (user_id, game_id, delta, reason, created_at)
SELECT u.id, g.id, 500, 'adjust', unixepoch() * 1000
FROM user u, game g
WHERE u.email = 'player@example.com' AND g.slug = 'xu-vu-tru'
RETURNING id, delta;

UPDATE ticket_wallet
SET balance = balance + 500, updated_at = unixepoch() * 1000
WHERE user_id = (SELECT id FROM user WHERE email = 'player@example.com')
RETURNING balance;
```

`earned_total` counts earnings only; leave it alone for an adjustment.

### Reconcile a wallet from its ledger

If a wallet ever disagrees with its ledger (a Worker died between the two
writes), this rebuilds every wallet from the record:

```sql
INSERT INTO ticket_wallet (user_id, balance, earned_total, updated_at)
SELECT user_id, sum(delta), sum(CASE WHEN reason = 'earn' THEN delta ELSE 0 END), unixepoch() * 1000
FROM ticket_ledger GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET
  balance = excluded.balance,
  earned_total = excluded.earned_total,
  updated_at = excluded.updated_at
RETURNING user_id, balance;
```

To list the ones that disagree first:

```sql
SELECT w.user_id, w.balance, coalesce(sum(l.delta), 0) AS ledger
FROM ticket_wallet w LEFT JOIN ticket_ledger l ON l.user_id = w.user_id
GROUP BY w.user_id HAVING w.balance != ledger;
```

### Purchases: list, find the stuck ones, refund one

Every purchase, newest first, with whether the game has picked it up and
whether it was refunded:

```sql
SELECT l.id AS spend_id, u.email, g.slug, l.reason, -l.delta AS price,
       p.id AS pending_id, p.kind, p.amount,
       datetime(l.created_at / 1000, 'unixepoch', '+7 hours') AS bought_vn,
       datetime(p.claimed_at / 1000, 'unixepoch', '+7 hours') AS delivered_vn,
       EXISTS (SELECT 1 FROM ticket_ledger r WHERE r.reason = 'refund:' || l.id) AS refunded
FROM ticket_ledger l
JOIN user u ON u.id = l.user_id
JOIN game g ON g.id = l.game_id
LEFT JOIN pending_grant p ON p.ledger_id = l.id
WHERE l.reason LIKE 'shop:%'
ORDER BY l.created_at DESC
LIMIT 50;
```

Add `AND u.email = 'player@example.com'` for one player. `pending_id` NULL means
**paid, nothing to deliver**: the Worker died between the spend and the pending
grant (see `buyItem`). Those, unrefunded:

```sql
SELECT l.id AS spend_id, u.email, l.reason, -l.delta AS price
FROM ticket_ledger l JOIN user u ON u.id = l.user_id
WHERE l.reason LIKE 'shop:%'
  AND NOT EXISTS (SELECT 1 FROM pending_grant p WHERE p.ledger_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM ticket_ledger r WHERE r.reason = 'refund:' || l.id);
```

**Refund a purchase** by its `spend_id`, in three statements run one after
another. Step 1 cancels the delivery if the game has not picked it up; step 2
writes the refund into the ledger, at most once per spend; step 3 credits the
wallet. Run step 3 **only if step 2 printed a row**.

```sql
-- 1. Never deliver it. No row back: there was nothing waiting (already
--    delivered: the player keeps the coins too, so decide first; or a stuck
--    purchase with no pending grant: go on)
UPDATE pending_grant SET claimed_at = unixepoch() * 1000
WHERE ledger_id = 123 AND claimed_at IS NULL
RETURNING id, kind, amount;

-- 2. The refund, naming the spend it reverses. No row back: already refunded
INSERT INTO ticket_ledger (user_id, game_id, delta, reason, created_at)
SELECT l.user_id, l.game_id, -l.delta, 'refund:' || l.id, unixepoch() * 1000
FROM ticket_ledger l
WHERE l.id = 123 AND l.reason LIKE 'shop:%'
  AND NOT EXISTS (SELECT 1 FROM ticket_ledger r WHERE r.reason = 'refund:' || l.id)
RETURNING id, delta, reason;

-- 3. The wallet (only after step 2 printed a row)
UPDATE ticket_wallet
SET balance = balance + (SELECT -delta FROM ticket_ledger WHERE id = 123),
    updated_at = unixepoch() * 1000
WHERE user_id = (SELECT user_id FROM ticket_ledger WHERE id = 123)
RETURNING balance;
```

The refunded spend still counts toward that day's `dailyLimit` (the limit counts
purchases, and the spend row stays: the ledger is never edited). If a wallet ends
up wrong anyway, the reconcile query above rebuilds it from the ledger.

### This week's board by hand

```sql
SELECT u.name,
       max(0, sum(CASE WHEN l.reason = 'earn' THEN l.delta ELSE -abs(l.delta) END)) AS tickets
FROM ticket_ledger l JOIN user u ON u.id = l.user_id
WHERE l.game_id = (SELECT id FROM game WHERE slug = 'xu-vu-tru')
  AND (l.reason = 'earn' OR l.reason LIKE 'shop:xu-vu-tru:%')
  -- Monday 00:00 in Vietnam: Vietnam's today, back 6 days, forward to a Monday
  -- (today, on a Monday), then back to UTC
  AND l.created_at >= unixepoch(date('now', '+7 hours', '-6 days', 'weekday 1'), '-7 hours') * 1000
GROUP BY l.user_id
HAVING tickets > 0
ORDER BY tickets DESC
LIMIT 10;
```

---

## 4. The Prize Counter (shop)

Shared tickets buy a game's **own** currency. The portal owns the counter; the
game only declares what it sells and picks purchases up.

### How a game opts in

```ts
// packages/games/src/<slug>/manifest.ts
const manifest: GameManifest = {
  // …
  tickets: true,
  // Required: purchases are delivered through allowance.claim()
  allowance: { kind: "coins", welcome: 100, daily: 50 },
  shop: [
    { id: "coins-100", name: { vi: "Túi 100 xu", en: "Bag of 100 coins" }, kind: "coins", amount: 100, price: 400 },
    { id: "coins-500", name: { vi: "Hũ 500 xu", en: "Jar of 500 coins" }, kind: "coins", amount: 500, price: 1500, dailyLimit: 3 },
  ],
};
```

- `id` names the purchase in the ledger (`shop:<slug>:<id>`) and in
  `pending_grant.source` (`shop:<id>`): **never rename one** that has been sold,
  or today's limit and the audit trail lose track of it.
- `price` is in shared tickets; `amount` of `kind` is what the game receives;
  `dailyLimit` is per player per Vietnam day (unlimited when missing).
- `conventions.test.ts` checks every shop: unique ids, both names, positive whole
  numbers, and that the game declares `allowance`.
- Xu Vũ Trụ's shop (and its streak) are added to its manifest by its own task;
  until a game has a shop, the counter shows an empty state and the signed-out
  chip stays hidden.

The game handles a purchase like any other grant:

```ts
void allowance?.claim().then(({ grants }) => {
  for (const g of grants) if (g.kind === "coins") state.coins += g.amount;
  if (grants.length > 0) save(); // NOW: never sent again
});
```

A purchase made while the game is open arrives on the next `claim()`.

### How a purchase is written

`buyItem` (`apps/web/src/server/db/shop.ts`) returns `{ ok: true, balance }` or
`{ ok: false, reason: "insufficient" | "daily-limit" | "unknown-item" }`. D1 has
no interactive transactions and the two rules live in two tables, so each is
enforced by the single statement that writes what it guards:

1. **Pre-check** today's count for the limit (a read; it only spares the common
   "sold out" case a debit and refund).
2. **Wallet**: `UPDATE … SET balance = balance − price WHERE balance >= price
   RETURNING`. Atomic: the balance never goes below zero. No row: `insufficient`.
3. **Ledger**: one `INSERT … SELECT … WHERE` *today's rows with this reason* `<
   dailyLimit`, the same guard as the deposit cap, so racing buys can never pass
   the limit. No row: another buy took the last one; the price goes back to the
   wallet and the answer is `daily-limit`.
4. **Pending grant**, linked by `ledger_id`.

The wallet goes first so that a Worker dying between steps leaves a state the
database can name: after 2, the wallet is short with no ledger row (the
reconcile query gives it back); after 3, a paid spend with no pending grant (the
"stuck" query above finds it, the refund recipe settles it). Nothing is ever
delivered unpaid. `shop.test.ts` races both rules.

### The boundary and the UI

- `listShopFn` (GET, `apps/web/src/server/shop.ts`): every game with a shop, its
  items with today's `remaining` for the signed-in player, and their balance.
- `buyItemFn` (POST): sign-in required; refuses a slug without a shop.
- The counter (`components/features/prize-counter/`) is a Dialog opened from the
  ticket chip. Signed out it offers Google sign-in. After a purchase it writes the
  new balance to `stores/tickets.ts`, so the chip and any open game's
  `onBalance` update at once.

---

## 5. The weekly board

For games with `tickets: true`, the game page's leaderboard has two tabs:

| Tab | What it ranks |
| --- | --- |
| **This week** (default) | **Net tickets** since Monday 00:00 Asia/Ho_Chi_Minh, per player: `SUM(delta)` of the game's `earn` rows minus `SUM(abs(delta))` of its `shop:<slug>:<itemId>` rows, floored at 0. Top 10, the player's own row highlighted (or their rank under the list when below it), and a "resets in" countdown |
| **All time** | the usual `score` table (`reportScore`) |

`weeklyTicketBoard` (`apps/web/src/server/db/leaderboard.ts`) is the query;
`getWeeklyLeaderboard` (`server/leaderboard.ts`) the boundary, which adds the
signed-in player. The board's caption says so: "Vé kiếm được trong tuần, trừ vé
đã tiêu ở Quầy đổi thưởng".

- **Why net.** Without it, a player could farm a game, cash the tickets at its
  counter, and still sit on top of its board. Net tickets rank what a player
  *kept* from that game this week.
- **Only this game's counter.** A spend is matched by its reason
  (`shop:<slug>:`), so buying another game's coins never touches this board.
- **The floor is on the week.** Spending more than you earned puts the week at 0,
  and a player at 0 is off the board (and has no own rank) until this week's
  earnings pass this week's spends again. Last week's spends never carry over.
- **Never counted:** Lucky Jar wins, `adjust` rows and `refund:` rows. So a
  refunded purchase still comes off the board for the week it was bought in: a
  refund fixes the wallet, not the board.
- The tie-break is the player's last **earning** this week (a spend never
  moves it).

The week is the Vietnam week: `vnWeekStart` in `server/db/allowance.ts`, next to
`vnDayStart`.
