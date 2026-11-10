# Coupons

How a player redeems a code inside a game, how a game opts in, and how the admin
mints codes by hand in D1. There is no admin UI: minting is SQL.

---

## TL;DR

- **The admin mints** a row in `coupon` with SQL (ready-to-paste below).
- **A game opts in** with `manifest.coupons = { kinds: [...] }` and uses
  `ctx.coupons` (`open()` the portal's redeem dialog, `onGrant` to receive).
- **The server decides.** `redeemCode` (`apps/web/src/server/coupons.ts`) checks
  the code, spends one use, records who got what, and returns the rewards, already
  filtered to the kinds the game accepts.
- **A game persists a grant immediately.** The code is spent the moment the server
  answers; a grant lost to a reload is never sent again.
- **Never in online matches.** The portal leaves `ctx.coupons` out of an online
  mount: the room owns the state.

---

## 1. The model

| Table | What it holds |
| --- | --- |
| `coupon` | One row per code: `code` (uppercase, no spaces or dashes), `game_id` (the game's id in the `game` table, or NULL for any game that takes coupons), `rewards` (JSON array of `{"kind","amount"}`), `max_uses` (default 1), `uses`, `expires_at` (unix **ms**, NULL = never), `disabled` (0/1), `note`, `created_at` (unix ms, defaults to now) |
| `coupon_redemption` | One row per code **per player**: `code`, `user_id`, `game_id` (where it was redeemed), `rewards` (what was actually granted), `redeemed_at` (unix ms). Primary key `(code, user_id)` |

Rules, in the order the server applies them:

| Reason | When |
| --- | --- |
| `not-found` | no such code (after normalising what the player typed) |
| `disabled` | `disabled = 1` |
| `expired` | `expires_at <= now` |
| `wrong-game` | `game_id` is set and is not this game |
| `nothing-for-this-game` | none of the rewards is a kind this game accepts. **Nothing is spent**, so the player can still use the code in a game that does |
| `already-redeemed` | this player already redeemed this code (in any game) |
| `used-up` | `uses = max_uses` |

- **Codes are normalised**: the player may type `tet-2027`, ` TET 2027 ` or
  `Tet2027`; all of them mean `TET2027`. A CHECK constraint rejects a minted code
  with lowercase letters, spaces or dashes, because nobody could ever type it in.
  A second CHECK rejects `rewards` that is not a JSON array.
- **Kinds are game-defined.** A coupon for `[{"kind":"coins","amount":100},
  {"kind":"gems","amount":5}]` redeemed in a game that accepts only `coins` grants
  100 coins, and the gems are gone for that player (the code is spent). Mint
  per-game codes when a game's kinds differ.
- **Every player redeems a code once**, however many uses it has left.
- **Disable, don't delete.** Redemptions reference their coupon, so D1 refuses to
  delete a code anyone has redeemed. `disabled = 1` stops it just as well and keeps
  the history.

### Race safety

D1 has no interactive transactions, so `redeemCoupon`
(`apps/web/src/server/db/coupons.ts`) relies on two single-statement guards: a
conditional `UPDATE` that bumps `uses` only while it is below `max_uses` (and the
code is live, matches the game, and this player has no redemption yet), then an
`INSERT … ON CONFLICT DO NOTHING` into `coupon_redemption`, whose primary key lets
only one of a player's concurrent requests through. The loser hands its use back.
`uses` can never exceed `max_uses`, and a player is never granted a code twice.
The comment above `redeemCoupon` has the full argument; `coupons.test.ts` races
both cases.

### Known risk: no rate limit

The portal has no rate-limit helper yet, so `redeemCode` does not throttle. What
holds a guesser off today: redeeming needs a signed-in account, and a random code
from the recipes below is 10 hex characters (40 bits, about 10¹² values). Keep it
that way:

- Use random codes for anything valuable. Keep **guessable** shared codes
  (`TET2027`) for small, expiring, capped rewards.
- If abuse shows up, add a per-user limit (for example a Cloudflare Rate Limiting
  binding keyed on `user.id`) in `redeemCode` before the database call.

---

## 2. How a game opts in

**The manifest** lists the reward kinds the game knows how to grant:

```ts
// packages/games/src/<slug>/manifest.ts
const manifest: GameManifest = {
  // …
  coupons: { kinds: ["coins"] },
};
```

Only opted-in games get `ctx.coupons`, and the server refuses `redeemCode` for any
other slug.

**The game** offers its own "Redeem code" button and subscribes to grants:

```ts
// packages/games/src/<slug>/game.ts
export function setup(rt: Runtime): GameHooks {
  const { storage, coupons } = rt.game;

  // Missing outside the portal, in a game without manifest.coupons, and always in
  // an online match: hide the button when it is undefined.
  const off = coupons?.onGrant((grant) => {
    for (const r of grant.rewards) {
      if (r.kind === "coins") state.coins += r.amount;
    }
    save(); // NOW — the code is already spent on the server
    showToast(tr().couponRedeemed(grant.code));
  });

  return {
    pointer: {
      up(p) {
        if (coupons && hit(p, redeemButton)) coupons.open();
      },
    },
    dispose() {
      off?.();
    },
    // …
  };
}
```

- `open()` shows the portal's redeem dialog. The portal handles sign-in, the
  typed code, the error messages (one per reason above, in both languages) and the
  call to `redeemCode`. The game draws nothing for it.
- `onGrant` fires once per successful redemption and returns the unsubscribe.
  Persist the grant at once, in `storage` or the cloud save, before anything else
  can go wrong.
- Never trust a grant you did not get from `onGrant`, and never call the server
  yourself: a game never imports portal code.

---

## 3. Minting codes (SQL)

Run these from `apps/web`. The database is `prod-engames`; pass `--local` for
the dev database, `--remote` for production. Apply the coupon migration first
(`bun run db:migrate:local`, or `db:migrate:remote` when it ships).

Times are unix **milliseconds**. Vietnam is UTC+7, so a local deadline is written
as `unixepoch('2027-02-28 23:59:59', '-7 hours') * 1000`.

The SQL is full of both kinds of quote, so pass it to wrangler through a quoted
heredoc. That form works in bash and zsh, keeps every character intact, and still
prints the `RETURNING` rows:

```sh
cd apps/web
bunx wrangler d1 execute prod-engames --local --command "$(cat <<'SQL'
SELECT code, uses, max_uses FROM coupon;
SQL
)"
# Same with --remote for production.
```

Swap the SQL between the `SQL` markers for any recipe below.

A coupon names its game by **id**, not slug: the id of
`(SELECT id FROM game WHERE slug = 'xu-vu-tru')`. Every catalogue game already has
its row (see [`database.md`](database.md)); `SELECT id, slug FROM game ORDER BY slug;`
lists them. The per-game recipes below select the id `FROM game WHERE slug = …`
rather than writing that subquery into `VALUES`, on purpose: a typo'd slug then
mints **nothing** (`RETURNING` prints no row), where a subquery would be NULL and
quietly make the code good in **any** game.

### A single-use random code for xu-vu-tru, worth 100 coins

```sql
INSERT INTO coupon (code, game_id, rewards, max_uses)
SELECT upper(hex(randomblob(5))), id, '[{"kind":"coins","amount":100}]', 1
FROM game WHERE slug = 'xu-vu-tru'
RETURNING code, game_id;
```

### A shared code: 100 uses, any coupon game, expires end of February 2027 (Vietnam time)

```sql
INSERT INTO coupon (code, rewards, max_uses, expires_at, note)
VALUES (
  'TET2027',
  '[{"kind":"coins","amount":50}]',
  100,
  unixepoch('2027-02-28 23:59:59', '-7 hours') * 1000,
  'Tết fanpage post'
)
RETURNING code, datetime(expires_at / 1000, 'unixepoch', '+7 hours') AS expires_vn;
```

For "valid for 7 days from now" use `(unixepoch() + 7 * 86400) * 1000`.

### 20 single-use random codes at once

```sql
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 20)
INSERT INTO coupon (code, game_id, rewards, max_uses, note)
SELECT upper(hex(randomblob(5))), g.id, '[{"kind":"coins","amount":100}]', 1, 'Giveaway 2026-11'
FROM n, game g WHERE g.slug = 'xu-vu-tru'
RETURNING code, game_id;
```

Give the batch a `note` so you can find, list or disable it together later. Two
random codes colliding is vanishingly unlikely; if it ever happens the whole
statement fails and nothing is minted, so just run it again.

### Listing redemptions

```sql
SELECT r.code, u.name, u.email, g.slug AS game, r.rewards,
       datetime(r.redeemed_at / 1000, 'unixepoch', '+7 hours') AS redeemed_vn
FROM coupon_redemption r
JOIN user u ON u.id = r.user_id
JOIN game g ON g.id = r.game_id
ORDER BY r.redeemed_at DESC
LIMIT 50;
```

Filter with `WHERE r.code = 'TET2027'`, or join `coupon c ON c.code = r.code`
and filter on `c.note` for a batch. To see how codes are doing:

```sql
SELECT c.code, coalesce(g.slug, '(any)') AS game, c.uses, c.max_uses, c.disabled,
       datetime(c.expires_at / 1000, 'unixepoch', '+7 hours') AS expires_vn, c.note
FROM coupon c
LEFT JOIN game g ON g.id = c.game_id
ORDER BY c.created_at DESC
LIMIT 50;
```

`LEFT JOIN` here, because a NULL `game_id` (any game) has no `game` row.

### Disabling a code

```sql
UPDATE coupon SET disabled = 1 WHERE code = 'TET2027' RETURNING code;
```

A whole batch that nobody used yet:
`UPDATE coupon SET disabled = 1 WHERE note = 'Giveaway 2026-11' AND uses = 0 RETURNING code;`.
Set `disabled = 0` to turn a code back on.
