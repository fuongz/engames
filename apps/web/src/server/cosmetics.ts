import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame } from "@web-games/games";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import {
  buyCosmetic,
  cosmeticInventory,
  equipCosmetic,
} from "#/server/db/cosmetics";

export const getCosmeticsFn = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slug: z.string().refine((s) => Boolean(findGame(s)?.cosmetics?.length)),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    return cosmeticInventory(
      getDb(),
      user?.id ?? null,
      data.slug,
      findGame(data.slug)?.cosmetics ?? [],
    );
  });
export const buyCosmeticFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().refine((s) => Boolean(findGame(s)?.cosmetics?.length)),
      itemId: z.string().min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    if (!user) throw new Error("sign-in-required");
    return buyCosmetic(getDb(), {
      userId: user.id,
      slug: data.slug,
      itemId: data.itemId,
      items: findGame(data.slug)?.cosmetics ?? [],
      now: Date.now(),
    });
  });
export const equipCosmeticFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().refine((s) => Boolean(findGame(s)?.cosmetics?.length)),
      itemId: z.string().min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const user = await currentUser(getRequestHeaders() as unknown as Headers);
    if (!user) throw new Error("sign-in-required");
    return equipCosmetic(
      getDb(),
      user.id,
      data.slug,
      data.itemId,
      findGame(data.slug)?.cosmetics ?? [],
    );
  });
