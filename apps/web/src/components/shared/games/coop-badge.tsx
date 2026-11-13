import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GameManifest } from "@web-games/core";
import { useMessages } from "#/hooks/use-messages";
import { fmt } from "#/lib/i18n";
import { onlineMode } from "#/lib/online";
import { cn } from "#/lib/utils";

/**
 * Marks a game that plays online (co-op, or 1v1 for a versus game). `overlay` sits on key art (glass pill),
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
  const versus = onlineMode(game) === "versus";
  // A versus game for more than two (Ludo, the property game, the street race): everyone against everyone
  const group = versus && game.online.maxPlayers > 2;
  const label =
    variant === "long"
      ? group
        ? fmt(m.online.badgeLongVersusGroup, { min: game.online.minPlayers, n: game.online.maxPlayers })
        : versus
          ? m.online.badgeLongVersus
          : fmt(m.online.badgeLong, { n: game.online.maxPlayers })
      : group
        ? m.online.badgeVersusGroup
        : versus
          ? m.online.badgeVersus
          : m.online.badge;
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
  game.online
    ? `co-op coop online multiplayer chơi cùng bạn nhiều người${onlineMode(game) === "versus" ? (game.online.maxPlayers > 2 ? " versus đấu nhiều người" : " 1v1 versus đấu đối kháng") : ""}`
    : "";
