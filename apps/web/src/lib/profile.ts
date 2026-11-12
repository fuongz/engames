import type { Localized } from "@web-games/core/i18n";

// The player profile's rules (docs/standards/checkin.md §6): XP, levels and
// titles, and the badge catalogue with what unlocks each badge. Pure and
// isomorphic: the server turns its rows into `ProfileFacts`, these functions
// decide, and the UI draws from the same catalogue.

// ---------------------------------------------------------------- XP and levels

/** What XP is made of: every input is a count the database already keeps. */
export interface XpInput {
  /** `ticket_wallet.earned_total`: tickets earned in games (never spends, jackpots or check-ins). */
  earnedTotal: number;
  /** Games started while signed in (`user_game_stat.plays`, summed). */
  plays: number;
  /** Days checked in (`daily_checkin` claim rows). */
  checkinDays: number;
  /** Different catalogue games played. */
  gamesTried: number;
  /** Badges unlocked. */
  badges: number;
}

/**
 * XP = earned tickets ÷ 20 + 10 per play + 25 per check-in + 50 per game tried
 * + 100 per badge. Coming back and trying things are worth as much as grinding
 * one machine: a month of daily check-ins (750) is about what 15,000 earned
 * tickets give. Whole numbers only.
 */
export function computeXp(x: XpInput): number {
  const n = (v: number) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return (
    Math.floor(n(x.earnedTotal) / 20) + 10 * n(x.plays) + 25 * n(x.checkinDays) + 50 * n(x.gamesTried) + 100 * n(x.badges)
  );
}

/**
 * Total XP needed to reach level `level` (level 1 needs 0): `50 · L · (L − 1)`.
 * Level 2 at 100, 5 at 1,000, 10 at 4,500, 20 at 19,000, 30 at 43,500: each
 * level costs 100 more than the one before, so early levels come quickly and
 * the top ones take months.
 */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 50 * l * (l - 1);
}

export interface Level {
  level: number;
  /** Total XP. */
  xp: number;
  /** XP into the current level. */
  xpIntoLevel: number;
  /** XP still needed for the next level. */
  xpToNext: number;
  title: Localized<string>;
}

/** The level `xp` reaches, with progress to the next one and its title. */
export function levelOf(xp: number): Level {
  const total = Math.max(0, Math.floor(xp));
  // Solve 50·L·(L−1) ≤ xp for the largest L, then correct any float rounding
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + total / 12.5)) / 2));
  while (xpForLevel(level + 1) <= total) level++;
  while (level > 1 && xpForLevel(level) > total) level--;
  return {
    level,
    xp: total,
    xpIntoLevel: total - xpForLevel(level),
    xpToNext: xpForLevel(level + 1) - total,
    title: titleOf(level),
  };
}

/** Level titles: each one holds from its `from` level up to the next. */
export const TITLES: readonly { from: number; title: Localized<string> }[] = [
  { from: 1, title: { vi: "Tân binh", en: "Rookie" } },
  { from: 3, title: { vi: "Khách quen", en: "Regular" } },
  { from: 6, title: { vi: "Tay chơi", en: "Player" } },
  { from: 10, title: { vi: "Cao thủ", en: "Ace" } },
  { from: 15, title: { vi: "Chiến tướng", en: "Veteran" } },
  { from: 20, title: { vi: "Bậc thầy", en: "Master" } },
  { from: 30, title: { vi: "Huyền thoại arcade", en: "Arcade legend" } },
];

export function titleOf(level: number): Localized<string> {
  let title = TITLES[0].title;
  for (const t of TITLES) if (level >= t.from) title = t.title;
  return title;
}

// ---------------------------------------------------------------- Badges

export type BadgeTier = "bronze" | "silver" | "gold";

