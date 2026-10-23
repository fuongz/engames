import { createFileRoute } from "@tanstack/react-router";
import { categories } from "@web-games/games";
import { LibraryView } from "#/components/features/library/library-view";
import { catalogs } from "#/content/messages";
import { useLocaleStore } from "#/stores/locale";

export const Route = createFileRoute("/library")({
  // ?category=<id> deep-links a filter (the ⌘K palette uses it); anything else means all.
  validateSearch: (search: Record<string, unknown>): { category?: string } => {
    const c = search.category;
    return typeof c === "string" && categories.some((x) => x.id === c) ? { category: c } : {};
  },
  // head runs outside React; it picks up a language switch on the next navigation
  head: () => ({ meta: [{ title: catalogs[useLocaleStore.getState().locale].library.pageTitle }] }),
  component: Library,
});

function Library() {
  const { category = "all" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LibraryView
      category={category}
      onCategory={(c) => navigate({ search: c === "all" ? {} : { category: c }, replace: true })}
    />
  );
}
