import type { CouponReward } from "@web-games/core";
import { and, eq, gt, isNull, lt, notExists, or, sql } from "drizzle-orm";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { coupon, couponRedemption } from "./schema";

// SERVER-ONLY implementation behind server/coupons.ts. Takes the database as a
// parameter (D1 in the Worker, bun:sqlite in coupons.test.ts).

export type RedeemFailure =
  | "not-found"
  | "disabled"
  | "expired"
  | "used-up"
  | "already-redeemed"
  | "wrong-game"
  | "nothing-for-this-game";

export type RedeemResult =
  | { ok: true; code: string; rewards: CouponReward[] }
  | { ok: false; reason: RedeemFailure };

export interface RedeemInput {
  /** As the player typed it; normalised here. */
  code: string;
  userId: string;
  /** The game it is redeemed in. */
  game: string;
  /** The reward kinds that game accepts (`manifest.coupons.kinds`). */
  kinds: readonly string[];
  /** Unix ms. */
  now: number;
}

/** What a typed code is stored as: trimmed, uppercase, no spaces or dashes. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/** The coupon's rewards JSON, keeping only well-formed positive entries. */
function parseRewards(json: string): CouponReward[] {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((r) =>
    r &&
    typeof r === "object" &&
    typeof r.kind === "string" &&
    typeof r.amount === "number" &&
    Number.isFinite(r.amount) &&
    r.amount > 0
      ? [{ kind: r.kind, amount: r.amount }]
      : [],
  );
}

const forGame = (json: string, kinds: readonly string[]) =>
  parseRewards(json).filter((r) => kinds.includes(r.kind));

type CouponRow = typeof coupon.$inferSelect;

/** Why this row can't be redeemed in game `gameId` right now, ignoring the per-player rule. */
function refusal(
  row: CouponRow,
  gameId: number,
  now: number,
): RedeemFailure | null {
  if (row.disabled) return "disabled";
  if (row.expiresAt !== null && row.expiresAt <= now) return "expired";
  if (row.gameId !== null && row.gameId !== gameId) return "wrong-game";
  if (row.uses >= row.maxUses) return "used-up";
  return null;
}

const readCoupon = async (db: Db, code: string) =>
  (await db.select().from(coupon).where(eq(coupon.code, code)).limit(1))[0];

/** Hand a claimed use back (the claim lost a race, or turned out empty). */
const release = (db: Db, code: string) =>
  db
    .update(coupon)
    .set({ uses: sql`${coupon.uses} - 1` })
    .where(and(eq(coupon.code, code), gt(coupon.uses, 0)));

/**
 * Redeem `code` for a player in `game`, granting only the rewards of the kinds
 * the game accepts.
 *
 * Race safety without transactions. D1 has no interactive transactions, but it
 * runs every statement atomically and one at a time, so the guarantees rest on
 * two single-statement guards rather than on read-then-write:
 *
 * 1. CLAIM: one conditional UPDATE bumps `uses` only while
 *    `uses < max_uses`, not disabled, not expired, the game matches, AND the
 *    player has no redemption row yet. Two players racing for the last use both
 *    run this statement, and the second sees `uses = max_uses` and changes
 *    nothing — so `uses` can never pass `max_uses`.
 * 2. RECORD: INSERT the redemption with ON CONFLICT DO NOTHING. The primary key
 *    (code, user_id) is the per-player guard: if the same player fired two
 *    requests and both claimed before either recorded, exactly one insert
 *    lands. The loser hands its use back and reports already-redeemed. Only a
 *    request whose insert landed returns rewards, so nobody is granted twice.
 *
 * Why this order: if the Worker dies between the two statements, the cost is
 * one use counted that nobody received (the code may run out one early), and
 * the player can simply try again. The other order would leave a player marked
 * as redeemed who never got the rewards. A `db.batch` would make the pair
 * all-or-nothing, but a batch can't branch on the UPDATE's result, the second
 * statement would still need its own guard, and bun:sqlite (the tests) has no
 * batch — so the same ordering runs in both places.
 *
 * Nothing is consumed for a refusal: the checks before the claim are on the
 * row just read, and a failed claim changes nothing.
 */
export async function redeemCoupon(
  db: Db,
  input: RedeemInput,
): Promise<RedeemResult> {
  const code = normalizeCode(input.code);
  const { userId, game, kinds, now } = input;
  if (!code) return { ok: false, reason: "not-found" };

  const row = await readCoupon(db, code);
  if (!row) return { ok: false, reason: "not-found" };
  const gameId = await gameIdOf(db, game);
  const early = refusal(row, gameId, now);
  // used-up waits for the claim: the player may have taken that last use, and
  // already-redeemed is the truer answer then
  if (early && early !== "used-up") return { ok: false, reason: early };
  if (forGame(row.rewards, kinds).length === 0)
    return { ok: false, reason: "nothing-for-this-game" };

  // 1. CLAIM a use
  const [claimed] = await db
    .update(coupon)
    .set({ uses: sql`${coupon.uses} + 1` })
    .where(
      and(
        eq(coupon.code, code),
        eq(coupon.disabled, false),
        lt(coupon.uses, coupon.maxUses),
        or(isNull(coupon.expiresAt), gt(coupon.expiresAt, now)),
        or(isNull(coupon.gameId), eq(coupon.gameId, gameId)),
        notExists(
          db
            .select({ one: sql`1` })
            .from(couponRedemption)
            .where(
              and(
                eq(couponRedemption.code, code),
                eq(couponRedemption.userId, userId),
              ),
            ),
        ),
      ),
    )
    .returning({ rewards: coupon.rewards });

  if (!claimed) {
    const [mine] = await db
      .select({ code: couponRedemption.code })
      .from(couponRedemption)
      .where(
        and(
          eq(couponRedemption.code, code),
          eq(couponRedemption.userId, userId),
        ),
      )
      .limit(1);
    if (mine) return { ok: false, reason: "already-redeemed" };
    const latest = await readCoupon(db, code);
    if (!latest) return { ok: false, reason: "not-found" };
    return { ok: false, reason: refusal(latest, gameId, now) ?? "used-up" };
  }

  // The rewards as of the claim (the admin may have just edited them)
  const rewards = forGame(claimed.rewards, kinds);
  if (rewards.length === 0) {
    await release(db, code);
    return { ok: false, reason: "nothing-for-this-game" };
  }

  // 2. RECORD it for this player
  const recorded = await db
    .insert(couponRedemption)
    .values({
      code,
      userId,
      gameId,
      rewards: JSON.stringify(rewards),
      redeemedAt: now,
    })
    .onConflictDoNothing()
    .returning({ code: couponRedemption.code });
  if (recorded.length === 0) {
    await release(db, code);
    return { ok: false, reason: "already-redeemed" };
  }
  return { ok: true, code, rewards };
}
