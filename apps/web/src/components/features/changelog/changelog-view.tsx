import { ArrowRight01Icon, NewReleasesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { games } from "@web-games/games";
import { motion } from "motion/react";
import { ChangeList, VersionBadge } from "#/components/shared/changelog/release-notes";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { type TimelineItem, changelogTimeline, gamesWithChangelog, releaseDate } from "#/lib/changelog";
import { INDICATOR_SPRING } from "#/lib/motion";

const ALL = "all";
const CHIP =
  "relative isolate h-10 gap-2 rounded-full border bg-card pr-4 pl-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-pressed:border-transparent data-pressed:bg-transparent data-pressed:text-primary-foreground";

/**
 * Every game's changelog as one timeline, newest day first (docs/standards/changelog.md).
 * `game` narrows it to one game; `onGame(undefined)` clears the filter.
 */
export function ChangelogView({ game, onGame }: { game?: string; onGame: (slug: string | undefined) => void }) {
  const m = useMessages();
  const locale = useLocale();
  const listed = gamesWithChangelog(games);
  const days = changelogTimeline(listed, game);
  const value = game ?? ALL;

  return (
    <main className="grid gap-5 md:gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{m.changelog.title}</h1>
        <p className="text-sm text-muted-foreground">{m.changelog.description}</p>
      </div>

      {listed.length > 1 && (
        // Scrolls sideways on phones, like the library's genre chips
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0">
          <ToggleGroup
            spacing={2}
            value={[value]}
            onValueChange={(v) => onGame(v[0] && v[0] !== ALL ? v[0] : undefined)}
            aria-label={m.changelog.filterLabel}
            className="w-max md:w-auto md:flex-wrap"
          >
            <ToggleGroupItem value={ALL} className={`${CHIP} pl-4`}>
              {value === ALL && <ActiveChip />}
              {m.changelog.allGames}
            </ToggleGroupItem>
            {listed.map((g) => (
              <ToggleGroupItem key={g.slug} value={g.slug} className={CHIP}>
                {value === g.slug && <ActiveChip />}
                <img src={g.poster[locale]} alt={g.title[locale]} aria-hidden className="aspect-[3/4] h-7 rounded-md object-cover" />
                {g.title[locale]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {days.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={NewReleasesIcon} />
            </EmptyMedia>
            <EmptyTitle>{m.changelog.emptyTitle}</EmptyTitle>
            <EmptyDescription>{m.changelog.emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="grid max-w-3xl gap-7">
          {days.map((day) => (
            <li key={day.date} className="grid gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                <time dateTime={day.date}>{releaseDate(day.date, locale, "full")}</time>
              </h2>
              {/* The rail: one dot per release */}
              <ol className="ml-1 grid gap-3 border-l border-border pl-4 md:pl-5">
                {day.items.map((item) => (
                  <Release key={`${item.game.slug}@${item.entry.version}`} item={item} />
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

/** The orange pill behind the picked chip; it slides to the next one. */
function ActiveChip() {
  return <motion.span layoutId="changelog-chip-active" transition={INDICATOR_SPRING} className="absolute inset-0 -z-10 rounded-full bg-primary" />;
}

/** One game's release: poster, name, version, optional title, bullets. The whole card opens the game. */
function Release({ item: { game, entry } }: { item: TimelineItem }) {
  const locale = useLocale();
  return (
    <li className="relative">
      <span aria-hidden className="absolute top-6 -left-[21px] size-2.5 rounded-full bg-primary ring-4 ring-background md:-left-[25px]" />
      <article className="group relative grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border transition-shadow hover:ring-primary/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
        <header className="flex items-center gap-3">
          <img src={game.poster[locale]} alt={game.title[locale]} aria-hidden loading="lazy" className="aspect-[3/4] w-10 shrink-0 rounded-lg object-cover ring-1 ring-border" />
          <div className="grid min-w-0 flex-1 gap-1">
            {/* Stretched over the card, so a tap anywhere on it opens the game */}
            <Link
              to="/games/$slug"
              params={{ slug: game.slug }}
              className="truncate font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {game.title[locale]}
            </Link>
            <span className="flex flex-wrap items-center gap-2">
              <VersionBadge version={entry.version} />
              {entry.title && <span className="text-sm font-medium leading-snug">{entry.title[locale]}</span>}
            </span>
          </div>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
          />
        </header>
        <ChangeList entry={entry} className="text-sm" />
      </article>
    </li>
  );
}
