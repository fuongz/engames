import { kyTucXaOnline } from "../ky-tuc-xa/online";
import type { RoomGame } from "./room-game";

// Every game playable online, by slug. Explicit (not import.meta.glob) because
// the realtime Worker is bundled by Wrangler. registry.test.ts keeps this in
// step with the manifests' `online` blocks.
export const onlineGames: Record<string, RoomGame> = {
  "ky-tuc-xa": kyTucXaOnline as RoomGame,
};

export const findOnlineGame = (slug: string): RoomGame | undefined =>
  Object.hasOwn(onlineGames, slug) ? onlineGames[slug] : undefined;
