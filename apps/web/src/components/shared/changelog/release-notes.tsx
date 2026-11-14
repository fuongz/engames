import type { ChangelogEntry } from "@web-games/core";
import { Badge } from "#/components/ui/badge";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt } from "#/lib/i18n";
import { cn } from "#/lib/utils";

/** "v1.3.0", in the mono face the game page already uses for versions. */
export function VersionBadge({ version, className }: { version: string; className?: string }) {
  const m = useMessages();
  return (
    <Badge variant="secondary" className={cn("font-mono tabular-nums", className)} title={fmt(m.player.versionLabel, { version })}>
      {fmt(m.player.version, { version })}
    </Badge>
  );
}

/** A release's changes in the player's language, one bullet each. */
export function ChangeList({ entry, className }: { entry: ChangelogEntry; className?: string }) {
  const locale = useLocale();
  return (
    <ul className={cn("grid list-disc gap-1.5 pl-4 leading-snug text-muted-foreground marker:text-primary/70", className)}>
      {entry.changes[locale].map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  );
}
