import { LockIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, useReducedMotion } from "motion/react";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "#/components/ui/popover";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt, intlTag } from "#/lib/i18n";
import { FADE, RISE, stagger } from "#/lib/motion";
import { BADGES, type BadgeId, type BadgeTier } from "#/lib/profile";
import { cn } from "#/lib/utils";
import type { BadgeState } from "#/server/profile";

/** Each badge's hexagon art, by id (public/profile/badges/<id>.webp). */
const ART: Record<BadgeId, string> = {
  "first-play": "/profile/badges/first-play.webp",
  "explorer-5": "/profile/badges/explorer-5.webp",
  "explorer-all": "/profile/badges/explorer-all.webp",
  "plays-100": "/profile/badges/plays-100.webp",
  "online-win": "/profile/badges/online-win.webp",
  "top-10": "/profile/badges/top-10.webp",
  "lucky-jar": "/profile/badges/lucky-jar.webp",
  "tickets-1k": "/profile/badges/tickets-1k.webp",
  "tickets-10k": "/profile/badges/tickets-10k.webp",
  "first-favorite": "/profile/badges/first-favorite.webp",
  "first-purchase": "/profile/badges/first-purchase.webp",
  "streak-7": "/profile/badges/streak-7.webp",
  "streak-30": "/profile/badges/streak-30.webp",
  "streak-100": "/profile/badges/streak-100.webp",
  "shield-saved": "/profile/badges/shield-saved.webp",
};

/** Bronze is the warm orange, silver the paper white, gold the records star. */
const TIER: Record<BadgeTier, { chip: string }> = {
  bronze: { chip: "bg-warm/20 text-warm" },
  silver: { chip: "bg-foreground/10 text-foreground" },
  gold: { chip: "bg-highlight/20 text-highlight" },
};

/** Stuck on by hand: every unlocked sticker leans a little, never the same way twice in a row. */
const TILTS = ["-rotate-6", "rotate-3", "-rotate-2", "rotate-6", "rotate-2", "-rotate-4", "rotate-4"];

const SIZE = { md: "size-14", lg: "size-24" } as const;
/** Pixel box per size, for the image's width/height attributes (matches SIZE). */
const PX = { md: 56, lg: 96 } as const;

const defOf = (id: BadgeId) => BADGES.find((b) => b.id === id);

/**
 * One badge as its hexagon art. Unlocked, it is in full colour with a drop
 * shadow and a hand-stuck tilt; locked, a dim silhouette with a lock marker.
 */
export function BadgeSticker({
  id,
  unlocked,
  size = "md",
  tilt,
  className,
}: {
  id: BadgeId;
  unlocked: boolean;
  size?: keyof typeof SIZE;
  tilt?: string;
  className?: string;
}) {
  if (!defOf(id)) return null;
  return (
    <span aria-hidden className={cn("relative grid shrink-0 place-items-center", SIZE[size], unlocked && tilt, className)}>
      <img
        src={ART[id]}
        alt=""
        width={PX[size]}
        height={PX[size]}
        decoding="async"
        draggable={false}
        className={cn(
          "size-full object-contain select-none",
          unlocked ? "drop-shadow-md" : "opacity-15 brightness-0 invert",
        )}
      />
      {!unlocked && (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full bg-secondary ring-2 ring-card">
          <HugeiconsIcon icon={LockIcon} className="size-3 text-muted-foreground" />
        </span>
      )}
    </span>
  );
}

/**
 * The sticker album: every badge, unlocked ones in colour and tilted, locked
 * ones as silhouettes. Tap (or hover, with a mouse) for the name, how to unlock
 * it and when it was unlocked.
 */
export function BadgeGrid({ badges, className }: { badges: BadgeState[]; className?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const date = new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "medium" });
  const count = badges.filter((b) => b.unlocked).length;

  return (
    <section aria-labelledby="badges-title" className={cn("grid gap-4 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="badges-title" className="text-xl font-bold tracking-tight">
          {m.profile.badges.title}
        </h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {fmt(m.profile.badges.count, { n: count, total: badges.length })}
        </span>
      </div>
      <motion.ul
        variants={stagger(0.03)}
        initial="hidden"
        animate="shown"
        className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5 lg:grid-cols-8"
      >
        {badges.map((b, i) => {
          const def = defOf(b.id);
          if (!def) return null;
          const name = def.name[locale];
          return (
            <motion.li key={b.id} variants={reduce ? FADE : RISE} className="grid">
              <Popover>
                <PopoverTrigger
                  openOnHover
                  delay={150}
                  aria-label={`${name}: ${b.unlocked ? m.profile.badges.unlocked : m.profile.badges.locked}`}
                  className="group grid justify-items-center gap-2 rounded-2xl p-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BadgeSticker
                    id={b.id}
                    unlocked={b.unlocked}
                    tilt={TILTS[i % TILTS.length]}
                    className="transition-transform duration-200 ease-out motion-safe:group-hover:scale-110 motion-safe:group-hover:rotate-0"
                  />
                  <span
                    className={cn(
                      "line-clamp-2 text-[11px] leading-tight font-medium",
                      b.unlocked ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {name}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-64 gap-3 rounded-2xl">
                  <PopoverHeader>
                    <div className="flex items-center gap-2">
                      <PopoverTitle className="font-semibold">{name}</PopoverTitle>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TIER[def.tier].chip)}>
                        {m.profile.badges.tiers[def.tier]}
                      </span>
                    </div>
                    <PopoverDescription>
                      {b.unlocked
                        ? b.unlockedAt
                          ? fmt(m.profile.badges.unlockedOn, { date: date.format(new Date(b.unlockedAt)) })
                          : m.profile.badges.unlocked
                        : m.profile.badges.locked}
                    </PopoverDescription>
                  </PopoverHeader>
                  <p className="text-sm">
                    <span className="text-muted-foreground">{m.profile.badges.howTo}: </span>
                    {def.hint[locale]}
                  </p>
                </PopoverContent>
              </Popover>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
