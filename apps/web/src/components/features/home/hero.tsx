import { ComputerIcon, PlayIcon, SmartphoneIcon, StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { SUMMARY_KEY, categories, createStorage, type GameManifest, games } from "@web-games/games";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

const ADVANCE_MS = 6500;
const SWIPE_PX = 40;

/**
 * Steam-style hero: a full-bleed art carousel on the left, the current game's
 * warm info card and two art tiles on the right. Stacks on phones.
 */
export function Hero() {
  const [index, setIndex] = useState(0);
  const game = games[index % Math.max(1, games.length)];

  // `games` is a static catalogue, so the timer never needs re-arming
  useEffect(() => {
    if (games.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % games.length), ADVANCE_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!game) return null;
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="grid gap-3">
        <Carousel index={index} onIndex={setIndex} />
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Game nổi bật">
          {games.map((g, i) => (
            <button
              key={g.slug}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={g.title}
              onClick={() => setIndex(i)}
              className={cn("h-1.5 rounded-full transition-all", i === index ? "w-7 bg-primary" : "w-1.5 bg-muted-foreground/40")}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:h-[400px]">
        <InfoCard game={game} />
        <ArtTiles index={index} onIndex={setIndex} />
      </div>
    </section>
  );
}

function Carousel({ index, onIndex }: { index: number; onIndex: (i: number) => void }) {
  const start = useRef<number | null>(null);
  const swiped = useRef(false);

  return (
    <div
      className="relative aspect-[16/10] touch-pan-y overflow-hidden rounded-2xl bg-card sm:aspect-[2/1] lg:aspect-auto lg:h-[400px]"
      onPointerDown={(e) => {
        start.current = e.clientX;
        swiped.current = false;
      }}
      onPointerUp={(e) => {
        if (start.current === null) return;
        const dx = e.clientX - start.current;
        start.current = null;
        if (Math.abs(dx) < SWIPE_PX || games.length < 2) return;
        swiped.current = true;
        onIndex((index + (dx < 0 ? 1 : -1) + games.length) % games.length);
      }}
      onClickCapture={(e) => {
        // A swipe ends with a click on the slide link; don't navigate for it
        if (swiped.current) e.preventDefault();
      }}
    >
      <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {games.map((g, i) => (
          <Slide key={g.slug} game={g} active={i === index} />
        ))}
      </div>
    </div>
  );
}

function Slide({ game, active }: { game: GameManifest; active: boolean }) {
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => setSummary(createStorage(game.slug).get<string | null>(SUMMARY_KEY, null)), [game.slug]);
  const category = categories.find((c) => c.id === game.category);
  const chips = [category?.label, ...game.tags].filter(Boolean).slice(0, 3);

  return (
    <Link
      to="/games/$slug"
      params={{ slug: game.slug }}
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      draggable={false}
      className="group relative block h-full w-full shrink-0 outline-none"
    >
      <img
        src={game.banner}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-cover object-right transition-transform duration-700 ease-out group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-linear-to-t from-background/90 via-background/20 to-transparent" />
      <div className="absolute inset-0 bg-linear-to-r from-background/50 to-transparent" />

      <div className="absolute top-4 left-4 flex flex-wrap gap-2 md:top-5 md:left-5">
        {chips.map((c) => (
          <span key={c} className="rounded-full bg-background/60 px-3 py-1 text-xs font-medium backdrop-blur-md">
            {c}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-4 bottom-4 grid gap-2 md:inset-x-6 md:bottom-6">
        <h2 className="max-w-[14ch] text-3xl leading-[0.95] font-black tracking-tight text-balance uppercase drop-shadow-lg md:text-5xl lg:text-6xl">
          {game.title}
        </h2>
        {summary && (
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 text-xs backdrop-blur-md">
            <HugeiconsIcon icon={StarIcon} className="size-3.5 fill-highlight text-highlight" />
            Kỷ lục: {summary}
          </span>
        )}
      </div>
    </Link>
  );
}

function InfoCard({ game }: { game: GameManifest }) {
  return (
    <div className="relative isolate flex flex-1 flex-col gap-3 overflow-hidden rounded-2xl bg-linear-to-br from-warm to-warm-deep p-5">
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-background/45 to-transparent" />
      <h3 className="text-2xl leading-tight font-bold tracking-tight">{game.title}</h3>
      <p className="line-clamp-3 text-sm leading-relaxed text-foreground/90 lg:line-clamp-4">{game.description}</p>
      <div className="mt-auto grid gap-3 pt-2">
        <span className="text-sm font-semibold">Miễn phí · Chơi ngay trên trình duyệt</span>
        <div className="flex items-center gap-3">
          {/* Dark glass on the orange card, as in the reference; an orange button would vanish here */}
          <Button
            size="lg"
            className="h-11 flex-1 rounded-xl bg-background/40 text-foreground backdrop-blur-md hover:bg-background/60"
            nativeButton={false}
            render={<Link to="/games/$slug" params={{ slug: game.slug }} />}
          >
            <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" className="fill-current" />
            Chơi ngay
          </Button>
          <span className="flex gap-1.5 text-foreground/80" title="Chơi được trên máy tính và điện thoại">
            <HugeiconsIcon icon={ComputerIcon} className="size-5" />
            <HugeiconsIcon icon={SmartphoneIcon} className="size-5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Two small art tiles: the next games in the carousel, or crops of this one. */
function ArtTiles({ index, onIndex }: { index: number; onIndex: (i: number) => void }) {
  const game = games[index];
  const tiles =
    games.length > 1
      ? [1, 2].map((k) => {
          const i = (index + k) % games.length;
          return { key: `g-${i}`, src: games[i].banner, pos: "object-right", go: () => onIndex(i), label: games[i].title };
        })
      : [
          { key: "crop-1", src: game.banner, pos: "object-[85%_30%]", go: null, label: game.title },
          { key: "crop-2", src: game.poster, pos: "object-[50%_35%]", go: null, label: game.title },
        ];

  return (
    <div className="grid h-24 grid-cols-2 gap-3 lg:h-[100px]">
      {tiles.map((t) =>
        t.go ? (
          <button
            key={t.key}
            type="button"
            onClick={t.go}
            aria-label={t.label}
            className="overflow-hidden rounded-xl ring-1 ring-border transition hover:ring-primary/60"
          >
            <img src={t.src} alt="" className={cn("size-full object-cover", t.pos)} />
          </button>
        ) : (
          <Link
            key={t.key}
            to="/games/$slug"
            params={{ slug: game.slug }}
            aria-label={t.label}
            className="overflow-hidden rounded-xl ring-1 ring-border transition hover:ring-primary/60"
          >
            <img src={t.src} alt="" className={cn("size-full scale-150 object-cover", t.pos)} />
          </Link>
        ),
      )}
    </div>
  );
}
