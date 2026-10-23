import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { categories, games } from "@web-games/games";
import { categoryIcon } from "#/components/shared/games/category-icons";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "#/components/ui/command";
import { useLocale, useMessages } from "#/hooks/use-messages";

/** ⌘K palette: jump to a game, or to the library filtered by category. */
export function GameSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const locale = useLocale();
  const m = useMessages();
  const go = (to: () => void) => {
    onOpenChange(false);
    to();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      // Phones: sit just under the status bar, so the list stays clear of the
      // on-screen keyboard and the top of the screen isn't left empty
      className="top-[calc(env(safe-area-inset-top)+0.75rem)] sm:top-1/3"
      title={m.search.title}
      description={m.search.description}
    >
      {/* CommandDialog only supplies the dialog; cmdk's store lives in <Command>,
          and CommandInput/Item crash ("reading 'subscribe'") without it. */}
      <Command>
        <CommandInput placeholder={m.search.placeholder} />
        <CommandList className="max-h-[min(70dvh,480px)]">
          <CommandEmpty>{m.search.empty}</CommandEmpty>
          <CommandGroup heading={m.search.games} className="**:[[cmdk-group-items]]:grid **:[[cmdk-group-items]]:gap-1">
            {games.map((g) => (
              <CommandItem
                key={g.slug}
                value={`${g.title.vi} ${g.title.en} ${g.tags[locale].join(" ")}`}
                className="gap-3 py-2.5"
                onSelect={() =>
                  go(() =>
                    navigate({ to: "/games/$slug", params: { slug: g.slug } }),
                  )
                }
              >
                {/* shrink-0 + aspect-square: flex would otherwise squash the art */}
                <img
                  src={g.poster[locale]}
                  alt=""
                  className="aspect-square size-11 shrink-0 rounded-lg object-cover object-top outline-1 -outline-offset-1 outline-white/10"
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{g.title[locale]}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {g.tagline[locale]}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup
            heading={m.search.categories}
            className="**:[[cmdk-group-items]]:grid **:[[cmdk-group-items]]:grid-cols-3 **:[[cmdk-group-items]]:gap-2 **:[[cmdk-group-items]]:pb-1"
          >
            {categories.map((c) => (
              <CommandItem
                key={c.id}
                value={`${m.search.categories} ${c.label[locale]}`}
                className="justify-center gap-1.5 rounded-full! border bg-card px-2 py-2 text-xs font-medium whitespace-nowrap data-selected:border-primary/60"
                onSelect={() =>
                  go(() =>
                    navigate({ to: "/library", search: { category: c.id } }),
                  )
                }
              >
                <HugeiconsIcon icon={categoryIcon(c.id)} className="size-4" />
                {c.label[locale]}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