export const BADGE_IDS = [
  "first-play",
  "explorer-5",
  "explorer-all",
  "plays-100",
  "online-win",
  "top-10",
  "lucky-jar",
  "tickets-1k",
  "tickets-10k",
  "first-favorite",
  "first-purchase",
  "streak-7",
  "streak-30",
  "streak-100",
  "shield-saved",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export interface BadgeDef {
  id: BadgeId;
  name: Localized<string>;
  /** How to unlock it, shown on a locked badge. */
  hint: Localized<string>;
  /** A `@hugeicons/core-free-icons` export name (the portal's icon library, components.json). */
  icon: string;
  tier: BadgeTier;
}

/**
 * Every badge, in display order. `badgeUnlocks` decides each one from data the
 * database already keeps; once its owner has seen it unlocked, a `user_badge` row
 * keeps it for good (docs/standards/checkin.md §6). Never rename an id: the UI,
 * the art (public/profile/badges/<id>.webp) and `user_badge` key on it.
 */
export const BADGES: readonly BadgeDef[] = [
  {
    id: "first-play",
    name: { vi: "Lượt đầu tiên", en: "First game" },
    hint: { vi: "Chơi một trò bất kỳ khi đã đăng nhập", en: "Play any game while signed in" },
    icon: "GameController01Icon",
    tier: "bronze",
  },
  {
    id: "explorer-5",
    name: { vi: "Nhà thám hiểm", en: "Explorer" },
    hint: { vi: "Chơi thử 5 trò khác nhau", en: "Try 5 different games" },
    icon: "Compass01Icon",
    tier: "silver",
  },
  {
    id: "explorer-all",
    name: { vi: "Đi khắp Engames", en: "Seen it all" },
    hint: { vi: "Chơi thử mọi trò trên Engames", en: "Try every game on Engames" },
    icon: "Globe02Icon",
    tier: "gold",
  },
  {
    id: "plays-100",
    name: { vi: "Chăm chỉ", en: "Dedicated" },
    hint: { vi: "Bắt đầu 100 lượt chơi", en: "Start 100 games" },
    icon: "Rocket01Icon",
    tier: "silver",
  },
  {
    id: "online-win",
    name: { vi: "Thắng trực tuyến", en: "Online victor" },
    hint: {
      vi: "Thắng một ván trực tuyến (khi đã bật lưu lịch sử đấu)",
      en: "Win an online match (with match history turned on)",
    },
    icon: "Sword01Icon",
    tier: "silver",
  },
  {
    id: "top-10",
    name: { vi: "Top 10", en: "Top 10" },
    hint: { vi: "Lọt vào top 10 bảng xếp hạng của một trò", en: "Reach the top 10 of a game's leaderboard" },
    icon: "ChampionIcon",
    tier: "gold",
  },
  {
    id: "lucky-jar",
    name: { vi: "Hũ may mắn", en: "Lucky Jar" },
    hint: { vi: "Trúng Hũ may mắn", en: "Win the Lucky Jar" },
    icon: "Diamond01Icon",
    tier: "gold",
  },
  {
    id: "tickets-1k",
    name: { vi: "Nghìn vé", en: "A thousand tickets" },
    hint: { vi: "Kiếm 1.000 vé trong các trò", en: "Earn 1,000 tickets in games" },
    icon: "Ticket01Icon",
    tier: "bronze",
  },
  {
    id: "tickets-10k",
    name: { vi: "Vua vé", en: "Ticket tycoon" },
    hint: { vi: "Kiếm 10.000 vé trong các trò", en: "Earn 10,000 tickets in games" },
    icon: "Ticket02Icon",
    tier: "silver",
  },
  {
    id: "first-favorite",
    name: { vi: "Trò ruột", en: "Got a favourite" },
    hint: { vi: "Thả tim một trò", en: "Add a game to your favourites" },
    icon: "FavouriteIcon",
    tier: "bronze",
  },
  {
    id: "first-purchase",
    name: { vi: "Khách Quầy đổi thưởng", en: "Prize Counter customer" },
    hint: { vi: "Đổi vé lấy một món ở Quầy đổi thưởng", en: "Buy something at the Prize Counter" },
    icon: "ShoppingBag01Icon",
    tier: "bronze",
  },
  {
    id: "streak-7",
    name: { vi: "Một tuần không nghỉ", en: "Week streak" },
    hint: { vi: "Điểm danh 7 ngày liên tiếp", en: "Check in 7 days in a row" },
    icon: "FireIcon",
    tier: "bronze",
  },
  {
    id: "streak-30",
    name: { vi: "Một tháng bền bỉ", en: "Month streak" },
    hint: { vi: "Điểm danh 30 ngày liên tiếp", en: "Check in 30 days in a row" },
    icon: "Fire02Icon",
    tier: "silver",
  },
  {
    id: "streak-100",
    name: { vi: "Trăm ngày", en: "Hundred days" },
    hint: { vi: "Điểm danh 100 ngày liên tiếp", en: "Check in 100 days in a row" },
    icon: "CrownIcon",
    tier: "gold",
  },
  {
    id: "shield-saved",
    name: { vi: "Khiên giữ chuỗi", en: "Saved by the shield" },
    hint: { vi: "Để khiên tuần giữ chuỗi điểm danh khi lỡ một ngày", en: "Let the weekly shield save your streak" },
    icon: "Shield01Icon",
    tier: "bronze",
  },
];

/**
 * What the server read about one player, already reduced to the facts the
 * badges need. Times are unix ms; null means "never".
 */
export interface ProfileFacts {
  /** When each catalogue game was first played (any order). */
  gamesFirstPlayed: readonly number[];
  /** How many games the catalogue lists (explorer-all). */
  catalogSize: number;
  plays: number;
  earnedTotal: number;
  onlineWinAt: number | null;
  /** When the player's oldest score still in a top 10 was set. */
  top10At: number | null;
  jackpotWinAt: number | null;
  favoriteAt: number | null;
  purchaseAt: number | null;
  /** When each check-in milestone bonus was paid, by its day count. */
  milestoneAt: Readonly<Partial<Record<7 | 30 | 100, number>>>;
  shieldAt: number | null;
}

/** What a counted badge counts, for its progress label. */
export type BadgeUnit = "games" | "plays" | "tickets";

export interface BadgeProgress {
  current: number;
  target: number;
  unit: BadgeUnit;
}

export interface BadgeState {
  id: BadgeId;
  unlocked: boolean;
  /** Unix ms, when the data says exactly (not for ticket and play counts). */
  unlockedAt?: number;
  /** How far along a locked, counted badge is (games tried, plays, tickets). */
  progress?: BadgeProgress;
}

/** Every badge, in `BADGES` order, unlocked or not. */
export function badgeUnlocks(f: ProfileFacts): BadgeState[] {
  const firsts = [...f.gamesFirstPlayed].sort((a, b) => a - b);
  const nth = (n: number) => (firsts.length >= n ? (firsts[n - 1] ?? null) : null);
  const at = (t: number | null | undefined): Omit<BadgeState, "id"> =>
    t === null || t === undefined ? { unlocked: false } : { unlocked: true, unlockedAt: t };
  const when: Record<BadgeId, Omit<BadgeState, "id">> = {
    "first-play": firsts.length > 0 || f.plays > 0 ? { unlocked: true, ...(firsts[0] ? { unlockedAt: firsts[0] } : {}) } : { unlocked: false },
    "explorer-5": at(nth(5)),
    "explorer-all": f.catalogSize > 0 ? at(nth(f.catalogSize)) : { unlocked: false },
    "plays-100": { unlocked: f.plays >= 100 },
    "online-win": at(f.onlineWinAt),
    "top-10": at(f.top10At),
    "lucky-jar": at(f.jackpotWinAt),
    "tickets-1k": { unlocked: f.earnedTotal >= 1_000 },
    "tickets-10k": { unlocked: f.earnedTotal >= 10_000 },
    "first-favorite": at(f.favoriteAt),
    "first-purchase": at(f.purchaseAt),
    "streak-7": at(f.milestoneAt[7]),
    "streak-30": at(f.milestoneAt[30]),
    "streak-100": at(f.milestoneAt[100]),
    "shield-saved": at(f.shieldAt),
  };
  const counted: Partial<Record<BadgeId, BadgeProgress>> = {
    "explorer-5": { current: firsts.length, target: 5, unit: "games" },
    ...(f.catalogSize > 0 ? { "explorer-all": { current: firsts.length, target: f.catalogSize, unit: "games" as const } } : {}),
    "plays-100": { current: f.plays, target: 100, unit: "plays" },
    "tickets-1k": { current: f.earnedTotal, target: 1_000, unit: "tickets" },
    "tickets-10k": { current: f.earnedTotal, target: 10_000, unit: "tickets" },
  };
  return BADGES.map((b) => {
    const state = when[b.id];
    const progress = counted[b.id];
    return state.unlocked || !progress
      ? { id: b.id, ...state }
      : { id: b.id, ...state, progress: { ...progress, current: Math.min(progress.current, progress.target) } };
  });
}
