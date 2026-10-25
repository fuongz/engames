import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import type { GameManifest } from "@web-games/core";
import { motion, useReducedMotion } from "motion/react";
import { GameCard } from "#/components/shared/games/game-card";
import { useMessages } from "#/hooks/use-messages";
import { FADE, RISE, stagger } from "#/lib/motion";

const CELL = "w-36 shrink-0 snap-start lg:w-auto";
/** Header first, then each tile, as the row scrolls into view (once). */
const ROW = stagger(0.06);
const VIEWPORT = { once: true, amount: 0.25 } as const;


/** A titled row of posters: swipeable on phones, a 6-column grid on desktop. */
export function GameShelf({ title, games }: { title: string; games: GameManifest[] }) {
  const m = useMessages();
  const cell = useReducedMotion() ? FADE : RISE;
  return (
    <motion.section variants={ROW} initial="hidden" whileInView="shown" viewport={VIEWPORT} className="grid gap-3">
      <motion.div variants={cell} className="flex items-end justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h2>
        <Link to="/library" className="flex items-center gap-1 text-sm transition-colors hover:text-primary">
          {m.home.seeAll}
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Link>
      </motion.div>
      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible lg:px-0">
        {games.map((g) => (
          <motion.div key={g.slug} variants={cell} className={CELL}>
            <GameCard game={g} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
