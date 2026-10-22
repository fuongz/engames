import { createFileRoute, notFound } from "@tanstack/react-router";
import { findGame, games } from "@web-games/games";
import { GameDetails } from "#/components/features/game-player/game-details";
import { GamePlayer } from "#/components/features/game-player/game-player";
import { GameCard } from "#/components/shared/games/game-card";

export const Route = createFileRoute("/games/$slug")({
  loader: ({ params }) => {
    const game = findGame(params.slug);
    if (!game) throw notFound();
    return game;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.title} · Engames` : "Engames" }],
  }),
  component: GamePage,
});

function GamePage() {
  const game = Route.useLoaderData();
  const others = games.filter((g) => g.slug !== game.slug).slice(0, 6);

  // The player gets the full width; the guide, then other games, stack below it.
  // On phones the player is full-screen and the guide lives in its info dialog.
  return (
    <main className="grid gap-6">
      <GamePlayer game={game} details={<GameDetails game={game} />} />
      <section className="hidden content-start gap-4 rounded-2xl bg-card p-6 ring-1 ring-border lg:grid">
        <h2 className="text-2xl leading-tight font-bold tracking-tight">{game.title}</h2>
        <GameDetails game={game} />
      </section>
      {others.length > 0 && (
        <section className="hidden gap-3 lg:grid">
          <h2 className="text-xl font-semibold tracking-tight">Game khác</h2>
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
