import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame } from "@web-games/games";
import { z } from "zod";
import { MAX_CONTRIBUTION_COINS } from "#/lib/jackpot";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { contribute, jackpotState, roll } from "#/server/db/jackpot";

// Boundary: client-callable server functions and types only (layout rule D).
// The shared arcade Lucky Jar, "Hũ may mắn". See docs/standards/jackpot.md.
//
// No response cache: the codebase has no pattern for one yet, and the portal
// polls this at most every 30 s per visible tab (stores/jackpot.ts).

export type { ContributeResult, JackpotState, JackpotWinner, RollResult } from "#/server/db/jackpot";

const jackpotSlug = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/)
  .refine((s) => findGame(s)?.jackpot === true, "Game has no jackpot");

/** The pool and the last `limit` winners (public: works signed out). */
export const getJackpotFn = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().int().min(1).max(20).default(20) }).default({ limit: 20 }))
  .handler(({ data }) => jackpotState(getDb(), { limit: data.limit }));

/**
 * Feed the jar `coins` coins (2 tickets each) from a game with
 * `manifest.jackpot`, for the signed-in player. Over today's cap it is clamped:
 * `accepted` says how many tickets went in. Never offered in an online match.
 */
export const contributeJackpotFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: jackpotSlug,
      coins: z.number().int().positive().max(MAX_CONTRIBUTION_COINS),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    if (!user) throw new Error("sign-in-required");
    return contribute(getDb(), { userId: user.id, slug: data.slug, coins: data.coins, now: Date.now() });
  });

/**
 * Roll once for the jackpot, for the signed-in player, from a game with
 * `manifest.jackpot`. The server draws (CSPRNG) and pays: on `won` the tickets
 * are already in the wallet. Over today's roll limit: `won: false, limited: true`.
 */
export const rollJackpotFn = createServerFn({ method: "POST" })
  .validator(z.object({ slug: jackpotSlug }))
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    if (!user) throw new Error("sign-in-required");
    return roll(getDb(), { userId: user.id, slug: data.slug, now: Date.now() });
  });
