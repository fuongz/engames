import { LockIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PointerEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Progress } from "#/components/ui/progress";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "#/components/ui/popover";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt, intlTag } from "#/lib/i18n";
import { FADE, RISE, stagger } from "#/lib/motion";
import { BADGES, type BadgeId, type BadgeTier } from "#/lib/profile";
import { cn } from "#/lib/utils";
import type { BadgeState } from "#/server/profile";

/** Each badge's shield art, by id (public/profile/badges/<id>.webp). */
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

const SIZE = { md: "size-14", xl: "size-[4.5rem] sm:size-20", lg: "size-24" } as const;
/** Pixel box per size, for the image's width/height attributes (matches SIZE). */
const PX = { md: 56, xl: 80, lg: 96 } as const;

const defOf = (id: BadgeId) => BADGES.find((b) => b.id === id);

/**
 * One badge as its shield art. Unlocked, it is in full colour with a drop
 * shadow; locked, a dim silhouette with a lock marker.
 */
export function BadgeSticker({
  id,
  unlocked,
  size = "md",
  className,
}: {
  id: BadgeId;
  unlocked: boolean;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  if (!defOf(id)) return null;
  return (
    <span aria-hidden className={cn("relative grid shrink-0 place-items-center", SIZE[size], className)}>
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

/** Degrees the badge leans at the very edge of its box. */
const MAX_TILT = 18;
const SPRING = { stiffness: 260, damping: 20, mass: 0.6 } as const;

/**
 * A badge that leans toward a mouse pointer in 3D, with a shine that follows
 * the pointer across its face (masked to the badge's own shape). Touch and pen
 * only tap, so they never tilt; reduced motion turns it off.
 */
function TiltBadge({ id, unlocked }: { id: BadgeId; unlocked: boolean }) {
  const reduce = useReducedMotion();
  // Pointer position over the box, 0..1 on each axis; 0.5 is the centre
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const lift = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [0, 1], [MAX_TILT, -MAX_TILT]), SPRING);
  const rotateY = useSpring(useTransform(px, [0, 1], [-MAX_TILT, MAX_TILT]), SPRING);
  const scale = useSpring(useTransform(lift, [0, 1], [1, 1.12]), SPRING);
  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, color-mix(in oklab, var(--color-white) 55%, transparent), transparent 55%)`;
  const glareOpacity = useSpring(lift, SPRING);

  const move = (e: PointerEvent<HTMLSpanElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
    lift.set(1);
  };
  const leave = () => {
    px.set(0.5);
    py.set(0.5);
    lift.set(0);
  };

  return (
    <span className="grid shrink-0 place-items-center perspective-[600px]" onPointerMove={move} onPointerLeave={leave}>
      {/* Exactly the sticker's box, so the shine's mask lines up with the art */}
      <motion.span
        className={cn("relative grid transform-3d", SIZE.xl)}
        style={reduce ? undefined : { rotateX, rotateY, scale }}
      >
        <BadgeSticker id={id} unlocked={unlocked} size="xl" />
        {unlocked && !reduce && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-overlay"
            style={{
              backgroundImage: glare,
              opacity: glareOpacity,
              maskImage: `url(${ART[id]})`,
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              translateZ: 24,
            }}
          />
        )}
      </motion.span>
    </span>
  );
}

/**
 * "Achievements": every badge as a big shield, the unlocked ones first and in
 * colour, the locked ones as silhouettes after them. Tap (or hover, with a
 * mouse) for the name, how to unlock it and when it was unlocked.
 */
export function BadgeGrid({ badges, className }: { badges: BadgeState[]; className?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const date = new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "medium" });
  const nf = new Intl.NumberFormat(intlTag(locale));
  const count = badges.filter((b) => b.unlocked).length;
  // Unlocked first (newest first), locked after in catalogue order
  const ordered = [...badges].sort(
    (a, b) => Number(b.unlocked) - Number(a.unlocked) || (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0),
  );

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
        className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 lg:grid-cols-8"
      >
        {ordered.map((b) => {
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
                  className="grid justify-items-center rounded-2xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <TiltBadge id={b.id} unlocked={b.unlocked} />
                  {b.progress && (
                    <span className="mt-1.5 grid w-full max-w-16 gap-1 justify-items-center">
                      <span aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-foreground/15">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${(b.progress.current / b.progress.target) * 100}%` }}
                        />
                      </span>
                      <span className="text-[10px] leading-none text-muted-foreground tabular-nums">
                        {nf.format(b.progress.current)}/{nf.format(b.progress.target)}
                      </span>
                    </span>
                  )}
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
                  {b.progress && (
                    <div className="grid gap-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-semibold tabular-nums">
                          {fmt(m.profile.badges.progress[b.progress.unit], {
                            n: nf.format(b.progress.current),
                            total: nf.format(b.progress.target),
                          })}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {fmt(m.profile.badges.remaining[b.progress.unit], {
                            n: nf.format(b.progress.target - b.progress.current),
                          })}
                        </span>
                      </div>
                      <Progress
                        value={(b.progress.current / b.progress.target) * 100}
                        aria-label={name}
                        className="[&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-track]]:bg-foreground/15"
                      />
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}
