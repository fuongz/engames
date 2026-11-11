import type { GameManifest, Localized, ShopItem } from "@web-games/core";
import { and, count, eq, gte, like, lt, sql } from "drizzle-orm";
import { vnDayStart } from "./allowance";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { pendingGrant, ticketLedger, ticketWallet } from "./schema";

// SERVER-ONLY implementation behind server/shop.ts: the Prize Counter, where
// shared arcade tickets buy a game's own currency. Takes the database as a
// parameter (D1 in the Worker, bun:sqlite in shop.test.ts).
// See docs/standards/tickets.md §4.

const DAY = 24 * 3_600_000;

/** The ledger `reason` of a purchase: "shop:<slug>:<itemId>". */
export const shopReason = (slug: string, itemId: string) => `shop:${slug}:${itemId}`;

export interface BuyInput {
  userId: string;
  slug: string;
  itemId: string;
  /** Unix ms. */
  now: number;
  /** The game's `manifest.shop`; undefined for a game without one. */
  shop: GameManifest["shop"];
}

export type BuyResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "insufficient" | "daily-limit" | "unknown-item" };

/** How many of each item this player bought today (Vietnam day), keyed by ledger reason. */
async function boughtToday(db: Db, userId: string, now: number, reason?: string): Promise<Map<string, number>> {
  const dayStart = vnDayStart(now);
  const rows = await db
    .select({ reason: ticketLedger.reason, n: count() })
    .from(ticketLedger)
    .where(
      and(
        eq(ticketLedger.userId, userId),
        gte(ticketLedger.createdAt, dayStart),
        lt(ticketLedger.createdAt, dayStart + DAY),
        reason ? eq(ticketLedger.reason, reason) : like(ticketLedger.reason, "shop:%"),
      ),
    )
    .groupBy(ticketLedger.reason);
  return new Map(rows.map((r) => [r.reason, r.n]));
}

/**
 * Buy one `itemId` of game `slug` with shared tickets. On success the tickets
 * are gone and a `pending_grant` waits for the game's next `allowance.claim()`.
 *
 * D1 has no interactive transactions, and the two rules live in two places: the
 * BALANCE in `ticket_wallet`, the DAILY LIMIT in `ticket_ledger` (today's rows
 * with this item's reason). Each is enforced by the one statement that writes
 * the thing it guards, so concurrent buys serialise on it:
 *
 * 1. Pre-check the limit (a plain read). Only spares the common "limit already
 *    reached" case a debit-and-refund; it decides nothing.
 * 2. WALLET: `UPDATE … SET balance = balance − price WHERE balance >= price
 *    RETURNING`. Atomic, so the balance can never go below zero, however many
 *    buys race. No row back: `insufficient`, nothing written.
 * 3. LEDGER: one `INSERT … SELECT … WHERE (today's rows with this reason) <
 *    dailyLimit`, the same single-statement guard as the deposit cap: racing
 *    buys each count the others' rows, so the limit can never be passed. No row
 *    back: another buy took the last one; hand the price back to the wallet
 *    (`balance + price`) and answer `daily-limit`.
 * 4. PENDING GRANT, linked to the spend by `ledger_id`.
 *
 * Why the wallet goes first. If the Worker dies between two steps:
 * - after 2: the wallet is short with no ledger row. The reconcile query in
 *   tickets.md rebuilds the wallet from the ledger and gives it back.
 * - after 3: paid, nothing to deliver: a `shop:` ledger row with no
 *   `pending_grant` (the recipe in tickets.md finds and refunds it).
 * Neither ever delivers an item that was not paid for or takes tickets the
 * ledger cannot show. Ledger-first would leave a spend row whose debit may or
 * may not have happened, and the database could not tell which.
 *
 * Spends never count as earnings: the deposit cap and the weekly board sum
 * `reason = 'earn'` rows only, and `earned_total` is left alone.
 */
