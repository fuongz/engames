import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame } from "@web-games/games";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { claimAllowance, nextDailyAt } from "#/server/db/allowance";

// Boundary: client-callable server functions and types only (layout rule D).
// See docs/standards/allowance.md.

/**
 * Claim whatever allowance is due for the signed-in player in a game with
 * `manifest.allowance`. Every grant returned is already recorded and is never
 * sent again: hand it to the game at once. The portal must not offer this inside
 * an online match.
 */
export const claimAllowanceFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z
        .string()
        .refine(
          (s) => findGame(s)?.allowance !== undefined,
          "Game has no allowance",
        ),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    if (!user) throw new Error("sign-in-required");
    const now = Date.now();
    const grants = await claimAllowance(getDb(), {
      userId: user.id,
      slug: data.slug,
      allowance: findGame(data.slug)?.allowance,
      now,
    });
    return { grants, nextDailyAt: nextDailyAt(now) };
  });
