import { createFileRoute } from "@tanstack/react-router";
import { findGame } from "@web-games/games";
import { PrizeCounterView } from "#/components/features/prize-counter/prize-counter-view";
import { catalogs } from "#/content/messages";
import { hasPrizes } from "#/lib/prizes";
import { headLocale } from "#/lib/seo";
import { storedLocale } from "#/stores/locale";

export const Route = createFileRoute("/prize-counter")({
  // ?game=<slug> picks the game whose prizes are shown; anything else means the first one
  validateSearch: (search: Record<string, unknown>): { game?: string } => {
    const slug = search.game;
    const game = typeof slug === "string" ? findGame(slug) : undefined;
    return game && hasPrizes(game) ? { game: game.slug } : {};
  },
  // Personal to the player (their balance and today's limits): never indexed
  head: ({ match }) => {
    const m = catalogs[headLocale(match.search, storedLocale)].shop;
    return { meta: [{ title: m.pageTitle }, { name: "description", content: m.description }, { name: "robots", content: "noindex" }] };
  },
  component: PrizeCounterPage,
});

function PrizeCounterPage() {
  const { game } = Route.useSearch();
  return <PrizeCounterView slug={game} />;
}
