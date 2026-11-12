import { createFileRoute } from "@tanstack/react-router";
import { PublicProfileView } from "#/components/features/public-profile/public-profile-view";
import { catalogs } from "#/content/messages";
import { fmt } from "#/lib/i18n";
import { headLocale, socialMeta } from "#/lib/seo";
import { getPublicProfileFn } from "#/server/profile";
import { storedLocale } from "#/stores/locale";

/** An account id as Better Auth makes them; anything else cannot be a player. */
const USER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const Route = createFileRoute("/u/$userId")({
  loader: async ({ params }) => {
    if (!USER_ID.test(params.userId)) return { profile: null, notFound: true };
    // Null: private, or no such player (the server tells no one which)
    const profile = await getPublicProfileFn({ data: { userId: params.userId } });
    return { profile, notFound: false };
  },
  head: ({ loaderData, match, params }) => {
    const locale = headLocale(match.search, storedLocale);
    const m = catalogs[locale].profile;
    const profile = loaderData?.profile;
    if (!profile) {
      const title = `${loaderData?.notFound ? m.public.notFoundTitle : m.public.privateTitle} | Engames`;
      return { meta: [{ title }, { name: "robots", content: "noindex" }] };
    }
    const title = fmt(m.public.pageTitle, { name: profile.name });
    const description = fmt(m.public.description, { name: profile.name });
    const { meta, links } = socialMeta({ title, description, locale, path: `/u/${params.userId}` });
    // A player's page: shareable (link previews), but never indexed, like every personal page
    return { meta: [{ title }, { name: "description", content: description }, { name: "robots", content: "noindex" }, ...meta], links };
  },
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { profile, notFound } = Route.useLoaderData();
  return <PublicProfileView profile={profile} notFound={notFound} />;
}
