import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { Db } from "./leaderboard";
import { historyConsent, onlineMatch, onlineMatchPlayer } from "./schema";

// SERVER-ONLY implementation behind server/history.ts: signed-in players'
// online match history, kept only for those who said yes.

export type Outcome = "win" | "loss" | "draw";

/** true / false once answered, null if the player was never asked. */
export async function consentOf(db: Db, userId: string): Promise<boolean | null> {
  const [row] = await db.select({ enabled: historyConsent.enabled }).from(historyConsent).where(eq(historyConsent.userId, userId));
  return row ? row.enabled : null;
}

export async function setConsent(db: Db, userId: string, enabled: boolean) {
  await db
    .insert(historyConsent)
    .values({ userId, enabled })
    .onConflictDoUpdate({ target: historyConsent.userId, set: { enabled, updatedAt: new Date() } });
}

export interface MatchPlayerInput {
  seat: number;
  name: string;
  /** The player's account, if signed in (kept only if they agreed). */
  userId: string | null;
  score: number;
  detail: string;
  outcome: Outcome | null;
}

export interface MatchInput {
  gameSlug: string;
  mode: string;
  roomCode: string;
  settings: Record<string, string>;
  postedAt: number;
  players: MatchPlayerInput[];
}

/**
 * Keep a finished match for every player who agreed. Nothing is written when
 * nobody did; a replayed post (same room and time) is ignored. Returns the match
 * id, or null when nothing was saved.
 */
export async function recordMatch(db: Db, input: MatchInput): Promise<number | null> {
  const members = input.players.map((p) => p.userId).filter((id): id is string => id !== null);
  if (members.length === 0) return null;
  const agreed = new Set(
    (
      await db
        .select({ userId: historyConsent.userId })
        .from(historyConsent)
        .where(and(inArray(historyConsent.userId, members), eq(historyConsent.enabled, true)))
    ).map((r) => r.userId),
  );
  if (agreed.size === 0) return null;
  const [row] = await db
    .insert(onlineMatch)
    .values({
      gameSlug: input.gameSlug,
      mode: input.mode,
      roomCode: input.roomCode,
      settings: JSON.stringify(input.settings),
      postedAt: input.postedAt,
    })
    .onConflictDoNothing()
    .returning({ id: onlineMatch.id });
  if (!row) return null;
  await db.insert(onlineMatchPlayer).values(
    input.players.map((p) => ({
      matchId: row.id,
      seat: p.seat,
      name: p.name.slice(0, 20),
      userId: p.userId && agreed.has(p.userId) ? p.userId : null,
      score: p.score,
      detail: p.detail.slice(0, 40),
      outcome: p.outcome,
    })),
  );
  return row.id;
}

export interface HistoryEntry {
  id: number;
  gameSlug: string;
  mode: string;
  settings: Record<string, string>;
  /** Unix seconds. */
  playedAt: number;
  you: { seat: number; score: number; detail: string | null; outcome: Outcome | null };
  /** Everyone else in the match, in seat order. */
  others: { seat: number; name: string; outcome: Outcome | null }[];
}

const asOutcome = (s: string | null): Outcome | null => (s === "win" || s === "loss" || s === "draw" ? s : null);

function parseSettings(s: string): Record<string, string> {
  try {
    const v = JSON.parse(s) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v))
      return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {}
  return {};
}

/** A player's matches, newest first; pass the last id seen as `before` for the next page. */
export async function historyFor(db: Db, userId: string, limit: number, before?: number): Promise<HistoryEntry[]> {
  const mine = await db
    .select({
      id: onlineMatch.id,
      gameSlug: onlineMatch.gameSlug,
      mode: onlineMatch.mode,
      settings: onlineMatch.settings,
      playedAt: onlineMatch.playedAt,
      seat: onlineMatchPlayer.seat,
      score: onlineMatchPlayer.score,
      detail: onlineMatchPlayer.detail,
      outcome: onlineMatchPlayer.outcome,
    })
    .from(onlineMatchPlayer)
    .innerJoin(onlineMatch, eq(onlineMatch.id, onlineMatchPlayer.matchId))
    .where(and(eq(onlineMatchPlayer.userId, userId), before === undefined ? undefined : lt(onlineMatch.id, before)))
    .orderBy(desc(onlineMatch.id))
    .limit(limit);
  if (mine.length === 0) return [];
  const all = await db
    .select({ matchId: onlineMatchPlayer.matchId, seat: onlineMatchPlayer.seat, name: onlineMatchPlayer.name, outcome: onlineMatchPlayer.outcome })
    .from(onlineMatchPlayer)
    .where(inArray(onlineMatchPlayer.matchId, mine.map((m) => m.id)))
    .orderBy(onlineMatchPlayer.seat);
  return mine.map((m) => ({
    id: m.id,
    gameSlug: m.gameSlug,
    mode: m.mode,
    settings: parseSettings(m.settings),
    playedAt: Math.floor(m.playedAt.getTime() / 1000),
    you: { seat: m.seat, score: m.score, detail: m.detail, outcome: asOutcome(m.outcome) },
    others: all.filter((p) => p.matchId === m.id && p.seat !== m.seat).map((p) => ({ seat: p.seat, name: p.name, outcome: asOutcome(p.outcome) })),
  }));
}
