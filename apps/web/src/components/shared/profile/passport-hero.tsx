import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { compactCount } from "#/lib/format";
import { fmt, intlTag } from "#/lib/i18n";
import { EASE_OUT } from "#/lib/motion";
import { cn } from "#/lib/utils";
import type { Profile } from "#/server/profile";
import { StreakFlame } from "./streak-flame";

const DAY_MS = 86_400_000;

/** One cell of the passport's stat strip: a small icon, the number, a tiny label. */
function StripStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="grid justify-items-center gap-1 text-center">
      <img src={icon} alt="" aria-hidden width={32} height={32} decoding="async" draggable={false} className="size-7 object-contain sm:size-8" />
      <span className="text-sm leading-none font-bold tabular-nums sm:text-base">{value}</span>
      <span className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">{label}</span>
    </div>
  );
}

/** The ring's radius in its 100-unit viewBox; the stroke sits inside the box. */
const R = 45;

/**
 * The passport's machine-readable line: the name in capitals, accents stripped,
 * gaps as `<`, padded to a fixed width. Decoration only (aria-hidden).
 */
function mrz(name: string, userId: string, level: number) {
  const plain = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "<");
  const id = userId.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9).padEnd(9, "<");
  return [`P<ENG${plain}`.padEnd(36, "<").slice(0, 36), `${id}<LV${String(level).padStart(3, "0")}<<<<<<<<<<<<<<<<<<<<<<<<`.slice(0, 36)];
}

/**
 * The top of the Engames Passport: the avatar inside an XP ring that fills to
 * the next level, the level number on a tab, the title, name, join date, ticket
 * balance and streak flame. `actions` sits in the corner (the owner's Share).
 * `avatarAction` sits on the avatar's lower right and `nameAction` right after
 * the name (the owner's edit buttons); both stay empty on a public profile.
 * `streakDay` and `balance` override the profile's when the page has fresher ones.
 */
export function PassportHero({
  profile: p,
  streakDay = p.checkin.streakDay,
  balance = p.tickets.balance,
  actions,
  avatarAction,
  nameAction,
  className,
}: {
  profile: Profile;
  streakDay?: number;
  balance?: number;
  actions?: ReactNode;
  avatarAction?: ReactNode;
  nameAction?: ReactNode;
  className?: string;
}) {
  const m = useMessages();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const need = p.xpIntoLevel + p.xpToNext;
  const progress = need > 0 ? Math.min(1, p.xpIntoLevel / need) : 0;
  const nf = new Intl.NumberFormat(intlTag(locale));
  const joined = new Intl.DateTimeFormat(intlTag(locale), { month: "long", year: "numeric" }).format(new Date(p.joinedAt));
  const [line1, line2] = mrz(p.name, p.userId, p.level);
  const s = m.profile.stats;
  const plays = p.games.reduce((sum, g) => sum + g.plays, 0);
  const unlocked = p.badges.filter((b) => b.unlocked).length;
  const daysWithUs = Math.max(1, Math.ceil((Date.now() - p.joinedAt) / DAY_MS));

  return (
    <section
      aria-label={m.profile.passport}
      className={cn(
        "relative isolate overflow-hidden rounded-3xl bg-card ring-1 ring-border",
        "bg-linear-to-br from-warm/30 via-card to-card",
        className,
      )}
    >
      {/* Security print: a fine dot grid fading out to the right */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--glass-edge)_1px,transparent_1.5px)] bg-size-[12px_12px] mask-r-from-10% mask-r-to-90%"
      />
      <div className="grid gap-5 p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] font-semibold tracking-[0.25em] text-primary uppercase">{m.profile.passport}</span>
          {actions}
        </div>

        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-7 sm:text-left">
          {/* XP ring. The slot is a sibling of the labelled image: a role="img" hides its children from assistive tech */}
          <div className="relative size-32 shrink-0 sm:size-36">
            <div
              className="absolute inset-0"
              role="img"
              aria-label={fmt(m.profile.xpLabel, { level: p.level, into: nf.format(p.xpIntoLevel), need: nf.format(need) })}
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r={R} className="fill-none stroke-foreground/10" strokeWidth="6" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r={R}
                  className="fill-none stroke-primary"
                  strokeWidth="6"
                  strokeLinecap="round"
                  initial={{ pathLength: reduce ? progress : 0 }}
                  animate={{ pathLength: progress }}
                  transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.2 }}
                />
              </svg>
              <Avatar className="absolute inset-[11%] size-auto">
                {p.image && <AvatarImage src={p.image} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback className="text-3xl font-bold">{p.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-primary-foreground tabular-nums shadow-md ring-[3px] ring-card">
                {fmt(m.profile.level, { n: p.level })}
              </span>
            </div>
            {avatarAction && <div className="absolute right-0 bottom-5 z-10">{avatarAction}</div>}
          </div>

          <div className="grid min-w-0 justify-items-center gap-2 sm:justify-items-start">
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-primary uppercase">
              {p.title[locale]}
            </span>
            <div className="flex max-w-full items-center gap-1">
              <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight sm:text-3xl">{p.name}</h1>
              {nameAction}
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <HugeiconsIcon icon={Calendar03Icon} className="size-4" aria-hidden />
              {fmt(m.profile.joined, { date: joined })}
              <span aria-hidden className="text-border">•</span>
              <span className="font-mono text-xs tabular-nums">{fmt(m.profile.xp, { into: nf.format(p.xpIntoLevel), need: nf.format(need) })}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-sm font-bold tabular-nums ring-1 ring-border">
                <TicketIcon px={20} className="size-5" />
                {nf.format(balance)}
                <span className="sr-only">{m.profile.tickets}</span>
              </span>
              <StreakFlame days={streakDay} compact />
            </div>
          </div>
        </div>
      </div>

      {/* The stat strip: everything worth bragging about, at a glance */}
      <dl className="grid grid-cols-4 gap-x-2 gap-y-4 border-t px-4 py-4 sm:grid-cols-7 sm:px-7">
        {[
          { key: "plays", icon: "/profile/stats/plays.webp", value: nf.format(plays), label: s.plays },
          { key: "games", icon: "/profile/stats/games-tried.webp", value: nf.format(p.games.length), label: s.gamesTried },
          { key: "tickets", icon: "/profile/stats/tickets-earned.webp", value: compactCount(p.tickets.earnedTotal, locale), label: s.ticketsEarned },
          { key: "badges", icon: "/profile/badges/top-10.webp", value: `${unlocked}/${p.badges.length}`, label: s.badges },
          { key: "checkins", icon: "/profile/stats/checkin-days.webp", value: nf.format(p.checkin.totalCheckinDays), label: s.checkinDays },
          { key: "xp", icon: "/profile/stats/total-xp.webp", value: compactCount(p.xp, locale), label: s.xp },
          { key: "days", icon: "/profile/cards/clock.webp", value: nf.format(daysWithUs), label: s.daysWithUs },
        ].map((x) => (
          <div key={x.key} className="contents">
            <dt className="sr-only">{x.label}</dt>
            <dd className="contents">
              <StripStat icon={x.icon} value={x.value} label={x.label} />
            </dd>
          </div>
        ))}
      </dl>

      {/* The machine-readable zone along the bottom edge */}
      <div
        aria-hidden
        className="overflow-hidden border-t border-dashed bg-background/40 px-5 py-2 font-mono text-[10px] leading-4 tracking-[0.18em] whitespace-nowrap text-muted-foreground/60 sm:px-7 sm:text-[11px]"
      >
        <div>{line1}</div>
        <div>{line2}</div>
      </div>
    </section>
  );
}
