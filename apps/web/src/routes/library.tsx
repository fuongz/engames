import { createFileRoute } from "@tanstack/react-router";
import { categories } from "@web-games/games";
import { LibraryView } from "#/components/features/library/library-view";
import { catalogs } from "#/content/messages";
import { useLocaleStore } from "#/stores/locale";

export const Route = createFileRoute("/library")({
  // ?category=<id> deep-links a filter (the ⌘K palette uses it); anything else means all.
  // ?coop=1 keeps only games that play online co-op; it combines with a category.
  validateSearch: (search: Record<string, unknown>): { category?: string; coop?: 1 } => {
    const c = search.category;
    const coop = search.coop === 1 || search.coop === "1" || search.coop === true;
    return {
      ...(typeof c === "string" && categories.some((x) => x.id === c) ? { category: c } : {}),
      ...(coop ? { coop: 1 as const } : {}),
    };
  },
  // head runs outside React; it picks up a language switch on the next navigation
  head: () => ({ meta: [{ title: catalogs[useLocaleStore.getState().locale].library.pageTitle }] }),
  component: Library,
});

function Library() {
  const { category = "all", coop } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LibraryView
      category={category}
      coop={coop === 1}
      onCategory={(c) => navigate({ search: (s) => ({ ...s, category: c === "all" ? undefined : c }), replace: true })}
      onCoop={(on) => navigate({ search: (s) => ({ ...s, coop: on ? 1 : undefined }), replace: true })}
    />
  );
}
