import { ArrowRight01Icon, GameController03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { categories, type GameManifest, games } from "@web-games/games";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { cn } from "#/lib/utils";

/** Fixed slot ids so the "coming soon" fillers have stable keys. */
const SLOTS = ["slot-1", "slot-2", "slot-3"];
const TILE = "group relative h-52 shrink-0 snap-start overflow-hidden rounded-2xl bg-card ring-1 ring-border transition hover:ring-primary/60 lg:h-72";

/**
 * Steam's "Special offers" row, as "Recommended for you": one wide art card, then
 * portrait posters. Short catalogues are padded with "Coming soon" tiles.
 */
export function OffersRow() {
  const m = useMessages();
  const [lead, ...rest] = games;
  const posters = rest.slice(0, 3);
  const fillers = SLOTS.slice(posters.length);

  return (
    <section className="grid gap-3">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight md:text-xl">{m.home.recommended}</h2>
        <Link to="/library" className="flex items-center gap-1 text-sm transition-colors hover:text-primary">
          {m.home.seeAll}
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Link>
      </div>
      <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-4 lg:overflow-visible lg:px-0">
        {lead && <WideTile game={lead} />}
        {posters.map((g) => (
          <PosterTile key={g.slug} game={g} />
        ))}
        {fillers.map((key) => (
          <div key={key} aria-hidden className={cn(TILE, "grid w-36 place-items-center border border-dashed bg-transparent ring-0 lg:w-auto")}>
            <div className="grid justify-items-center gap-2 text-center text-muted-foreground">
              <HugeiconsIcon icon={GameController03Icon} className="size-8 opacity-50" />
              <span className="text-sm font-medium">{m.home.comingSoon}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WideTile({ game }: { game: GameManifest }) {
  const locale = useLocale();
  const category = categories.find((c) => c.id === game.category);
  return (
    <Link to="/games/$slug" params={{ slug: game.slug }} className={cn(TILE, "w-[78%] lg:w-auto")}>
      <img src={game.banner} alt="" className="absolute inset-0 size-full object-cover object-right transition-transform duration-500 ease-out group-hover:scale-105" />
      <div className="absolute inset-0 bg-linear-to-t from-background/85 via-transparent to-transparent" />
      <div className="absolute inset-x-4 bottom-4 grid gap-0.5">
        <span className="text-xs font-medium text-primary">{category?.label[locale]}</span>
        <span className="text-xl leading-tight font-bold">{game.title[locale]}</span>
      </div>
    </Link>
  );
}

function PosterTile({ game }: { game: GameManifest }) {
  const locale = useLocale();
  return (
    <Link to="/games/$slug" params={{ slug: game.slug }} className={cn(TILE, "w-36 lg:w-auto")} aria-label={game.title[locale]}>
      <img src={game.poster[locale]} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" />
    </Link>
  );
}
