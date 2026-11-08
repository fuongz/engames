import type { RoomGame } from "@web-games/core/online";
import { caroOnline } from "./caro/online";
import { coCaNguaOnline } from "./co-ca-ngua/online";
import { coLatOnline } from "./co-lat/online";
import { coTyPhuOnline } from "./co-ty-phu/online";
import { coVuaOnline } from "./co-vua/online";
import { kyTucXaOnline } from "./ky-tuc-xa/online";

// Every game playable online, by slug. Explicit (not import.meta.glob) because
// the realtime Worker is bundled by Wrangler. online.test.ts keeps this in
// step with the manifests' `online` blocks.
export const onlineGames: Record<string, RoomGame> = {
  "ky-tuc-xa": kyTucXaOnline as RoomGame,
  caro: caroOnline as RoomGame,
  "co-ca-ngua": coCaNguaOnline as RoomGame,
  "co-lat": coLatOnline as RoomGame,
  "co-ty-phu": coTyPhuOnline as RoomGame,
  "co-vua": coVuaOnline as RoomGame,
};

export const findOnlineGame = (slug: string): RoomGame | undefined =>
  Object.hasOwn(onlineGames, slug) ? onlineGames[slug] : undefined;
