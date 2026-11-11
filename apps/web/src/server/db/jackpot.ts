import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import {
  DAILY_CONTRIBUTION_CAP,
  DAILY_ROLLS,
  JACKPOT_ID,
  jackpotChance,
  TICKETS_PER_COIN,
} from "#/lib/jackpot";
import { vnDay } from "./allowance";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import {
  game,
  jackpotContribution,
  jackpotPool,
  jackpotRoll,
  jackpotWin,
  ticketLedger,
  ticketWallet,
  user,
} from "./schema";

// SERVER-ONLY implementation behind server/jackpot.ts: the shared arcade Lucky
// Jar (Hũ may mắn). Takes the database as a parameter (D1 in the Worker,
// bun:sqlite in jackpot.test.ts). See docs/standards/jackpot.md.
//
// D1 has no interactive transactions, so, like depositTickets and buyItem,
// every rule here is enforced by the ONE statement that writes what it guards:
// SQLite (and D1) runs a single statement atomically, and concurrent requests
// serialise on it. No statement depends on a value read earlier in the request
// unless its WHERE re-checks that value (compare-and-set).

/** The ledger `reason` of a jackpot payout. Not "earn": it never counts as earnings. */
export const JACKPOT_REASON = "jackpot";

/** How often `contribute` retries its compare-and-set before giving up on a hot row. */
const CAS_ATTEMPTS = 8;

export interface ContributeInput {
  userId: string;
  /** A game with `manifest.jackpot` (the boundary checks it). */
  slug: string;
  /** Coins the game fed the jar: a positive integer. */
  coins: number;
  /** Unix ms. */
  now: number;
}

export interface ContributeResult {
  /** Tickets that counted toward today's cap: `coins × 2`, or less once the cap is near. */
  accepted: number;
  /** The pool after this contribution (never above `cap`). */
  pool: number;
}

export interface RollInput {
  userId: string;
  slug: string;
  /** Unix ms. */
  now: number;
  /** A uniform number in [0, 1). Injectable for tests; defaults to `secureRandom`. */
  rand?: () => number;
}

export interface RollResult {
  won: boolean;
  /** Tickets paid into the winner's wallet; only when `won`. */
  amount?: number;
  /** The pool after this roll (back near the seed after a win). */
  pool: number;
  /** The round now open (one more than the round a win claimed). */
  round: number;
  /** True when today's DAILY_ROLLS were already used: nothing was drawn. */
  limited?: boolean;
}

/** One past jackpot, as anyone may see it. */
export interface JackpotWinner {
  /** The winner's first name (at most 12 characters), never an email; "" when there is nothing safe to show. */
  name: string;
  amount: number;
  gameSlug: string;
  /** Unix ms. */
  wonAt: number;
}

export interface JackpotState {
  pool: number;
  seed: number;
  cap: number;
  round: number;
  /** Newest first. */
  recent: JackpotWinner[];
}

/** A uniform number in [0, 1) from the platform CSPRNG (Workers and bun both have `crypto`). */
export function secureRandom(): number {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return n / 2 ** 32;
}

/**
 * The part of a display name safe to show to everyone: the first word, cut to
 * 12 characters. A name that looks like an email (some accounts have no other)
 * gives "", and the portal shows "a player" instead.
 */
export function publicName(name: string | null | undefined): string {
  const clean = (name ?? "")
    .normalize("NFC")
    .replace(/\p{C}/gu, "")
    .trim();
  if (!clean || clean.includes("@")) return "";
  const [first] = clean.split(/\s+/);
  return Array.from(first).slice(0, 12).join("");
}

async function readPool(db: Db) {
  const [row] = await db
    .select({
      pool: jackpotPool.pool,
      seed: jackpotPool.seed,
      cap: jackpotPool.cap,
      round: jackpotPool.round,
    })
    .from(jackpotPool)
    .where(eq(jackpotPool.id, JACKPOT_ID))
    .limit(1);
  // Migration 0010 inserts the row; without it there is no jar to play for
  if (!row) throw new Error("no-jackpot-pool");
  return row;
}

