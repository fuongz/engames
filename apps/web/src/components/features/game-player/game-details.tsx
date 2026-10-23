import { categories, type GameManifest } from "@web-games/games";
import { CoopBadge } from "#/components/shared/games/coop-badge";
import { Badge } from "#/components/ui/badge";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt } from "#/lib/i18n";

/** Description, controls and tags. Rendered in the desktop sidebar and the phone info dialog. */
export function GameDetails({ game }: { game: GameManifest }) {
  const locale = useLocale();
  const m = useMessages();
  const category = categories.find((c) => c.id === game.category);
  return (
    <div className="grid gap-4 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <CoopBadge game={game} variant="long" />
        {category && <Badge>{category.label[locale]}</Badge>}
        {game.tags[locale].map((t) => (
          <Badge key={t} variant="outline">
            {t}
          </Badge>
        ))}
      </div>
      <p className="leading-relaxed text-muted-foreground">{game.description[locale]}</p>
      <div className="grid gap-2">
        <h3 className="font-semibold">{m.player.howToPlay}</h3>
        <ul className="grid gap-2">
          {game.controls[locale].map((c) => (
            <li key={c} className="rounded-xl bg-muted px-3 py-2 leading-snug">
              {c}
            </li>
          ))}
        </ul>
      </div>
      {game.inspiredBy && (
        <p className="text-xs text-muted-foreground">{fmt(m.player.inspiredBy, { source: game.inspiredBy[locale] })}</p>
      )}
    </div>
  );
}
