import {
  FavouriteIcon,
  GoogleIcon,
  Logout01Icon,
  UserCircleIcon,
  WorkHistoryIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { play } from "cuelume";
import { type ReactNode, useEffect, useState } from "react";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Switch } from "#/components/ui/switch";
import { useHistoryConsent } from "#/hooks/use-history-consent";
import { useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { signInWithGoogle, signOut } from "#/lib/auth-client";
import { fmt } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import type { CheckinState } from "#/server/checkin";
import { useCheckin } from "#/stores/checkin";
import { type LevelInfo, useLevel } from "#/stores/level";
import { profilePublicOf, useProfilePublic } from "#/stores/profile-public";
import { useTickets } from "#/stores/tickets";

/** Menu rows: roomy and rounded, like the cards above them. */
const ROW = "gap-3 rounded-xl px-3 py-2.5 text-sm";

/** The level's progress, 0 … 1. */
function progressOf(info: LevelInfo | null): number {
  if (!info) return 0;
  const total = info.xpIntoLevel + info.xpToNext;
  return total > 0 ? info.xpIntoLevel / total : 0;
}

/** An avatar inside a thin XP ring: a grey track and the level's progress in the brand colour. */
function XpRing({ progress, className, children }: { progress: number; className?: string; children: ReactNode }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <span className={cn("relative grid shrink-0 place-items-center", className)}>
      <svg viewBox="0 0 40 40" aria-hidden className="absolute inset-0 size-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="2.5" className="stroke-muted-foreground/25" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      {children}
    </span>
  );
}

/** The 7-day cycle as dots: claimed filled, today's ringed until claimed, day 7 gold. */
function CheckinDots({ state }: { state: CheckinState }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {state.next7.map((d, i) => {
        const today = i === state.cycleIndex && !state.todayClaimed;
        return (
          <span
            key={d.day}
            className={cn(
              "rounded-full",
              d.isChest ? "size-2.5" : "size-2",
              d.claimed
                ? d.isChest
                  ? "bg-highlight"
                  : "bg-primary"
                : today
                  ? "animate-pulse bg-primary/35 ring-2 ring-primary"
                  : d.isChest
                    ? "bg-highlight/30"
                    : "bg-muted-foreground/25",
            )}
          />
        );
      })}
    </div>
  );
}

