import { createFileRoute } from "@tanstack/react-router";
import { categories } from "@web-games/games";
import { LibraryView } from "#/components/features/library/library-view";

export const Route = createFileRoute("/library")({
  // ?category=<id> deep-links a filter (the ⌘K palette uses it); anything else means all.
  validateSearch: (search: Record<string, unknown>): { category?: string } => {
    const c = search.category;
    return typeof c === "string" && categories.some((x) => x.id === c) ? { category: c } : {};
  },
  head: () => ({ meta: [{ title: "Thư viện · Engames" }] }),
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
