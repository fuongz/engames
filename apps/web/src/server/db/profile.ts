import type { Localized } from "@web-games/core/i18n";
import { eq, sql } from "drizzle-orm";
import { milestoneReason } from "#/lib/checkin";
import { type BadgeId, type BadgeState, badgeUnlocks, computeXp, levelOf } from "#/lib/profile";
import { type NextMilestone, readCheckin } from "./checkin";
import { PORTAL_SLUG } from "./games";
import type { Db } from "./leaderboard";
import {
  dailyCheckin,
  favorite,
  game,
  gameSave,
  jackpotWin,
  onlineMatch,
  onlineMatchPlayer,
  score,
  ticketLedger,
  ticketWallet,
  user,
  userBadge,
  userGameStat,
} from "./schema";

// SERVER-ONLY implementation behind server/profile.ts. Takes the database as a
// parameter (D1 in the Worker, bun:sqlite in profile.test.ts).
// See docs/standards/checkin.md §6.

/** One game on a profile. Times are unix ms. */
export interface ProfileGameStat {
  slug: string;
  /** Games started while signed in (counted from migration 0011 on). */
  plays: number;
  /** Best score on the game's all-time board, or null without one. */
  bestScore: number | null;
  /** Earliest activity seen in the game: a play, score, save, online match or ticket earned. */
  firstPlayedAt: number;
  /** Latest such activity. */
  lastPlayedAt: number;
}

export interface ProfileCheckin {
  streakDay: number;
  todayClaimed: boolean;
  totalCheckinDays: number;
  shieldAvailableThisWeek: boolean;
  nextMilestone: NextMilestone | null;
}

/** A player's profile, as one viewer may see it. Nothing in it is private unless under `owner`. */
export interface Profile {
  userId: string;
  name: string;
  image: string | null;
  /** Account creation, unix ms. */
  joinedAt: number;
  level: number;
  xp: number;
  /** XP into the current level. */
  xpIntoLevel: number;
  /** XP still needed for the next level. */
  xpToNext: number;
  title: Localized<string>;
  tickets: { balance: number; earnedTotal: number };
  checkin: ProfileCheckin;
  /** Every badge in `BADGES` order. */
  badges: BadgeState[];
  /** Games played, most recent first. */
  games: ProfileGameStat[];
  /** The viewer is this player. */
  isOwner: boolean;
  /** Only for the owner: what other players never see. */
  owner?: { email: string; profilePublic: boolean };
}

export interface ReadProfileOptions {
  /** Who is looking: their user id, or null signed out. */
  viewer: string | null;
  /**
   * The catalogue's slugs (`games` from @web-games/games). Per-game stats keep
   * only these, and "explorer-all" needs its size. Omitted: every game row the
   * player touched, and explorer-all stays locked.
   */
  catalog?: readonly string[];
  /** Unix ms; defaults to Date.now(). */
  now?: number;
}

const ms = (seconds: number | null) => (seconds === null ? null : Number(seconds) * 1000);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/**
 * Per game this player touched: plays, first and last activity, best score.
 * ONE compound select of five terms (D1's limit is five), each a table that
 * holds per-player rows: `user_game_stat`, `score`, `game_save`, online matches,
 * and `earn` ticket rows. Times are converted to ms in SQL (score, saves and
 * matches store seconds). Online boards (`<slug>:<mode>`) come back under
 * their own row and are folded into their game by the caller.
 */
async function readGames(db: Db, userId: string) {
  const activity = sql`(
    select ${userGameStat.gameId} as gid, ${userGameStat.plays} as plays, ${userGameStat.firstPlayedAt} as t0, ${userGameStat.lastPlayedAt} as t1, null as best
      from ${userGameStat} where ${userGameStat.userId} = ${userId}
    union all
    select ${score.gameId}, 0, ${score.createdAt} * 1000, ${score.createdAt} * 1000, ${score.score}
      from ${score} where ${score.userId} = ${userId}
    union all
    select ${gameSave.gameId}, 0, ${gameSave.updatedAt} * 1000, ${gameSave.updatedAt} * 1000, null
      from ${gameSave} where ${gameSave.userId} = ${userId}
    union all
    select ${onlineMatch.gameId}, 0, ${onlineMatch.playedAt} * 1000, ${onlineMatch.playedAt} * 1000, null
      from ${onlineMatchPlayer} join ${onlineMatch} on ${onlineMatch.id} = ${onlineMatchPlayer.matchId}
      where ${onlineMatchPlayer.userId} = ${userId}
    union all
    select ${ticketLedger.gameId}, 0, min(${ticketLedger.createdAt}), max(${ticketLedger.createdAt}), null
      from ${ticketLedger} where ${ticketLedger.userId} = ${userId} and ${ticketLedger.reason} = 'earn'
      group by ${ticketLedger.gameId}
  ) a`;
  return db
    .select({
      slug: game.slug,
      plays: sql<number>`sum(a.plays)`,
      first: sql<number>`min(a.t0)`,
      last: sql<number>`max(a.t1)`,
      best: sql<number | null>`max(a.best)`,
    })
    .from(activity)
    .innerJoin(game, sql`${game.id} = a.gid`)
    .groupBy(game.slug);
}

