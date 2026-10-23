import { HugeiconsIcon } from "@hugeicons/react";
import { categories } from "@web-games/games";
import { ALL_CATEGORIES, categoryIcon } from "#/components/shared/games/category-icons";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { useLocale, useMessages } from "#/hooks/use-messages";

/** Category filter chips; the selected one takes the orange accent. Scrolls sideways on phones. */
export function CategoryChips({
  value,
  onChange,
  allLabel,
}: {
  value: string;
  onChange: (category: string) => void;
  allLabel?: string;
}) {
  const locale = useLocale();
  const m = useMessages();
  const items = [
    { id: ALL_CATEGORIES, label: allLabel ?? m.library.featured },
    ...categories.map((c) => ({ id: c.id, label: c.label[locale] })),
  ];
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0">
      <ToggleGroup
        spacing={2}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? ALL_CATEGORIES)}
        aria-label={m.library.categories}
        className="w-max"
      >
        {items.map((c) => (
          <ToggleGroupItem
            key={c.id}
            value={c.id}
            className="h-10 gap-2 rounded-full border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-pressed:border-transparent data-pressed:bg-primary data-pressed:text-primary-foreground"
          >
            <HugeiconsIcon icon={categoryIcon(c.id)} className="size-4.5" />
            {c.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
