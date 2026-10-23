import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GameManifest } from "@web-games/games";
import { useMessages } from "#/hooks/use-messages";
import { fmt } from "#/lib/i18n";
import { cn } from "#/lib/utils";

/**
 * Marks a game that plays online co-op. `overlay` sits on key art (glass pill),
 * `inline` reads in a row of badges, `long` spells out the player count.
 * Renders nothing for solo-only games.
 */
export function CoopBadge({
  game,
  variant = "inline",
  className,
}: {
  game: GameManifest;
  variant?: "overlay" | "inline" | "long";
  className?: string;
}) {
  const m = useMessages();
  if (!game.online) return null;
  const label = variant === "long" ? fmt(m.online.badgeLong, { n: game.online.maxPlayers }) : m.online.badge;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full font-semibold whitespace-nowrap",
        variant === "overlay"
          ? "bg-background/70 px-2 py-0.5 text-[11px] text-primary ring-1 ring-white/10 backdrop-blur-md"
          : "bg-primary/15 px-2.5 py-0.5 text-xs text-primary",
        className,
      )}
    >
      <HugeiconsIcon icon={UserGroupIcon} className={variant === "overlay" ? "size-3.5" : "size-4"} aria-hidden />
      {label}
    </span>
  );
}

/** Extra search words for a co-op game, in both languages, so "co-op" or "online" finds it. */
export const coopKeywords = (game: GameManifest) =>
  game.online ? "co-op coop online multiplayer chơi cùng bạn nhiều người" : "";
