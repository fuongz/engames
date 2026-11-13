import type { GameManifest } from "@web-games/core";

// What a game offers at the Prize Counter (docs/standards/tickets.md §4, §6):
// its `manifest.shop` items plus its paid permanent cosmetics.

/** How many things `game` sells for tickets: shop items and paid outfits. */
export const prizeCount = (game: GameManifest) =>
  (game.shop?.length ?? 0) + (game.cosmetics?.filter((i) => i.price > 0).length ?? 0);

/** Whether `game` has a shelf at the Prize Counter. */
export const hasPrizes = (game: GameManifest) => prizeCount(game) > 0;
