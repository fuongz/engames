import { createFileRoute } from "@tanstack/react-router";
import { findGame } from "@web-games/games";
import { GameShelf } from "#/components/features/home/game-shelf";
import { Hero } from "#/components/features/home/hero";
import { OffersRow } from "#/components/features/home/offers-row";
import { catalogs } from "#/content/messages";
import { useMessages } from "#/hooks/use-messages";
import { headLocale, socialMeta } from "#/lib/seo";
import { storedLocale } from "#/stores/locale";
import { usePlayStats } from "#/stores/play-stats";

// A route exports exactly one thing: `Route`. The moment it exports a second,
// something imports the route to get it, and a URL declaration lands on the import
// graph of your components. Extract instead — to hooks/ or components/.
export const Route = createFileRoute("/")({
  head: ({ match }) => {
    const locale = headLocale(match.search, storedLocale);
    const m = catalogs[locale];
    // Title and description come from the root; the home page adds its canonical
    const { meta, links } = socialMeta({ title: m.app.title, description: m.app.description, locale, path: "/" });
    return { meta, links };
  },
  component: Home,
});

function Home() {
  const m = useMessages();
  const recentSlugs = usePlayStats((s) => s.recent);
  const recent = recentSlugs.flatMap((slug) => findGame(slug) ?? []);

  return (
    <main className="grid gap-8 lg:gap-10">
      <Hero />
      <OffersRow />
      {recent.length > 0 && <GameShelf title={m.home.continue} games={recent} />}
    </main>
  );
}
