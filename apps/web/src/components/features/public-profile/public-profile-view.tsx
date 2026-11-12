import { SquareLock02Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { BadgeGrid } from "#/components/shared/profile/badge-grid";
import { PassportHero } from "#/components/shared/profile/passport-hero";
import { StatsPanel } from "#/components/shared/profile/stats-panel";
import { buttonVariants } from "#/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { useMessages } from "#/hooks/use-messages";
import type { Profile } from "#/server/profile";

/**
 * /u/<id>: another player's Engames Passport, read-only (hero, badges, stats;
 * no check-in). `profile` null: private (or no such player: the server does not
 * tell the two apart); `notFound`: the id itself is not a valid one.
 */
export function PublicProfileView({ profile, notFound = false }: { profile: Profile | null; notFound?: boolean }) {
  const m = useMessages();

  if (!profile) {
    return (
      <main className="grid content-start">
        <Empty className="rounded-3xl border border-dashed bg-card/50 py-14">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={notFound ? UserCircleIcon : SquareLock02Icon} />
            </EmptyMedia>
            <EmptyTitle>{notFound ? m.profile.public.notFoundTitle : m.profile.public.privateTitle}</EmptyTitle>
            <EmptyDescription>{notFound ? m.profile.public.notFoundHint : m.profile.public.privateHint}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/" className={buttonVariants({ variant: "secondary" })}>
              {m.profile.public.home}
            </Link>
          </EmptyContent>
        </Empty>
      </main>
    );
  }

  return (
    <main className="grid w-full content-start gap-4 md:gap-6">
      {profile.isOwner && (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm ring-1 ring-primary/30">
          {m.profile.public.yours}
          <Link to="/profile" className="font-semibold text-primary underline-offset-4 hover:underline">
            {m.profile.public.openMine}
          </Link>
        </p>
      )}
      <PassportHero profile={profile} />
      <BadgeGrid badges={profile.badges} />
      <StatsPanel profile={profile} />
    </main>
  );
}
