import { createFileRoute } from "@tanstack/react-router";
import { HistoryView } from "#/components/features/history/history-view";
import { catalogs } from "#/content/messages";
import { headLocale } from "#/lib/seo";
import { storedLocale } from "#/stores/locale";

export const Route = createFileRoute("/history")({
  // Personal to the player: never indexed, in either language
  head: ({ match }) => {
    const m = catalogs[headLocale(match.search, storedLocale)].history;
    return { meta: [{ title: m.pageTitle }, { name: "description", content: m.description }, { name: "robots", content: "noindex" }] };
  },
  component: HistoryView,
});
