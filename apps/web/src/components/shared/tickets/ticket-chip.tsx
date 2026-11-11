import { Ticket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect } from "react";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { compactCount } from "#/lib/format";
import { fmt } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import { useTickets } from "#/stores/tickets";

/**
 * The signed-in player's arcade ticket balance (docs/standards/tickets.md), a
 * small pill: the sidebar on desktop, the top bar on phones. Hidden when signed
 * out, and until the balance has loaded.
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

  if (!userId || balance === null) return null;
  const label = fmt(m.tickets.balance, { n: balance.toLocaleString(locale) });
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-semibold tabular-nums text-secondary-foreground ring-1 ring-border",
        className,
      )}
    >
      <HugeiconsIcon icon={Ticket01Icon} className="size-4 shrink-0 text-primary" aria-hidden />
      {compactCount(balance, locale)}
    </span>
  );
}
