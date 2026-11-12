import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { AccountButton } from "./account-button";
import { LanguageMenu } from "./language-menu";
import { JackpotTicker } from "#/components/features/jackpot/jackpot-ticker";
import { TicketChip } from "./ticket-chip";
import { Kbd } from "#/components/ui/kbd";
import { useMessages } from "#/hooks/use-messages";

/**
 * Desktop: wide search field (opens the ⌘K palette), the Lucky Jar ticker, then
 * the ticket wallet, language and account menu on the right.
 * Phones: logo and search icon, the same right-hand group, the ticker as a slim
 * strip underneath. Installing lives in the sidebar card.
 */
export function TopBar({ onSearch }: { onSearch: () => void }) {
  const m = useMessages();
  return (
    <>
      {/* Sticky, full-bleed to the column's edges; it carries the notch inset itself */}
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-2 bg-background/85 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-md lg:-mx-8 lg:px-8 lg:py-4">
        <Link to="/" className="flex items-center gap-2.5 lg:hidden">
          <img src="/icons/logo.svg" alt="" className="size-9 rounded-xl" />
          <span className="text-lg font-bold tracking-wide uppercase">Engames</span>
        </Link>

        {/* Looks like an input, behaves like a button: typing happens in the palette */}
        <button
          type="button"
          onClick={onSearch}
          className="hidden h-11 w-full max-w-xs items-center gap-3 rounded-xl border bg-card px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground lg:flex xl:max-w-md"
        >
          <HugeiconsIcon icon={Search01Icon} className="size-4.5" />
          <span className="flex-1 text-left">{m.search.placeholder}</span>
          <Kbd>⌘K</Kbd>
        </button>

        <JackpotTicker className="hidden min-w-0 max-w-sm flex-1 xl:flex" />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Button variant="ghost" size="icon" className="size-9 rounded-full lg:hidden" aria-label={m.search.open} onClick={onSearch}>
            <HugeiconsIcon icon={Search01Icon} />
          </Button>
          {/* The wallet beside the account it belongs to; the avatar opens the options */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <TicketChip />
            <LanguageMenu variant="compact" />
            <AccountButton variant="compact" />
          </div>
        </div>
      </header>
      {/* Phones: under the bar, clear of a landscape notch */}
      <JackpotTicker className="-mt-3 flex pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:hidden" />
    </>
  );
}
