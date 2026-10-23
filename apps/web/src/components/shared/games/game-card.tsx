import { StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { SUMMARY_KEY, categories, createStorage, type GameManifest, summaryText } from "@web-games/games";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { type PointerEvent, useEffect, useState } from "react";
import { useLocale } from "#/hooks/use-messages";
import { cn } from "#/lib/utils";

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
/** Degrees the poster leans toward the cursor at its edges. */
const TILT = 8;
const TILT_SPRING = { stiffness: 300, damping: 30, mass: 0.5 };

/**
 * A poster that leans toward the mouse like a card held in the hand, with a
 * glare following the cursor. Mouse only (touch has no hover to track), and
 * off under reduced motion.
 */
function usePosterTilt() {
  const reduce = useReducedMotion();
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(FINE_POINTER);
    const apply = () => setFine(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(y, [0, 1], [TILT, -TILT]), TILT_SPRING);
  const rotateY = useSpring(useTransform(x, [0, 1], [-TILT, TILT]), TILT_SPRING);
  const glareX = useTransform(x, (v) => v * 100);
  const glareY = useTransform(y, (v) => v * 100);
  const transform = useMotionTemplate`perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, color-mix(in oklab, var(--color-white) 22%, transparent), transparent 55%)`;

  if (!fine || reduce) return null;
  return {
    transform,
    glare,
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const r = e.currentTarget.getBoundingClientRect();
      x.set((e.clientX - r.left) / r.width);
      y.set((e.clientY - r.top) / r.height);
    },
    onPointerLeave() {
      x.set(0.5);
      y.set(0.5);
    },
  };
}

/** Portrait poster card: art, title, then your record if you have one. */
export function GameCard({ game, className }: { game: GameManifest; className?: string }) {
  const locale = useLocale();
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => setSummary(summaryText(createStorage(game.slug).get<unknown>(SUMMARY_KEY, null), locale)), [game.slug, locale]);
  const category = categories.find((c) => c.id === game.category);
  const tilt = usePosterTilt();

  return (
    <Link to="/games/$slug" params={{ slug: game.slug }} className={cn(
        // Press feedback for touch, where the hover lift never shows
        "group grid content-start gap-2.5 outline-none transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100",
        className,
      )}
    >
      {/* transition names translate + box-shadow only: the tilt's transform is driven every frame */}
      <motion.div
        style={tilt ? { transform: tilt.transform } : undefined}
        onPointerMove={tilt?.onPointerMove}
        onPointerLeave={tilt?.onPointerLeave}
        className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-card ring-1 ring-white/10 transition-[translate,box-shadow] duration-300 ease-out motion-safe:group-hover:-translate-y-1 group-hover:shadow-glow group-focus-visible:ring-2 group-focus-visible:ring-ring"
      >
        <img
          src={game.poster[locale]}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
        />
        {tilt && (
          <motion.div
            aria-hidden
            style={{ background: tilt.glare }}
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
      </motion.div>
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
