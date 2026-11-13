import { Link } from "@tanstack/react-router";
import { games } from "@web-games/games";
import { useEffect } from "react";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { compactCount } from "#/lib/format";
import { fmt } from "#/lib/i18n";
import { hasPrizes } from "#/lib/prizes";
import { cn } from "#/lib/utils";
import { useTickets } from "#/stores/tickets";

/** Signed out, the chip is only worth showing when the counter has something on it. */
const HAS_PRIZES = games.some(hasPrizes);

const PILL =
  "inline-flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-full bg-secondary text-sm font-semibold tabular-nums text-secondary-foreground ring-1 ring-border outline-none transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/30";

/**
 * The signed-in player's arcade ticket balance (docs/standards/tickets.md), a
 * small pill: the sidebar on desktop, the top bar on phones. A link to the Prize
 * Counter page (/prize-counter). Signed out it shrinks to the ticket icon (and the
 * counter asks them to sign in), or hides when no game has prizes; hidden while
 * the session or balance is loading.
 */
export function TicketChip({ className }: { className?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const { data, isPending } = useSession();
  const userId = isPending ? undefined : (data?.user.id ?? null);
  const load = useTickets((s) => s.load);
  const balance = useTickets((s) => (s.userId === userId ? s.balance : null));

  useEffect(() => {
    if (userId !== undefined) void load(userId);
  }, [userId, load]);

  if (userId === null && HAS_PRIZES) {
    return (
      <Link to="/prize-counter" aria-label={m.shop.open} title={m.shop.open} className={cn(PILL, "justify-center px-2", className)}>
        <TicketIcon px={20} className="size-5" />
      </Link>
    );
  }
  if (!userId || balance === null) return null;
  const label = fmt(m.tickets.balance, { n: balance.toLocaleString(locale) });
  return (
    <Link
      to="/prize-counter"
      aria-label={fmt(m.tickets.openShop, { balance: label })}
      title={label}
      // Where check-in tickets fly to (features/profile/checkin-track)
      data-ticket-chip=""
      className={cn(PILL, "px-3", className)}
    >
      <TicketIcon px={20} className="size-5" />
      {compactCount(balance, locale)}
    </Link>
  );
}