/**
 * The player's row and every scalar the badges need, in one statement. The
 * subqueries compare with the `userId` PARAMETER, never `${user.id}`: inside a
 * select field drizzle renders a column unqualified (`"id"`), which would bind
 * to the subquery's own `id` column (jackpot_win, ticket_ledger, score …).
 */
async function readFacts(db: Db, userId: string) {
  const prefix = milestoneReason(0).slice(0, -1);
  const [row] = await db
    .select({
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
      profilePublic: user.profilePublic,
      balance: sql<number | null>`(select ${ticketWallet.balance} from ${ticketWallet} where ${ticketWallet.userId} = ${userId})`,
      earnedTotal: sql<
        number | null
      >`(select ${ticketWallet.earnedTotal} from ${ticketWallet} where ${ticketWallet.userId} = ${userId})`,
      favoriteAt: sql<number | null>`(select min(${favorite.createdAt}) from ${favorite} where ${favorite.userId} = ${userId})`,
      purchaseAt: sql<
        number | null
      >`(select min(${ticketLedger.createdAt}) from ${ticketLedger} where ${ticketLedger.userId} = ${userId} and ${ticketLedger.reason} like 'shop:%')`,
      jackpotWinAt: sql<number | null>`(select min(${jackpotWin.wonAt}) from ${jackpotWin} where ${jackpotWin.userId} = ${userId})`,
      onlineWinAt: sql<
        number | null
      >`(select min(${onlineMatch.playedAt}) from ${onlineMatchPlayer} join ${onlineMatch} on ${onlineMatch.id} = ${onlineMatchPlayer.matchId} where ${onlineMatchPlayer.userId} = ${userId} and ${onlineMatchPlayer.outcome} = 'win')`,
      // A score of theirs with fewer than 10 scores strictly ahead of it on its board
      top10At: sql<number | null>`(select min(s.created_at) from ${score} s where s.user_id = ${userId}
        and (select count(*) from ${score} s2 where s2.game_id = s.game_id and s2.score > s.score) < 10)`,
      shieldAt: sql<
        number | null
      >`(select min(${dailyCheckin.createdAt}) from ${dailyCheckin} where ${dailyCheckin.userId} = ${userId} and ${dailyCheckin.kind} = 'shield')`,
      milestones: sql<
        string | null
      >`(select group_concat(${ticketLedger.reason} || '@' || ${ticketLedger.createdAt}) from ${ticketLedger} where ${ticketLedger.userId} = ${userId} and ${ticketLedger.reason} like ${`${prefix}%`})`,
    })
    .from(user)
    .where(eq(user.id, userId));
  return row;
}

/**
 * A player's profile as `viewer` sees it, or null when there is no such player,
 * or when their profile is private (`user.profile_public = 0`) and the viewer is
 * not them. Never returns the email or the privacy flag to anyone but the owner.
 */
