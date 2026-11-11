# Arcade tickets

One ticket balance per player, shared by every arcade game that opts in. Games
pay tickets out; the server keeps the wallet, caps what a game can pay, and logs
every change.

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
  `onBalance` listener in step.

---

## 1. The model

| Table | What it holds |
| --- | --- |
| `ticket_wallet` | `user_id` (primary key, `ON DELETE CASCADE`), `balance`, `earned_total` (every ticket ever earned, never lowered by spending), `updated_at` (unix **ms**) |
| `ticket_ledger` | `id`, `user_id`, `game_id` (the game it came from), `delta` (+ earned), `reason` (`earn` for now), `created_at` (unix **ms**). Indexed on `(user_id, created_at)` |

**The ledger is the record; the wallet is its running total.** For every player
`balance = SUM(delta)` over their ledger, and `earned_total = SUM(delta)` over
the `earn` rows.

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
bunx wrangler d1 migrations apply prod-engames --local   # once, for 0008
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
