import { JarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { findGame, games } from "@web-games/games";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { compactCount } from "#/lib/format";
import { fmt, intlTag } from "#/lib/i18n";
import { EASE_OUT } from "#/lib/motion";
import { cn } from "#/lib/utils";
import type { JackpotWinner } from "#/server/jackpot";
import { useJackpot } from "#/stores/jackpot";
import { JackpotHall } from "./jackpot-hall";

/** Nothing to show until at least one game feeds the jar. */
const HAS_JACKPOT = games.some((g) => g.jackpot === true);
/** How long each recent winner stays before the next one slides in. */
const CYCLE_MS = 5000;
/** The ticker cycles through this many of the latest winners. */
const CYCLE_COUNT = 5;
/** The announcement crawls at this speed (px/s), twice across. */
const CRAWL_SPEED = 70;
/** Under reduced motion, the announcement sits still this long. */
const STILL_MS = 8000;

/**
 * The live Lucky Jar pool and its latest winners (docs/standards/jackpot.md),
 * a pill in the top bar: beside the search field on desktop, a slim strip
 * under the top bar on phones. A new win crawls across once as an
 * announcement, then it settles back. Opens the Lucky Jar Hall. Hidden until
 * a game has `manifest.jackpot` and the pool has loaded; works signed out.
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
  const [index, setIndex] = useState(0);

  useEffect(() => useJackpot.getState().watch(), []);

  const winners = state?.recent.slice(0, CYCLE_COUNT) ?? [];
  const cycling = !reduce && !announcement && winners.length > 1;
  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(() => setIndex((i) => i + 1), CYCLE_MS);
    return () => clearInterval(id);
  }, [cycling]);

  if (!state) return null;

  const nf = new Intl.NumberFormat(intlTag(locale));
  const line = (w: JackpotWinner, template: string) =>
    fmt(template, {
      name: w.name || m.jackpot.someone,
      amount: nf.format(w.amount),
      game: findGame(w.gameSlug)?.title[locale] ?? w.gameSlug,
    });
  // Reduced motion: the newest winner, still
  const shown = winners.length > 0 ? winners[reduce ? 0 : index % winners.length] : null;
  const announceText = announcement ? line(announcement, m.jackpot.announce) : null;

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
          "flex h-9 w-full min-w-0 items-center gap-2 rounded-full bg-secondary px-3 text-sm text-secondary-foreground ring-1 ring-border outline-none transition-[background-color,box-shadow] duration-300 hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/30",
          announceText && "bg-primary/15 ring-primary/40",
        )}
      >
        <HugeiconsIcon icon={JarIcon} className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="shrink-0 font-semibold tabular-nums">{compactCount(state.pool, locale)}</span>
        <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
        <span aria-hidden className="relative h-5 min-w-0 flex-1 overflow-hidden text-left text-muted-foreground">
          {announceText ? (
            <Announcement key={announcement?.wonAt} text={announceText} still={reduce} />
          ) : (
            <AnimatePresence initial={false}>
              <motion.span
                key={shown ? `${shown.wonAt}-${index}` : "none"}
                className="absolute inset-0 truncate leading-5"
                initial={reduce ? false : { opacity: 0, transform: "translateY(8px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transform: "translateY(-8px)" }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                {shown ? line(shown, m.jackpot.winner) : m.jackpot.noWinners}
              </motion.span>
            </AnimatePresence>
          )}
        </span>
      </button>
      {/* Screen readers hear the news once, not the crawl */}
      <span role="status" className="sr-only">
        {announceText}
      </span>
      {open && <JackpotHall onClose={() => setOpen(false)} />}
    </div>
  );
}

const done = () => useJackpot.getState().dismissAnnouncement();

/**
 * A new win, crawling right to left twice, then handing back to the ticker.
 * Still (reduced motion): the text sits truncated for STILL_MS. Only a ticker
 * that is on screen runs it: the other placement is display:none and has no
 * width, and must not end the announcement early.
 */
function Announcement({ text, still }: { text: string; still: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const width = box.current?.clientWidth ?? 0;
    const el = inner.current;
    if (width === 0) return;
    if (still || !el) {
      const id = setTimeout(done, STILL_MS);
      return () => clearTimeout(id);
    }
    // In from the right edge, out past the left one, twice; transform only
    const textWidth = el.scrollWidth;
    const crawl = animate(
      el,
      { x: [width, -textWidth] },
      { duration: (width + textWidth) / CRAWL_SPEED, ease: "linear", repeat: 1, onComplete: done },
    );
    el.style.visibility = "visible";
    return () => crawl.stop();
  }, [still]);

  if (still) {
    return (
      <span ref={box} className="absolute inset-0 truncate leading-5 font-medium text-foreground">
        {text}
      </span>
    );
  }
  return (
    <span ref={box} className="absolute inset-0">
      <span
        ref={inner}
        style={{ visibility: "hidden" }}
        className="absolute top-0 left-0 whitespace-nowrap leading-5 font-medium text-foreground will-change-transform"
      >
        {text}
      </span>
    </span>
  );
}
