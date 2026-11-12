import { ArrowRight01Icon, GameController01Icon, LibraryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { findGame } from "@web-games/games";
import { motion, useReducedMotion } from "motion/react";
import { buttonVariants } from "#/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "#/components/ui/empty";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "#/components/ui/popover";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { timeAgo } from "#/lib/format";
import { fmt, intlTag, plural } from "#/lib/i18n";
import { FADE, RISE, stagger } from "#/lib/motion";
import { cn } from "#/lib/utils";
import type { Profile } from "#/server/profile";

/**
 * "Games played lately": one square tile per game, most recent first (the
 * server already orders them), in a row that scrolls sideways on a phone.
 * Tap (or hover, with a mouse) for plays, best score and when it was last
 * played, with a link into the game.
 */
export function StatsPanel({ profile: p, className }: { profile: Profile; className?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const nf = new Intl.NumberFormat(intlTag(locale));
  const now = Date.now();
  const games = p.games.flatMap((g) => {
    const game = findGame(g.slug);
    return game ? [{ stat: g, game }] : [];
  });

  return (
    <section aria-labelledby="stats-title" className={cn("grid gap-4 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6", className)}>
      <h2 id="stats-title" className="text-xl font-bold tracking-tight">
        {m.profile.stats.perGame}
      </h2>
      {games.length === 0 ? (
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
        <motion.ul
          variants={stagger(0.03)}
          initial="hidden"
          animate="shown"
          className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:flex-wrap lg:overflow-visible"
        >
          {games.map(({ stat: g, game }) => {
            const title = game.title[locale];
            return (
              <motion.li key={g.slug} variants={reduce ? FADE : RISE} className="shrink-0 snap-start">
                <Popover>
                  <PopoverTrigger
                    openOnHover
                    delay={150}
                    aria-label={title}
                    className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    <img
                      src={game.poster[locale]}
                      alt=""
                      loading="lazy"
                      width={64}
                      height={64}
                      draggable={false}
                      className="size-16 rounded-2xl object-cover object-top shadow-md ring-1 ring-border transition-transform duration-200 ease-out select-none motion-safe:group-hover:scale-105 sm:size-[4.5rem]"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 gap-3 rounded-2xl">
                    <PopoverHeader>
                      <PopoverTitle className="font-semibold">{title}</PopoverTitle>
                      <PopoverDescription>
                        {plural(locale, g.plays, m.profile.stats.playsN)}
                        <span aria-hidden> · </span>
                        {fmt(m.profile.stats.lastPlayed, { when: timeAgo(g.lastPlayedAt, now, locale) })}
                      </PopoverDescription>
                    </PopoverHeader>
                    <div className="flex items-center justify-between gap-3">
                      {g.bestScore !== null ? (
                        <span className="grid">
                          <span className="text-[11px] text-muted-foreground">{m.profile.stats.best}</span>
                          <span className="text-sm font-bold text-highlight tabular-nums">{nf.format(g.bestScore)}</span>
                        </span>
                      ) : (
                        <span />
                      )}
                      <Link to="/games/$slug" params={{ slug: g.slug }} className={buttonVariants({ size: "sm", className: "rounded-full" })}>
                        {m.profile.stats.play}
                        <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
                      </Link>
                    </div>
                  </PopoverContent>
                </Popover>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </section>
  );
}
