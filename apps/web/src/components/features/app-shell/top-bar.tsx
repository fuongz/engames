import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { AccountButton } from "#/components/shared/auth/account-button";
import { Kbd } from "#/components/ui/kbd";

/**
 * Desktop: wide search field (opens the ⌘K palette).
 * Phones: logo and search icon. Installing lives in the sidebar card.
 */
export function TopBar({ onSearch }: { onSearch: () => void }) {
  return (
    <header className="flex items-center gap-3">
      <Link to="/" className="flex items-center gap-2.5 lg:hidden">
        <img src="/icons/icon.svg" alt="" className="size-9 rounded-xl" />
        <span className="text-lg font-bold tracking-wide uppercase">Engames</span>
      </Link>

      {/* Looks like an input, behaves like a button: typing happens in the palette */}
      <button
        type="button"
        onClick={onSearch}
        className="hidden h-11 w-full max-w-md items-center gap-3 rounded-xl border bg-card px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground lg:flex"
      >
        <HugeiconsIcon icon={Search01Icon} className="size-4.5" />
        <span className="flex-1 text-left">Tìm game, thể loại...</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="size-10 rounded-full lg:hidden" aria-label="Tìm game" onClick={onSearch}>
          <HugeiconsIcon icon={Search01Icon} />
        </Button>
        {/* Desktop has it in the sidebar */}
        <div className="lg:hidden">
          <AccountButton variant="compact" />
        </div>
      </div>
    </header>
  );
}
