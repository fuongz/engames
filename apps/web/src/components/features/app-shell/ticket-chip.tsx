import { games } from "@web-games/games";
import { useEffect, useState } from "react";
import { PrizeCounter } from "#/components/features/prize-counter/prize-counter";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { compactCount } from "#/lib/format";
import { fmt } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import { useTickets } from "#/stores/tickets";

/** Signed out, the chip is only worth showing when there is a counter to open. */
const HAS_SHOP = games.some((g) => (g.shop?.length ?? 0) > 0);

const PILL =
  "inline-flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-full bg-secondary text-sm font-semibold tabular-nums text-secondary-foreground ring-1 ring-border outline-none transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/30";

/**
 * The signed-in player's arcade ticket balance (docs/standards/tickets.md), a
 * small pill: the sidebar on desktop, the top bar on phones. A button: it opens
 * the Prize Counter. Signed out it shrinks to the ticket icon (and the counter
 * asks them to sign in), or hides when no game has a shop; hidden while the
 * session or balance is loading.
 */
export function TicketChip({ className }: { className?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const { data, isPending } = useSession();
  const userId = isPending ? undefined : (data?.user.id ?? null);
  const load = useTickets((s) => s.load);
  const balance = useTickets((s) => (s.userId === userId ? s.balance : null));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (userId !== undefined) void load(userId);
  }, [userId, load]);

  const counter = open && <PrizeCounter onClose={() => setOpen(false)} />;

  if (userId === null && HAS_SHOP) {
    return (
      <>
        <button
          type="button"
          aria-label={m.shop.open}
          title={m.shop.open}
          className={cn(PILL, "justify-center px-2", className)}
          onClick={() => setOpen(true)}
        >
          <TicketIcon px={20} className="size-5" />
        </button>
        {counter}
      </>
    );
  }
  if (!userId || balance === null) return counter || null;
  const label = fmt(m.tickets.balance, { n: balance.toLocaleString(locale) });
  return (
    <>
      <button
        type="button"
        aria-label={fmt(m.tickets.openShop, { balance: label })}
        title={label}
        aria-haspopup="dialog"
        // Where check-in tickets fly to (features/profile/checkin-track)
        data-ticket-chip=""
        className={cn(PILL, "px-3", className)}
        onClick={() => setOpen(true)}
      >
        <TicketIcon px={20} className="size-5" />
        {compactCount(balance, locale)}
      </button>
      {counter}
    </>
  );
}
