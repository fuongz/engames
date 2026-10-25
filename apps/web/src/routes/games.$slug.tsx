import { createFileRoute, notFound } from "@tanstack/react-router";
import { findGame, games } from "@web-games/games";
import { isRoomCode } from "@web-games/core/online";
import { BoardTabs } from "#/components/features/game-player/board-tabs";
import { GameDetails } from "#/components/features/game-player/game-details";
import { GamePlayer } from "#/components/features/game-player/game-player";
import { GameCard } from "#/components/shared/games/game-card";
import { LeaderboardList } from "#/components/shared/leaderboard/leaderboard-list";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { getLeaderboard } from "#/server/leaderboard";
import { socialMeta } from "#/lib/seo";
import { useLocaleStore } from "#/stores/locale";

export const Route = createFileRoute("/games/$slug")({
  // ?room=<code> opens an online room for games that play online
  validateSearch: (search: Record<string, unknown>): { room?: string } => {
    const room = typeof search.room === "string" ? search.room.toUpperCase() : "";
    return isRoomCode(room) ? { room } : {};
  },
  loader: async ({ params }) => {
    const game = findGame(params.slug);
    if (!game) throw notFound();
    // Offline (installed PWA) or API down: the game still plays, the board just hides
    const [board, coop] = await Promise.all([
      getLeaderboard({ data: { slug: game.slug, limit: 10 } }).catch(() => null),
      game.online ? getLeaderboard({ data: { slug: game.slug, limit: 10, mode: "coop" } }).catch(() => null) : null,
    ]);
    return { game, board, coop };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Engames" }] };
    const { game } = loaderData;
    const locale = useLocaleStore.getState().locale;
    const title = `${game.title[locale]} | Engames`;
    return {
      meta: [
        { title },
        { name: "description", content: game.tagline[locale] },
        // The game's own card: its banner with the title on it
        ...socialMeta({ title, description: game.tagline[locale], image: game.share, imageAlt: game.title[locale], path: `/games/${game.slug}` }),
      ],
    };
  },
  component: GamePage,
});

function GamePage() {
  const locale = useLocale();
  const m = useMessages();
  const { game, board, coop } = Route.useLoaderData();
  const { room } = Route.useSearch();
  const others = games.filter((g) => g.slug !== game.slug).slice(0, 6);
  const offline = <p className="text-sm text-muted-foreground">{m.player.boardOffline}</p>;
  const solo = board ? <LeaderboardList entries={board} /> : offline;
  // Online games keep a separate co-op board
  const leaderboard = game.online ? <BoardTabs solo={solo} coop={coop ? <LeaderboardList entries={coop} /> : offline} /> : solo;

  // The player gets the full width; guide + leaderboard, then other games, stack
  // below it. On phones the player is full-screen and both open as dialogs.
  return (
    <main className="grid gap-6">
      <GamePlayer game={game} details={<GameDetails game={game} />} leaderboard={leaderboard} room={room} />
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
