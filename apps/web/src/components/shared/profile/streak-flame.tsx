import { FireIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, useReducedMotion } from "motion/react";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { plural } from "#/lib/i18n";
import { cn } from "#/lib/utils";

/**
 * The flame's colour climbs with the streak: orange from day 1, gold at 7 (the
 * first milestone), blue at 30, lime at 100. No streak: a cold grey.
 */
function flameOf(days: number) {
  if (days >= 100) return { icon: "text-brand", glow: "bg-brand/25", pill: "bg-brand/12 ring-brand/40" };
  if (days >= 30) return { icon: "text-brand-alt", glow: "bg-brand-alt/25", pill: "bg-brand-alt/12 ring-brand-alt/40" };
  if (days >= 7) return { icon: "text-highlight", glow: "bg-highlight/25", pill: "bg-highlight/12 ring-highlight/40" };
  if (days >= 1) return { icon: "text-primary", glow: "bg-primary/25", pill: "bg-primary/12 ring-primary/40" };
  return { icon: "text-muted-foreground", glow: "", pill: "bg-secondary ring-border" };
}

/**
 * The check-in streak as a flickering flame and its day count. `compact`: just
 * the pill; otherwise the label sits under it.
 */
export function StreakFlame({ days, compact = false, className }: { days: number; compact?: boolean; className?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const flame = flameOf(days);
  const lit = days > 0;
  const count = lit ? plural(locale, days, m.profile.streak.days) : m.profile.streak.none;

  return (
    <span
      className={cn("inline-flex w-fit items-center gap-2 rounded-full py-1 pr-3.5 pl-1.5 ring-1", flame.pill, className)}
      title={m.profile.streak.label}
    >
      <span className="relative grid size-7 place-items-center">
        {lit && <span aria-hidden className={cn("absolute inset-0.5 rounded-full blur-md", flame.glow)} />}
        <motion.span
          aria-hidden
          className="relative grid origin-bottom place-items-center"
          animate={lit && !reduce ? { scaleY: [1, 1.12, 0.96, 1.06, 1], rotate: [0, -3, 2, -1, 0] } : undefined}
          transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        >
          <HugeiconsIcon icon={FireIcon} className={cn("size-5", flame.icon)} strokeWidth={2.2} />
        </motion.span>
      </span>
      <span className="grid leading-tight">
        <span className="text-sm font-bold tabular-nums">{count}</span>
        {!compact && <span className="text-[11px] text-muted-foreground">{m.profile.streak.label}</span>}
      </span>
    </span>
  );
}
