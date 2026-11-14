import { FavouriteIcon, GiftIcon, GoogleIcon, Logout01Icon, UserCircleIcon, WorkHistoryIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { isLocale, LOCALES } from "@web-games/core/i18n";
import { Link } from "@tanstack/react-router";
import { play } from "cuelume";
import { type ComponentProps, type ReactNode, useState } from "react";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "#/components/ui/dropdown-menu";
import { Switch } from "#/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { useHistoryConsent } from "#/hooks/use-history-consent";
import { useChooseLocale, useLocale, useMessages } from "#/hooks/use-messages";
import { signInWithGoogle, signOut } from "#/lib/auth-client";
import { fmt } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import type { CheckinState } from "#/server/checkin";
import { useCheckin } from "#/stores/checkin";
import { type LevelInfo, useLevel } from "#/stores/level";
import { profilePublicOf, useProfilePublic } from "#/stores/profile-public";
import { useTickets } from "#/stores/tickets";

/**
 * The account menu has two shells (a dropdown from `lg`, a full-screen sheet below it) and one
 * body. `shell` only picks the primitive of each row: menu items need the dropdown's context, so
 * the sheet gets plain links and buttons with the same look.
 */
export type MenuShell = "menu" | "sheet";

/** Menu rows: roomy and rounded, like the cards above them. */
const ROW = "gap-3 rounded-xl px-3 py-2.5 text-sm";
/** The same row outside a menu: a full-width, thumb-sized tap target. */
const SHEET_ROW = "flex min-h-12 w-full cursor-pointer items-center text-left transition-colors hover:bg-secondary active:bg-secondary";

/** The level's progress, 0 … 1. */
export function progressOf(info: LevelInfo | null): number {
  if (!info) return 0;
  const total = info.xpIntoLevel + info.xpToNext;
  return total > 0 ? info.xpIntoLevel / total : 0;
}

/** An avatar inside a thin XP ring: a grey track and the level's progress in the brand colour. */
export function XpRing({
  progress,
  className,
  children,
}: {
  progress: number;
  className?: string;
  children: ReactNode;
}) {
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

const CLAIM = "h-8 shrink-0 cursor-pointer justify-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground";

/** Quick check-in inside the account menu: the cycle's dots and a Claim pill. */
function CheckinCard({ shell, state, userId }: { shell: MenuShell; state: CheckinState; userId: string }) {
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
        {!state.todayClaimed &&
          (shell === "menu" ? (
            // A menu item so the keyboard reaches it; it keeps the menu open to show the result
            <DropdownMenuItem
              closeOnClick={false}
              disabled={busy}
              onClick={() => void onClaim()}
              className={cn(CLAIM, "data-highlighted:bg-primary/85 data-highlighted:text-primary-foreground")}
            >
              {m.account.checkinClaim}
            </DropdownMenuItem>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onClaim()}
              className={cn(CLAIM, "inline-flex items-center active:bg-primary/85 disabled:opacity-50")}
            >
              {m.account.checkinClaim}
            </button>
          ))}
      </div>
    </div>
  );
}

/** The sheet's divider (the dropdown has its own). */
function SheetSeparator({ className }: { className?: string }) {
  return <hr className={cn("h-px border-0 bg-border", className)} />;
}

type LinkTo = ComponentProps<typeof Link>["to"];

/** A navigation row. In the sheet it closes the sheet; in the menu the item closes itself. */
function NavRow({
  shell,
  to,
  icon,
  onNavigate,
  children,
}: {
  shell: MenuShell;
  to: LinkTo;
  icon: ComponentProps<typeof HugeiconsIcon>["icon"];
  onNavigate: () => void;
  children: ReactNode;
}) {
  const content = (
    <>
      <HugeiconsIcon icon={icon} />
      {children}
    </>
  );
  return shell === "menu" ? (
    <DropdownMenuItem render={<Link to={to} />} className={ROW}>
      {content}
    </DropdownMenuItem>
  ) : (
    <Link to={to} onClick={onNavigate} className={cn(ROW, SHEET_ROW, "[&_svg]:size-4 [&_svg]:shrink-0")}>
      {content}
    </Link>
  );
}

/** A setting as a switch row. The menu row keeps checkbox-item semantics; the sheet's is a switch button. */
function SwitchRow({
  shell,
  checked,
  onChange,
  children,
}: {
  shell: MenuShell;
  checked: boolean;
  onChange: (on: boolean) => void;
  children: ReactNode;
}) {
  const sw = <Switch size="sm" checked={checked} aria-hidden tabIndex={-1} className="pointer-events-none" />;
  return shell === "menu" ? (
    <DropdownMenuCheckboxItem
      checked={checked}
      onCheckedChange={onChange}
      className={cn(ROW, "justify-between pr-3 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden")}
    >
      {children}
      {sw}
    </DropdownMenuCheckboxItem>
  ) : (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(ROW, SHEET_ROW, "justify-between")}
    >
      {children}
      {sw}
    </button>
  );
}

/**
 * The sheet's language row: Tiếng Việt / English as a segmented control. It
 * switches at once and, signed in, saves to the account (the same
 * `useChooseLocale` as the signed-out top bar's language menu).
 */
