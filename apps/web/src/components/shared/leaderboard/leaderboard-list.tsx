import { Crown02Icon, RankingIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, useReducedMotion } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { intlTag } from "#/lib/i18n";
import { FADE, RISE, stagger } from "#/lib/motion";
import { cn } from "#/lib/utils";
import type { LeaderboardEntry } from "#/server/leaderboard";

const ROWS = stagger(0.05);

/**
 * Ranked rows: medal colours for the podium, the player's own row highlighted.
 * `cascade` deals the rows in one after another — for the end-of-run reveal,
 * not for a board someone is reading on a page.
 */
export function LeaderboardList({
  entries,
  highlightId,
  cascade = false,
  className,
}: {
  entries: LeaderboardEntry[];
  highlightId?: number;
  cascade?: boolean;
  className?: string;
}) {
  const m = useMessages();
  const row = useReducedMotion() ? FADE : RISE;
  const score = new Intl.NumberFormat(intlTag(useLocale()));
  if (entries.length === 0) {
    return (
      <Empty className="rounded-xl border border-dashed py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={RankingIcon} />
          </EmptyMedia>
          <EmptyTitle>{m.leaderboard.emptyTitle}</EmptyTitle>
          <EmptyDescription>{m.leaderboard.emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <motion.ol variants={ROWS} initial={cascade ? "hidden" : false} animate="shown" className={cn("grid gap-1", className)}>
      {entries.map((e, i) => {
        const rank = i + 1;
        return (
          <motion.li
            key={e.id}
            variants={row}
            className={cn(
              "flex items-center gap-3 rounded-xl px-2.5 py-2",
              e.id === highlightId ? "bg-primary/15 ring-1 ring-primary/50" : i % 2 === 0 && "bg-muted/50",
            )}
          >
            <span
              className={cn(
                "grid w-6 shrink-0 place-items-center text-sm font-bold tabular-nums",
                rank === 1 ? "text-highlight" : rank <= 3 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {rank === 1 ? <HugeiconsIcon icon={Crown02Icon} className="size-5" /> : rank}
            </span>
            <Avatar className="size-8 shrink-0">
              {e.image && <AvatarImage src={e.image} alt="" referrerPolicy="no-referrer" />}
              <AvatarFallback className="text-xs font-semibold">{e.name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">{e.name}</span>
              {e.detail && <span className="truncate text-xs text-muted-foreground">{e.detail}</span>}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{score.format(e.score)}</span>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
