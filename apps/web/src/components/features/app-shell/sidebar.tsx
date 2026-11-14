import {
  CloudSavingDone01Icon,
  Download04Icon,
  FavouriteIcon,
  GiftIcon,
  Joystick02Icon,
  LibraryIcon,
  NewReleasesIcon,
  Store01Icon,
  UserCircleIcon,
  UserGroupIcon,
  VolumeHighIcon,
  VolumeOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { audioBus } from "@web-games/core";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { INDICATOR_SPRING } from "#/lib/motion";
import { useInstallStore } from "#/stores/install";
import { HelpDialog } from "./help-dialog";

/** Sidebar row; the active one gets the orange text and the left bar. */
const SIDEBAR_ITEM =
  "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[active=true]:text-primary";

/** A labelled block of the rail: the label names what its links have in common. */
function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="px-3 pb-1 text-xs font-medium text-muted-foreground/70">{label}</span>
      {children}
    </div>
  );
}

/** One bar shared by the nav links: it glides to the new page instead of blinking. */
function ActiveBar() {
  return (
    <motion.span
      layoutId="sidebar-active"
      transition={INDICATOR_SPRING}
      className="absolute top-1/2 -left-5 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
    />
  );
}

/** Steam-style left rail, desktop only; phones get the bottom tab bar. */
export function Sidebar() {
  const m = useMessages();
  const [muted, setMuted] = useState(false);
  const installMode = useInstallStore((s) => s.mode);
  const install = useInstallStore((s) => s.install);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const coopFilter = useRouterState({ select: (s) => (s.location.search as { coop?: unknown }).coop === 1 });
  const onlineFilter = useRouterState({ select: (s) => (s.location.search as { online?: unknown }).online === 1 });
  const arcadeFilter = useRouterState({ select: (s) => (s.location.search as { category?: unknown }).category === "arcade" });
  // index.html is prerendered at "/", and hydration keeps its attributes, so the
  // active link is only decided after mount (a normal re-render patches it).
  const [mounted, setMounted] = useState(false);
  const discover = mounted && path === "/";
  const coop = mounted && path.startsWith("/library") && coopFilter && !onlineFilter;
  const online = mounted && path.startsWith("/library") && onlineFilter && !coopFilter;
  const arcade = mounted && path.startsWith("/library") && arcadeFilter && !coopFilter && !onlineFilter;
  const library = mounted && path.startsWith("/library") && !coopFilter && !onlineFilter && !arcadeFilter;
  const favorites = mounted && path.startsWith("/favorites");
  const prizes = mounted && path.startsWith("/prize-counter");
  const changelog = mounted && path.startsWith("/changelog");
  const profile = mounted && path.startsWith("/profile");
  // Favourites live on the account: signed-in players only
  const signedIn = Boolean(useSession().data?.user);

  useEffect(() => {
    setMounted(true);
    setMuted(audioBus.muted);
    return audioBus.onMuteChange(setMuted);
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col gap-8 border-r bg-background px-5 py-7 lg:flex">
      <Link to="/" className="flex items-center gap-2.5 px-1">
        <img src="/icons/logo.svg" alt="Engames" aria-hidden className="size-9 rounded-xl" />
        <span className="text-lg font-bold tracking-wide uppercase">Engames</span>
      </Link>

      <nav className="grid gap-5" aria-label={m.nav.label}>
        <NavGroup label={m.nav.groupBrowse}>
        <Link to="/" className={SIDEBAR_ITEM} data-active={discover}>
          {discover && <ActiveBar />}
          <HugeiconsIcon icon={Store01Icon} className="size-5" />
          {m.nav.discover}
        </Link>
        <Link to="/library" className={SIDEBAR_ITEM} data-active={library}>
          {library && <ActiveBar />}
          <HugeiconsIcon icon={LibraryIcon} className="size-5" />
          {m.nav.library}
        </Link>
        </NavGroup>
        <NavGroup label={m.nav.groupModes}>
        {/* The library, filtered to the arcade category (Xu Vũ Trụ, Xếp Tầng…) */}
        <Link to="/library" search={{ category: "arcade" }} className={SIDEBAR_ITEM} data-active={arcade}>
          {arcade && <ActiveBar />}
          <HugeiconsIcon icon={Joystick02Icon} className="size-5" />
          {m.nav.arcade}
        </Link>
        {/* The library, filtered to games you can play with friends */}
        <Link to="/library" search={{ coop: 1 }} className={SIDEBAR_ITEM} data-active={coop}>
          {coop && <ActiveBar />}
          <HugeiconsIcon icon={UserGroupIcon} className="size-5" />
          {m.nav.coop}
        </Link>
        {/* The library, filtered to games that save to your account (Tiệm Bánh Ngọt) */}
        <Link to="/library" search={{ online: 1 }} className={SIDEBAR_ITEM} data-active={online}>
          {online && <ActiveBar />}
          <HugeiconsIcon icon={CloudSavingDone01Icon} className="size-5" />
          {m.nav.online}
        </Link>
        </NavGroup>
        <NavGroup label={m.nav.groupYou}>
        {/* Tickets → each game's prizes (signed out, the page asks them to sign in) */}
        <Link to="/prize-counter" className={SIDEBAR_ITEM} data-active={prizes}>
          {prizes && <ActiveBar />}
          <HugeiconsIcon icon={GiftIcon} className="size-5" />
          {m.nav.prizes}
        </Link>
        {mounted && signedIn && (
          <Link to="/favorites" className={SIDEBAR_ITEM} data-active={favorites}>
            {favorites && <ActiveBar />}
            <HugeiconsIcon icon={FavouriteIcon} className="size-5" />
            {m.nav.favorites}
          </Link>
        )}
        {mounted && signedIn && (
          <Link to="/profile" className={SIDEBAR_ITEM} data-active={profile}>
            {profile && <ActiveBar />}
            <HugeiconsIcon icon={UserCircleIcon} className="size-5" />
            {m.nav.profile}
          </Link>
        )}
        </NavGroup>
      </nav>

      <div className="mt-auto grid gap-1">
        <button type="button" className={SIDEBAR_ITEM} onClick={() => audioBus.setMuted(!muted)} aria-pressed={!muted}>
          <HugeiconsIcon icon={muted ? VolumeOffIcon : VolumeHighIcon} className="size-5" />
          {muted ? m.sidebar.soundOff : m.sidebar.soundOn}
        </button>
        {/* Every game's update history, one timeline */}
        <Link to="/changelog" className={SIDEBAR_ITEM} data-active={changelog}>
          {changelog && <ActiveBar />}
          <HugeiconsIcon icon={NewReleasesIcon} className="size-5" />
          {m.nav.changelog}
        </Link>
        <HelpDialog triggerClassName={SIDEBAR_ITEM} />
      </div>

      {installMode !== "hidden" && (
        <button
          type="button"
          onClick={() => void install()}
          title={m.sidebar.installTitle}
          className="flex items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-3.5 text-left text-sm font-medium whitespace-nowrap transition-colors hover:border-primary/50 hover:bg-secondary"
        >
          {m.sidebar.install}
          <HugeiconsIcon icon={Download04Icon} className="size-5 shrink-0 text-muted-foreground" />
        </button>
      )}
    </aside>
  );
}
