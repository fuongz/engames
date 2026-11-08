import { env } from "cloudflare:workers";
import { boardKey, verifyHmac } from "@web-games/core/online";
import { findOnlineGame } from "@web-games/games/online";
import { z } from "zod";
import { recordMatch } from "#/server/db/history";
import type { Db } from "#/server/db/leaderboard";
import { saveScore } from "#/server/db/leaderboard";

// SERVER-ONLY: a finished online match, posted by the realtime Worker with an
// HMAC of the body (docs/standards/online-multiplayer.md §8).

/** A post older than this is refused, so a captured one cannot be replayed later. */
const MAX_AGE_MS = 60_000;

const resultsBody = z.object({
  board: z.string().max(60),
  slug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  code: z.string().max(10),
  at: z.number(),
  results: z
    .array(
      z.object({
        userId: z.string().min(1).max(100),
        name: z.string().min(1).max(40),
        score: z.number().int().min(1).max(10_000_000),
        detail: z.string().max(40),
      }),
    )
    .max(6),
  // Since match history: every seat, the room's mode and settings. Optional so a
  // room deployed before it still posts scores.
  mode: z.string().max(10).optional(),
  settings: z.record(z.string().max(24), z.string().max(24)).optional(),
  players: z
    .array(
      z.object({
        seat: z.number().int().min(0).max(5),
        userId: z.string().min(1).max(100).nullable(),
        name: z.string().min(1).max(40),
        score: z.number().int().min(0).max(10_000_000),
        detail: z.string().max(40),
        outcome: z.enum(["win", "loss", "draw"]).optional(),
      }),
    )
    .max(6)
    .optional(),
});

export async function acceptResults(db: Db, raw: string, signature: string | null, now = Date.now()) {
  if (!signature || !(await verifyHmac(env.TICKET_SECRET, raw, signature))) return { status: 401, error: "bad signature" } as const;
  let parsed: z.infer<typeof resultsBody>;
  try {
    parsed = resultsBody.parse(JSON.parse(raw));
  } catch {
    return { status: 400, error: "bad body" } as const;
  }
  if (Math.abs(now - parsed.at) > MAX_AGE_MS) return { status: 400, error: "stale" } as const;
  const game = findOnlineGame(parsed.slug);
  if (!game || parsed.board !== boardKey(parsed.slug, game.mode)) return { status: 400, error: "bad board" } as const;
  for (const r of parsed.results)
    await saveScore(db, { gameSlug: parsed.board, score: r.score, detail: r.detail, name: r.name.slice(0, 20), userId: r.userId });
  // History is kept only for the players who agreed to it (recordMatch checks)
  const match = parsed.players
    ? await recordMatch(db, {
        gameSlug: parsed.slug,
        mode: game.mode,
        roomCode: parsed.code,
        settings: parsed.settings ?? {},
        postedAt: parsed.at,
        players: parsed.players.map((p) => ({ ...p, outcome: p.outcome ?? null })),
      })
    : null;
  return { status: 200, saved: parsed.results.length, history: match !== null } as const;
}