export async function buyItem(db: Db, input: BuyInput): Promise<BuyResult> {
  const { userId, slug, itemId, now, shop } = input;
  const item = shop?.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: "unknown-item" };
  const reason = shopReason(slug, item.id);
  const limit = item.dailyLimit;

  // 1. The common "sold out today" case, without touching the wallet
  if (limit !== undefined && ((await boughtToday(db, userId, now, reason)).get(reason) ?? 0) >= limit)
    return { ok: false, reason: "daily-limit" };

  const gameId = await gameIdOf(db, slug);

  // 2. WALLET: never below zero
  const [debited] = await db
    .update(ticketWallet)
    .set({ balance: sql`${ticketWallet.balance} - ${item.price}`, updatedAt: now })
    .where(and(eq(ticketWallet.userId, userId), gte(ticketWallet.balance, item.price)))
    .returning({ balance: ticketWallet.balance });
  if (!debited) return { ok: false, reason: "insufficient" };

  // 3. LEDGER: the spend, written only while today's limit has room
  const dayStart = vnDayStart(now);
  const sold = db
    .select({ n: count() })
    .from(ticketLedger)
    .where(
      and(
        eq(ticketLedger.userId, userId),
        eq(ticketLedger.reason, reason),
        gte(ticketLedger.createdAt, dayStart),
        lt(ticketLedger.createdAt, dayStart + DAY),
      ),
    );
  const [spend] = await db
    .insert(ticketLedger)
    .select(
      db
        .select({
          // Drizzle wants every column, in order; NULL lets SQLite number the row
          id: sql<number>`null`.as("id"),
          userId: sql<string>`${userId}`.as("user_id"),
          gameId: sql<number>`${gameId}`.as("game_id"),
          delta: sql<number>`${-item.price}`.as("delta"),
          reason: sql<string>`${reason}`.as("reason"),
          createdAt: sql<number>`${now}`.as("created_at"),
        })
        .from(sql`(select 1)`)
        .where(limit === undefined ? sql`1` : sql`(${sold}) < ${limit}`),
    )
    .returning({ id: ticketLedger.id });
  if (!spend) {
    // A racing buy took the last one: give the price back
    await db
      .update(ticketWallet)
      .set({ balance: sql`${ticketWallet.balance} + ${item.price}`, updatedAt: now })
      .where(eq(ticketWallet.userId, userId));
    return { ok: false, reason: "daily-limit" };
  }

  // 4. What the game picks up on its next claim
  await db.insert(pendingGrant).values({
    userId,
    gameId,
    kind: item.kind,
    amount: item.amount,
    source: `shop:${item.id}`,
    ledgerId: spend.id,
    createdAt: now,
  });
  return { ok: true, balance: debited.balance };
}

export interface ShopListingItem extends ShopItem {
  /** What is left of today's `dailyLimit` for this player (the whole limit when signed out); null = no limit. */
  remaining: number | null;
}

export interface ShopListingGame {
  slug: string;
  title: Localized<string>;
  items: ShopListingItem[];
}

/**
 * Every game's shop, with today's remaining limits for `userId` (null: signed
 * out, every `remaining` is the full limit). `catalogue` is the games to list.
 */
export async function listShop(
  db: Db,
  input: { userId: string | null; now: number; catalogue: GameManifest[] },
): Promise<ShopListingGame[]> {
  const { userId, now, catalogue } = input;
  const bought = userId ? await boughtToday(db, userId, now) : new Map<string, number>();
  return catalogue
    .filter((g) => (g.shop?.length ?? 0) > 0)
    .map((g) => ({
      slug: g.slug,
      title: g.title,
      items: (g.shop ?? []).map((item) => ({
        ...item,
        remaining:
          item.dailyLimit === undefined
            ? null
            : Math.max(0, item.dailyLimit - (bought.get(shopReason(g.slug, item.id)) ?? 0)),
      })),
    }));
}
