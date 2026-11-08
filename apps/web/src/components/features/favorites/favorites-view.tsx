import { FavouriteIcon, GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { findGame } from "@web-games/games";
import { GameCard } from "#/components/shared/games/game-card";
import { Button } from "#/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { useFavorites } from "#/hooks/use-favorites";
import { useMessages } from "#/hooks/use-messages";
import { signInWithGoogle } from "#/lib/auth-client";

/** The signed-in player's favourite games as a poster grid. */
export function FavoritesView() {
  const m = useMessages();
  const { signedIn, pending, slugs } = useFavorites();
  const list = (slugs ?? []).flatMap((s) => findGame(s) ?? []);

  return (
    <main className="grid gap-5 md:gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{m.favorites.title}</h1>
        <p className="text-sm text-muted-foreground">{m.favorites.description}</p>
      </div>
      {pending ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : !signedIn || list.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={FavouriteIcon} />
            </EmptyMedia>
            <EmptyTitle>{signedIn ? m.favorites.emptyTitle : m.favorites.title}</EmptyTitle>
            <EmptyDescription>{signedIn ? m.favorites.emptyHint : m.favorites.signIn}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {signedIn ? (
              <Button variant="secondary" nativeButton={false} render={<Link to="/library" />}>
                {m.favorites.browse}
              </Button>
            ) : (
              <Button onClick={() => void signInWithGoogle()}>
                <HugeiconsIcon icon={GoogleIcon} data-icon="inline-start" />
                {m.account.signIn}
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {list.map((g) => (
            <GameCard key={g.slug} game={g} />
          ))}
        </div>
      )}
    </main>
  );
}
