import { type ReactNode, useEffect, useState } from "react";
import { GameSearch } from "./game-search";
import { InstallHelpDialog } from "./install-help-dialog";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * Steam-style launcher frame: fixed left rail on desktop, top bar and content in
 * the main column; phones swap the rail for a floating bottom tab bar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openSearch = () => setSearchOpen(true);

  return (
    <>
      {/* A faint warm glow from the top, like light spilling off the hero art */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-radial-[at_60%_-10%] from-warm/12 via-transparent to-transparent" />
      <Sidebar />

      <div className="lg:pl-[220px]">
        <div className="mx-auto grid max-w-[1240px] gap-6 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:gap-8 lg:px-8 lg:pt-7 lg:pb-10">
          <TopBar onSearch={openSearch} />
          {children}
        </div>
      </div>

      <MobileNav onSearch={openSearch} />
      <GameSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <InstallHelpDialog />
    </>
  );
}
