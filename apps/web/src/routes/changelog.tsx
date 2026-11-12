import { createFileRoute } from "@tanstack/react-router";
import { games } from "@web-games/games";
import { ChangelogView } from "#/components/features/changelog/changelog-view";
import { catalogs } from "#/content/messages";
import { gamesWithChangelog } from "#/lib/changelog";
import { socialMeta } from "#/lib/seo";
import { useLocaleStore } from "#/stores/locale";

export const Route = createFileRoute("/changelog")({
  // ?game=<slug> narrows the timeline to one game (the game page's "All updates" link)
  validateSearch: (search: Record<string, unknown>): { game?: string } => {
    const g = search.game;
    return typeof g === "string" && gamesWithChangelog(games).some((x) => x.slug === g) ? { game: g } : {};
  },
  // head runs outside React; it picks up a language switch on the next navigation
  head: () => {
    const m = catalogs[useLocaleStore.getState().locale];
    return {
      meta: [
        { title: m.changelog.pageTitle },
        { name: "description", content: m.changelog.description },
        ...socialMeta({ title: m.changelog.pageTitle, description: m.changelog.description, path: "/changelog" }),
      ],
    };
  },
  component: Changelog,
});

function Changelog() {
  const { game } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <ChangelogView game={game} onGame={(slug) => navigate({ search: slug ? { game: slug } : {}, replace: true })} />;
}
