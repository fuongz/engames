import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { findGame } from "@web-games/games";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { favoritesOf, setFavorite } from "#/server/db/favorites";

// Boundary: client-callable server functions and types only (layout rule D).

const signedIn = () => currentUser(getRequestHeaders() as unknown as Headers);

/** The signed-in player's favourite games (slugs, newest first); null when signed out. */
export const getFavorites = createServerFn({ method: "GET" }).handler(async () => {
  const user = await signedIn();
  if (!user) return null;
  // A game removed from the catalogue just drops out
  return (await favoritesOf(getDb(), user.id)).filter((slug) => findGame(slug) !== undefined);
});

export const toggleFavorite = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().refine((s) => findGame(s) !== undefined, "Unknown game"), on: z.boolean() }))
  .handler(async ({ data }) => {
    const user = await signedIn();
    if (!user) throw new Error("sign-in-required");
    await setFavorite(getDb(), user.id, data.slug, data.on);
    return data.on;
  });
