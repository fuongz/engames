import { motion } from "motion/react";
import { cn } from "#/lib/utils";

export type BoxLook = "future" | "today" | "claimed";

/** The three chest tiers along the 7-day road: days 1–3 wood, 4–6 silver, day 7 gold. */
type Tier = "wood" | "silver" | "gold";

function tierOf(day: number): Tier {
  if (day >= 7) return "gold";
  return day >= 4 ? "silver" : "wood";
}

/** Chest art in public/checkin/ (sources: packages/games/art-src/samples/checkin/v4/). */
const ART: Record<Tier, { closed: string; open: string }> = {
  wood: { closed: "/checkin/wood-closed.webp", open: "/checkin/wood-open.webp" },
  silver: { closed: "/checkin/silver-closed.webp", open: "/checkin/silver-open.webp" },
  gold: { closed: "/checkin/gold-closed.webp", open: "/checkin/gold-open.webp" },
};

/**
 * Per look. Filters, not opacity: the road behind must never show through a box.
 * Static strings, never assembled at runtime.
 */
const LOOK: Record<BoxLook, string> = {
  future: "brightness-[.85] saturate-[.8]",
  today: "drop-shadow-[0_6px_14px_color-mix(in_oklch,var(--highlight)_45%,transparent)]",
  claimed: "brightness-[.6] saturate-[.5]",
};

/**
 * One check-in chest for `day` (1 … 7) of the cycle. `opened` shows it open;
 * with `pop` the open chest springs in (the open-chest sequence). Both images
 * are always in the DOM so the open one is already loaded when it is needed.
 */
export function GiftBox({
  day,
  look,
  opened = look === "claimed",
  pop = false,
  className,
}: {
  day: number;
  look: BoxLook;
  opened?: boolean;
  pop?: boolean;
  className?: string;
}) {
  const art = ART[tierOf(day)];
  return (
    <span aria-hidden className={cn("relative block", className)}>
      <img
        src={art.closed}
        alt=""
        draggable={false}
        className={cn("absolute inset-0 size-full object-contain", LOOK[look], opened && "invisible")}
      />
      <motion.img
        src={art.open}
        alt=""
        draggable={false}
        className={cn("absolute inset-0 size-full object-contain", LOOK[look], !opened && "invisible")}
        initial={false}
        animate={opened ? { scale: 1, y: 0 } : { scale: 0.7, y: 6 }}
        transition={pop ? { type: "spring", stiffness: 520, damping: 14 } : { duration: 0 }}
        style={{ transformOrigin: "50% 100%" }}
      />
    </span>
  );
}
