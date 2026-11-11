import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame, games } from "@web-games/games";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { buyItem, listShop } from "#/server/db/shop";
import { getTicketBalance } from "#/server/db/tickets";

// Boundary: client-callable server functions and types only (layout rule D).
// The Prize Counter: shared arcade tickets buy a game's own currency.
// See docs/standards/tickets.md §4.

export type { BuyResult, ShopListingGame, ShopListingItem } from "#/server/db/shop";

/**
 * Every game's Prize Counter items, with what is left of each daily limit today
 * for the signed-in player, and their ticket balance (null when signed out).
 */
export const listShopFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser(getRequestHeaders() as unknown as Headers);
  const db = getDb();
  const [shop, wallet] = await Promise.all([
    listShop(db, { userId: user?.id ?? null, now: Date.now(), catalogue: games }),
    user ? getTicketBalance(db, user.id) : null,
  ]);
  return { signedIn: user !== null, balance: wallet?.balance ?? null, games: shop };
});

/**
 * Buy one item for the signed-in player. On `ok` the tickets are spent and the
 * game receives the item on its next `ctx.allowance.claim()`; `balance` is the
 * wallet after the purchase.
 */
export const buyItemFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z
        .string()
        .refine((s) => (findGame(s)?.shop?.length ?? 0) > 0, "Game has no shop"),
      itemId: z.string().min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    if (!user) throw new Error("sign-in-required");
    return buyItem(getDb(), {
      userId: user.id,
      slug: data.slug,
      itemId: data.itemId,
      now: Date.now(),
      shop: findGame(data.slug)?.shop,
    });
  });
