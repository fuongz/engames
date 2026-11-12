import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import type { GameManifest } from "@web-games/core";
import { categories } from "@web-games/games";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { type PointerEvent, useEffect, useState } from "react";
import { useFavorites } from "#/hooks/use-favorites";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { CoopBadge } from "./coop-badge";
import { PlayCount } from "./play-count";
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

/** Portrait poster card: art, then the game's name and category. */
export function GameCard({ game, className }: { game: GameManifest; className?: string }) {
  const locale = useLocale();
  const category = categories.find((c) => c.id === game.category);
  const tilt = usePosterTilt();

  return (
    // The heart is a sibling of the link (a button may not sit inside an <a>), laid over the poster's corner
    <div className={cn("group relative", className)}>
      <Link
        to="/games/$slug"
        params={{ slug: game.slug }}
        className="grid content-start gap-2.5 outline-none transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100"
      >
        {/* transition names translate + box-shadow only: the tilt's transform is driven every frame */}
        <motion.div
          style={tilt ? { transform: tilt.transform } : undefined}
          onPointerMove={tilt?.onPointerMove}
          onPointerLeave={tilt?.onPointerLeave}
          className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-card ring-1 ring-white/10 transition-[translate,box-shadow] duration-300 ease-out motion-safe:group-hover:-translate-y-1 group-hover:shadow-glow group-has-[a:focus-visible]:ring-2 group-has-[a:focus-visible]:ring-ring"
        >
          <img
            src={game.poster[locale]}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
          />
          {/* Bottom corners, clear of the title baked into the top of the key art */}
          <PlayCount slug={game.slug} variant="overlay" className="absolute bottom-2 left-2" />
          <CoopBadge game={game} variant="overlay" className="absolute right-2 bottom-2" />
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
          <p className="truncate text-xs text-muted-foreground">{category?.label[locale]}</p>
        </div>
      </Link>
      <CardFavorite slug={game.slug} />
    </div>
  );
}

/** The heart in the poster's top-right corner. Signed-in players only: favourites live on the account. */
function CardFavorite({ slug }: { slug: string }) {
  const m = useMessages();
  const { signedIn, slugs, isFavorite, toggle } = useFavorites();
  if (!signedIn || slugs === undefined) return null;
  const on = isFavorite(slug);
  const label = on ? m.player.unfavorite : m.player.favorite;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={() => void toggle(slug)}
      className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-background/70 text-foreground ring-1 ring-white/10 backdrop-blur-md transition-[color,transform] outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring active:scale-90"
    >
      <HugeiconsIcon icon={FavouriteIcon} className={cn("size-4", on && "fill-current text-primary")} />
    </button>
  );
}
