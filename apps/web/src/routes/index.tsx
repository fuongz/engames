import { createFileRoute } from "@tanstack/react-router";
import { findGame } from "@web-games/games";
import { GameShelf } from "#/components/features/home/game-shelf";
import { Hero } from "#/components/features/home/hero";
import { OffersRow } from "#/components/features/home/offers-row";
import { usePlayStats } from "#/stores/play-stats";

// A route exports exactly one thing: `Route`. The moment it exports a second,
// something imports the route to get it, and a URL declaration lands on the import
// graph of your components. Extract instead — to hooks/ or components/.
export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const recentSlugs = usePlayStats((s) => s.recent);
  const recent = recentSlugs.flatMap((slug) => findGame(slug) ?? []);

  return (
    <main className="grid gap-8 lg:gap-10">
      <Hero />
      <OffersRow />
      {recent.length > 0 && <GameShelf title="Chơi tiếp" games={recent} />}
    </main>
  );
}
