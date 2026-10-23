import { categories, type GameManifest } from "@web-games/games";
import { useLayoutEffect, useRef, useState } from "react";
import { CoopBadge } from "#/components/shared/games/coop-badge";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Kbd, KbdGroup } from "#/components/ui/kbd";
import { useLocale, useMessages } from "#/hooks/use-messages";
import { fmt } from "#/lib/i18n";

/** Description, controls and tags. Rendered in the desktop sidebar and the phone info dialog. */
export function GameDetails({ game }: { game: GameManifest }) {
  const locale = useLocale();
  const m = useMessages();
  const [expanded, setExpanded] = useState(false);
  // Only offer "show more" when the clamp actually hides text
  const [clamped, setClamped] = useState(false);
  const text = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = text.current;
    if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight + 1);
  });
  const category = categories.find((c) => c.id === game.category);
  return (
    <div className="grid gap-5 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <CoopBadge game={game} variant="long" />
        {category && <Badge>{category.label[locale]}</Badge>}
        {game.tags[locale].map((t) => (
          <Badge key={t} variant="outline">
            {t}
          </Badge>
        ))}
      </div>
      <div className="grid justify-items-start gap-1">
        <p
          ref={text}
          className={
            expanded
              ? "leading-relaxed text-muted-foreground"
              : "line-clamp-3 leading-relaxed text-muted-foreground"
          }
        >
          {game.description[locale]}
        </p>
        {clamped && (
          <Button
            variant="link"
            size="xs"
            // Plain text link: no pill, and keyboard focus shows as the underline
            className="h-auto rounded-none border-0 p-0 focus-visible:underline focus-visible:ring-0"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? m.player.showLess : m.player.showMore}
          </Button>
        )}
      </div>
      <div className="grid gap-2.5">
        <h3 className="font-semibold">{m.player.howToPlay}</h3>
        <ol className="grid gap-2.5">
          {game.controls[locale].map((c, i) => (
            <li key={c} className="flex gap-3 leading-relaxed">
              <span className="w-4 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span>
                <ControlText text={c} />
              </span>
            </li>
          ))}
        </ol>
      </div>
      {game.inspiredBy && (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          {fmt(m.player.inspiredBy, { source: game.inspiredBy[locale] })}
        </p>
      )}
    </div>
  );
}

const ARROWS = /^[←↑→↓]+$/;
// Raised a step off the card so a key reads as a key, not as muted text
const CAP = "bg-secondary align-middle text-foreground ring-1 ring-border";

/** A control hint with its `[Key]` markers drawn as key caps; `[↓→]` is one cap per arrow. */
function ControlText({ text }: { text: string }) {
  return text.split(/(\[[^\]]+\])/).map((part, i) => {
    const key =
      part.startsWith("[") && part.endsWith("]") ? part.slice(1, -1) : null;
    // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed string never reorder
    if (!key) return <span key={i}>{part}</span>;
    if (!ARROWS.test(key) || key.length === 1)
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed string never reorder
        <Kbd key={i} className={CAP}>
          {key}
        </Kbd>
      );
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed string never reorder
      <KbdGroup key={i} className="gap-0.5 align-middle">
        {[...key].map((a, j) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: arrows repeat ("↓↓"), so position is the identity
          <Kbd key={j} className={CAP}>
            {a}
          </Kbd>
        ))}
      </KbdGroup>
    );
  });
}
