import { Tick02Icon, Ticket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { play } from "cuelume";
import {
  AnimatePresence,
  animate,
  motion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { StreakFlame } from "#/components/shared/profile/streak-flame";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { Button } from "#/components/ui/button";
import { Progress } from "#/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "#/components/ui/tooltip";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt, intlTag, plural } from "#/lib/i18n";
import { EASE_OUT } from "#/lib/motion";
import { cn } from "#/lib/utils";
import type { CheckinClaim, CheckinDay, CheckinState } from "#/server/checkin";
import { GiftBox } from "./gift-box";

/** How many little tickets fly from the box to the ticket chip. */
const FLYERS = 7;
/** Burst rays around an opening box. */
const RAYS = Array.from({ length: 10 }, (_, i) => (i * 360) / 10);

interface Flyer {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay: number;
}

/** The ticket chip on screen right now (sidebar on desktop, top bar on phones), if any. */
function chipCenter() {
  for (const el of document.querySelectorAll<HTMLElement>(
    "[data-ticket-chip]",
  )) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0)
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return null;
}

/** "2026-11-11" as the reader says it: "Thứ Ba, 11/11" / "Tuesday, 11/11". */
function useDayName() {
  const locale = useLocale();
  const f = new Intl.DateTimeFormat(intlTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });
  return (day: string) => f.format(new Date(`${day}T00:00:00Z`));
}

