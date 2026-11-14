import { Cancel01Icon, GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "#/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "#/components/ui/sheet";
import { useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { signInWithGoogle } from "#/lib/auth-client";
import { cn } from "#/lib/utils";
import { useCheckin } from "#/stores/checkin";
import { useLevel } from "#/stores/level";
import { AccountMenuBody, GuestMenuBody, progressOf, XpRing } from "./account-menu-body";

/**
 * Google sign-in (only used to put your name on leaderboards).
 * `sidebar`: full-width row; `compact`: the avatar in the top bar, inside its XP ring.
 * The menu opens on a profile card, today's quick check-in, then the links and settings.
 */
export function AccountButton({ variant }: { variant: "sidebar" | "compact" }) {
  const { data, isPending } = useSession();
  const m = useMessages();
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
  const [sheetOpen, setSheetOpen] = useState(false);
  // The sheet is for phones: if the window grows to `lg` while it is open, the dropdown takes over
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setSheetOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
      <>
        {/* From lg: straight to Google (the sidebar has the rest) */}
        <Button
          variant="outline"
          className="h-10 rounded-full px-4 font-semibold text-primary hover:text-primary max-lg:hidden"
          title={m.account.signIn}
          onClick={() => void signInWithGoogle()}
        >
          <HugeiconsIcon icon={GoogleIcon} data-icon="inline-start" />
          {m.account.signInShort}
        </Button>
        {/* Below lg: the account sheet, so the pages that left the tab bar stay reachable */}
        <AccountSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          trigger={
            <Button
              variant="outline"
              className="h-9 rounded-full px-3.5 font-semibold text-primary hover:text-primary lg:hidden"
              aria-label={m.account.menuTitle}
            />
          }
          triggerBody={m.account.signInShort}
        >
          <GuestMenuBody onNavigate={() => setSheetOpen(false)} />
        </AccountSheet>
      </>
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
  const triggerClass = cn(
    "flex cursor-pointer items-center gap-3 rounded-xl text-left transition-colors hover:bg-secondary",
    variant === "sidebar" ? "w-full px-3 py-2" : "rounded-full",
  );
  const triggerBody = (
    <>
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
    </>
  );
  return (
    <>
      {/* From lg: the dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" className={cn(triggerClass, "max-lg:hidden")} />}>
          {triggerBody}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} className="w-76 rounded-2xl p-2">
          <AccountMenuBody shell="menu" user={user} onNavigate={() => {}} />
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Below lg: the same body as a full-screen sheet (it covers the bottom nav) */}
      <AccountSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        trigger={<button type="button" className={cn(triggerClass, "lg:hidden")} />}
        triggerBody={triggerBody}
      >
        <AccountMenuBody shell="sheet" user={user} onNavigate={() => setSheetOpen(false)} />
      </AccountSheet>
    </>
  );
}

/** The phone shell of the account menu: a full-screen sheet from the right, clear of the notch and home bar. */
function AccountSheet({
  open,
  onOpenChange,
  trigger,
  triggerBody,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  triggerBody: ReactNode;
  children: ReactNode;
}) {
  const m = useMessages();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger render={trigger}>{triggerBody}</SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 bg-background data-[side=right]:w-full data-[side=right]:border-l-0 data-[side=right]:sm:max-w-none lg:hidden"
      >
        <SheetHeader className="flex-row items-center justify-between border-b px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
          <SheetTitle className="text-lg font-semibold">{m.account.menuTitle}</SheetTitle>
          <SheetClose
            render={<Button variant="ghost" size="icon" className="size-10 rounded-full bg-secondary" />}
            aria-label={m.account.close}
          >
            <HugeiconsIcon icon={Cancel01Icon} />
          </SheetClose>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
