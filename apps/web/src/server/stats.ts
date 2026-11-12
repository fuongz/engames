import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame } from "@web-games/games";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { addPlay, playCounts } from "#/server/db/stats";

// Boundary: client-callable server functions and types only (layout rule D).

/** How many times every game has been started, by slug. */
export const getPlayCounts = createServerFn({ method: "GET" }).handler(() => playCounts(getDb()));

/**
 * Count one play. The browser calls it at most once per game every 30 minutes
 * (stores/play-stats.ts), so a refresh doesn't inflate the number. A signed-in
 * player's play also counts on their profile (`user_game_stat`).
 */
export const countPlay = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().refine((s) => findGame(s) !== undefined, "Unknown game") }))
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    return addPlay(getDb(), data.slug, user ? { userId: user.id, now: Date.now() } : undefined);
  });