/** HH:MM:SS until `at` (unix ms), ticking every second; calls `onDone` once it passes. */
function useCountdown(at: number, onDone: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= at) done.current();
    }, 1000);
    return () => clearInterval(id);
  }, [at]);
  const left = Math.max(0, Math.floor((at - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
}

/**
 * The daily check-in as a road of seven gift boxes (docs/standards/checkin.md):
 * opened boxes behind, today's box wiggling, closed ones ahead and a gold chest
 * on day 7. Opening today's box claims it: the box shakes, the lid pops, a
 * burst, the amount counts up and tickets fly to the ticket chip. Below: the
 * streak shield, the next milestone and the countdown to the next box.
 * `onClaim` runs the claim and resolves to its result; `onLanded` gets it once
 * the tickets have landed (the chip's balance updates then).
 */
export function CheckinTrack({
  state,
  onClaim,
  onLanded,
  onExpired,
}: {
  state: CheckinState;
  onClaim: () => Promise<CheckinClaim>;
  onLanded: (claim: CheckinClaim) => void;
  onExpired: () => void;
}) {
  const m = useMessages();
  const locale = useLocale();
  const reduce = useReducedMotion() ?? false;
  const dayName = useDayName();
  const nf = new Intl.NumberFormat(intlTag(locale));
  const countdown = useCountdown(state.nextResetAt, onExpired);

  // The open-chest sequence: "shaking" while the server answers, then "open"
  const [phase, setPhase] = useState<"idle" | "shaking" | "open">("idle");
  const [claim, setClaim] = useState<CheckinClaim | null>(null);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState(false);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [scope, animateBox] = useAnimate<HTMLDivElement>();
  const busy = phase !== "idle";

  const today = state.cycleIndex;
  // While the sequence runs, today's cell keeps its box even though the state now says claimed
  const showToday = !state.todayClaimed || busy;

  const open = async () => {
    if (busy || state.todayClaimed) return;
    setError(false);
    setPhase("shaking");
    const shake = reduce
      ? null
      : animateBox(
          scope.current,
          { rotate: [0, -9, 9, -7, 7, -4, 4, 0] },
          { duration: 0.55, repeat: Number.POSITIVE_INFINITY },
        );
    let result: CheckinClaim;
    try {
      result = await onClaim();
    } catch {
      shake?.stop();
      if (scope.current)
        void animateBox(scope.current, { rotate: 0 }, { duration: 0.15 });
      play("error");
      setPhase("idle");
      setError(true);
      return;
    }
    shake?.stop();
    if (!result.claimed) {
      // Another tab (or a racing tap) already checked in: just show the opened box
      setPhase("idle");
      onLanded(result);
      return;
    }
    setClaim(result);
    if (scope.current)
      void animateBox(
        scope.current,
        { rotate: 0, scale: [1, 1.18, 1] },
        { duration: 0.35, ease: EASE_OUT },
      );
    setPhase("open");
    play("open");

    const total = result.amount + (result.milestone?.bonus ?? 0);
    if (reduce) {
      setShown(total);
      window.setTimeout(() => finish(result), 900);
      return;
    }
    play("count", { duration: 700 });
    void animate(0, total, {
      duration: 0.7,
      ease: EASE_OUT,
      delay: 0.15,
      onUpdate: (v) => setShown(Math.round(v)),
    });

    // Tickets fly from the box to the chip on screen (or simply up, without one)
    const box = scope.current?.getBoundingClientRect();
    if (!box) return finish(result);
    const from = { x: box.left + box.width / 2, y: box.top + box.height / 3 };
    // A chip scrolled out of view: aim at the top edge under it, so the tickets visibly leave
    const chip = chipCenter();
    const to = chip
      ? { x: chip.x, y: Math.max(8, chip.y) }
      : { x: from.x, y: Math.max(8, from.y - 260) };
    setFlyers(
      Array.from({ length: FLYERS }, (_, i) => ({
        id: Date.now() + i,
        from: { x: from.x + (i - FLYERS / 2) * 6, y: from.y },
        to,
        delay: 0.35 + i * 0.07,
      })),
    );
    window.setTimeout(
      () => finish(result),
      (0.35 + FLYERS * 0.07 + 0.75) * 1000,
    );
  };

  const finish = (result: CheckinClaim) => {
    setFlyers([]);
    onLanded(result);
    // Let the count sit a moment over the opened box before the cell settles
    window.setTimeout(() => {
      setPhase("idle");
      setClaim(null);
    }, 1400);
  };

  const milestone = state.nextMilestone;
  const milestoneProgress = milestone
    ? Math.round(((milestone.days - milestone.daysLeft) / milestone.days) * 100)
    : 100;
  // The road fills up to the last opened box
  const lastClaimed = state.next7.reduce(
    (last, d, i) => (d.claimed && !(busy && i === today) ? i : last),
    -1,
  );
  // Six gift columns and a wider chest column (1.5 shares): each cell's centre, in % of the road
  const center = (i: number) => ((i < 6 ? i + 0.5 : 6.75) / 7.5) * 100;

  return (
    <section
      aria-labelledby="checkin-title"
      className="grid gap-5 overflow-hidden rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="checkin-title" className="text-xl font-bold tracking-tight">
            {m.profile.checkin.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {m.profile.checkin.subtitle}
          </p>
        </div>
        <StreakFlame days={state.streakDay} />
      </div>

      {/* The road */}
      {/* Phones: two rows (days 1-4, then 5-6 and the featured chest); sm up: one row on the track */}
      <div className="pt-2 pb-1 sm:pt-5">
        <ol className="relative grid grid-cols-4 items-end gap-x-2 gap-y-5 sm:grid-cols-[repeat(6,minmax(0,1fr))_minmax(0,1.5fr)] sm:gap-0">
          {/* The track the boxes sit on, filled up to the last opened one (one-row layout only) */}
          <span
            aria-hidden
            className="absolute right-[10%] bottom-[2.1rem] left-[6.67%] hidden h-2 rounded-full bg-secondary sm:block"
          />
          {lastClaimed > 0 && (
            <motion.span
              aria-hidden
              className="absolute bottom-[2.1rem] left-[6.67%] hidden h-2 rounded-full bg-primary sm:block"
              initial={false}
              animate={{ width: `${center(lastClaimed) - center(0)}%` }}
              transition={{ duration: reduce ? 0 : 0.6, ease: EASE_OUT }}
            />
          )}
          {state.next7.map((d, i) => (
            <li
              key={d.day}
              className={cn(
                "relative grid justify-items-center gap-1.5",
                d.isChest && "col-span-2 sm:col-span-1",
              )}
            >
              {i === today && showToday ? (
                <TodayBox
                  day={d}
                  phase={phase}
                  reduce={reduce}
                  scope={scope}
                  onOpen={() => void open()}
                  label={fmt(m.profile.checkin.claim, { n: d.amount })}
                  shown={shown}
                />
              ) : (
                <StaticBox day={d} />
              )}
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  d.isChest
                    ? "font-semibold text-highlight"
                    : i === today
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {fmt(m.profile.checkin.day, { n: d.day })}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Today's line: the button, or what happened */}
      <div
        className="grid min-h-11 place-items-center text-center"
        aria-live="polite"
      >
        {state.todayClaimed && !busy ? (
          <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <HugeiconsIcon
              icon={Tick02Icon}
              className="size-4 text-brand"
              aria-hidden
            />
            {m.profile.checkin.doneToday}
          </p>
        ) : phase === "open" && claim ? (
          <p className="text-sm font-medium">
            {claim.shieldUsed
              ? fmt(m.profile.checkin.shieldSaved, {
                  day: dayName(claim.shieldUsed),
                })
              : fmt(m.profile.checkin.got, { n: nf.format(claim.amount) })}
          </p>
        ) : (
          <Button
            size="lg"
            className="h-11 rounded-full px-6 font-semibold"
            disabled={busy}
            onClick={() => void open()}
          >
            <HugeiconsIcon icon={Ticket01Icon} data-icon="inline-start" />
            {busy
              ? m.profile.checkin.opening
              : fmt(m.profile.checkin.claim, { n: state.todayAmount })}
          </Button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {m.profile.checkin.error}
          </p>
        )}
      </div>

      {/* Shield, next milestone, countdown */}
      <div className="grid gap-2 sm:grid-cols-3">
        <InfoTile
          art="/profile/cards/shield.webp"
          dim={!state.shieldAvailableThisWeek}
          label={m.profile.checkin.shield}
          value={
            state.shieldAvailableThisWeek
              ? m.profile.checkin.shieldReady
              : fmt(m.profile.checkin.shieldUsed, {
                  day: state.shieldUsedOn ? dayName(state.shieldUsedOn) : "",
                })
          }
          hint={
            state.shieldWillCover
              ? fmt(m.profile.checkin.shieldWillCover, {
                  day: dayName(state.shieldWillCover),
                })
              : state.shieldAvailableThisWeek
                ? m.profile.checkin.shieldReadyHint
                : m.profile.checkin.shieldUsedHint
          }
        />
        <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3 ring-1 ring-border">
          <CardArt src="/profile/cards/milestone.webp" dim={!milestone} />
          <div className="grid min-w-0 flex-1 gap-1.5">
            <p className="text-xs font-semibold">
              {milestone
                ? fmt(m.profile.checkin.milestone, {
                    days: milestone.days,
                    bonus: nf.format(milestone.bonus),
                  })
                : m.profile.checkin.milestonesDone}
            </p>
            {milestone && (
              <>
                <Progress
                  value={milestoneProgress}
                  aria-label={m.profile.checkin.milestone}
                  className="gap-0 [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-indicator]]:bg-highlight [&_[data-slot=progress-track]]:bg-foreground/15"
                />
                <p className="text-[11px] text-muted-foreground">
                  {milestone.daysLeft === 0
                    ? m.profile.checkin.milestoneToday
                    : plural(
                        locale,
                        milestone.daysLeft,
                        m.profile.checkin.milestoneLeft,
                      )}
                </p>
              </>
            )}
          </div>
        </div>
        <InfoTile
          art="/profile/cards/clock.webp"
          label={m.profile.checkin.nextIn}
          value={<span className="font-mono tabular-nums">{countdown}</span>}
          hint={fmt(m.profile.checkin.total, {
            n: nf.format(state.totalCheckinDays),
          })}
        />
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {flyers.map((f) => (
              <motion.span
                key={f.id}
                aria-hidden
                className="pointer-events-none fixed top-0 left-0 z-[60] grid size-7 -translate-1/2 place-items-center drop-shadow-lg"
                initial={{
                  x: f.from.x,
                  y: f.from.y,
                  scale: 0.4,
                  opacity: 0,
                  rotate: 0,
                }}
                animate={{
                  x: [
                    f.from.x,
                    (f.from.x + f.to.x) / 2 + (f.id % 2 ? 40 : -40),
                    f.to.x,
                  ],
                  y: [f.from.y, Math.min(f.from.y, f.to.y) - 90, f.to.y],
                  scale: [0.4, 1.1, 0.5],
                  opacity: [0, 1, 0.9],
                  rotate: [0, f.id % 2 ? 160 : -160, 360],
                }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{
                  duration: 0.75,
                  delay: f.delay,
                  ease: "easeInOut",
                }}
              >
                <TicketIcon px={28} className="size-7" />
              </motion.span>
            ))}
          </AnimatePresence>,
          document.body,
        )}
    </section>
  );
}

/** A card's picture (public/profile/cards/*.webp); `dim` greys it out when the thing is spent. */
function CardArt({ src, dim = false }: { src: string; dim?: boolean }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={40}
      height={40}
      decoding="async"
      draggable={false}
      className={cn(
        "size-10 shrink-0 object-contain select-none",
        dim ? "opacity-50 grayscale" : "drop-shadow-sm",
      )}
    />
  );
}

function InfoTile({
  art,
  dim,
  label,
  value,
  hint,
}: {
  art: string;
  dim?: boolean;
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3 ring-1 ring-border">
      <CardArt src={art} dim={dim} />
      <div className="grid min-w-0 gap-0.5">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm leading-tight font-semibold">{value}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/** The tickets a box pays: a ticket icon and the amount, as a small pill. Static class strings per tone; on today's orange pill the ticket turns white so it doesn't vanish. */
const BADGE_TONE = {
  claimed: "bg-secondary text-muted-foreground/70",
  future: "bg-secondary text-foreground",
  chest: "bg-highlight/15 text-highlight ring-1 ring-highlight/40",
  today: "bg-primary text-primary-foreground shadow-md",
} as const;

function TicketBadge({
  amount,
  tone,
}: {
  amount: number;
  tone: keyof typeof BADGE_TONE;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-1 text-[11px] leading-none font-bold whitespace-nowrap tabular-nums",
        BADGE_TONE[tone],
      )}
    >
      <TicketIcon
        px={14}
        className={cn("size-3.5", tone === "today" && "brightness-0 invert")}
      />
      +{amount}
    </span>
  );
}

/** A box that is not today's: opened with a check mark, or closed with its amount. */
function StaticBox({ day }: { day: CheckinDay }) {
  const m = useMessages();
  const cell = fmt(
    day.claimed ? m.profile.checkin.claimedCell : m.profile.checkin.futureCell,
    { n: day.day, amount: day.amount },
  );
  const label = day.isChest ? `${m.profile.checkin.chest}. ${cell}` : cell;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            role="img"
            aria-label={label}
            className="relative grid cursor-pointer justify-items-center rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <span className="mb-1">
          <TicketBadge
            amount={day.amount}
            tone={day.claimed ? "claimed" : day.isChest ? "chest" : "future"}
          />
        </span>
        <GiftBox
          day={day.day}
          look={day.claimed ? "claimed" : "future"}
          className={
            day.isChest
              ? "size-20 lg:size-24"
              : "size-14 lg:size-16"
          }
        />
        {day.claimed && (
          <span className="absolute top-7 -right-1 grid size-5 place-items-center rounded-full bg-brand text-primary-foreground ring-2 ring-card">
            <HugeiconsIcon
              icon={Tick02Icon}
              className="size-3.5"
              strokeWidth={3}
            />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Today's box: wiggles until tapped, then shakes, pops its lid and bursts. */
function TodayBox({
  day,
  phase,
  reduce,
  scope,
  onOpen,
  label,
  shown,
}: {
  day: CheckinDay;
  phase: "idle" | "shaking" | "open";
  reduce: boolean;
  scope: RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  label: string;
  shown: number;
}) {
  const m = useMessages();
  const opened = phase === "open";
  return (
    <div className="relative grid justify-items-center">
      {/* The amount, then the count-up once open */}
      <span className="relative mb-1 grid h-4.5 place-items-center">
        {opened ? (
          <motion.span
            className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-highlight px-2 py-0.5 text-xs whitespace-nowrap text-primary-foreground shadow-lg"
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.6 }
            }
            animate={
              reduce ? { opacity: 1 } : { opacity: 1, y: -14, scale: 1.15 }
            }
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
          >
            +{shown}
          </motion.span>
        ) : (
          <TicketBadge amount={day.amount} tone="today" />
        )}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={onOpen}
              disabled={phase !== "idle"}
              aria-label={label}
              className="group relative grid cursor-pointer place-items-center rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
            />
          }
        >
          {/* A soft pulse behind the box until it is opened */}
          {!opened && !reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-primary/30 blur-md"
              animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.5, 0.15, 0.5] }}
              transition={{
                duration: 1.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
          )}
          {/* The burst */}
          {opened && !reduce && (
            <span aria-hidden className="pointer-events-none absolute inset-0">
              {RAYS.map((deg, i) => (
                <motion.span
                  key={deg}
                  className={cn(
                    "absolute top-1/2 left-1/2 h-1.5 w-4 origin-left rounded-full",
                    i % 2 ? "bg-highlight" : "bg-primary",
                  )}
                  style={{ rotate: deg }}
                  initial={{ x: 0, opacity: 1, scaleX: 0.3 }}
                  animate={{ x: 34, opacity: 0, scaleX: 1 }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                />
              ))}
              <motion.span
                className="absolute inset-0 rounded-full ring-4 ring-highlight"
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
              />
            </span>
          )}
          <motion.div
            ref={scope}
            className="relative"
            animate={
              phase === "idle" && !reduce
                ? { rotate: [0, -7, 7, -5, 5, 0] }
                : undefined
            }
            transition={
              phase === "idle"
                ? {
                    duration: 0.6,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatDelay: 1.6,
                  }
                : undefined
            }
          >
            <GiftBox
              day={day.day}
              look="today"
              opened={opened}
              pop={!reduce}
              className={
                day.isChest
                  ? "size-24 lg:size-28"
                  : "size-16 lg:size-20"
              }
            />
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          {opened
            ? fmt(m.profile.checkin.claimedCell, {
                n: day.day,
                amount: day.amount,
              })
            : m.profile.checkin.tapToOpen}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