/**
 * Feed the jar: `coins × TICKETS_PER_COIN` tickets into the shared pool, at most
 * DAILY_CONTRIBUTION_CAP per player per game per Vietnam day. The pool never
 * passes `cap`. The tickets come from the house, not the player's wallet.
 *
 * Statement order:
 *
 * 1. CAP LEDGER (`jackpot_contribution`). An upsert's RETURNING only sees the
 *    new value, so a blind `min(cap, tickets + n)` could not say how much it
 *    took. Instead:
 *    a. ONE upsert that inserts today's row, or adds all of it only
 *       `WHERE tickets + n <= cap`. A row back: all of it went in. This is the
 *       usual case, and it needs no read.
 *    b. No row back (the cap is near): a compare-and-set. Read today's row,
 *       then upsert what is left only `WHERE tickets = <what was read>`. A
 *       racing contribution that got there first makes the WHERE fail, and
 *       this one re-reads and tries again.
 *    Either way the statement that writes the row is the one that checks the
 *    cap, so concurrent contributions can never pass it and `accepted` is exact.
 * 2. POOL: `pool = min(cap, pool + accepted)` in one UPDATE, so concurrent
 *    contributions add up and the pool can never pass the cap.
 *
 * The cap ledger goes first because it is the guard. If the Worker dies between
 * the two, the pool is short one contribution: house tickets, nobody's loss.
 */
export async function contribute(
  db: Db,
  input: ContributeInput,
): Promise<ContributeResult> {
  const { userId, slug, coins, now } = input;
  if (!Number.isSafeInteger(coins) || coins <= 0) throw new Error("bad-amount");
  const wanted = Math.min(coins * TICKETS_PER_COIN, DAILY_CONTRIBUTION_CAP);
  const gameId = await gameIdOf(db, slug);
  const day = vnDay(now);
  const key = and(
    eq(jackpotContribution.userId, userId),
    eq(jackpotContribution.gameId, gameId),
    eq(jackpotContribution.day, day),
  );

  const upsert = (take: number, where: SQL) =>
    db
      .insert(jackpotContribution)
      .values({ userId, gameId, day, tickets: take })
      .onConflictDoUpdate({
        target: [jackpotContribution.userId, jackpotContribution.gameId, jackpotContribution.day],
        set: { tickets: sql`${jackpotContribution.tickets} + excluded.tickets` },
        setWhere: where,
      })
      .returning({ tickets: jackpotContribution.tickets });

  // 1a. CAP LEDGER, the common case: all of it fits (or today's first row)
  let accepted = 0;
  const [whole] = await upsert(
    wanted,
    sql`${jackpotContribution.tickets} + excluded.tickets <= ${DAILY_CONTRIBUTION_CAP}`,
  );
  if (whole) accepted = wanted;

  // 1b. Near the cap: take what is left, compare-and-set on what was read
  for (let attempt = 0; !whole && attempt < CAS_ATTEMPTS; attempt++) {
    const [seen] = await db
      .select({ tickets: jackpotContribution.tickets })
      .from(jackpotContribution)
      .where(key)
      .limit(1);
    const take = Math.min(wanted, DAILY_CONTRIBUTION_CAP - (seen?.tickets ?? 0));
    if (take <= 0) break;
    // Missing when read: never update (a NULL compare is false), so a row
    // another request inserted meanwhile sends this one round again
    const [row] = await upsert(take, sql`${jackpotContribution.tickets} = ${seen?.tickets ?? null}`);
    if (row) {
      accepted = take;
      break;
    }
  }

  if (accepted === 0) return { accepted, pool: (await readPool(db)).pool };

  // 2. POOL: add, never overwrite, never past the cap
  const [pool] = await db
    .update(jackpotPool)
    .set({
      pool: sql`min(${jackpotPool.cap}, ${jackpotPool.pool} + ${accepted})`,
      updatedAt: now,
    })
    .where(eq(jackpotPool.id, JACKPOT_ID))
    .returning({ pool: jackpotPool.pool });
  if (!pool) throw new Error("no-jackpot-pool");
  return { accepted, pool: pool.pool };
}

