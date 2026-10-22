import { GameController03Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { games } from "@web-games/games";
import { useMemo, useState } from "react";
import { CategoryChips } from "./category-chips";
import { GameCard } from "#/components/shared/games/game-card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "#/components/ui/empty";
import { Input } from "#/components/ui/input";

/** Every game, filterable by category (from the URL) and free text. */
export function LibraryView({ category, onCategory }: { category: string; onCategory: (c: string) => void }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter(
      (g) =>
        (category === "all" || g.category === category) &&
        (!q || [g.title, g.tagline, ...g.tags].some((s) => s.toLowerCase().includes(q))),
    );
  }, [category, query]);

  return (
    <main className="grid gap-5 md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Thư viện</h1>
          <p className="text-sm text-muted-foreground">{games.length} game, chơi ngay không cần cài.</p>
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
            placeholder="Tìm trong thư viện..."
            aria-label="Tìm trong thư viện"
            className="h-11 rounded-xl bg-card pl-10"
          />
        </div>
      </div>

      <CategoryChips value={category} onChange={onCategory} allLabel="Tất cả" />

      {list.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={GameController03Icon} />
            </EmptyMedia>
            <EmptyTitle>Chưa có game nào</EmptyTitle>
            <EmptyDescription>Thử thể loại khác hoặc từ khóa khác nhé.</EmptyDescription>
          </EmptyHeader>
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