export async function readProfile(db: Db, userId: string, opts: ReadProfileOptions): Promise<Profile | null> {
  const now = opts.now ?? Date.now();
  const facts = await readFacts(db, userId);
  if (!facts) return null;
  const isOwner = opts.viewer === userId;
  if (!facts.profilePublic && !isOwner) return null;

  const [rows, checkin, stored] = await Promise.all([
    readGames(db, userId),
    readCheckin(db, userId, now),
    db.select({ id: userBadge.badgeId, at: userBadge.unlockedAt }).from(userBadge).where(eq(userBadge.userId, userId)),
  ]);

  // Fold online boards ("<slug>:<mode>") into their game; drop the portal row and
  // anything the catalogue no longer lists
  const listed = opts.catalog ? new Set(opts.catalog) : null;
  const bySlug = new Map<string, ProfileGameStat>();
  for (const r of rows) {
    const [slug, mode] = r.slug.split(":");
    if (!slug || slug === PORTAL_SLUG || (listed && !listed.has(slug))) continue;
    const best = mode === undefined ? num(r.best) : null;
    const cur = bySlug.get(slug);
    const first = Number(r.first);
    const last = Number(r.last);
    if (!cur) {
      bySlug.set(slug, { slug, plays: Number(r.plays ?? 0), bestScore: best, firstPlayedAt: first, lastPlayedAt: last });
      continue;
    }
    cur.plays += Number(r.plays ?? 0);
    cur.firstPlayedAt = Math.min(cur.firstPlayedAt, first);
    cur.lastPlayedAt = Math.max(cur.lastPlayedAt, last);
    if (best !== null) cur.bestScore = Math.max(cur.bestScore ?? best, best);
  }
  const games = [...bySlug.values()].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt || a.slug.localeCompare(b.slug));

  const milestoneAt: Partial<Record<7 | 30 | 100, number>> = {};
  for (const part of (facts.milestones ?? "").split(",")) {
    const m = /^checkin:milestone:(\d+)@(\d+)$/.exec(part);
    const days = Number(m?.[1]);
    if (m && (days === 7 || days === 30 || days === 100)) milestoneAt[days] = Number(m[2]);
  }
  const plays = games.reduce((a, g) => a + g.plays, 0);
  const earnedTotal = Number(facts.earnedTotal ?? 0);
  const live = badgeUnlocks({
    gamesFirstPlayed: games.map((g) => g.firstPlayedAt),
    catalogSize: opts.catalog?.length ?? 0,
    plays,
    earnedTotal,
    onlineWinAt: ms(num(facts.onlineWinAt)),
    top10At: ms(num(facts.top10At)),
    jackpotWinAt: num(facts.jackpotWinAt),
    favoriteAt: ms(num(facts.favoriteAt)),
    purchaseAt: num(facts.purchaseAt),
    milestoneAt,
    shieldAt: num(facts.shieldAt),
  });
  // Badges are permanent: a stored row keeps a badge unlocked (and supplies its
  // date) even when the live data no longer qualifies, e.g. a top 10 lost
  const storedAt = new Map(stored.map((r) => [r.id, Number(r.at)]));
  const badges: BadgeState[] = live.map((b) => {
    const at = storedAt.get(b.id);
    if (at !== undefined) return { id: b.id, unlocked: true, unlockedAt: at };
    return b;
  });
  // Record newly unlocked badges, only for the owner: a visitor never causes a write.
  // ON CONFLICT DO NOTHING makes a concurrent first view harmless
  if (isOwner) {
    const fresh = live.filter((b) => b.unlocked && !storedAt.has(b.id));
    if (fresh.length > 0) {
      await db
        .insert(userBadge)
        .values(fresh.map((b) => ({ userId, badgeId: b.id as BadgeId, unlockedAt: b.unlockedAt ?? now })))
        .onConflictDoNothing();
      for (const b of badges) {
        const f = fresh.find((x) => x.id === b.id);
        if (f) b.unlockedAt = f.unlockedAt ?? now;
      }
    }
  }
  const level = levelOf(
    computeXp({
      earnedTotal,
      plays,
      checkinDays: checkin.totalCheckinDays,
      gamesTried: games.length,
      badges: badges.filter((b) => b.unlocked).length,
    }),
  );

  return {
    userId,
    name: facts.name,
    image: facts.image,
    joinedAt: facts.createdAt.getTime(),
    level: level.level,
    xp: level.xp,
    xpIntoLevel: level.xpIntoLevel,
    xpToNext: level.xpToNext,
    title: level.title,
    tickets: { balance: Number(facts.balance ?? 0), earnedTotal },
    checkin: {
      streakDay: checkin.streakDay,
      todayClaimed: checkin.todayClaimed,
      totalCheckinDays: checkin.totalCheckinDays,
      shieldAvailableThisWeek: checkin.shieldAvailableThisWeek,
      nextMilestone: checkin.nextMilestone,
    },
    badges,
    games,
    isOwner,
    ...(isOwner ? { owner: { email: facts.email, profilePublic: facts.profilePublic } } : {}),
  };
}

/** Turn the player's profile public (others can open it) or private. Returns the new value. */
export async function setProfilePublic(db: Db, userId: string, on: boolean): Promise<boolean> {
  const [row] = await db
    .update(user)
    .set({ profilePublic: on })
    .where(eq(user.id, userId))
    .returning({ profilePublic: user.profilePublic });
  if (!row) throw new Error("no-such-user");
  return row.profilePublic;
}
