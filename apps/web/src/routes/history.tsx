import { createFileRoute } from "@tanstack/react-router";
import { HistoryView } from "#/components/features/history/history-view";
import { catalogs } from "#/content/messages";
import { useLocaleStore } from "#/stores/locale";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: catalogs[useLocaleStore.getState().locale].history.pageTitle }, { name: "robots", content: "noindex" }] }),
  component: HistoryView,
});
