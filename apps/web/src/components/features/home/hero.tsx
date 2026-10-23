import { PlayIcon, StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { SUMMARY_KEY, categories, createStorage, type GameManifest, games, summaryText } from "@web-games/games";
import { play } from "cuelume";
import {
  AnimatePresence,
  type MotionValue,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CoopBadge } from "#/components/shared/games/coop-badge";
import { Button } from "#/components/ui/button";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt } from "#/lib/i18n";
import { FADE, FLICK_VELOCITY, RISE_BLUR, SETTLE_SPRING, stagger } from "#/lib/motion";
import { cn } from "#/lib/utils";

const ADVANCE_MS = 6500;
const SWIPE_PX = 40;
/** Slide text runs ahead of its art by this share of the slide's travel: a layered, parallax depth. */
const TEXT_PARALLAX = 0.25;

/**
 * Steam-style hero: a full-bleed art carousel on the left, the current game's
 * warm info card on the right. Stacks on phones.
 */
export function Hero() {
  const [index, setIndex] = useState(0);
  // A finger on the carousel holds auto-advance, so a slide never changes mid-drag.
  const [held, setHeld] = useState(false);
  const locale = useLocale();
  const m = useMessages();
  const game = games[index % Math.max(1, games.length)];

  // Re-armed on every change, so picking a slide (dot or swipe) gets a full
  // ADVANCE_MS before auto-advance moves on.
  useEffect(() => {
    if (games.length < 2 || held) return;
    const id = window.setTimeout(() => setIndex((index + 1) % games.length), ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [index, held]);

  if (!game) return null;
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="grid gap-3">
        <Carousel index={index} onIndex={setIndex} onHold={setHeld} />
        <div className="flex justify-center" role="tablist" aria-label={m.home.featured}>
          {games.map((g, i) => (
            // The padding is the hit area (~24px); the pill inside is the visible dot
            <button
              key={g.slug}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={g.title[locale]}
              onClick={() => setIndex(i)}
              className="group grid cursor-pointer place-items-center rounded-full px-1.5 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "relative h-1.5 overflow-hidden rounded-full transition-[width,background-color] duration-300",
                  i === index
                    ? "w-7 bg-primary motion-safe:bg-primary/35"
                    : "w-1.5 bg-muted-foreground/40 group-hover:w-3 group-hover:bg-muted-foreground",
                )}
              >
                {/* Fills over the auto-advance wait; gone while a finger holds the carousel */}
                {i === index && !held && games.length > 1 && (
                  <span
                    className="absolute inset-0 origin-left rounded-full bg-primary motion-reduce:hidden"
                    style={{ animation: `dot-fill ${ADVANCE_MS}ms linear both` }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:h-[400px]">
        <InfoCard game={game} />
      </div>
    </section>
  );
}

/**
 * The track sits at `-index * 100%` plus a pixel offset. Dragging moves the
 * offset under the finger; changing slide (swipe, dot, auto-advance) re-bases
 * the offset so the track stays where it is, then springs it to 0 — so a
 * release keeps its momentum and every path animates the same way.
 */
function Carousel({ index, onIndex, onHold }: { index: number; onIndex: (i: number) => void; onHold: (held: boolean) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const base = useMotionValue(-index * 100);
  const offset = useMotionValue(0);
  const transform = useMotionTemplate`translateX(calc(${base}% + ${offset}px))`;
  // Reduced motion: no slide, the new art cross-fades in instead of cutting
  const opacity = useMotionValue(1);
  const width = useMotionValue(0);
  const shown = useRef(index);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => width.set(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);
  const drag = useRef<{ id: number; x: number; t: number; from: number; captured: boolean } | null>(null);
  const swiped = useRef(false);

  const settle = () => (reduce ? offset.jump(0) : void animate(offset, 0, SETTLE_SPRING));

  useLayoutEffect(() => {
    if (shown.current === index) return;
    const width = frame.current?.offsetWidth ?? 0;
    offset.jump(offset.get() + (index - shown.current) * width);
    base.jump(-index * 100);
    shown.current = index;
    settle();
    if (reduce) {
      opacity.jump(0);
      animate(opacity, 1, { duration: 0.2, ease: "easeOut" });
    }
  });

  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    onHold(false);
    const dx = e.clientX - d.x;
    const speed = Math.abs(dx) / Math.max(1, e.timeStamp - d.t);
    // Commit on distance, or on a short quick flick
    if (games.length > 1 && (Math.abs(dx) >= SWIPE_PX || (speed > FLICK_VELOCITY && Math.abs(dx) > 10))) {
      swiped.current = true;
      play("navigate", { emphasis: "subtle", direction: dx < 0 ? "forward" : "back" });
      onIndex((index + (dx < 0 ? 1 : -1) + games.length) % games.length);
    } else settle();
  };

  return (
    <div
      ref={frame}
      className="relative aspect-[16/10] touch-pan-y overflow-hidden rounded-2xl bg-card select-none sm:aspect-[2/1] lg:aspect-auto lg:h-[400px]"
      onPointerDown={(e) => {
        if (drag.current) return; // a second finger must not hijack the drag
        offset.stop();
        drag.current = { id: e.pointerId, x: e.clientX, t: e.timeStamp, from: offset.get(), captured: false };
        swiped.current = false;
        onHold(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x;
        // Capture once it is clearly a drag, so it survives leaving the frame; a tap stays a click
        if (!d.captured && Math.abs(dx) > 6) {
          e.currentTarget.setPointerCapture(e.pointerId);
          d.captured = true;
        }
        offset.set(d.from + dx);
      }}
      onPointerUp={end}
      // The browser took over (vertical scroll): spring back
      onPointerCancel={end}
      onClickCapture={(e) => {
        // A swipe ends with a click on the slide link; don't navigate for it
        if (swiped.current) e.preventDefault();
      }}
    >
      <motion.div className="flex h-full" style={{ transform, opacity }}>
        {games.map((g, i) => (
          <Slide key={g.slug} game={g} active={i === index} at={i} track={{ base, offset, width }} parallax={!reduce} />
        ))}
      </motion.div>
    </div>
  );
}

interface Track {
  base: MotionValue<number>;
  offset: MotionValue<number>;
  width: MotionValue<number>;
}

function Slide({ game, active, at, track, parallax }: { game: GameManifest; active: boolean; at: number; track: Track; parallax: boolean }) {
  const locale = useLocale();
  const m = useMessages();
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => setSummary(summaryText(createStorage(game.slug).get<unknown>(SUMMARY_KEY, null), locale)), [game.slug, locale]);
  const category = categories.find((c) => c.id === game.category);
  const chips = [category?.label[locale], ...game.tags[locale]].filter(Boolean).slice(0, 3);
  // Where this slide sits relative to the frame, in px; the text layer moves a bit further
  const textShift = useTransform(
    [track.base, track.offset, track.width],
    ([base, offset, width]: number[]) => `translateX(${parallax ? ((at + base / 100) * width + offset) * TEXT_PARALLAX : 0}px)`,
  );

  return (
    <Link
      to="/games/$slug"
      params={{ slug: game.slug }}
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      draggable={false}
      className="group relative block h-full w-full shrink-0 outline-none"
    >
      <img
        src={game.banner}
        alt=""
        draggable={false}
        className={cn(
          // Ken Burns: the showing slide drifts in slowly for as long as it shows; a slide
          // that left resets only once it is off screen
          "absolute inset-0 size-full origin-right object-cover object-right transition-[scale] ease-linear",
          active ? "duration-[6500ms] motion-safe:scale-[1.08]" : "delay-700 duration-0",
        )}
      />
      <div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/20 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-background/50 to-transparent" />

      <motion.div className="absolute inset-0" style={{ transform: textShift }}>
        <div className="absolute top-4 left-4 flex flex-wrap gap-2 md:top-5 md:left-5">
          <CoopBadge game={game} variant="overlay" className="px-3 py-1 text-xs" />
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-background/60 px-3 py-1 text-xs font-medium backdrop-blur-md">
              {c}
            </span>
          ))}
        </div>

        <div className="absolute inset-x-4 bottom-4 grid gap-2 md:inset-x-6 md:bottom-6">
          <h2 className="max-w-[14ch] text-3xl leading-[0.95] font-black tracking-tight text-balance uppercase drop-shadow-lg md:text-5xl lg:text-6xl">
            {game.title[locale]}
          </h2>
          {summary && (
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 text-xs backdrop-blur-md">
              <HugeiconsIcon icon={StarIcon} className="size-3.5 fill-highlight text-highlight" />
              {fmt(m.home.best, { summary })}
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}

/** Title, copy and action swap in 100ms apart when the slide changes; the card itself stays put. */
const INFO_SWAP = stagger(0.1);

function InfoCard({ game }: { game: GameManifest }) {
  const locale = useLocale();
  const m = useMessages();
  const piece = useReducedMotion() ? FADE : RISE_BLUR;
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden rounded-2xl bg-linear-to-br from-warm to-warm-deep p-5">
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-background/45 to-transparent" />
      {/* initial={false}: the first slide is already there; only changes swap */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={game.slug} variants={INFO_SWAP} initial="hidden" animate="shown" exit="exit" className="flex flex-1 flex-col gap-3">
          <motion.h3 variants={piece} className="text-2xl leading-tight font-bold tracking-tight">{game.title[locale]}</motion.h3>
          {game.online && (
            <motion.div variants={piece}>
              <CoopBadge game={game} variant="long" className="bg-background/30 text-foreground" />
            </motion.div>
          )}
          <motion.p variants={piece} className="line-clamp-3 text-sm leading-relaxed text-foreground/90 lg:line-clamp-9">{game.description[locale]}</motion.p>
          <motion.div variants={piece} className="mt-auto grid gap-3 pt-2">
            <span className="text-sm font-semibold">{m.home.free}</span>
            {/* Dark glass on the orange card, as in the reference; an orange button would vanish here */}
            <Button
              size="lg"
              className="h-11 w-full rounded-xl bg-background/40 text-foreground backdrop-blur-md hover:bg-background/60"
              nativeButton={false}
              render={<Link to="/games/$slug" params={{ slug: game.slug }} />}
            >
              <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" className="fill-current" />
              {m.home.playNow}
            </Button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
