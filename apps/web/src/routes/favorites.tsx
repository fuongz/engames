import { createFileRoute } from "@tanstack/react-router";
import { FavoritesView } from "#/components/features/favorites/favorites-view";
import { catalogs } from "#/content/messages";
import { useLocaleStore } from "#/stores/locale";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: catalogs[useLocaleStore.getState().locale].favorites.pageTitle }, { name: "robots", content: "noindex" }] }),
  component: FavoritesView,
});
