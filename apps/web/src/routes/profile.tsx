import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "#/components/features/profile/profile-view";
import { catalogs } from "#/content/messages";
import { headLocale } from "#/lib/seo";
import { storedLocale } from "#/stores/locale";

export const Route = createFileRoute("/profile")({
  // The player's own passport (and check-in): never indexed; /u/<id> is the shareable one
  head: ({ match }) => {
    const m = catalogs[headLocale(match.search, storedLocale)].profile;
    return { meta: [{ title: m.pageTitle }, { name: "description", content: m.description }, { name: "robots", content: "noindex" }] };
  },
  component: ProfileView,
});
