import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { games } from "@web-games/games";
import { z } from "zod";
import { currentUser } from "#/server/auth";
import { getDb } from "#/server/db";
import { readProfile, setProfilePublic } from "#/server/db/profile";

// Boundary: client-callable server functions and types only (layout rule D).
// See docs/standards/checkin.md §6.

export type { Profile, ProfileCheckin, ProfileGameStat } from "#/server/db/profile";
export type { BadgeDef, BadgeId, BadgeState, BadgeTier } from "#/lib/profile";

const signedIn = () => currentUser(getRequestHeaders() as unknown as Headers);
const catalog = () => games.map((g) => g.slug);

/** The signed-in player's own profile (with `owner`: email and the privacy flag). Throws `sign-in-required`. */
export const getMyProfileFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await signedIn();
  if (!user) throw new Error("sign-in-required");
  const profile = await readProfile(getDb(), user.id, { viewer: user.id, catalog: catalog() });
  if (!profile) throw new Error("sign-in-required");
  return profile;
});

/**
 * Any player's profile (/u/<userId>), signed in or not. Null when there is no
 * such player or their profile is private (unless the viewer is them). Never
 * carries an email.
 */
export const getPublicProfileFn = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().min(1).max(64) }))
  .handler(async ({ data }) => {
    const viewer = await signedIn();
    return readProfile(getDb(), data.userId, { viewer: viewer?.id ?? null, catalog: catalog() });
  });

/** Make the signed-in player's profile public or private. Returns the new value. Throws `sign-in-required`. */
export const setProfilePublicFn = createServerFn({ method: "POST" })
  .validator(z.object({ public: z.boolean() }))
  .handler(async ({ data }) => {
    const user = await signedIn();
    if (!user) throw new Error("sign-in-required");
    return setProfilePublic(getDb(), user.id, data.public);
  });
