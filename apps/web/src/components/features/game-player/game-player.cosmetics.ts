import type { GameCosmetics } from "@web-games/core";
import {
  buyCosmeticFn,
  equipCosmeticFn,
  getCosmeticsFn,
} from "#/server/cosmetics";
import { signInWithGoogle } from "#/lib/auth-client";
import { useTickets } from "#/stores/tickets";

export function createCosmeticsBridge(
  slug: string,
  userId: string | null,
  online: boolean,
): GameCosmetics {
  return {
    async signIn() {
      await signInWithGoogle();
    },
    state: () => getCosmeticsFn({ data: { slug } }),
    async buy(itemId) {
      if (online) throw new Error("purchase-before-online-match");
      const result = await buyCosmeticFn({ data: { slug, itemId } });
      const wallet = useTickets.getState();
      if (wallet.userId === userId && result.inventory.balance !== null)
        wallet.set(result.inventory.balance);
      return result;
    },
    equip: (itemId) => equipCosmeticFn({ data: { slug, itemId } }),
  };
}
