import { Crown02Icon, RankingIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { cn } from "#/lib/utils";
import type { LeaderboardEntry } from "#/server/leaderboard";

const SCORE = new Intl.NumberFormat("vi-VN");

/** Ranked rows: medal colours for the podium, the player's own row highlighted. */
export function LeaderboardList({
  entries,
  highlightId,
  className,
}: {
  entries: LeaderboardEntry[];
  highlightId?: number;
  className?: string;
}) {
  if (entries.length === 0) {
    return (
      <Empty className="rounded-xl border border-dashed py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={RankingIcon} />
          </EmptyMedia>
          <EmptyTitle>Chưa có ai trên bảng</EmptyTitle>
          <EmptyDescription>Chơi một ván và ghi tên mình đầu tiên nhé!</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ol className={cn("grid gap-1", className)}>
      {entries.map((e, i) => {
        const rank = i + 1;
        return (
          <li
            key={e.id}
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
            <span className="shrink-0 text-sm font-semibold tabular-nums">{SCORE.format(e.score)}</span>
          </li>
        );
      })}
    </ol>
  );
}
