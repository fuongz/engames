# Daily check-in and the player profile

A portal-level reward for coming back: once per Vietnam day a signed-in player
**checks in** and gets **arcade tickets** in the shared wallet
([`tickets.md`](tickets.md)). Seven days make a cycle that ends in a gold chest,
long streaks pay one-time milestone bonuses, and a weekly **streak shield**
forgives one missed day. The same data feeds the player **profile**: level, XP,
title, badges and per-game stats, which other players can open when it is public.

---

## TL;DR

- **One check-in per Vietnam day** (00:00 Asia/Ho_Chi_Minh, UTC+7), signed-in
  players only: `claimCheckinFn` (POST) and `getCheckinFn` (GET) in
  `apps/web/src/server/checkin.ts`. Signed out: `sign-in-required`.
- **The cycle** (`CHECKIN_CYCLE`, `apps/web/src/lib/checkin.ts`): streak day n pays
  `[20, 25, 30, 35, 40, 50, 100][(n − 1) % 7]` tickets. Day 7 is the chest; day 8
  starts the cycle over. A full week is 300 tickets: the cheapest Prize Counter item.
- **Milestones**: the first time ever a streak reaches **7 / 30 / 100** days it pays
  **+100 / +500 / +2,000** tickets and unlocks the badges `streak-7`, `streak-30`,
  `streak-100`. Once per player, ever, even after a reset.
- **The shield**: every Vietnam week (from Monday 00:00) has **one** free shield. It
  covers exactly one missed day on its own, at the next check-in. Two missed days in
  a row, or a miss when that week's shield is used, start the streak over at day 1.
- **Not earnings.** Check-in tickets go into `balance` only, as `ticket_ledger`
  rows with reason `checkin` and `checkin:milestone:<n>`: never `earned_total`, the
  daily earn cap or the weekly board.
