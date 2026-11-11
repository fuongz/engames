import { and, eq, gte, lt, sql, sum } from "drizzle-orm";
import { DAILY_EARN_CAP, MAX_DEPOSIT } from "#/lib/tickets";
import { vnDayStart } from "./allowance";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { ticketLedger, ticketWallet } from "./schema";

// SERVER-ONLY implementation behind server/tickets.ts. Takes the database as a
// parameter (D1 in the Worker, bun:sqlite in tickets.test.ts).
// See docs/standards/tickets.md.

export { DAILY_EARN_CAP, MAX_DEPOSIT };

const DAY = 24 * 3_600_000;

export interface DepositInput {
  userId: string;
  slug: string;
  /** The game's `manifest.tickets`; anything but true is refused. */
  tickets: boolean | undefined;
  /** What the game asked for: a positive integer. */
  amount: number;
  /** Unix ms. */
  now: number;
}

export interface DepositResult {
  balance: number;
  /** What actually went into the wallet: `amount`, or less when a cap applied. */
  accepted: number;
  /**
   * Why `accepted` is below `amount`: "deposit" (over MAX_DEPOSIT) or "daily"
   * (this game's DAILY_EARN_CAP for today is used up). Null when all of it went in.
   */
  clamped: "deposit" | "daily" | null;
}

export interface TicketBalance {
  balance: number;
  earnedTotal: number;
}

export async function getTicketBalance(
  db: Db,
  userId: string,
): Promise<TicketBalance> {
  const [row] = await db
    .select({ balance: ticketWallet.balance, earnedTotal: ticketWallet.earnedTotal })
    .from(ticketWallet)
    .where(eq(ticketWallet.userId, userId))
    .limit(1);
  return row ?? { balance: 0, earnedTotal: 0 };
}

/**
 * Earn `amount` tickets in game `slug`, within the caps, and return the new
 * balance and how many were accepted. An over-cap deposit is clamped to what
 * remains, never dropped silently: `accepted` and `clamped` say what happened.
 *
 * Statement order, and why not a batch. D1 has no interactive transactions. A
 * `db.batch` would make the two writes all-or-nothing, but the wallet update
 * depends on how much the ledger statement accepted (the daily cap is decided
 * inside it), a batch cannot branch on that, and bun:sqlite (the tests) has no
 * batch. So two single-statement guards, run in this order:
 *
 * 1. LEDGER: one `INSERT … SELECT` computes `min(amount, cap − today's earnings)`
 *    from the ledger itself and inserts only when that is positive. SQLite (and
 *    D1) runs a statement atomically, so concurrent deposits each see the sum
 *    including the others' rows: together they can never pass the daily cap.
 * 2. WALLET: an upsert that ADDS the accepted amount (`balance = balance + n`),
 *    so concurrent deposits never overwrite each other.
 *
 * The ledger goes first because it is the record. If the Worker dies between
 * the two, the player is short that one deposit in the wallet but nothing is
 * ever credited without a ledger row; the reconcile query in tickets.md
 * rebuilds a wallet from its ledger. The other order could credit tickets the
 * cap should have refused.
 */
export async function depositTickets(
  db: Db,
  input: DepositInput,
): Promise<DepositResult> {
  const { userId, slug, tickets, amount, now } = input;
  if (tickets !== true) throw new Error("no-tickets");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("bad-amount");
  const gameId = await gameIdOf(db, slug);
  const wanted = Math.min(amount, MAX_DEPOSIT);
  const dayStart = vnDayStart(now);

  const earnedToday = db
    .select({ n: sql`coalesce(${sum(ticketLedger.delta)}, 0)` })
    .from(ticketLedger)
    .where(
      and(
        eq(ticketLedger.userId, userId),
        eq(ticketLedger.gameId, gameId),
        eq(ticketLedger.reason, "earn"),
        gte(ticketLedger.createdAt, dayStart),
        lt(ticketLedger.createdAt, dayStart + DAY),
      ),
    );
  const room = sql<number>`min(${wanted}, ${DAILY_EARN_CAP} - (${earnedToday}))`;

  // 1. LEDGER: what fits under today's cap, decided and written in one statement
  const [row] = await db
    .insert(ticketLedger)
    .select(
      db
        .select({
          // Drizzle wants every column, in order; NULL lets SQLite number the row
          id: sql<number>`null`.as("id"),
          userId: sql<string>`${userId}`.as("user_id"),
          gameId: sql<number>`${gameId}`.as("game_id"),
          delta: sql<number>`d`.as("delta"),
          reason: sql<string>`'earn'`.as("reason"),
          createdAt: sql<number>`${now}`.as("created_at"),
        })
        .from(sql`(select ${room} as d)`)
        .where(sql`d > 0`),
    )
    .returning({ delta: ticketLedger.delta });

  const accepted = row?.delta ?? 0;
  const clamped =
    accepted < wanted ? "daily" : wanted < amount ? "deposit" : null;
  if (accepted === 0) {
    const { balance } = await getTicketBalance(db, userId);
    return { balance, accepted, clamped };
  }

  // 2. WALLET: add it, never overwrite
  const [wallet] = await db
    .insert(ticketWallet)
    .values({ userId, balance: accepted, earnedTotal: accepted, updatedAt: now })
    .onConflictDoUpdate({
      target: ticketWallet.userId,
      set: {
        balance: sql`${ticketWallet.balance} + excluded.balance`,
        earnedTotal: sql`${ticketWallet.earnedTotal} + excluded.earned_total`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning({ balance: ticketWallet.balance });
  return { balance: wallet?.balance ?? accepted, accepted, clamped };
}
