import { HugeiconsIcon } from "@hugeicons/react";
import { categories } from "@web-games/games";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ALL_CATEGORIES, categoryIcon } from "#/components/shared/games/category-icons";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { INDICATOR_SPRING } from "#/lib/motion";

/** Category filter chips; the selected one takes the orange accent. Scrolls sideways on phones. */
export function CategoryChips({
  value,
  onChange,
  allLabel,
  leading,
}: {
  value: string;
  onChange: (category: string) => void;
  allLabel?: string;
  /** Rendered first in the same scrolling row (e.g. the co-op filter). */
  leading?: ReactNode;
}) {
  const locale = useLocale();
  const m = useMessages();
  const items = [
    { id: ALL_CATEGORIES, label: allLabel ?? m.library.featured },
    ...categories.map((c) => ({ id: c.id, label: c.label[locale] })),
  ];
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0">
      <div className="flex w-max items-center gap-2">
        {leading}
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
              className="relative isolate h-10 gap-2 rounded-full border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-pressed:border-transparent data-pressed:bg-transparent data-pressed:text-primary-foreground"
            >
              {/* One orange pill, sliding to the picked chip */}
              {value === c.id && (
                <motion.span layoutId="chip-active" transition={INDICATOR_SPRING} className="absolute inset-0 -z-10 rounded-full bg-primary" />
              )}
              <HugeiconsIcon icon={categoryIcon(c.id)} className="size-4.5" />
              {c.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
