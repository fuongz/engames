import type { RoomGame } from "@web-games/core/online";
import { kyTucXaOnline } from "./ky-tuc-xa/online";

// Every game playable online, by slug. Explicit (not import.meta.glob) because
// the realtime Worker is bundled by Wrangler. online.test.ts keeps this in
// step with the manifests' `online` blocks.
export const onlineGames: Record<string, RoomGame> = {
  "ky-tuc-xa": kyTucXaOnline as RoomGame,
};

export const findOnlineGame = (slug: string): RoomGame | undefined =>
  Object.hasOwn(onlineGames, slug) ? onlineGames[slug] : undefined;
