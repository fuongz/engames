import type {
  CosmeticBuyResult,
  CosmeticInventory,
  CosmeticItem,
} from "@web-games/core";
import { and, eq } from "drizzle-orm";
import { gameIdOf } from "./games";
import type { Db } from "./leaderboard";
import { cosmeticEquipment, gameCosmetic } from "./schema";
import { getTicketBalance } from "./tickets";

export async function ownedCosmetics(
  db: Db,
  userId: string,
  slug: string,
): Promise<string[]> {
  const gameId = await gameIdOf(db, slug);
  return (
    await db
      .select({ id: gameCosmetic.itemId })
      .from(gameCosmetic)
      .where(
        and(eq(gameCosmetic.userId, userId), eq(gameCosmetic.gameId, gameId)),
      )
  ).map((r) => r.id);
}
export async function cosmeticInventory(
  db: Db,
  userId: string | null,
  slug: string,
  items: CosmeticItem[],
): Promise<CosmeticInventory> {
  const free = items.filter((i) => i.price === 0).map((i) => i.id);
  const fallback = free[0] ?? "";
  if (!userId)
    return { signedIn: false, balance: null, owned: free, equipped: fallback };
  const gameId = await gameIdOf(db, slug);
  const [paid, wallet, equipment] = await Promise.all([
    ownedCosmetics(db, userId, slug),
    getTicketBalance(db, userId),
    db
      .select()
      .from(cosmeticEquipment)
      .where(
        and(
          eq(cosmeticEquipment.userId, userId),
          eq(cosmeticEquipment.gameId, gameId),
        ),
      )
      .limit(1),
  ]);
  const owned = [
    ...new Set([
      ...free,
      ...paid.filter((id) => items.some((i) => i.id === id)),
    ]),
  ];
  const equipped = equipment[0]?.itemId;
  return {
    signedIn: true,
    balance: wallet.balance,
    owned,
    equipped: equipped && owned.includes(equipped) ? equipped : fallback,
  };
}
export async function buyCosmetic(
  db: Db,
  input: {
    userId: string;
    slug: string;
    itemId: string;
    items: CosmeticItem[];
    now: number;
  },
): Promise<CosmeticBuyResult> {
  const { userId, slug, itemId, items, now } = input;
  const inventory = () => cosmeticInventory(db, userId, slug, items);
  const item = items.find((i) => i.id === itemId);
  if (!item)
    return { ok: false, reason: "unknown-item", inventory: await inventory() };
  if (item.price === 0)
    return { ok: true, reason: "already-owned", inventory: await inventory() };
  const gameId = await gameIdOf(db, slug);
  let inserted: { itemId: string }[];
  try {
    inserted = await db
      .insert(gameCosmetic)
      .values({ userId, gameId, itemId, price: item.price, purchasedAt: now })
      .onConflictDoNothing()
      .returning({ itemId: gameCosmetic.itemId });
  } catch (error) {
    // Drizzle wraps SQLite/D1 errors. Only the trigger's known refusal is translated.
    let cause: unknown = error;
    for (let i = 0; i < 5 && cause instanceof Error; i++, cause = cause.cause) {
      if (cause.message.includes("insufficient-tickets"))
        return {
          ok: false,
          reason: "insufficient",
          inventory: await inventory(),
        };
    }
    throw error;
  }
  return {
    ok: true,
    ...(inserted.length ? {} : { reason: "already-owned" as const }),
    inventory: await inventory(),
  };
}
export async function equipCosmetic(
  db: Db,
  userId: string,
  slug: string,
  itemId: string,
  items: CosmeticItem[],
): Promise<CosmeticInventory> {
  const state = await cosmeticInventory(db, userId, slug, items);
  if (!state.owned.includes(itemId)) throw new Error("cosmetic-not-owned");
  const gameId = await gameIdOf(db, slug);
  await db
    .insert(cosmeticEquipment)
    .values({ userId, gameId, itemId })
    .onConflictDoUpdate({
      target: [cosmeticEquipment.userId, cosmeticEquipment.gameId],
      set: { itemId },
    });
  return { ...state, equipped: itemId };
}