/** Quick check-in inside the account menu: the cycle's dots and a Claim pill. */
function CheckinCard({ state, userId }: { state: CheckinState; userId: string }) {
  const m = useMessages();
  const claim = useCheckin((s) => s.claim);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const onClaim = async () => {
    if (busy || state.todayClaimed) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await claim();
      if (result.claimed) {
        if (useTickets.getState().userId === userId) useTickets.getState().set(result.balance);
        setNote(fmt(m.account.checkinGot, { n: result.amount + (result.milestone?.bonus ?? 0) }));
        play("success");
      }
    } catch {
      setNote(m.account.checkinError);
      play("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1.5 grid gap-3 rounded-xl bg-secondary/70 p-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold whitespace-nowrap">{m.account.checkin}</span>
        <CheckinDots state={state} />
        <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {fmt(m.account.checkinDay, { n: state.cycleIndex + 1 })}
        </span>
      </div>
      <div className="flex items-center gap-2 border-t pt-3">
        <TicketIcon px={20} className="size-5" />
        <span className="min-w-0 flex-1 truncate text-sm" aria-live="polite">
          {note ?? (state.todayClaimed ? m.account.checkinDone : fmt(m.account.checkinToday, { n: state.todayAmount }))}
        </span>
        {!state.todayClaimed && (
          // A menu item so the keyboard reaches it; it keeps the menu open to show the result
          <DropdownMenuItem
            closeOnClick={false}
            disabled={busy}
            onClick={() => void onClaim()}
            className="h-8 shrink-0 cursor-pointer justify-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground data-highlighted:bg-primary/85 data-highlighted:text-primary-foreground"
          >
            {m.account.checkinClaim}
          </DropdownMenuItem>
        )}
      </div>
    </div>
  );
}

/**
 * Google sign-in (only used to put your name on leaderboards).
 * `sidebar`: full-width row; `compact`: the avatar in the top bar, inside its XP ring.
 * The menu opens on a profile card, today's quick check-in, then the links and settings.
 */
export function AccountButton({ variant }: { variant: "sidebar" | "compact" }) {
  const { data, isPending } = useSession();
  const m = useMessages();
  const history = useHistoryConsent();
  const user = data?.user;
  const userId = user?.id;
  // Today's check-in (a red dot on the avatar while it waits; cached for the day) and the XP ring
  const loadCheckin = useCheckin((s) => s.load);
  const checkin = useCheckin((s) => (s.userId === userId ? s.state : null));
  const checkinDue = checkin?.todayClaimed === false;
  const loadLevel = useLevel((s) => s.load);
  const level = useLevel((s) => (s.userId === userId ? s.info : null));
  useEffect(() => {
    if (isPending) return;
    void loadCheckin(userId ?? null);
    void loadLevel(userId ?? null);
  }, [isPending, userId, loadCheckin, loadLevel]);
  // The session's user row carries the saved flag (a Better Auth additional field)
  const fromSession = (user as { profilePublic?: unknown } | undefined)?.profilePublic;
  const isPublic = useProfilePublic((s) => profilePublicOf(s, userId, fromSession));
  const setPublic = useProfilePublic((s) => s.set);

  if (isPending) return <div className={variant === "sidebar" ? "h-12" : "size-10"} aria-hidden />;

  if (!user) {
    return variant === "sidebar" ? (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
      >
        <HugeiconsIcon icon={GoogleIcon} className="size-5 shrink-0" />
        <span className="grid min-w-0">
          <span className="font-medium whitespace-nowrap">{m.account.signIn}</span>
          <span className="truncate text-xs text-muted-foreground">{m.account.signInHint}</span>
        </span>
      </button>
    ) : (
      <Button
        variant="ghost"
        size="icon"
        className="size-10 rounded-full"
        aria-label={m.account.signIn}
        onClick={() => void signInWithGoogle()}
      >
        <HugeiconsIcon icon={GoogleIcon} />
      </Button>
    );
  }

  const initial = user.name.slice(0, 1).toUpperCase();
  const progress = progressOf(level);
  const avatar = (size: string) => (
    <Avatar className={size}>
      {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="text-xs font-semibold">{initial}</AvatarFallback>
    </Avatar>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl text-left transition-colors hover:bg-secondary",
              variant === "sidebar" ? "w-full px-3 py-2" : "rounded-full",
            )}
          />
        }
      >
        <span className="relative shrink-0">
          <XpRing progress={progress} className="size-10">
            {avatar("size-8")}
          </XpRing>
          {checkinDue && (
            <span className="absolute top-0 right-0 size-3 rounded-full bg-destructive ring-2 ring-background">
              <span className="sr-only">{m.account.checkinDue}</span>
            </span>
          )}
        </span>
        {variant === "sidebar" && <span className="min-w-0 flex-1 truncate text-sm font-medium">{user.name}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} className="w-76 rounded-2xl p-2">
        {/* The profile card: who, and how far into the level */}
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40"
        >
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="truncate text-base font-semibold">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            {level && (
              <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">
                  {fmt(m.account.level, { n: level.level })}
                </span>
                <span className="tabular-nums">
                  {fmt(m.account.xp, { into: level.xpIntoLevel, total: level.xpIntoLevel + level.xpToNext })}
                </span>
              </span>
            )}
          </span>
          <XpRing progress={progress} className="size-14">
            {avatar("size-11")}
          </XpRing>
        </Link>

        {checkin && userId && <CheckinCard state={checkin} userId={userId} />}

        <DropdownMenuGroup className="mt-1.5">
          <DropdownMenuItem render={<Link to="/profile" />} className={ROW}>
            <HugeiconsIcon icon={UserCircleIcon} />
            <span className="flex-1">{m.account.profile}</span>
            {checkinDue && <span aria-hidden className="size-2 rounded-full bg-destructive" />}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/favorites" />} className={ROW}>
            <HugeiconsIcon icon={FavouriteIcon} />
            {m.nav.favorites}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/history" />} className={ROW}>
            <HugeiconsIcon icon={WorkHistoryIcon} />
            {m.account.history}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1.5" />
        {/* Settings get their own group, as switches */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 text-xs text-muted-foreground">{m.account.settings}</DropdownMenuLabel>
          {/* Unasked (null) reads as off; switching it on is the answer. The row keeps the
              checkbox-item semantics (and stays open on click); the Switch only shows the state */}
          <DropdownMenuCheckboxItem
            checked={history.value === true}
            onCheckedChange={(on) => void history.set(on)}
            className={cn(ROW, "justify-between pr-3 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden")}
          >
            {m.account.saveHistory}
            <Switch size="sm" checked={history.value === true} aria-hidden tabIndex={-1} className="pointer-events-none" />
          </DropdownMenuCheckboxItem>
          {/* Others may open /u/<id> and the leaderboards link to it */}
          <DropdownMenuCheckboxItem
            checked={isPublic}
            onCheckedChange={(on) => void setPublic(user.id, on)}
            className={cn(ROW, "justify-between pr-3 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden")}
          >
            {m.account.publicProfile}
            <Switch size="sm" checked={isPublic} aria-hidden tabIndex={-1} className="pointer-events-none" />
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuItem onClick={() => void signOut()} className={ROW}>
          <HugeiconsIcon icon={Logout01Icon} />
          {m.account.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
