import { findGame, games } from "@web-games/games";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { compactCount } from "#/lib/format";
import { fmt, intlTag } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import { useJackpot } from "#/stores/jackpot";
import { JackpotHall } from "./jackpot-hall";

/** Nothing to show until at least one game feeds the jar. */
const HAS_JACKPOT = games.some((g) => g.jackpot === true);
/** How long a new win keeps the ticker lit. */
const ANNOUNCE_MS = 6000;

/**
 * The live Lucky Jar pool (docs/standards/jackpot.md) as a pill in the top
 * bar: the jar, "Jackpot" and the amount. Beside the search field on desktop,
 * under the top bar on phones. A new win lights it up for a moment and is read
 * once to screen readers. Opens the Lucky Jar Hall, which lists the winners.
 * Hidden until a game has `manifest.jackpot` and the pool has loaded; works
 * signed out.
 */
export function JackpotTicker({ className }: { className?: string }) {
  return HAS_JACKPOT ? <Ticker className={className} /> : null;
}

function Ticker({ className }: { className?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const reduce = useReducedMotion() ?? false;
  const state = useJackpot((s) => s.state);
  const announcement = useJackpot((s) => s.announcement);
  const [open, setOpen] = useState(false);

  useEffect(() => useJackpot.getState().watch(), []);

  // A new win stays lit for a moment, then hands back to the plain pool
  useEffect(() => {
    if (!announcement) return;
    const id = setTimeout(() => useJackpot.getState().dismissAnnouncement(), ANNOUNCE_MS);
    return () => clearTimeout(id);
  }, [announcement]);

  if (!state) return null;

  const nf = new Intl.NumberFormat(intlTag(locale));
  const announceText = announcement
    ? fmt(m.jackpot.announce, {
        name: announcement.name || m.jackpot.someone,
        amount: nf.format(announcement.amount),
        game: findGame(announcement.gameSlug)?.title[locale] ?? announcement.gameSlug,
      })
    : null;

  return (
    // The placement's display classes go on this wrapper, so a hidden placement
    // hides its screen-reader status too
    <div className={cn("min-w-0", className)}>
      <button
        type="button"
        aria-label={fmt(m.jackpot.open, { n: nf.format(state.pool) })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-fit min-w-0 items-center gap-2 rounded-full bg-secondary pr-3.5 pl-2 text-sm text-secondary-foreground ring-1 ring-border outline-none transition-[background-color,box-shadow] duration-300 hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/30",
          announceText && "bg-primary/15 ring-primary/40",
        )}
      >
        <motion.img
          key={announcement?.wonAt ?? "idle"}
          src="/jackpot/jar.webp"
          alt=""
          aria-hidden
          width={24}
          height={24}
          draggable={false}
          className="size-6 shrink-0 select-none drop-shadow-sm"
          animate={announceText && !reduce ? { y: [0, -5, 0, -3, 0], rotate: [0, -8, 6, -3, 0] } : undefined}
          transition={{ duration: 0.9, repeat: 2, repeatDelay: 0.6 }}
        />
        <span className="font-medium text-muted-foreground">{m.jackpot.label}</span>
        <span className="font-bold tabular-nums">{compactCount(state.pool, locale)}</span>
      </button>
      {/* Screen readers hear the news once */}
      <span role="status" className="sr-only">
        {announceText}
      </span>
      {open && <JackpotHall onClose={() => setOpen(false)} />}
    </div>
  );
}
