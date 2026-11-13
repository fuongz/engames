import { SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt, intlTag } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import { type ShopListingGame, type ShopListingItem, buyItemFn } from "#/server/shop";
import { useTickets } from "#/stores/tickets";

/** What happened to one item's last Buy. */
type ItemState = { status: "pending" } | { status: "bought" } | { status: "error"; message: string };

const itemKey = (slug: string, id: string) => `${slug}/${id}`;

/** Card backgrounds, cycled per item. Static class strings (never assembled). */
const TONES = [
  "from-brand-alt to-[color-mix(in_oklch,var(--brand-alt)_30%,var(--card))]",
  "from-warm to-[color-mix(in_oklch,var(--warm)_30%,var(--card))]",
  "from-[color-mix(in_oklch,var(--brand-alt)_55%,var(--warm))] to-[color-mix(in_oklch,var(--brand-alt)_25%,var(--card))]",
  "from-warm-deep to-[color-mix(in_oklch,var(--warm-deep)_30%,var(--card))]",
] as const;

/** Item art: /shop/<slug>/<itemId>.webp, or the generic gift when a game has none yet. */
const FALLBACK_ART = "/shop/gift.webp";

/**
 * One game's `manifest.shop` items at the Prize Counter (docs/standards/tickets.md
 * §4), with today's remaining limits. A purchase spends shared tickets, writes the
 * new balance to the ticket store (so the chip and any open game update at once),
 * and reports the item's new limit through `onRemaining`.
 */
export function ShopShelf({
  game,
  balance,
  userId,
  onRemaining,
}: {
  game: ShopListingGame;
  balance: number | null;
  userId: string | null;
  onRemaining: (itemId: string, remaining: number) => void;
}) {
  const m = useMessages();
  const locale = useLocale();
  const nf = new Intl.NumberFormat(intlTag(locale));
  const [items, setItems] = useState<Record<string, ItemState>>({});

  const buy = async (item: ShopListingItem) => {
    const key = itemKey(game.slug, item.id);
    if (items[key]?.status === "pending") return;
    setItems((s) => ({ ...s, [key]: { status: "pending" } }));
    const fail = (reason: string) =>
      setItems((s) => ({ ...s, [key]: { status: "error", message: m.shop.errors[reason] ?? m.shop.errors.generic } }));
    try {
      const r = await buyItemFn({ data: { slug: game.slug, itemId: item.id } });
      if (r.ok) {
        if (userId && useTickets.getState().userId === userId) useTickets.getState().set(r.balance);
        setItems((s) => ({ ...s, [key]: { status: "bought" } }));
        if (item.remaining !== null) onRemaining(item.id, item.remaining - 1);
      } else {
        fail(r.reason);
        if (r.reason === "daily-limit") onRemaining(item.id, 0);
      }
    } catch (err) {
      fail(err instanceof Error && err.message === "sign-in-required" ? "sign-in-required" : "generic");
    }
  };

  // Two up on phones, more as the page widens; cosmetic-shelf.tsx uses the same grid
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
      {game.items.map((item, i) => {
        const state = items[itemKey(game.slug, item.id)];
        const soldOut = item.remaining === 0;
        const short = balance !== null ? item.price - balance : 0;
        const pending = state?.status === "pending";
        const reward = m.coupon.rewardKinds[item.kind];
        const rewardText = reward
          ? fmt(reward, { amount: nf.format(item.amount) })
          : fmt(m.coupon.reward, { amount: nf.format(item.amount), kind: item.kind });
        return (
          <li
            key={item.id}
            className={cn(
              "relative isolate flex flex-col items-center overflow-hidden rounded-3xl bg-linear-to-b px-2.5 pt-9 pb-2.5 text-center sm:px-3 sm:pb-3 shadow-lg ring-1 ring-foreground/10",
              TONES[i % TONES.length],
              soldOut && "grayscale-[.7]",
            )}
          >
            {/* Today's limit as a tilted sticker in the corner */}
            {item.remaining !== null && (
              <span
                className={cn(
                  "absolute top-2.5 left-2.5 z-10 -rotate-6 rounded-full px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap shadow-md",
                  soldOut ? "bg-muted text-muted-foreground" : "bg-highlight text-background",
                )}
              >
                {soldOut ? m.shop.soldOutShort : fmt(m.shop.left, { n: item.remaining })}
              </span>
            )}
            <h4 className="line-clamp-2 min-h-10 text-sm leading-tight font-extrabold text-balance text-white drop-shadow-sm sm:text-base sm:leading-tight">
              {item.name[locale]}
            </h4>
            {/* The item on a soft burst of light */}
            <div className="relative my-2 grid aspect-square w-full max-w-36 place-items-center">
              <span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-[repeating-conic-gradient(color-mix(in_oklch,var(--color-white)_16%,transparent)_0deg_9deg,transparent_9deg_30deg)] mask-radial-from-15% mask-radial-to-70%"
              />
              <span aria-hidden className="absolute inset-[18%] -z-10 rounded-full bg-white/20 blur-xl" />
              <HugeiconsIcon icon={SparklesIcon} aria-hidden className="absolute top-[8%] right-[10%] size-4 text-white/90" />
              <HugeiconsIcon icon={SparklesIcon} aria-hidden className="absolute bottom-[20%] left-[6%] size-3 text-white/80" />
              <img
                src={`/shop/${game.slug}/${item.id}.webp`}
                onError={(e) => {
                  if (!e.currentTarget.src.endsWith(FALLBACK_ART)) e.currentTarget.src = FALLBACK_ART;
                }}
                alt=""
                width={144}
                height={144}
                decoding="async"
                draggable={false}
                className="size-[82%] object-contain drop-shadow-lg select-none"
              />
            </div>
            <button
              type="button"
              disabled={pending || soldOut || short > 0}
              aria-label={fmt(m.shop.buyLabel, { item: item.name[locale], price: nf.format(item.price) })}
              onClick={() => void buy(item)}
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-brand text-base font-extrabold text-background tabular-nums shadow-[inset_0_-4px_0_color-mix(in_oklch,var(--brand)_55%,var(--background))] transition-[transform,filter] outline-none hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring/60 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100"
            >
              {pending ? (
                m.shop.buying
              ) : (
                <>
                  <TicketIcon px={24} className="size-6" />
                  {nf.format(item.price)}
                </>
              )}
            </button>
            {/* One line under the button: what happened, or what you get */}
            <p
              role={state?.status === "error" ? "alert" : state?.status === "bought" ? "status" : undefined}
              className={cn(
                "mt-2 min-h-8 text-[11px] leading-snug font-semibold text-pretty",
                state?.status === "error" ? "text-destructive-foreground" : "text-white/80",
              )}
            >
              {state?.status === "error"
                ? state.message
                : state?.status === "bought"
                  ? fmt(m.shop.bought, { game: game.title[locale] })
                  : short > 0 && !soldOut
                    ? fmt(m.shop.short, { n: nf.format(short) })
                    : rewardText}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
