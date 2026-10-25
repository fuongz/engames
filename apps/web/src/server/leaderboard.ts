import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame } from "@web-games/games";
import { boardKey } from "@web-games/core/online";
import { findOnlineGame } from "@web-games/games/online";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { saveScore, topScores } from "#/server/db/leaderboard";

// Boundary: client-callable server functions and types only (layout rule D).

export type { LeaderboardEntry, SaveResult } from "#/server/db/leaderboard";

const slug = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/)
  .refine((s) => findGame(s) !== undefined, "Unknown game");

/** Display names: printable, single-spaced, 2–20 characters. */
const playerName = z
  .string()
  .transform((s) =>
    s
      .normalize("NFC")
      .replace(/\p{C}/gu, "")
      .replace(/\s+/g, " ")
      .trim(),
  )
  .pipe(z.string().min(2, "Tên cần ít nhất 2 ký tự").max(20, "Tên tối đa 20 ký tự"));

export const getLeaderboard = createServerFn({ method: "GET" })
  .validator(
    z
      .object({ slug, limit: z.number().int().min(1).max(50).default(10), mode: z.enum(["coop"]).optional() })
      .refine((d) => !d.mode || findOnlineGame(d.slug) !== undefined, "Not an online game"),
  )
  // Online boards live under "<slug>:<mode>" in the same table (online-multiplayer.md §9)
  .handler(({ data }) => topScores(getDb(), boardKey(data.slug, data.mode), data.limit));

export const submitScore = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug,
      // Scores are client-reported; bound them so one bad request can't wreck a board.
      score: z.number().int().min(1).max(10_000_000),
      detail: z.string().max(40).optional(),
      name: playerName.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const signedIn = await currentUser(getRequestHeaders() as unknown as Headers);
    const name = signedIn?.name ? signedIn.name.slice(0, 20) : data.name;
    if (!name) throw new Error("Cần nhập tên để lưu điểm");
    return saveScore(getDb(), {
      gameSlug: data.slug,
      score: data.score,
      detail: data.detail ?? null,
      name,
      userId: signedIn?.id ?? null,
    });
  });
