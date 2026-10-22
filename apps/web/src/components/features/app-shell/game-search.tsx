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

/** ⌘K palette: jump to a game, or to the library filtered by category. */
export function GameSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const go = (to: () => void) => {
    onOpenChange(false);
    to();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tìm game"
      description="Tìm theo tên, thể loại hoặc từ khóa"
    >
      {/* CommandDialog only supplies the dialog; cmdk's store lives in <Command>,
          and CommandInput/Item crash ("reading 'subscribe'") without it. */}
      <Command>
        <CommandInput placeholder="Tìm game, thể loại..." />
        <CommandList className="max-h-[min(70dvh,480px)]">
          <CommandEmpty>Không thấy game nào.</CommandEmpty>
          <CommandGroup heading="Game" className="**:[[cmdk-group-items]]:grid **:[[cmdk-group-items]]:gap-1">
            {games.map((g) => (
              <CommandItem
                key={g.slug}
                value={`${g.title} ${g.tags.join(" ")}`}
                className="gap-3 py-2.5"
                onSelect={() =>
                  go(() =>
                    navigate({ to: "/games/$slug", params: { slug: g.slug } }),
                  )
                }
              >
                {/* shrink-0 + aspect-square: flex would otherwise squash the art */}
                <img
                  src={g.poster}
                  alt=""
                  className="aspect-square size-11 shrink-0 rounded-lg object-cover object-top"
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{g.title}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {g.tagline}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup
            heading="Thể loại"
            className="**:[[cmdk-group-items]]:grid **:[[cmdk-group-items]]:grid-cols-3 **:[[cmdk-group-items]]:gap-2 **:[[cmdk-group-items]]:pb-1"
          >
            {categories.map((c) => (
              <CommandItem
                key={c.id}
                value={`thể loại ${c.label}`}
                className="justify-center gap-1.5 rounded-full! border bg-card px-2 py-2 text-xs font-medium whitespace-nowrap data-selected:border-primary/60"
                onSelect={() =>
                  go(() =>
                    navigate({ to: "/library", search: { category: c.id } }),
                  )
                }
              >
                <HugeiconsIcon icon={categoryIcon(c.id)} className="size-4" />
                {c.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
