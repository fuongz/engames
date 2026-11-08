import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "#/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { useFavorites } from "#/hooks/use-favorites";
import { useMessages } from "#/hooks/use-messages";
import { cn } from "#/lib/utils";

/** The heart in the player's toolbar. Signed-in players only: favourites live on the account. */
export function FavoriteButton({ slug, className }: { slug: string; className?: string }) {
  const m = useMessages();
  const { signedIn, slugs, isFavorite, toggle } = useFavorites();
  if (!signedIn || slugs === undefined) return null;
  const on = isFavorite(slug);
  const label = on ? m.player.unfavorite : m.player.favorite;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon" aria-label={label} aria-pressed={on} className={className} onClick={() => void toggle(slug)} />}
      >
        <HugeiconsIcon icon={FavouriteIcon} className={cn("transition-colors", on && "fill-current text-primary")} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
