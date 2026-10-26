import { createFileRoute } from "@tanstack/react-router";
import { categories } from "@web-games/games";
import { LibraryView } from "#/components/features/library/library-view";
import { catalogs } from "#/content/messages";
import { socialMeta } from "#/lib/seo";
import { useLocaleStore } from "#/stores/locale";

export const Route = createFileRoute("/library")({
  // ?category=<id> deep-links a filter (the ⌘K palette uses it); anything else means all.
  // ?coop=1 keeps only games that play online co-op; ?online=1 only games saved
  // to the player's account. Both combine with a category.
  validateSearch: (search: Record<string, unknown>): { category?: string; coop?: 1; online?: 1 } => {
    const c = search.category;
    const on = (v: unknown) => v === 1 || v === "1" || v === true;
    return {
      ...(typeof c === "string" && categories.some((x) => x.id === c) ? { category: c } : {}),
      ...(on(search.coop) ? { coop: 1 as const } : {}),
      ...(on(search.online) ? { online: 1 as const } : {}),
    };
  },
  // head runs outside React; it picks up a language switch on the next navigation
  head: () => {
    const m = catalogs[useLocaleStore.getState().locale];
    return {
      meta: [{ title: m.library.pageTitle }, ...socialMeta({ title: m.library.pageTitle, description: m.app.description, path: "/library" })],
    };
  },
  component: Library,
});

function Library() {
  const { category = "all", coop, online } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LibraryView
      category={category}
      coop={coop === 1}
      online={online === 1}
      onCategory={(c) => navigate({ search: (s) => ({ ...s, category: c === "all" ? undefined : c }), replace: true })}
      onCoop={(on) => navigate({ search: (s) => ({ ...s, coop: on ? 1 : undefined }), replace: true })}
      onOnline={(on) => navigate({ search: (s) => ({ ...s, online: on ? 1 : undefined }), replace: true })}
    />
  );
}
