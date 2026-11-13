import { Link } from "@tanstack/react-router";
import type { GameManifest } from "@web-games/core";
import { useEffect, useRef } from "react";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { plural } from "#/lib/i18n";
import { prizeCount } from "#/lib/prizes";

/**
 * The Prize Counter's first step: every game with something to redeem, one card
 * each (cover, name, how many prizes). A strip that scrolls sideways on phones, a
 * grid from lg up. Each card is a link to `?game=<slug>`, so a pick is shareable
 * and the back button returns to the previous one.
 */
export function GamePicker({ games, selected }: { games: GameManifest[]; selected: string }) {
  const m = useMessages();
  const locale = useLocale();
  const strip = useRef<HTMLUListElement>(null);
  const first = useRef(true);

  // Phones: keep the picked card inside the strip (a deep link may pick the last
  // one). Only the strip scrolls, never the page; instant on arrival, smooth after.
  useEffect(() => {
    const ul = strip.current;
    const card = ul?.querySelector<HTMLElement>(`[data-slug="${CSS.escape(selected)}"]`);
    const instant = first.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    first.current = false;
    if (!ul || !card || ul.scrollWidth <= ul.clientWidth) return;
    const pad = Number.parseFloat(getComputedStyle(ul).paddingLeft) || 0;
    // The strip is the card's offsetParent (relative), so offsetLeft is in scroll coordinates
    const left = card.offsetLeft - pad;
    const right = card.offsetLeft + card.offsetWidth + pad;
    if (left < ul.scrollLeft) ul.scrollTo({ left, behavior: instant ? "instant" : "smooth" });
    else if (right > ul.scrollLeft + ul.clientWidth)
      ul.scrollTo({ left: right - ul.clientWidth, behavior: instant ? "instant" : "smooth" });
  }, [selected]);

  return (
    <nav aria-label={m.shop.pickGame} className="grid gap-3">
      <h2 className="text-lg font-semibold tracking-tight md:text-xl">{m.shop.pickGame}</h2>
      <ul ref={strip} className="relative -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] lg:gap-4 lg:overflow-visible lg:px-0">
        {games.map((g) => {
          const active = g.slug === selected;
          return (
            <li key={g.slug} data-slug={g.slug} className="w-32 shrink-0 snap-start lg:w-auto">
              <Link
                to="/prize-counter"
                search={{ game: g.slug }}
                // Picking a game keeps the page where it is: the prizes are just below
                resetScroll={false}
                aria-current={active ? "page" : undefined}
                data-active={active}
                className="group grid gap-2 rounded-2xl bg-card p-1.5 ring-1 ring-border outline-none transition-[background-color,box-shadow,scale] duration-150 ease-out hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:active:scale-100 data-[active=true]:bg-secondary data-[active=true]:ring-2 data-[active=true]:ring-primary"
              >
                <img
                  src={g.poster[locale]}
                  alt=""
                  width={160}
                  height={120}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="aspect-[4/3] w-full rounded-xl object-cover object-top select-none"
                />
                <span className="grid gap-0.5 px-1 pb-1">
                  <span className="line-clamp-2 min-h-[2lh] text-sm leading-tight font-semibold text-balance transition-colors group-hover:text-primary group-data-[active=true]:text-primary">
                    {g.title[locale]}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{plural(locale, prizeCount(g), m.shop.prizeCount)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
