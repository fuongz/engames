import { SparklesIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CosmeticInventory, CosmeticItem, GameManifest } from "@web-games/core";
import { useEffect, useState } from "react";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt, intlTag } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import { buyCosmeticFn, getCosmeticsFn } from "#/server/cosmetics";
import { useTickets } from "#/stores/tickets";

type ItemState = { status: "pending" } | { status: "bought" } | { status: "error"; message: string };

/** Card backgrounds, cycled per item. Static class strings (never assembled). */
const TONES = [
  "from-warm to-[color-mix(in_oklch,var(--warm)_30%,var(--card))]",
  "from-brand-alt to-[color-mix(in_oklch,var(--brand-alt)_30%,var(--card))]",
  "from-warm-deep to-[color-mix(in_oklch,var(--warm-deep)_30%,var(--card))]",
  "from-[color-mix(in_oklch,var(--brand-alt)_55%,var(--warm))] to-[color-mix(in_oklch,var(--brand-alt)_25%,var(--card))]",
] as const;

const FALLBACK_ART = "/shop/gift.webp";

/**
 * One game's permanent outfits at the Prize Counter (docs/standards/tickets.md
 * §6): its paid `manifest.cosmetics`. Ownership comes from the account; a
 * purchase goes through the same boundary as the game's own shop, so the game
 * sees it on its next inventory read.
 */
export function CosmeticShelf({ game, balance, userId }: { game: GameManifest; balance: number | null; userId: string | null }) {
  const m = useMessages();
  const locale = useLocale();
  const nf = new Intl.NumberFormat(intlTag(locale));
  const [inventories, setInventories] = useState<Record<string, CosmeticInventory | undefined>>({});
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const slug = game.slug;

  // Each game's inventory once; switching back to a game keeps what was loaded
  const loaded = slug in inventories;
  useEffect(() => {
    if (loaded) return;
    let live = true;
    getCosmeticsFn({ data: { slug } }).then(
      (inv) => live && setInventories((s) => ({ ...s, [slug]: inv })),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [slug, loaded]);

  const buy = async (item: CosmeticItem) => {
    const key = `${game.slug}/${item.id}`;
    if (items[key]?.status === "pending") return;
    setItems((s) => ({ ...s, [key]: { status: "pending" } }));
    const fail = (reason: string) =>
      setItems((s) => ({ ...s, [key]: { status: "error", message: m.shop.errors[reason] ?? m.shop.errors.generic } }));
    try {
      const r = await buyCosmeticFn({ data: { slug: game.slug, itemId: item.id } });
      setInventories((s) => ({ ...s, [game.slug]: r.inventory }));
      if (userId && r.inventory.balance !== null && useTickets.getState().userId === userId) useTickets.getState().set(r.inventory.balance);
      if (r.ok) setItems((s) => ({ ...s, [key]: { status: "bought" } }));
      else fail(r.reason ?? "generic");
    } catch (err) {
      fail(err instanceof Error && err.message === "sign-in-required" ? "sign-in-required" : "generic");
    }
  };

  // The same grid as shop-shelf.tsx
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
      {(game.cosmetics ?? [])
        .filter((item) => item.price > 0)
        .map((item, i) => {
          const inv = inventories[game.slug];
          const state = items[`${game.slug}/${item.id}`];
          const owned = inv?.owned.includes(item.id) ?? false;
          const short = balance !== null ? item.price - balance : 0;
          const pending = state?.status === "pending";
          return (
            <li
              key={item.id}
              className={cn(
                "relative isolate flex flex-col items-center overflow-hidden rounded-3xl bg-linear-to-b px-2.5 pt-9 pb-2.5 text-center sm:px-3 sm:pb-3 shadow-lg ring-1 ring-foreground/10",
                TONES[i % TONES.length],
              )}
            >
              <h4 className="line-clamp-2 min-h-10 text-sm leading-tight font-extrabold text-balance text-white drop-shadow-sm sm:text-base sm:leading-tight">
                {item.name[locale]}
              </h4>
              <div className="relative my-2 grid aspect-square w-full max-w-36 place-items-center">
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-full bg-[repeating-conic-gradient(color-mix(in_oklch,var(--color-white)_16%,transparent)_0deg_9deg,transparent_9deg_30deg)] mask-radial-from-15% mask-radial-to-70%"
                />
                <span aria-hidden className="absolute inset-[18%] -z-10 rounded-full bg-white/20 blur-xl" />
                <HugeiconsIcon icon={SparklesIcon} aria-hidden className="absolute top-[8%] right-[10%] size-4 text-white/90" />
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
              {owned ? (
                <span
                  role="img"
                  aria-label={fmt(m.shop.ownedLabel, { item: item.name[locale] })}
                  className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-background/70 text-base font-extrabold text-foreground"
                >
                  <HugeiconsIcon icon={Tick02Icon} className="size-5" aria-hidden />
                  {m.shop.owned}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending || !inv || short > 0}
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
              )}
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
                    ? fmt(m.shop.boughtSkin, { game: game.title[locale] })
                    : owned
                      ? fmt(m.shop.ownedHint, { game: game.title[locale] })
                      : short > 0
                        ? fmt(m.shop.short, { n: nf.format(short) })
                        : m.shop.skinHint}
              </p>
            </li>
          );
        })}
    </ul>
  );
}
