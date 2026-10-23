import { createFileRoute, notFound } from "@tanstack/react-router";
import { findGame, games } from "@web-games/games";
import { GameDetails } from "#/components/features/game-player/game-details";
import { GamePlayer } from "#/components/features/game-player/game-player";
import { GameCard } from "#/components/shared/games/game-card";
import { LeaderboardList } from "#/components/shared/leaderboard/leaderboard-list";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { getLeaderboard } from "#/server/leaderboard";
import { useLocaleStore } from "#/stores/locale";

export const Route = createFileRoute("/games/$slug")({
  loader: async ({ params }) => {
    const game = findGame(params.slug);
    if (!game) throw notFound();
    // Offline (installed PWA) or API down: the game still plays, the board just hides
    const board = await getLeaderboard({ data: { slug: game.slug, limit: 10 } }).catch(() => null);
    return { game, board };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.game.title[useLocaleStore.getState().locale]} | Engames` : "Engames" }],
  }),
  component: GamePage,
});

function GamePage() {
  const locale = useLocale();
  const m = useMessages();
  const { game, board } = Route.useLoaderData();
  const others = games.filter((g) => g.slug !== game.slug).slice(0, 6);
  const leaderboard = board ? (
    <LeaderboardList entries={board} />
  ) : (
    <p className="text-sm text-muted-foreground">{m.player.boardOffline}</p>
  );

  // The player gets the full width; guide + leaderboard, then other games, stack
  // below it. On phones the player is full-screen and both open as dialogs.
  return (
    <main className="grid gap-6">
      <GamePlayer game={game} details={<GameDetails game={game} />} leaderboard={leaderboard} />
      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="grid content-start gap-4 rounded-2xl bg-card p-6 ring-1 ring-border">
          <h2 className="text-2xl leading-tight font-bold tracking-tight">{game.title[locale]}</h2>
          <GameDetails game={game} />
        </section>
        <section className="grid content-start gap-4 rounded-2xl bg-card p-6 ring-1 ring-border">
          <h2 className="text-xl font-bold tracking-tight">{m.player.leaderboard}</h2>
          {leaderboard}
        </section>
      </div>
      {others.length > 0 && (
        <section className="hidden gap-3 lg:grid">
          <h2 className="text-xl font-semibold tracking-tight">{m.player.moreGames}</h2>
          <div className="grid grid-cols-4 gap-4 xl:grid-cols-6">
            {others.map((g) => (
              <GameCard key={g.slug} game={g} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
