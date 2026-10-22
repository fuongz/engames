import { LibraryIcon, Search01Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const ITEM =
  "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium text-muted-foreground transition-colors data-[active=true]:text-primary";

/** Floating tab bar for phones (the sidebar's job on desktop), clear of the home indicator. */
export function MobileNav({ onSearch }: { onSearch: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Decided after mount: the prerendered "/" shell's attributes survive hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <nav className="fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex gap-1 rounded-2xl border bg-card/90 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
      <Link to="/" className={ITEM} data-active={mounted && path === "/"}>
        <HugeiconsIcon icon={Store01Icon} className="size-5" />
        Khám phá
      </Link>
      <Link to="/library" className={ITEM} data-active={mounted && path.startsWith("/library")}>
        <HugeiconsIcon icon={LibraryIcon} className="size-5" />
        Thư viện
      </Link>
      <button type="button" onClick={onSearch} className={ITEM}>
        <HugeiconsIcon icon={Search01Icon} className="size-5" />
        Tìm kiếm
      </button>
    </nav>
  );
}
