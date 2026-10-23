import { StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { SUMMARY_KEY, categories, createStorage, type GameManifest, summaryText } from "@web-games/games";
import { useEffect, useState } from "react";
import { useLocale } from "#/hooks/use-messages";
import { cn } from "#/lib/utils";

/** Portrait poster card: art, title, then your record if you have one. */
export function GameCard({ game, className }: { game: GameManifest; className?: string }) {
  const locale = useLocale();
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => setSummary(summaryText(createStorage(game.slug).get<unknown>(SUMMARY_KEY, null), locale)), [game.slug, locale]);
  const category = categories.find((c) => c.id === game.category);

  return (
    <Link to="/games/$slug" params={{ slug: game.slug }} className={cn("group grid content-start gap-2.5 outline-none", className)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-card ring-1 ring-border transition duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:ring-primary/60 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <img
          src={game.poster[locale]}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>
      <div className="grid gap-1 px-0.5">
        <h3 className="truncate text-sm font-semibold transition-colors group-hover:text-primary">{game.title[locale]}</h3>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {summary ? (
            <>
              <HugeiconsIcon icon={StarIcon} className="size-3.5 shrink-0 fill-highlight text-highlight" />
              {summary}
            </>
          ) : (
            <>
              {category?.label[locale]}
              <span aria-hidden className="h-3 w-px bg-border" />
              {game.releasedAt.slice(0, 4)}
            </>
          )}
        </p>
      </div>
    </Link>
  );
}
