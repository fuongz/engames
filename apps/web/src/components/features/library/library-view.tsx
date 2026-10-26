import { CloudSavingDone01Icon, GameController03Icon, Search01Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { games } from "@web-games/games";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { CategoryChips } from "./category-chips";
import { coopKeywords } from "#/components/shared/games/coop-badge";
import { GameCard } from "#/components/shared/games/game-card";
import { Toggle } from "#/components/ui/toggle";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { Input } from "#/components/ui/input";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { plural } from "#/lib/i18n";
import { EASE_IN_OUT, EASE_OUT } from "#/lib/motion";

// Filtering shows where cards went: the rest slide into the gaps, leavers fade.
// `scale` rather than a transform string, so it composes with the layout transform.
const SHOWN = { opacity: 1, scale: 1 };
const HIDDEN = { opacity: 0, scale: 0.96 };
const LEAVE = { ...HIDDEN, transition: { duration: 0.15, ease: EASE_OUT } };
const CARD = { default: { duration: 0.2, ease: EASE_OUT }, layout: { duration: 0.25, ease: EASE_IN_OUT } };

/** Every game, filterable by category (from the URL) and free text. */
export function LibraryView({
  category,
  coop,
  online,
  onCategory,
  onCoop,
  onOnline,
}: {
  category: string;
  coop: boolean;
  /** Only games that save to the player's account. */
  online: boolean;
  onCategory: (c: string) => void;
  onCoop: (on: boolean) => void;
  onOnline: (on: boolean) => void;
}) {
  const locale = useLocale();
  const m = useMessages();
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter(
      (g) =>
        (category === "all" || g.category === category) &&
        (!coop || g.online !== undefined) &&
        (!online || g.requiresAccount === true) &&
        (!q || [g.title.vi, g.title.en, g.tagline[locale], ...g.tags[locale], coopKeywords(g)].some((s) => s.toLowerCase().includes(q))),
    );
  }, [category, coop, online, query, locale]);

  return (
    <main className="grid gap-5 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{m.library.title}</h1>
          <p className="text-sm text-muted-foreground">{plural(locale, games.length, m.library.count)}</p>
        </div>
        <div className="relative md:w-80">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={m.library.searchPlaceholder}
            aria-label={m.library.searchLabel}
            className="h-11 rounded-xl bg-card pl-10"
          />
        </div>
      </div>

      <CategoryChips
        value={category}
        onChange={onCategory}
        allLabel={m.library.all}
        leading={
          <>
            {/* Independent of the category: "co-op puzzle games" is a valid ask */}
            <Toggle
              pressed={coop}
              onPressedChange={onCoop}
              className="h-10 shrink-0 gap-2 rounded-full border border-primary/40 bg-card px-4 text-sm font-medium text-primary hover:bg-primary/10 hover:text-primary aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              <HugeiconsIcon icon={UserGroupIcon} className="size-4.5" />
              {m.library.coopFilter}
            </Toggle>
            <Toggle
              pressed={online}
              onPressedChange={onOnline}
              className="h-10 shrink-0 gap-2 rounded-full border border-primary/40 bg-card px-4 text-sm font-medium text-primary hover:bg-primary/10 hover:text-primary aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              <HugeiconsIcon icon={CloudSavingDone01Icon} className="size-4.5" />
              {m.library.onlineFilter}
            </Toggle>
            <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
          </>
        }
      />

      {list.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={GameController03Icon} />
            </EmptyMedia>
            <EmptyTitle>{m.library.emptyTitle}</EmptyTitle>
            <EmptyDescription>{m.library.emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <AnimatePresence mode="popLayout">
            {list.map((g, i) => (
              <motion.div
                key={g.slug}
                layout
                initial={HIDDEN}
                animate={SHOWN}
                exit={LEAVE}
                // One after another, capped so a long list never keeps the last card waiting
                transition={{ ...CARD, default: { ...CARD.default, delay: Math.min(i, 12) * 0.04 } }}
              >
                <GameCard game={g} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </main>
  );
}
