import { categories, type GameManifest } from "@web-games/games";
import { Badge } from "#/components/ui/badge";

/** Description, controls and tags. Rendered in the desktop sidebar and the phone info dialog. */
export function GameDetails({ game }: { game: GameManifest }) {
  const category = categories.find((c) => c.id === game.category);
  return (
    <div className="grid gap-4 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {category && <Badge>{category.label}</Badge>}
        {game.tags.map((t) => (
          <Badge key={t} variant="outline">
            {t}
          </Badge>
        ))}
      </div>
      <p className="leading-relaxed text-muted-foreground">{game.description}</p>
      <div className="grid gap-2">
        <h3 className="font-semibold">Cách chơi</h3>
        <ul className="grid gap-2">
          {game.controls.map((c) => (
            <li key={c} className="rounded-xl bg-muted px-3 py-2 leading-snug">
              {c}
            </li>
          ))}
        </ul>
      </div>
      {game.inspiredBy && <p className="text-xs text-muted-foreground">Lấy cảm hứng từ {game.inspiredBy}</p>}
    </div>
  );
}