function LanguageRow() {
  const m = useMessages();
  const locale = useLocale();
  const chooseLocale = useChooseLocale();
  return (
    <div className={cn(ROW, "flex min-h-12 items-center justify-between")}>
      <span id="sheet-language">{m.language.label}</span>
      <ToggleGroup
        aria-labelledby="sheet-language"
        spacing={1}
        value={[locale]}
        // Tapping the current language would empty the group: ignore that
        onValueChange={(v) => v[0] && isLocale(v[0]) && chooseLocale(v[0])}
        className="shrink-0 rounded-full bg-secondary p-1"
      >
        {LOCALES.map((l) => (
          <ToggleGroupItem
            key={l}
            value={l}
            lang={l}
            className="h-10 rounded-full px-3.5 text-sm text-muted-foreground hover:bg-transparent aria-pressed:bg-background aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm"
          >
            {m.language[l]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/**
 * The account menu's content, shared by the dropdown (`menu`) and the full-screen sheet (`sheet`):
 * a profile card, today's quick check-in, the links, the settings and sign-out.
 * `onNavigate` closes the shell (the dropdown's items close it themselves).
 */
export function AccountMenuBody({
  shell,
  user,
  onNavigate,
}: {
  shell: MenuShell;
  user: { id: string; name: string; email: string; image?: string | null };
  onNavigate: () => void;
}) {
  const m = useMessages();
  const history = useHistoryConsent();
  const userId = user.id;
  const checkin = useCheckin((s) => (s.userId === userId ? s.state : null));
  const checkinDue = checkin?.todayClaimed === false;
  const level = useLevel((s) => (s.userId === userId ? s.info : null));
  // The session's user row carries the saved flag (a Better Auth additional field)
  const fromSession = (user as { profilePublic?: unknown }).profilePublic;
  const isPublic = useProfilePublic((s) => profilePublicOf(s, userId, fromSession));
  const setPublic = useProfilePublic((s) => s.set);

  const progress = progressOf(level);
  const initial = user.name.slice(0, 1).toUpperCase();
  const avatar = (size: string) => (
    <Avatar className={size}>
      {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="text-xs font-semibold">{initial}</AvatarFallback>
    </Avatar>
  );
  const menu = shell === "menu";
  const Group = menu ? DropdownMenuGroup : "div";
  const Label = menu ? DropdownMenuLabel : "div";
  const Separator = menu ? DropdownMenuSeparator : SheetSeparator;

  return (
    <>
      {/* The profile card: who, and how far into the level */}
      <Link
        to="/profile"
        onClick={onNavigate}
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

      {checkin && <CheckinCard shell={shell} state={checkin} userId={userId} />}

      <Group className="mt-1.5">
        <NavRow shell={shell} to="/profile" icon={UserCircleIcon} onNavigate={onNavigate}>
          <span className="flex-1">{m.account.profile}</span>
          {checkinDue && <span aria-hidden className="size-2 rounded-full bg-destructive" />}
        </NavRow>
        {/* Phones have no tab for it: the Prize Counter is reached from here (and the ticket chip) */}
        <NavRow shell={shell} to="/prize-counter" icon={GiftIcon} onNavigate={onNavigate}>
          {m.nav.prizes}
        </NavRow>
        <NavRow shell={shell} to="/favorites" icon={FavouriteIcon} onNavigate={onNavigate}>
          {m.nav.favorites}
        </NavRow>
        <NavRow shell={shell} to="/history" icon={WorkHistoryIcon} onNavigate={onNavigate}>
          {m.account.history}
        </NavRow>
      </Group>
      <Separator className="my-1.5" />
      {/* Settings get their own group, as switches */}
      <Group>
        <Label className={cn("px-3 text-xs text-muted-foreground", !menu && "py-1.5")}>{m.account.settings}</Label>
        {/* In the sheet and the dropdown alike: the top bar has no language menu when signed in */}
        <LanguageRow />
        {/* Unasked (null) reads as off; switching it on is the answer */}
        <SwitchRow shell={shell} checked={history.value === true} onChange={(on) => void history.set(on)}>
          {m.account.saveHistory}
        </SwitchRow>
        {/* Others may open /u/<id> and the leaderboards link to it */}
        <SwitchRow shell={shell} checked={isPublic} onChange={(on) => void setPublic(userId, on)}>
          {m.account.publicProfile}
        </SwitchRow>
      </Group>
      <Separator className="my-1.5" />
      {menu ? (
        <DropdownMenuItem onClick={() => void signOut()} className={ROW}>
          <HugeiconsIcon icon={Logout01Icon} />
          {m.account.signOut}
        </DropdownMenuItem>
      ) : (
        <button
          type="button"
          onClick={() => {
            onNavigate();
            void signOut();
          }}
          className={cn(ROW, SHEET_ROW, "[&_svg]:size-4 [&_svg]:shrink-0")}
        >
          <HugeiconsIcon icon={Logout01Icon} />
          {m.account.signOut}
        </button>
      )}
    </>
  );
}

/**
 * The phone account sheet for a signed-out visitor: Google sign-in, the pages
 * that work without an account, and the language. The Prize Counter is one of them: it shows the
 * sign-in prompt itself, so it must stay reachable from here.
 */
export function GuestMenuBody({ onNavigate }: { onNavigate: () => void }) {
  const m = useMessages();
  return (
    <>
      <div className="grid gap-3 rounded-xl border bg-card p-3">
        <p className="text-sm text-pretty text-muted-foreground">{m.account.guestHint}</p>
        <Button size="lg" className="h-11" onClick={() => void signInWithGoogle()}>
          <HugeiconsIcon icon={GoogleIcon} data-icon="inline-start" />
          {m.account.signIn}
        </Button>
      </div>
      <div className="mt-1.5">
        <NavRow shell="sheet" to="/prize-counter" icon={GiftIcon} onNavigate={onNavigate}>
          {m.nav.prizes}
        </NavRow>
      </div>
      <SheetSeparator className="my-1.5" />
      <LanguageRow />
    </>
  );
}
