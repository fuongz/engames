import { describe, expect, it } from "vitest";

describe("i18n", () => {
  it("every game manifest has both languages, and summaries read old and new saves", async () => {
    const { games, summaryText } = await import("./registry");
    for (const g of games) {
      for (const l of ["vi", "en"] as const) {
        expect(g.title[l].length, `${g.slug} title ${l}`).toBeGreaterThan(0);
        expect(g.poster[l], `${g.slug} poster ${l}`).toBeTruthy();
        expect(g.tagline[l].length, `${g.slug} tagline ${l}`).toBeGreaterThan(
          0,
        );
        expect(
          g.description[l].length,
          `${g.slug} description ${l}`,
        ).toBeGreaterThan(0);
        expect(g.controls[l].length, `${g.slug} controls ${l}`).toBe(
          g.controls.vi.length,
        );
        // Key caps are [Key]: every bracket closes, none nests
        for (const c of g.controls[l])
          expect(c, `${g.slug} key caps`).toMatch(/^(?:[^[\]]|\[[^[\]]+\])*$/);
      }
    }
    expect(summaryText("Kỷ lục 10 điểm", "en")).toBe("Kỷ lục 10 điểm");
    expect(summaryText({ vi: "Kỷ lục 10 điểm", en: "Best 10 pts" }, "en")).toBe(
      "Best 10 pts",
    );
    expect(summaryText(null, "vi")).toBeNull();
  });
});
