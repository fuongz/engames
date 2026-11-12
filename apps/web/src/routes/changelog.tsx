import { createFileRoute } from "@tanstack/react-router";
import { games } from "@web-games/games";
import { ChangelogView } from "#/components/features/changelog/changelog-view";
import { catalogs } from "#/content/messages";
import { gamesWithChangelog } from "#/lib/changelog";
import { headLocale, socialMeta } from "#/lib/seo";
import { storedLocale } from "#/stores/locale";

export const Route = createFileRoute("/changelog")({
  // ?game=<slug> narrows the timeline to one game (the game page's "All updates" link)
  validateSearch: (search: Record<string, unknown>): { game?: string } => {
    const g = search.game;
    return typeof g === "string" && gamesWithChangelog(games).some((x) => x.slug === g) ? { game: g } : {};
  },
  // One timeline page: ?game= narrows it but is not a page of its own
  head: ({ match }) => {
    const locale = headLocale(match.search, storedLocale);
    const m = catalogs[locale];
    const { meta, links } = socialMeta({ title: m.changelog.pageTitle, description: m.changelog.description, locale, path: "/changelog" });
    return {
      meta: [{ title: m.changelog.pageTitle }, { name: "description", content: m.changelog.description }, ...meta],
      links,
    };
  },
  component: Changelog,
});

function Changelog() {
  const { game } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <ChangelogView game={game} onGame={(slug) => navigate({ search: slug ? { game: slug } : {}, replace: true })} />;
}
