import { createFileRoute } from "@tanstack/react-router";
import { FavoritesView } from "#/components/features/favorites/favorites-view";
import { catalogs } from "#/content/messages";
import { headLocale } from "#/lib/seo";
import { storedLocale } from "#/stores/locale";

export const Route = createFileRoute("/favorites")({
  // Personal to the player: never indexed, in either language
  head: ({ match }) => {
    const m = catalogs[headLocale(match.search, storedLocale)].favorites;
    return { meta: [{ title: m.pageTitle }, { name: "description", content: m.description }, { name: "robots", content: "noindex" }] };
  },
  component: FavoritesView,
});
