import { LibraryIcon, PlusSignIcon, Store01Icon, VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { audioBus } from "@web-games/games";
import { useEffect, useState } from "react";
import { useInstallStore } from "#/stores/install";
import { HelpDialog } from "./help-dialog";

/** Sidebar row; the active one gets the orange text and left bar. */
const SIDEBAR_ITEM =
  "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground before:absolute before:top-1/2 before:-left-5 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:opacity-0 data-[active=true]:text-primary data-[active=true]:before:opacity-100";

/** Steam-style left rail, desktop only; phones get the bottom tab bar. */
export function Sidebar() {
  const [muted, setMuted] = useState(false);
  const installMode = useInstallStore((s) => s.mode);
  const install = useInstallStore((s) => s.install);
  const path = useRouterState({ select: (s) => s.location.pathname });
  // index.html is prerendered at "/", and hydration keeps its attributes, so the
  // active link is only decided after mount (a normal re-render patches it).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setMuted(audioBus.muted);
    return audioBus.onMuteChange(setMuted);
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col gap-8 border-r bg-background px-5 py-7 lg:flex">
      <Link to="/" className="flex items-center gap-2.5 px-1">
        <img src="/icons/icon.svg" alt="" className="size-9 rounded-xl" />
        <span className="text-lg font-bold tracking-wide uppercase">Engames</span>
      </Link>

      <nav className="grid gap-1" aria-label="Điều hướng chính">
        <Link to="/" className={SIDEBAR_ITEM} data-active={mounted && path === "/"}>
          <HugeiconsIcon icon={Store01Icon} className="size-5" />
          Khám phá
        </Link>
        <Link to="/library" className={SIDEBAR_ITEM} data-active={mounted && path.startsWith("/library")}>
          <HugeiconsIcon icon={LibraryIcon} className="size-5" />
          Thư viện
        </Link>
      </nav>

      <div className="mt-auto grid gap-1">
        <button type="button" className={SIDEBAR_ITEM} onClick={() => audioBus.setMuted(!muted)} aria-pressed={!muted}>
          <HugeiconsIcon icon={muted ? VolumeOffIcon : VolumeHighIcon} className="size-5" />
          Âm thanh: {muted ? "Tắt" : "Bật"}
        </button>
        <HelpDialog triggerClassName={SIDEBAR_ITEM} />
      </div>

      {installMode !== "hidden" && (
        <button
          type="button"
          onClick={() => void install()}
          title="Cài Engames lên điện thoại"
          className="flex items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-3.5 text-left text-sm font-medium whitespace-nowrap transition-colors hover:border-primary/50 hover:bg-secondary"
        >
          Cài app về máy
          <HugeiconsIcon icon={PlusSignIcon} className="size-5 shrink-0 text-muted-foreground" />
        </button>
      )}
    </aside>
  );
}
