// The portal's daily check-in rules (docs/standards/checkin.md), and the
// Vietnam clock every daily feature runs on. Pure and isomorphic: the server
// pays by these numbers, and the profile UI draws its calendar from the same ones.

// ---------------------------------------------------------------- The Vietnam clock

const HOUR = 3_600_000;
export const DAY_MS = 24 * HOUR;
export const WEEK_MS = 7 * DAY_MS;
/** Asia/Ho_Chi_Minh is UTC+7 all year (no daylight saving). */
const VN_OFFSET = 7 * HOUR;

/** Unix ms of the Vietnam midnight that starts the Vietnam day holding `now`. */
export function vnDayStart(now: number): number {
  return Math.floor((now + VN_OFFSET) / DAY_MS) * DAY_MS - VN_OFFSET;
}

/** The Vietnam date holding `now`, "YYYY-MM-DD". */
export function vnDay(now: number): string {
  return new Date(now + VN_OFFSET).toISOString().slice(0, 10);
}

/** The next Vietnam midnight after `now`, unix ms: when the next daily is due. */
export function nextDailyAt(now: number): number {
  return vnDayStart(now) + DAY_MS;
}

/** Unix ms of the Monday 00:00 (Vietnam) that starts the Vietnam week holding `now`. */
export function vnWeekStart(now: number): number {
  const day = vnDayStart(now);
  // getUTCDay of the shifted clock is the Vietnam weekday: 0 = Sunday … 6 = Saturday
  const sinceMonday = (new Date(now + VN_OFFSET).getUTCDay() + 6) % 7;
  return day - sinceMonday * DAY_MS;
}

/** Unix ms of the Vietnam midnight starting the date `day` ("YYYY-MM-DD"). */
export function vnDayStartOf(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) - VN_OFFSET;
}

/** The date `n` days after `day` (negative: before), "YYYY-MM-DD". */
export function addDays(day: string, n: number): string {
  return vnDay(vnDayStartOf(day) + n * DAY_MS);
}

/** The Monday ("YYYY-MM-DD") of the Vietnam week holding the date `day`. */
export function weekMonday(day: string): string {
  return vnDay(vnWeekStart(vnDayStartOf(day)));
}

/** The Monday and Sunday ("YYYY-MM-DD", both inclusive) of the week holding `day`. */
export function weekOf(day: string): { from: string; to: string } {
  const from = weekMonday(day);
  return { from, to: addDays(from, 6) };
}

// ---------------------------------------------------------------- Rewards

/**
 * What the check-in pays, in shared arcade tickets, on cycle day 1 … 7. Streak
 * day n pays `CHECKIN_CYCLE[(n − 1) % 7]`: day 8 starts the cycle over. Day 7 is
 * the gold chest.
 *
 * Calibration (Prize Counter and caps as of 2026-11-12):
 * - The cheapest Prize Counter item is Xu Vũ Trụ's "coins10" at 300 tickets (the
 *   card pack is 400). A full week sums to 20+25+30+35+40+50+100 = 300: one
 *   perfect week of check-ins buys exactly one cheap item, as agreed.
 * - Days 1–6 rise in small steps so coming back tomorrow always pays a little
 *   more; the chest (100) is a third of the week, so day 7 feels like a payday
 *   and missing it hurts more than missing day 2.
 * - Against the game economy it stays small: one check-in is at most 2 % of one
 *   deposit (MAX_DEPOSIT 5,000) and a rounding error next to a game's daily earn
 *   cap (50,000). The check-in rewards coming back, not grinding; it never
 *   counts as earnings, so it cannot lift the weekly board either.
 */
export const CHECKIN_CYCLE = [20, 25, 30, 35, 40, 50, 100] as const;
/** The cycle's length: 7 days. */
export const CYCLE_LENGTH = CHECKIN_CYCLE.length;

/** What streak day `n` (1-based, counting past the cycle) pays. */
export function cycleAmount(n: number): number {
  return CHECKIN_CYCLE[(Math.max(n, 1) - 1) % CYCLE_LENGTH] ?? 0;
}

/** The 0-based slot of streak day `n` in the 7-day calendar (6 = the chest). */
export function cycleIndex(n: number): number {
  return (Math.max(n, 1) - 1) % CYCLE_LENGTH;
}

/** The chest is the cycle's last day. */
export function isChestDay(n: number): boolean {
  return cycleIndex(n) === CYCLE_LENGTH - 1;
}

export interface CheckinMilestone {
  /** The streak day that reaches it. */
  days: number;
  /** Bonus tickets, paid once per player ever. */
  bonus: number;
  /** The badge it unlocks (lib/profile.ts BADGES). */
  badge: "streak-7" | "streak-30" | "streak-100";
}

/**
 * One-time bonuses the first time a streak reaches 7, 30 and 100 days. The 7-day
 * bonus (100) makes the first full week pay 400: the card pack (400). The 30-
 * and 100-day ones are rarer and bigger, but each stays under one week of a
 * playing player's earnings.
 */
export const CHECKIN_MILESTONES: readonly CheckinMilestone[] = [
  { days: 7, bonus: 100, badge: "streak-7" },
  { days: 30, bonus: 500, badge: "streak-30" },
  { days: 100, bonus: 2_000, badge: "streak-100" },
];

/** The milestone streak day `n` reaches, if any. */
export function milestoneAt(n: number): CheckinMilestone | undefined {
  return CHECKIN_MILESTONES.find((m) => m.days === n);
}

/** `ticket_ledger.reason` of a check-in payout. Not earnings (docs/standards/tickets.md). */
export const CHECKIN_REASON = "checkin";

/** `ticket_ledger.reason` of the milestone bonus for `days`: at most one per player, ever. */
export function milestoneReason(days: number): string {
  return `${CHECKIN_REASON}:milestone:${days}`;
}
