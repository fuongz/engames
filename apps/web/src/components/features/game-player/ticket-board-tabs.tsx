import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useEffect, useState } from "react";
import { LeaderboardList } from "#/components/shared/leaderboard/leaderboard-list";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt, intlTag } from "#/lib/i18n";
import type { WeeklyBoard } from "#/server/leaderboard";

const MINUTE = 60_000;
/** The toggle's own pressed state (bg-muted) hardly shows on a dialog: mark the active tab. */
const TAB = "h-9 px-4 aria-pressed:border-primary/60 aria-pressed:bg-primary/15 aria-pressed:text-foreground";

/** Unix ms, ticking once a minute (enough for a "resets in 2d 4h" countdown). */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * A ticket game's two boards (docs/standards/tickets.md §5): "This week" (the
 * default: net tickets since Monday 00:00 Vietnam time, earned less spent at
 * this game's Prize Counter, with a resets-in countdown and the player's own
 * rank) and "All time" (the usual score board).
 * `week` is null when it could not be loaded.
 */
export function TicketBoardTabs({ week, allTime }: { week: WeeklyBoard | null; allTime: ReactNode }) {
  const m = useMessages();
  const [tab, setTab] = useState<"week" | "all">("week");
  return (
    <div className="grid gap-3">
      <ToggleGroup
        value={[tab]}
        onValueChange={(v) => v[0] && setTab(v[0] as "week" | "all")}
        aria-label={m.player.leaderboard}
        variant="outline"
        className="w-max"
      >
        <ToggleGroupItem value="week" className={TAB}>
          {m.leaderboard.thisWeek}
        </ToggleGroupItem>
        <ToggleGroupItem value="all" className={TAB}>
          {m.leaderboard.allTime}
        </ToggleGroupItem>
      </ToggleGroup>
      {tab === "all" ? (
        allTime
      ) : week ? (
        <Week board={week} />
      ) : (
        <p className="text-sm text-muted-foreground">{m.player.boardOffline}</p>
      )}
    </div>
  );
}

function Week({ board }: { board: WeeklyBoard }) {
  const m = useMessages();
  const locale = useLocale();
  const now = useMinuteClock();
  // Whole minutes, rounded up: never "0m" before the reset
  const total = Math.ceil(Math.max(0, board.resetsAt - now) / MINUTE);
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor(total / 60) % 24;
  const min = total % 60;
  const time =
    d > 0 ? fmt(m.leaderboard.days, { d, h }) : h > 0 ? fmt(m.leaderboard.hours, { h, m: min }) : fmt(m.leaderboard.minutes, { m: min });
  const { me } = board;
  return (
    <div className="grid gap-2">
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{m.leaderboard.weekCaption}</span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <HugeiconsIcon icon={Clock01Icon} className="size-3.5" aria-hidden />
          {fmt(m.leaderboard.resetsIn, { time })}
        </span>
      </p>
      <LeaderboardList
        entries={board.entries}
        highlightId={me?.id ?? undefined}
        empty={{ title: m.leaderboard.weekEmptyTitle, description: m.leaderboard.weekEmptyDescription }}
      />
      {me && me.id === null && (
        <p className="rounded-xl bg-primary/15 px-3 py-2 text-sm font-medium ring-1 ring-primary/50">
          {fmt(m.leaderboard.yourRank, { rank: me.rank, n: new Intl.NumberFormat(intlTag(locale)).format(me.score) })}
        </p>
      )}
    </div>
  );
}
