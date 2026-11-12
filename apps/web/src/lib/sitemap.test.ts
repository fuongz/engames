import { describe, expect, it } from "bun:test";
import { buildSitemap, latestDate } from "./sitemap";

const SITE = "https://example.com";
const xml = buildSitemap(SITE, [{ slug: "caro", releaseDates: ["2026-11-01", "2026-11-08"] }, { slug: "chess" }]);

describe("latestDate", () => {
  it("picks the newest day, or nothing", () => {
    expect(latestDate(["2026-01-05", "2026-11-08", "2026-03-01"])).toBe("2026-11-08");
    expect(latestDate([])).toBeUndefined();
    expect(latestDate()).toBeUndefined();
  });
});

describe("buildSitemap", () => {
  it("lists vi and en for every page and game", () => {
    for (const p of ["/", "/library", "/changelog", "/games/caro", "/games/chess"]) {
      expect(xml).toContain(`<loc>${SITE}${p}</loc>`);
      expect(xml).toContain(`<loc>${SITE}${p}?lang=en</loc>`.replace("?lang", "?lang"));
    }
    expect(xml.match(/<url>/g)?.length).toBe(10);
  });

  it("escapes & inside XML and never emits a raw one", () => {
    expect(xml).toContain(`${SITE}/library?lang=en`);
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
    expect(buildSitemap(SITE, [{ slug: "a&b" }])).toContain("/games/a&amp;b");
  });

  it("carries hreflang vi, en and x-default (= vi) on each url", () => {
    expect(xml.match(/hreflang="x-default" href="[^"?]*"/g)?.length).toBe(10);
    expect(xml.match(/hreflang="en"/g)?.length).toBe(10);
    expect(xml).toContain(`hreflang="vi" href="${SITE}/games/caro"`);
  });

  it("adds lastmod only for games with a release date", () => {
    expect(xml.match(/<lastmod>2026-11-08<\/lastmod>/g)?.length).toBe(2);
    expect(xml.match(/<lastmod>/g)?.length).toBe(2);
  });

  it("leaves out private and api pages", () => {
    expect(xml).not.toMatch(/history|favorites|\/api\//);
  });
});
