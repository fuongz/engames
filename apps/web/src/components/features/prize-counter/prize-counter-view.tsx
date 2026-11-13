import { ArrowRight01Icon, GiftIcon, GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { games } from "@web-games/games";
import { useCallback, useEffect, useState } from "react";
import { CosmeticShelf } from "#/components/features/prize-counter/cosmetic-shelf";
import { GamePicker } from "#/components/features/prize-counter/game-picker";
import { ShopShelf } from "#/components/features/prize-counter/shop-shelf";
import { TicketIcon } from "#/components/shared/tickets/ticket-icon";
import { Button } from "#/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { useSession } from "#/hooks/use-session";
import { signInWithGoogle } from "#/lib/auth-client";
import { fmt, intlTag } from "#/lib/i18n";
import { hasPrizes } from "#/lib/prizes";
import { listShopFn } from "#/server/shop";
import { useTickets } from "#/stores/tickets";

type Listing = Awaited<ReturnType<typeof listShopFn>>;

/** Every game with something at the counter, in catalogue order. */
const PRIZE_GAMES = games.filter(hasPrizes);

/**
 * The Prize Counter page (docs/standards/tickets.md §4): shared arcade tickets
 * buy a game's own currency (shop-shelf.tsx) and permanent outfits
 * (cosmetic-shelf.tsx). The player picks a game first (`slug`, from `?game=`;
 * the first game when missing), then redeems that game's prizes.
 * Signed out it offers Google sign-in.
 */
export function PrizeCounterView({ slug }: { slug?: string }) {
  const m = useMessages();
  const locale = useLocale();
  const { data: session, isPending } = useSession();
  const userId = session?.user.id ?? null;
  const [listing, setListing] = useState<Listing | "error" | null>(null);
  // The chip's store is the live balance (a game may deposit while this is open)
  const storeBalance = useTickets((s) => (s.userId === userId ? s.balance : null));
  const game = PRIZE_GAMES.find((g) => g.slug === slug) ?? PRIZE_GAMES[0];

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
    if (!isPending && userId) load();
  }, [isPending, userId, load]);

  const balance = storeBalance ?? (listing && listing !== "error" ? listing.balance : null);
  const nf = new Intl.NumberFormat(intlTag(locale));
  const signedOut = !isPending && !userId;

  /** A purchase used up some of today's limit: the card's sticker follows. */
  const setRemaining = (gameSlug: string, itemId: string, remaining: number) =>
    setListing((l) =>
      l && l !== "error"
        ? {
            ...l,
            games: l.games.map((g) =>
              g.slug !== gameSlug
                ? g
                : { ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, remaining: Math.max(0, remaining) } : i)) },
            ),
          }
        : l,
    );

  const shopGame = listing && listing !== "error" ? listing.games.find((g) => g.slug === game?.slug) : undefined;
  const hasShop = (game?.shop?.length ?? 0) > 0;
  const hasSkins = game?.cosmetics?.some((i) => i.price > 0) ?? false;

  return (
    <main className="grid gap-5 md:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{m.shop.title}</h1>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">{m.shop.description}</p>
        </div>
        {!signedOut && balance !== null && (
          <p className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold tabular-nums text-secondary-foreground ring-1 ring-border">
            <TicketIcon px={20} className="size-5" />
            {fmt(m.shop.balance, { n: nf.format(balance) })}
          </p>
        )}
      </header>

      {signedOut ? (
        <Empty className="rounded-2xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={GiftIcon} />
            </EmptyMedia>
            <EmptyTitle>{m.shop.signInTitle}</EmptyTitle>
            <EmptyDescription>{m.shop.signInHint}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="lg" className="h-11" onClick={() => void signInWithGoogle(window.location.pathname + window.location.search)}>
              <HugeiconsIcon icon={GoogleIcon} data-icon="inline-start" />
              {m.shop.signIn}
            </Button>
          </EmptyContent>
        </Empty>
      ) : !game ? (
        <Empty className="rounded-2xl border border-dashed">
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
          <GamePicker games={PRIZE_GAMES} selected={game.slug} />

          <section aria-labelledby="prize-game" className="grid gap-5 rounded-3xl sm:bg-secondary/60 sm:p-4 sm:ring-1 sm:ring-border lg:p-6">
            {/* The game these prizes belong to: its art, its name, a way into it */}
            <Link
              to="/games/$slug"
              params={{ slug: game.slug }}
              className="group flex min-h-11 items-center gap-3 rounded-2xl outline-none transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-1"
            >
              <img
                src={game.poster[locale]}
                alt=""
                width={44}
                height={44}
                decoding="async"
                className="size-11 shrink-0 rounded-xl object-cover object-top ring-1 ring-border"
              />
              <h2 id="prize-game" className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight">
                {game.title[locale]}
              </h2>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                {m.shop.openGame}
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" aria-hidden />
              </span>
            </Link>

            {hasShop && (
              <div className="grid gap-3">
                {hasSkins && <h3 className="text-sm font-semibold text-muted-foreground">{m.shop.itemsHeading}</h3>}
                {listing === "error" ? (
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
                ) : (
                  shopGame && (
                    <ShopShelf
                      game={shopGame}
                      balance={balance}
                      userId={userId}
                      onRemaining={(itemId, n) => setRemaining(shopGame.slug, itemId, n)}
                    />
                  )
                )}
              </div>
            )}

            {hasSkins && (
              <div className="grid gap-3">
                {hasShop && <h3 className="text-sm font-semibold text-muted-foreground">{m.shop.skinsHeading}</h3>}
                <CosmeticShelf game={game} balance={balance} userId={userId} />
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
