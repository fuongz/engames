import type { ChangelogEntry, GameManifest } from "@web-games/core";
import type { Locale } from "@web-games/core/i18n";
import { intlTag } from "./i18n";

// Pure helpers for game changelogs (docs/standards/changelog.md): the game
// page's Update history and the site-wide /changelog timeline.

/**
 * A `YYYY-MM-DD` release day in the player's language. Read as a calendar day,
 * never as an instant, so it shows the same date in every time zone.
 * `medium`: "11 thg 11, 2026" / "Nov 11, 2026"; `full` adds the weekday.
 */
export function releaseDate(date: string, locale: Locale, style: "medium" | "full" = "medium"): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(intlTag(locale), { dateStyle: style, timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

export interface TimelineItem {
  game: GameManifest;
  entry: ChangelogEntry;
}

export interface TimelineDay {
  /** `YYYY-MM-DD`. */
  date: string;
  items: TimelineItem[];
}

/** The games that have a changelog, in catalogue order: the timeline's filter. */
export const gamesWithChangelog = (catalogue: readonly GameManifest[]) =>
  catalogue.filter((g) => (g.changelog?.length ?? 0) > 0);

/**
 * Every changelog entry of `catalogue` (or of game `slug` only), grouped by
 * release day, newest day first. Within a day, games keep catalogue order and a
 * game's own entries stay newest first.
 */
export function changelogTimeline(catalogue: readonly GameManifest[], slug?: string): TimelineDay[] {
  const items = catalogue
    .filter((g) => slug === undefined || g.slug === slug)
    .flatMap((game) => (game.changelog ?? []).map((entry) => ({ game, entry })));
  // Array#sort is stable: equal days keep the order above
  items.sort((a, b) => (a.entry.date < b.entry.date ? 1 : a.entry.date > b.entry.date ? -1 : 0));
  const days: TimelineDay[] = [];
  for (const item of items) {
    const last = days.at(-1);
    if (last?.date === item.entry.date) last.items.push(item);
    else days.push({ date: item.entry.date, items: [item] });
  }
  return days;
}