- **Race-safe** like the allowance: today's row is one `INSERT … ON CONFLICT DO
  NOTHING … RETURNING`; only the call whose insert landed pays.
- **The profile** (§6): `getMyProfileFn`, `getPublicProfileFn({ userId })`,
  `setProfilePublicFn({ public })` in `apps/web/src/server/profile.ts`. A private
  profile (`user.profile_public = 0`) is null to everyone but its owner; no one but
  the owner ever gets the email.

---

## 1. The model

| Column of `daily_checkin` | |
| --- | --- |
| `user_id` | the player (`user.id`); rows go with the account (`ON DELETE CASCADE`) |
| `day` | the Vietnam date `YYYY-MM-DD` |
| `kind` | `claim` (the player checked in and was paid) or `shield` (a missed day the shield covered) |
| `streak_day` | the streak count on that day. A shield row holds the count it kept alive (the day before's), so the next claim is that + 1 |
| `amount` | tickets paid for the cycle (the milestone bonus is its own ledger row); 0 for a shield |
| `created_at` | unix **ms** |

The primary key is `(user_id, day)`: one row per player per day, claim or shield.
A CHECK rejects any other `kind`, a `day` that is not a date, a `streak_day` below
1, a negative `amount` and a shield with an amount.

**The tickets live in the ledger.** A claim writes a `ticket_ledger` row
(`reason = 'checkin'`, `delta = amount`, `created_at` = the check-in's) and, on a
milestone, a second one (`checkin:milestone:7|30|100`). Their `game_id` is the
reserved **`portal`** game row ([`database.md`](database.md)): `ticket_ledger.game_id`
is NOT NULL and a check-in comes from no game.

The Vietnam clock (`vnDay`, `vnDayStart`, `vnWeekStart`, `addDays`, `weekOf`) lives
in `apps/web/src/lib/checkin.ts`; `server/db/allowance.ts` re-exports the first ones.

---

## 2. Race safety

`claimCheckin(db, userId, now)` (`apps/web/src/server/db/checkin.ts`) reads the
last 8 days of rows, decides the streak, then writes, each rule enforced by the
single statement that writes what it guards (D1 has no interactive transactions):

1. **Shield** (only when one is due): `INSERT … SELECT … WHERE NOT EXISTS (a shield
   row in the missed day's week) ON CONFLICT DO NOTHING RETURNING`. A week can never
   hold two shields, and a racing duplicate for the same day is a no-op. When the
   insert returns nothing, the day is read again: a racer's shield for the same day
   keeps the streak; anything else resets it to day 1.
2. **Today**: `INSERT … ON CONFLICT DO NOTHING RETURNING` on `(user_id, day)`. Of
   any number of racing claims exactly one row lands; only that call pays. Racing
   claims read the same past rows, so they agree on the streak day.
3. **Ledger**: the `checkin` row, then the milestone as `INSERT … SELECT … WHERE
   NOT EXISTS (a ledger row with that reason)`: once per player, ever.
4. **Wallet**: an upsert that **adds** the total to `balance` (never
   `earned_total`).

If the Worker dies after step 2 and before step 3, that day is recorded but
unpaid; §5 lists those days. Nothing is ever paid twice. `checkin.test.ts` races
three claims on the same day (with a shield due) and checks one payout.

---

## 3. The streak and the shield

At the check-in on day **D** (yesterday = D − 1):

| Rows before D | Streak day for D | Shield |
| --- | --- | --- |
| D − 1 has a row (claim or shield) | that row's `streak_day` + 1 | — |
| D − 1 missing, D − 2 is a **claim**, D − 1's week has **no** shield row | D − 2's `streak_day` + 1 | a `shield` row is written for D − 1 |
| anything else (2+ missed days, or the week's shield is used, or no history) | 1 | — |

- **The week is the missed day's week**, Monday 00:00 to Sunday 24:00 Vietnam time.
  Missing a Sunday and checking in on Monday uses the *previous* week's shield.
- **Exactly one day.** A shield row only ever sits between two claims, so two missed
  days in a row are never covered, even across a week boundary.
- **Automatic.** The shield is written at the next check-in, not at midnight: a
  player who misses a day and comes back the day after sees it applied
  (`claimCheckin` returns `shieldUsed`). Before that, `readCheckin` says
  `shieldWillCover: "<the missed day>"`.
- A shielded day is not a check-in: it pays nothing, does not count in
  `totalCheckinDays`, and does not move the cycle.

`readCheckin(db, userId, now)` returns:

| Field | |
| --- | --- |
| `todayClaimed` | today has a check-in |
| `streakDay` | the live streak: today's streak day when claimed, otherwise the run today's check-in would continue (0 when broken) |
| `cycleIndex` | today's cell in the 7-day calendar, 0 … 6 (6 = the chest) |
| `next7` | the current cycle: `[{ day: 1…7, amount, isChest, claimed }]` |
| `todayAmount` | what today's check-in pays (or paid) |
| `shieldAvailableThisWeek` | no shield row in this week |
| `shieldUsedOn?` | the day this week's shield covered |
| `shieldWillCover?` | not claimed yet, and the next check-in will shield this missed day |
| `nextMilestone` | the first milestone never reached: `{ days, bonus, badge, daysLeft }`, or null |
| `totalCheckinDays` | every claim row, ever |
| `nextResetAt` | the next Vietnam midnight, unix ms |

`claimCheckin` returns `{ claimed, amount, milestone, shieldUsed, balance, state }`,
where `state` is the same object after the claim.

---

## 4. Rewards

| Streak day | 1 | 2 | 3 | 4 | 5 | 6 | 7 (chest) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tickets | 20 | 25 | 30 | 35 | 40 | 50 | 100 |

| Milestone (first time ever) | Bonus | Badge |
| --- | --- | --- |
| 7 days | +100 | `streak-7` |
| 30 days | +500 | `streak-30` |
| 100 days | +2,000 | `streak-100` |

Why these numbers (the comment above `CHECKIN_CYCLE` has the full argument): the
cheapest Prize Counter item (Xu Vũ Trụ's `coins10`) costs 300 tickets and a full
week pays exactly 300; the first week with its milestone pays 400, the card pack.
One check-in is at most 2 % of one game deposit (`MAX_DEPOSIT`, 5,000), so it
rewards coming back without competing with playing. Change the arrays in
`lib/checkin.ts` only together with this table, and re-check them against the
Prize Counter prices when a game adds a `shop`.

| `ticket_ledger.reason` | Counts as earnings? |
| --- | --- |
| `checkin` | no: `balance` only |
| `checkin:milestone:<n>` | no: `balance` only |

`checkin.test.ts` proves it: after a week of check-ins a full 5,000 deposit still
goes in whole (the daily earn cap ignores them), the weekly board shows only the
game's earnings, and `earned_total` stays at what games paid.

---

## 5. Inspecting and resetting (SQL)

Run from `apps/web`; `--local` for the dev database, `--remote` for production:

```sh
cd apps/web
bunx wrangler d1 migrations apply prod-engames --local   # once, for 0011
bunx wrangler d1 execute prod-engames --local --command "$(cat <<'SQL'
SELECT 1;
SQL
)"
# Same with --remote for production.
```

### One player's check-ins

```sql
SELECT c.day, c.kind, c.streak_day, c.amount,
       datetime(c.created_at / 1000, 'unixepoch', '+7 hours') AS at_vn
FROM daily_checkin c JOIN user u ON u.id = c.user_id
WHERE u.email = 'player@example.com'
ORDER BY c.day DESC
LIMIT 30;
```

### Their check-in tickets and milestones

```sql
SELECT l.delta, l.reason, datetime(l.created_at / 1000, 'unixepoch', '+7 hours') AS at_vn
FROM ticket_ledger l JOIN user u ON u.id = l.user_id
WHERE u.email = 'player@example.com' AND l.reason LIKE 'checkin%'
ORDER BY l.created_at DESC;
```

### Today's check-ins and shields

```sql
SELECT kind, count(*) AS players, sum(amount) AS tickets
FROM daily_checkin WHERE day = date('now', '+7 hours')
GROUP BY kind;
```

### Check-ins that were recorded but never paid

A claim row with no `checkin` ledger row at the same time (the Worker died between
the two). Pay one by hand with the `adjust` recipe in [`tickets.md`](tickets.md) §3,
using reason `checkin` and the row's `amount`.

```sql
SELECT u.email, c.day, c.amount
FROM daily_checkin c JOIN user u ON u.id = c.user_id
WHERE c.kind = 'claim'
  AND NOT EXISTS (SELECT 1 FROM ticket_ledger l
                  WHERE l.user_id = c.user_id AND l.reason = 'checkin' AND l.created_at = c.created_at);
```

### Reset

```sql
-- Let a player check in again today (the tickets already paid stay paid:
-- take them back with an `adjust` row first if that matters)
DELETE FROM daily_checkin
WHERE user_id = (SELECT id FROM user WHERE email = 'player@example.com')
  AND day = date('now', '+7 hours')
RETURNING day, kind, amount;

-- Give a player this week's shield back
DELETE FROM daily_checkin
WHERE user_id = (SELECT id FROM user WHERE email = 'player@example.com')
  AND kind = 'shield'
  AND day >= date('now', '+7 hours', '-6 days', 'weekday 1')
RETURNING day;
```

Deleting a past claim breaks the streak at that day (the next check-in sees the
gap). Milestones are keyed on the ledger reason: deleting a `checkin:milestone:<n>`
row lets that bonus be paid again (fix the wallet with the reconcile query in
`tickets.md` §3).

---

## 6. The profile

`readProfile(db, userId, { viewer, catalog?, now? })`
(`apps/web/src/server/db/profile.ts`) builds it in five statements: the user row
with every badge fact as scalar subqueries, one compound select (five terms, D1's
limit) over the tables holding per-player game activity, `readCheckin`'s two, and
the player's `user_badge` rows (plus one `INSERT` for the owner, see Badges).

| Field | From |
| --- | --- |
| `name`, `image`, `joinedAt` | `user` (`joinedAt` = `created_at`, unix ms) |
| `level`, `xp`, `xpIntoLevel`, `xpToNext`, `title` | `levelOf(computeXp(…))` in `apps/web/src/lib/profile.ts` |
| `tickets` | `ticket_wallet`: `{ balance, earnedTotal }` |
| `checkin` | `readCheckin`: `{ streakDay, todayClaimed, totalCheckinDays, shieldAvailableThisWeek, nextMilestone }` |
| `badges` | `badgeUnlocks(facts)` OR-ed with the stored `user_badge` rows: every badge, `{ id, unlocked, unlockedAt? }` |
| `games` | `[{ slug, plays, bestScore, firstPlayedAt, lastPlayedAt }]`, most recent first |
| `isOwner`, `owner?` | `owner = { email, profilePublic }`, only when the viewer is the player |

**Per-game stats.** `game_stat` counts plays for everyone together, so migration
0011 adds `user_game_stat` (`user_id`, `game_id`, `plays`, `first_played_at`,
`last_played_at`), bumped by `countPlay` for a signed-in player. Plays before 0011
were never counted per player. First and last activity also look at `score`,
`game_save`, saved online matches and `earn` ticket rows, so a game played before
0011 still shows up. `bestScore` is the all-time board's; an online board
(`<slug>:<mode>`) folds into its game without lending it a best score. The
`portal` row and games the catalogue no longer lists are left out.

**XP and levels.** XP = earned tickets ÷ 20 + 10 per play + 25 per check-in + 50 per
game tried + 100 per badge. Level L needs `50 · L · (L − 1)` XP in total (2 at 100, 5
at 1,000, 10 at 4,500, 30 at 43,500). Titles: 1 Tân binh / Rookie, 3 Khách quen /
Regular, 6 Tay chơi / Player, 10 Cao thủ / Ace, 15 Chiến tướng / Veteran, 20 Bậc thầy
/ Master, 30 Huyền thoại arcade / Arcade legend.

**Badges** (`BADGES`; icons are `@hugeicons/core-free-icons` names, the portal's
icon library). Each is first derived from data that already exists, then
**recorded permanently** (below).

| id | Tier | Unlocked by | `unlockedAt` |
| --- | --- | --- | --- |
| `first-play` | bronze | any game played | first activity |
| `explorer-5` | silver | 5 different games | the 5th game's first activity |
| `explorer-all` | gold | every catalogue game | the last one's first activity |
| `plays-100` | silver | 100 plays (`user_game_stat`) | — |
| `online-win` | silver | an online match won, kept in history (needs history consent) | the match |
| `top-10` | gold | a score with fewer than 10 ahead of it on its board | that score |
| `lucky-jar` | gold | a `jackpot_win` row | the win |
| `tickets-1k` | bronze | `earned_total` ≥ 1,000 | — |
| `tickets-10k` | silver | `earned_total` ≥ 10,000 | — |
| `first-favorite` | bronze | a `favorite` row | the first one |
| `first-purchase` | bronze | a `shop:%` ledger row | the first one |
| `streak-7` / `streak-30` / `streak-100` | bronze / silver / gold | the `checkin:milestone:<n>` ledger row | the bonus |
| `shield-saved` | bronze | a `shield` check-in row | the first one |

**Badges are permanent.** `user_badge(user_id, badge_id, unlocked_at)` (migration
0012, primary key `(user_id, badge_id)`, `ON DELETE CASCADE`) keeps every unlocked
badge. `readProfile` ORs the live unlocks with the stored rows; XP counts the
union, so XP never drops. When the **owner** views their profile, badges that
qualify live and are not stored yet are written with `INSERT … ON CONFLICT DO
NOTHING` (`unlocked_at` = the live date, or now for count-based badges); a public
visitor never causes a write, so a badge is recorded the first time its owner
sees it, and until then it still shows from live data. The stored `unlocked_at`
wins afterwards. So `top-10` stays once earned even after the player is pushed out
of every board. Concurrent first views are harmless (the key makes the second
insert a no-op). Never rename a badge id; the UI keys on them.

Inspect or reset one player's badges:

```sql
SELECT badge_id, datetime(unlocked_at / 1000, 'unixepoch') AS unlocked FROM user_badge WHERE user_id = '<id>' ORDER BY unlocked_at;
-- Forget one badge (re-recorded on the owner's next view if it still qualifies live)
DELETE FROM user_badge WHERE user_id = '<id>' AND badge_id = 'top-10';
-- Forget them all
DELETE FROM user_badge WHERE user_id = '<id>';
```

**Privacy.** `user.profile_public` (default 1) is a Better Auth additional field
with `input: false`: only `setProfilePublicFn` changes it. `readProfile` returns
null for a private profile unless the viewer is its owner, and returns the email
and the flag only under `owner`. The leaderboards carry `userId` and
`profilePublic` per row; the UI links a name to `/u/<userId>` only when it is
public.

```sql
-- Who has a private profile
SELECT id, name FROM user WHERE profile_public = 0;
-- Make one public again
UPDATE user SET profile_public = 1 WHERE email = 'player@example.com' RETURNING id;
```
