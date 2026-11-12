import { createFileRoute } from "@tanstack/react-router";
import { games } from "@web-games/games";
import { buildSitemap } from "#/lib/sitemap";
import { SITE_URL } from "#/lib/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          buildSitemap(
            SITE_URL,
            games.map((g) => ({ slug: g.slug, releaseDates: g.changelog?.map((c) => c.date) })),
          ),
          { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } },
        ),
    },
  },
});
