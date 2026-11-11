import { GiftIcon, GoogleIcon, Ticket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState } from "react";
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

/**
 * The Prize Counter (docs/standards/tickets.md §4): every game's shop, where
 * shared arcade tickets buy a game's own currency. Opened from the ticket chip.
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
      <DialogContent className="max-h-[90dvh] gap-5 overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-lg">
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
        ) : listing.games.length === 0 ? (
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
                <HugeiconsIcon icon={Ticket01Icon} className="size-4 shrink-0 text-primary" aria-hidden />
                {fmt(m.shop.balance, { n: nf.format(balance) })}
              </p>
            )}
            {listing.games.map((game) => (
              <section key={game.slug} aria-labelledby={`shop-${game.slug}`} className="grid gap-2">
                <h3 id={`shop-${game.slug}`} className="text-base font-semibold tracking-tight">
                  {game.title[locale]}
                </h3>
                <ul className="grid gap-2">
                  {game.items.map((item) => {
                    const state = items[itemKey(game.slug, item.id)];
                    const soldOut = item.remaining === 0;
                    const short = balance !== null ? item.price - balance : 0;
                    const pending = state?.status === "pending";
                    const reward = m.coupon.rewardKinds[item.kind];
                    return (
                      <li key={item.id} className="grid gap-2 rounded-2xl bg-muted/50 p-3 ring-1 ring-border">
                        <div className="flex items-center gap-3">
                          <div className="grid min-w-0 flex-1 gap-0.5">
                            <span className="text-sm font-medium text-pretty">{item.name[locale]}</span>
                            <span className="text-xs text-muted-foreground">
                              {reward ? fmt(reward, { amount: nf.format(item.amount) }) : fmt(m.coupon.reward, { amount: nf.format(item.amount), kind: item.kind })}
                              {item.remaining !== null && (
                                <>
                                  {" · "}
                                  <span className={cn(soldOut && "font-medium text-destructive")}>
                                    {soldOut ? m.shop.soldOut : fmt(m.shop.remaining, { n: item.remaining })}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                          <div className="grid shrink-0 justify-items-end gap-1.5">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
                              <HugeiconsIcon icon={Ticket01Icon} className="size-4 text-primary" aria-hidden />
                              {fmt(m.shop.price, { n: nf.format(item.price) })}
                            </span>
                            <Button
                              size="lg"
                              className="h-10 min-w-20"
                              disabled={pending || soldOut || short > 0}
                              aria-label={fmt(m.shop.buyLabel, { item: item.name[locale], price: nf.format(item.price) })}
                              onClick={() => void buy(game, item)}
                            >
                              {pending ? m.shop.buying : m.shop.buy}
                            </Button>
                          </div>
                        </div>
                        {state?.status === "error" && (
                          <p role="alert" className="text-xs text-destructive">
                            {state.message}
                          </p>
                        )}
                        {state?.status === "bought" && (
                          <p role="status" className="text-xs font-medium text-primary">
                            {fmt(m.shop.bought, { game: game.title[locale] })}
                          </p>
                        )}
                        {short > 0 && !soldOut && state?.status !== "error" && (
                          <p className="text-xs text-muted-foreground">{fmt(m.shop.short, { n: nf.format(short) })}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
