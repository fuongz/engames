import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { AccountButton } from "#/components/shared/auth/account-button";
import { LanguageMenu } from "#/components/shared/i18n/language-menu";
import { JackpotTicker } from "#/components/features/jackpot/jackpot-ticker";
import { TicketChip } from "#/components/shared/tickets/ticket-chip";
import { Kbd } from "#/components/ui/kbd";
import { useMessages } from "#/hooks/use-messages";

/**
 * Desktop: wide search field (opens the ⌘K palette) and the Lucky Jar ticker.
 * Phones: logo and search icon, the ticker as a slim strip underneath.
 * Installing lives in the sidebar card.
 */
export function TopBar({ onSearch }: { onSearch: () => void }) {
  const m = useMessages();
  return (
    <div className="grid gap-3">
      <header className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5 lg:hidden">
          <img src="/icons/logo.svg" alt="" className="size-9 rounded-xl" />
          <span className="text-lg font-bold tracking-wide uppercase">Engames</span>
        </Link>

        {/* Looks like an input, behaves like a button: typing happens in the palette */}
        <button
          type="button"
          onClick={onSearch}
          className="hidden h-11 w-full max-w-md items-center gap-3 rounded-xl border bg-card px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground lg:flex"
        >
          <HugeiconsIcon icon={Search01Icon} className="size-4.5" />
          <span className="flex-1 text-left">{m.search.placeholder}</span>
          <Kbd>⌘K</Kbd>
        </button>

        <JackpotTicker className="hidden max-w-sm flex-1 lg:flex" />

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-10 rounded-full lg:hidden" aria-label={m.search.open} onClick={onSearch}>
            <HugeiconsIcon icon={Search01Icon} />
          </Button>
          {/* Desktop has both in the sidebar */}
          <div className="flex items-center gap-2 lg:hidden">
            <TicketChip />
            <LanguageMenu variant="compact" />
            <AccountButton variant="compact" />
          </div>
        </div>
      </header>
      {/* Phones: under the bar, clear of a landscape notch */}
      <JackpotTicker className="flex pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:hidden" />
    </div>
  );
}
