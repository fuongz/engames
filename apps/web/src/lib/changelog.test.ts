import { describe, expect, it } from "bun:test";
import type { ChangelogEntry, GameManifest } from "@web-games/core";
import { changelogTimeline, gamesWithChangelog, releaseDate } from "./changelog";

const entry = (version: string, date: string): ChangelogEntry => ({ version, date, changes: { vi: [version], en: [version] } });
const game = (slug: string, changelog?: ChangelogEntry[]) => ({ slug, changelog }) as GameManifest;

describe("releaseDate", () => {
  it("formats the calendar day in the player's language, in any time zone", () => {
    expect(releaseDate("2026-11-11", "en")).toBe("Nov 11, 2026");
    expect(releaseDate("2026-11-11", "vi")).toContain("2026");
    expect(releaseDate("2026-11-11", "vi")).toContain("11");
    // The first of the month never slips back to the 31st west of UTC
    expect(releaseDate("2026-01-01", "en")).toBe("Jan 1, 2026");
    expect(releaseDate("2026-11-11", "en", "full")).toBe("Wednesday, November 11, 2026");
  });
});

describe("changelogTimeline", () => {
  const catalogue = [
    game("a", [entry("1.2.0", "2026-11-10"), entry("1.1.0", "2026-11-10"), entry("1.0.0", "2026-10-01")]),
    game("b"),
    game("c", [entry("2.0.0", "2026-11-11"), entry("1.5.0", "2026-11-10")]),
  ];

  it("groups every entry by day, newest day first, games in catalogue order within a day", () => {
    const days = changelogTimeline(catalogue);
    expect(days.map((d) => [d.date, d.items.map((i) => `${i.game.slug}@${i.entry.version}`)])).toEqual([
      ["2026-11-11", ["c@2.0.0"]],
      ["2026-11-10", ["a@1.2.0", "a@1.1.0", "c@1.5.0"]],
      ["2026-10-01", ["a@1.0.0"]],
    ]);
  });

  it("filters to one game", () => {
    expect(changelogTimeline(catalogue, "c").flatMap((d) => d.items.map((i) => i.entry.version))).toEqual(["2.0.0", "1.5.0"]);
    expect(changelogTimeline(catalogue, "b")).toEqual([]);
  });

  it("lists only games that have entries", () => {
    expect(gamesWithChangelog([...catalogue, game("d", [])]).map((g) => g.slug)).toEqual(["a", "c"]);
  });
});
