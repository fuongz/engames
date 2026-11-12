import { describe, expect, it } from "bun:test";
import { headLocale, jsonLd, langParam, localizedUrl, SITE_URL, socialMeta, urlLocale, videoGameJsonLd } from "#/lib/seo";

describe("seo", () => {
  it("reads only a known ?lang= from search", () => {
    expect(urlLocale({ lang: "en" })).toBe("en");
    expect(urlLocale({ lang: "vi", room: "ABCD" })).toBe("vi");
    expect(urlLocale({ lang: "fr" })).toBeUndefined();
    expect(urlLocale(undefined)).toBeUndefined();
    expect(langParam("vi")).toBeUndefined();
    expect(langParam("en")).toBe("en");
  });

  it("uses the URL's language in head(), else the default on the server", () => {
    // bun test has no `window`, like the Worker: the client fallback is never asked
    const client = () => "en" as const;
    expect(headLocale({ lang: "en" }, client)).toBe("en");
    expect(headLocale({}, client)).toBe("vi");
  });

  it("keeps state params out of canonical URLs", () => {
    expect(localizedUrl("/library?category=x&coop=1", "en")).toBe(`${SITE_URL}/library?lang=en`);
    expect(localizedUrl("/games/caro", "vi")).toBe(`${SITE_URL}/games/caro`);
  });

  it("links both languages, with x-default on Vietnamese", () => {
    const { meta, links } = socialMeta({ title: "T", description: "D", locale: "en", path: "/games/caro" });
    expect(links).toEqual([
      { rel: "canonical", href: `${SITE_URL}/games/caro?lang=en` },
      { rel: "alternate", hrefLang: "vi", href: `${SITE_URL}/games/caro` },
      { rel: "alternate", hrefLang: "en", href: `${SITE_URL}/games/caro?lang=en` },
      { rel: "alternate", hrefLang: "x-default", href: `${SITE_URL}/games/caro` },
    ]);
    expect(meta).toContainEqual({ property: "og:locale", content: "en_US" });
    expect(meta).toContainEqual({ property: "og:locale:alternate", content: "vi_VN" });
    expect(meta).toContainEqual({ property: "og:url", content: `${SITE_URL}/games/caro?lang=en` });
  });

  it("writes JSON-LD that cannot close its script tag", () => {
    expect(jsonLd({ name: "</script>" }).children).not.toContain("</");
    const game = JSON.parse(videoGameJsonLd({ name: "Caro", description: "D", path: "/games/caro", image: "/x.jpg", locale: "vi" }).children);
    expect(game).toMatchObject({ "@type": "VideoGame", url: `${SITE_URL}/games/caro`, image: `${SITE_URL}/x.jpg`, inLanguage: "vi-VN" });
  });
});
