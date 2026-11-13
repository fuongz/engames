import { ArrowRight01Icon, GiftIcon, GoogleIcon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { findGame } from "@web-games/games";
import { useCallback, useEffect, useState } from "react";
import { CosmeticShelves, cosmeticGames } from "#/components/features/prize-counter/cosmetic-shelves";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { signInWithGoogle } from "#/lib/auth-client";
import { fmt, intlTag } from "#/lib/i18n";
import { cn } from "#/lib/utils";
import { type ShopListingGame, type ShopListingItem, buyItemFn, listShopFn } from "#/server/shop";
import { useTickets } from "#/stores/tickets";

type Listing = Awaited<ReturnType<typeof listShopFn>>;

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
 * The Prize Counter (docs/standards/tickets.md §4): every game's shop, where
 * shared arcade tickets buy a game's own currency and permanent outfits
 * (cosmetic-shelves.tsx). Opened from the ticket chip.
 * Signed out it offers Google sign-in; signed in it lists the items by game with
 * today's remaining limits, and keeps the ticket chip in step after a purchase.
 */
export function PrizeCounter({ onClose }: { onClose: () => void }) {
  const m = useMessages();
  const locale = useLocale();
  const { data: session, isPending } = useSession();
  const userId = session?.user.id ?? null;
  const [listing, setListing] = useState<Listing | "error" | null>(null);
  const [items, setItems] = useState<Record<string, ItemState>>({});
  // The chip's store is the live balance (a game may deposit while this is open)
  const storeBalance = useTickets((s) => (s.userId === userId ? s.balance : null));

  const load = useCallback(() => {
    setListing(null);
    listShopFn()
      .then((l) => {
        setListing(l);
        if (userId && l.balance !== null && useTickets.getState().userId === userId) useTickets.getState().set(l.balance);
      })
      .catch(() => setListing("error"));
  }, [userId]);

  useEffect(() => {
    if (!isPending) load();
  }, [isPending, load]);

  const balance = storeBalance ?? (listing && listing !== "error" ? listing.balance : null);
  const nf = new Intl.NumberFormat(intlTag(locale));

  const buy = async (game: ShopListingGame, item: ShopListingItem) => {
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
        if (item.remaining !== null) adjustRemaining(game.slug, item.id, item.remaining - 1);
      } else {
        fail(r.reason);
        if (r.reason === "daily-limit") adjustRemaining(game.slug, item.id, 0);
      }
    } catch (err) {
      fail(err instanceof Error && err.message === "sign-in-required" ? "sign-in-required" : "generic");
    }
  };

  const adjustRemaining = (slug: string, id: string, remaining: number) =>
    setListing((l) =>
      l && l !== "error"
        ? {
            ...l,
            games: l.games.map((g) =>
              g.slug !== slug ? g : { ...g, items: g.items.map((i) => (i.id === id ? { ...i, remaining: Math.max(0, remaining) } : i)) },
            ),
          }
        : l,
    );

  const signedOut = !isPending && !userId;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-[calc(100%-1rem-env(safe-area-inset-left)-env(safe-area-inset-right))] gap-4 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[90dvh] sm:max-w-xl sm:gap-5 sm:p-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <DialogHeader className="pr-8">
          <DialogTitle>{signedOut ? m.shop.signInTitle : m.shop.title}</DialogTitle>
          <DialogDescription>{signedOut ? m.shop.signInHint : m.shop.description}</DialogDescription>
        </DialogHeader>

        {signedOut ? (
          <Button size="lg" className="h-11" onClick={() => void signInWithGoogle(window.location.pathname)}>
            <HugeiconsIcon icon={GoogleIcon} data-icon="inline-start" />
            {m.shop.signIn}
          </Button>
        ) : listing === "error" ? (
          <div className="grid justify-items-start gap-3">
            <p role="alert" className="text-sm text-muted-foreground">
              {m.shop.loadError}
            </p>
            <Button variant="secondary" className="h-10" onClick={load}>
              {m.shop.retry}
            </Button>
          </div>
        ) : listing === null ? (
          <p aria-live="polite" className="py-6 text-center text-sm text-muted-foreground">
            {m.shop.loading}
          </p>
        ) : listing.games.length === 0 && cosmeticGames.length === 0 ? (
          <Empty className="rounded-xl border border-dashed py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={GiftIcon} />
              </EmptyMedia>
              <EmptyTitle>{m.shop.emptyTitle}</EmptyTitle>
              <EmptyDescription>{m.shop.emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {balance !== null && (
              <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold tabular-nums text-secondary-foreground ring-1 ring-border">
                <TicketIcon px={20} className="size-5" />
                {fmt(m.shop.balance, { n: nf.format(balance) })}
              </p>
            )}
            {listing.games.map((game) => (
              <section
                key={game.slug}
                aria-labelledby={`shop-${game.slug}`}
                // Flat on phones (the dialog is already the card); a tinted shelf from sm up
                className="grid gap-3 sm:rounded-3xl sm:bg-secondary/60 sm:p-4 sm:ring-1 sm:ring-border"
              >
                {/* The game this shelf belongs to: its art, its name, a way into it */}
                <Link
                  to="/games/$slug"
                  params={{ slug: game.slug }}
                  onClick={onClose}
                  className="group flex min-h-11 items-center gap-3 rounded-2xl sm:p-1 outline-none transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {findGame(game.slug) && (
                    <img
                      src={findGame(game.slug)?.poster[locale]}
                      alt=""
                      width={44}
                      height={44}
                      decoding="async"
                      className="size-11 shrink-0 rounded-xl object-cover object-top ring-1 ring-border"
                    />
                  )}
                  <h3 id={`shop-${game.slug}`} className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">
                    {game.title[locale]}
                  </h3>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                    {m.shop.openGame}
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" aria-hidden />
                  </span>
                </Link>
                <ul className="grid grid-cols-2 gap-2.5 sm:gap-4">
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
                          onClick={() => void buy(game, item)}
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
              </section>
            ))}
            <CosmeticShelves onClose={onClose} balance={balance} userId={userId} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
