// sitemap.xml for search engines: every indexable page in both languages, with
// hreflang alternates. Pure and isomorphic; the route in routes/sitemap[.]xml.ts
// only feeds it the catalogue. Vietnamese is the bare path, English is `?lang=en`.

export interface SitemapGame {
  slug: string;
  /** Release dates (ISO `YYYY-MM-DD`) from the game's changelog, any order. */
  releaseDates?: string[];
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** The newest release day, or undefined when there is none. */
export function latestDate(dates: string[] = []): string | undefined {
  return dates.reduce<string | undefined>((a, d) => (!a || d > a ? d : a), undefined);
}

const PAGES = ["/", "/library", "/changelog"];

export function buildSitemap(siteUrl: string, games: SitemapGame[]): string {
  const entries = [
    ...PAGES.map((path) => ({ path, lastmod: undefined as string | undefined })),
    ...games.map((g) => ({ path: `/games/${g.slug}`, lastmod: latestDate(g.releaseDates) })),
  ];
  const urls = entries.flatMap(({ path, lastmod }) => {
    const vi = `${siteUrl}${path}`;
    const en = `${vi}?lang=en`;
    const alternates = [
      ["vi", vi],
      ["en", en],
      ["x-default", vi],
    ]
      .map(([lang, href]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(href)}"/>`)
      .join("\n");
    return [vi, en].map(
      (loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}${alternates}\n  </url>`,
    );
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}
