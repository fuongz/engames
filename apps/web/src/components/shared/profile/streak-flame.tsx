import { motion, useReducedMotion } from "motion/react";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { plural } from "#/lib/i18n";
import { cn } from "#/lib/utils";

/**
 * The flame's colour climbs with the streak: orange from day 1, gold at 7 (the
 * first milestone), blue at 30, lime at 100. No streak: a cold grey, unlit.
 */
function flameOf(days: number) {
  if (days >= 100) return { fill: "text-brand", glow: "bg-brand/30", pill: "bg-brand/12 ring-brand/40" };
  if (days >= 30) return { fill: "text-brand-alt", glow: "bg-brand-alt/30", pill: "bg-brand-alt/12 ring-brand-alt/40" };
  if (days >= 7) return { fill: "text-highlight", glow: "bg-highlight/30", pill: "bg-highlight/12 ring-highlight/40" };
  if (days >= 1) return { fill: "text-primary", glow: "bg-primary/30", pill: "bg-primary/12 ring-primary/40" };
  return { fill: "text-muted-foreground/60", glow: "", pill: "bg-secondary ring-border" };
}

/** The whole flame: a round body, a tall tip leaning right, a small tongue each side. */
const BODY =
  "M54 4C58 22 72 30 77 44C80 38 81 33 80 27C91 39 95 53 95 66C95 89 76 106 50 106C24 106 5 89 5 66C5 51 13 40 22 33C22 40 24 45 29 49C29 31 41 20 54 4Z";
/** A softer, lighter core inside it, lower down. */
const CORE =
  "M51 34C55 47 68 53 70 66C72 80 63 94 50 94C37 94 28 84 29 72C30 60 41 55 45 44C47 50 49 52 51 55C51 47 50 41 51 34Z";

/**
 * The check-in streak as a flickering flame and its day count. `compact`: just
 * the pill; otherwise the label sits under the count and the flame stands as
 * tall as both lines. The flame flickers from its base (the body stretches
 * and leans, the core breathes out of step); reduced motion keeps it still.
 */
export function StreakFlame({ days, compact = false, className }: { days: number; compact?: boolean; className?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const flame = flameOf(days);
  const lit = days > 0;
  const live = lit && !reduce;
  const count = lit ? plural(locale, days, m.profile.streak.days) : m.profile.streak.none;

  return (
    <span
      className={cn("inline-flex w-fit items-center gap-2 rounded-full py-1 pr-3.5 pl-1.5 ring-1", flame.pill, className)}
      title={m.profile.streak.label}
    >
      <span className={cn("relative grid place-items-center", compact ? "size-6" : "size-9")}>
        {lit && <span aria-hidden className={cn("absolute inset-0.5 top-1.5 rounded-full blur-md", flame.glow)} />}
        <svg aria-hidden viewBox="0 0 100 110" className={cn("relative overflow-visible", compact ? "size-5" : "size-9", flame.fill)}>
          <motion.path
            d={BODY}
            className="fill-current"
            style={{ originX: "50%", originY: "100%", transformBox: "fill-box" }}
            animate={live ? { scaleY: [1, 1.07, 0.97, 1.05, 1], scaleX: [1, 0.97, 1.02, 0.98, 1], skewX: [0, -4, 3, -2, 0] } : undefined}
            transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
          <motion.path
            d={CORE}
            className="fill-white/25"
            style={{ originX: "50%", originY: "100%", transformBox: "fill-box" }}
            animate={live ? { scaleY: [1, 0.94, 1.08, 0.97, 1], skewX: [0, 3, -3, 2, 0] } : undefined}
            transition={{ duration: 0.7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
        </svg>
      </span>
      <span className="grid leading-tight">
        <span className="text-sm font-bold tabular-nums">{count}</span>
        {!compact && <span className="text-[11px] text-muted-foreground">{m.profile.streak.label}</span>}
      </span>
    </span>
  );
}
