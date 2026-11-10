import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame } from "@web-games/games";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { redeemCoupon } from "#/server/db/coupons";

// Boundary: client-callable server functions and types only (layout rule D).
// See docs/standards/coupons.md. No rate limit yet (there is no helper in this
// codebase); codes are long and random, and the doc spells out the risk.

export type { RedeemFailure, RedeemResult } from "#/server/db/coupons";

/**
 * Redeem a coupon for the signed-in player in a game that accepts coupons. On
 * success the code is spent: hand the rewards to the game at once. The portal
 * must not offer this inside an online match.
 */
export const redeemCode = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z
        .string()
        .refine(
          (s) => findGame(s)?.coupons !== undefined,
          "Game takes no coupons",
        ),
      code: z.string().min(4).max(64),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    if (!user) throw new Error("sign-in-required");
    return redeemCoupon(getDb(), {
      code: data.code,
      userId: user.id,
      game: data.slug,
      kinds: findGame(data.slug)?.coupons?.kinds ?? [],
      now: Date.now(),
    });
  });