/**
 * Roll for the jackpot once. At most DAILY_ROLLS per player per Vietnam day;
 * the chance is `jackpotChance(pool, seed, cap)`, 1 at the cap. A win pays the
 * whole pool into the player's ticket wallet and starts the next round at the
 * seed.
 *
 * Statement order (D1-safe: no transaction, each step one atomic statement):
 *
 * 1. RATE LIMIT: one upsert on `jackpot_roll` that adds 1 only
 *    `WHERE count < DAILY_ROLLS`. No row back: today's rolls are used up, and
 *    nothing is drawn. Racing rolls each take their own slot.
 * 2. READ the pool and its round, and draw `rand() < p` here, in the Worker.
 * 3. CLAIM: `UPDATE jackpot_pool SET pool = …, round = round + 1 WHERE id =
 *    'arcade' AND round = :round RETURNING`. Only the statement that changed the
 *    row wins: two rolls that both drew a win for round N both send it, the
 *    first moves the round to N + 1, and the second's WHERE no longer matches,
 *    so it gets no row and answers `won: false`. Contributions that land
 *    between the read and the claim are carried into the next round
 *    (`seed + (pool − :pool)`) instead of vanishing; the winner gets the pool
 *    they rolled against.
 * 4. WIN ROW in `jackpot_win` (unique on `round`: a second guard).
 * 5. LEDGER: `+amount` with reason "jackpot" and the same timestamp as the win.
 *    Not "earn", so it never counts toward the daily earn cap, `earned_total`
 *    or the weekly board.
 * 6. WALLET: an upsert that ADDS the amount.
 *
 * Everything after the claim only records it, so the claim goes first: a Worker
 * that dies after 3 leaves a round with no `jackpot_win` row, and after 4 a win
 * with no ledger row. Both are found and paid by the queries in jackpot.md.
 * Nothing is ever paid twice: only one request ever gets past 3 for a round.
 */
export async function roll(db: Db, input: RollInput): Promise<RollResult> {
  const { userId, slug, now, rand = secureRandom } = input;
  const gameId = await gameIdOf(db, slug);
  const day = vnDay(now);

  // 1. RATE LIMIT
  const [slot] = await db
    .insert(jackpotRoll)
    .values({ userId, day, count: 1 })
    .onConflictDoUpdate({
      target: [jackpotRoll.userId, jackpotRoll.day],
      set: { count: sql`${jackpotRoll.count} + 1` },
      setWhere: sql`${jackpotRoll.count} < ${DAILY_ROLLS}`,
    })
    .returning({ count: jackpotRoll.count });

  // 2. READ and DRAW
  const state = await readPool(db);
  if (!slot) return { won: false, pool: state.pool, round: state.round, limited: true };
  if (!(rand() < jackpotChance(state.pool, state.seed, state.cap))) {
    return { won: false, pool: state.pool, round: state.round };
  }

  // 3. CLAIM the round: only the statement that changes the row wins
  const [claimed] = await db
    .update(jackpotPool)
    .set({
      pool: sql`min(${jackpotPool.cap}, ${jackpotPool.seed} + max(0, ${jackpotPool.pool} - ${state.pool}))`,
      round: sql`${jackpotPool.round} + 1`,
      updatedAt: now,
    })
    .where(and(eq(jackpotPool.id, JACKPOT_ID), eq(jackpotPool.round, state.round)))
    .returning({ pool: jackpotPool.pool, round: jackpotPool.round });
  if (!claimed) {
    const after = await readPool(db);
    return { won: false, pool: after.pool, round: after.round };
  }
  const amount = state.pool;

  // 4. WIN ROW
  await db.insert(jackpotWin).values({ round: state.round, userId, gameId, amount, wonAt: now });

  // 5. LEDGER
  await db.insert(ticketLedger).values({
    userId,
    gameId,
    delta: amount,
    reason: JACKPOT_REASON,
    createdAt: now,
  });

  // 6. WALLET: add it, never overwrite; earned_total counts "earn" rows only
  await db
    .insert(ticketWallet)
    .values({ userId, balance: amount, earnedTotal: 0, updatedAt: now })
    .onConflictDoUpdate({
      target: ticketWallet.userId,
      set: {
        balance: sql`${ticketWallet.balance} + excluded.balance`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  return { won: true, amount, pool: claimed.pool, round: claimed.round };
}

/** The pool and the last `limit` winners, newest first. Public: no user ids, no emails. */
export async function jackpotState(
  db: Db,
  input: { limit: number },
): Promise<JackpotState> {
  const state = await readPool(db);
  const rows = await db
    .select({
      name: user.name,
      amount: jackpotWin.amount,
      gameSlug: game.slug,
      wonAt: jackpotWin.wonAt,
    })
    .from(jackpotWin)
    .innerJoin(user, eq(user.id, jackpotWin.userId))
    .innerJoin(game, eq(game.id, jackpotWin.gameId))
    .orderBy(desc(jackpotWin.wonAt), desc(jackpotWin.id))
    .limit(input.limit);
  return {
    ...state,
    recent: rows.map((r) => ({ ...r, name: publicName(r.name) })),
  };
}
