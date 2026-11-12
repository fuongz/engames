import { GameController01Icon, LibraryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { findGame } from "@web-games/games";
import { buttonVariants } from "#/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "#/components/ui/empty";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { timeAgo } from "#/lib/format";
import { fmt, intlTag, plural } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import type { Profile } from "#/server/profile";

/**
 * One row per game played with its art, plays, best score and when it was last
 * played, each linking to the game. The totals live in the passport's stat strip.
 */
export function StatsPanel({ profile: p, className }: { profile: Profile; className?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const nf = new Intl.NumberFormat(intlTag(locale));
  const now = Date.now();

  return (
    <section aria-labelledby="stats-title" className={cn("grid gap-4 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6", className)}>
      <h2 id="stats-title" className="text-xl font-bold tracking-tight">
        {m.profile.stats.perGame}
      </h2>
      {p.games.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={GameController01Icon} />
            </EmptyMedia>
            <EmptyDescription>{m.profile.stats.empty}</EmptyDescription>
          </EmptyHeader>
          {p.isOwner && (
            <EmptyContent>
              <Link to="/library" className={buttonVariants({ variant: "secondary" })}>
                <HugeiconsIcon icon={LibraryIcon} data-icon="inline-start" />
                {m.profile.stats.browse}
              </Link>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {p.games.map((g) => {
            const game = findGame(g.slug);
            if (!game) return null;
            return (
              <li key={g.slug}>
                <Link
                  to="/games/$slug"
                  params={{ slug: g.slug }}
                  className="group flex items-center gap-3 rounded-2xl bg-secondary/40 p-2.5 ring-1 ring-border transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <img src={game.poster[locale]} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl object-cover object-top" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-semibold transition-colors group-hover:text-primary">{game.title[locale]}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {plural(locale, g.plays, m.profile.stats.playsN)}
                      <span aria-hidden> · </span>
                      {fmt(m.profile.stats.lastPlayed, { when: timeAgo(g.lastPlayedAt, now, locale) })}
                    </span>
                  </span>
                  {g.bestScore !== null && (
                    <span className="grid shrink-0 justify-items-end">
                      <span className="text-[11px] text-muted-foreground">{m.profile.stats.best}</span>
                      <span className="text-sm font-bold text-highlight tabular-nums">{nf.format(g.bestScore)}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
