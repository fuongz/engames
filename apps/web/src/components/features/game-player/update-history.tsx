import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import type { ChangelogEntry } from "@web-games/core";
import { ChangeList, VersionBadge } from "#/components/shared/changelog/release-notes";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "#/components/ui/accordion";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { releaseDate } from "#/lib/changelog";

/**
 * A game's "Update history" (docs/standards/changelog.md): the newest release
 * open, older ones a tap away. Renders nothing for a game without a changelog.
 */
export function UpdateHistory({ slug, changelog }: { slug: string; changelog: ChangelogEntry[] | undefined }) {
  const m = useMessages();
  const locale = useLocale();
  if (!changelog?.length) return null;
  return (
    <div className="grid gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{m.player.updateHistory}</h3>
        <Link
          to="/changelog"
          search={{ game: slug }}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {m.player.allUpdates}
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" aria-hidden />
        </Link>
      </div>
      {/* Several may be open at once: comparing two releases is the point of a history */}
      <Accordion multiple defaultValue={[changelog[0].version]} className="border-border/70">
        {changelog.map((entry) => (
          <AccordionItem key={entry.version} value={entry.version} className="border-border/70">
            <AccordionTrigger className="items-center gap-3 border-0 px-4 py-2.5 hover:no-underline focus-visible:bg-muted/60">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <VersionBadge version={entry.version} />
                {entry.title && <span className="leading-snug">{entry.title[locale]}</span>}
                <time dateTime={entry.date} className="text-xs font-normal text-muted-foreground tabular-nums">
                  {releaseDate(entry.date, locale)}
                </time>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-3.5">
              <ChangeList entry={entry} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
