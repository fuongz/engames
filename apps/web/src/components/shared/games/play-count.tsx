import { PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect } from "react";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { compactCount } from "#/lib/format";
import { fmt } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import { usePlayCounts } from "#/stores/play-counts";

/** How many times `slug` has been played by everyone, or undefined until loaded (or offline). */
function usePlayCount(slug: string): number | undefined {
  const load = usePlayCounts((s) => s.load);
  const count = usePlayCounts((s) => (s.counts ? (s.counts[slug] ?? 0) : undefined));
  useEffect(load, [load]);
  return count;
}

/** "1,2K lượt chơi": how many times everyone has started this game. Nothing until loaded. */
export function PlayCount({ slug, className, iconless = false }: { slug: string; className?: string; iconless?: boolean }) {
  const m = useMessages();
  const locale = useLocale();
  const count = usePlayCount(slug);
  if (count === undefined) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)}>
      {!iconless && <HugeiconsIcon icon={PlayIcon} className="size-3.5 shrink-0" aria-hidden />}
      {fmt(m.plays, { n: compactCount(count, locale) })}
    </span>
  );
}
