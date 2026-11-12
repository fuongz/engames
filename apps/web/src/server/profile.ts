import { createServerFn } from "@tanstack/react-start";
import { appendResponseHeader, getRequestHeaders } from "@tanstack/react-start/server";
import { games } from "@web-games/games";
import { z } from "zod";
import { avatarUrl, sanitizeDisplayName } from "#/lib/avatar";
import { currentUser, getAuth } from "#/server/auth";
import { getDb } from "#/server/db";
import { readProfile, setProfilePublic } from "#/server/db/profile";
import { getAvatarBucket } from "#/server/media";
import { deleteAvatars, putAvatar, readAvatarUpload } from "#/server/media/avatars";

// Boundary: client-callable server functions and types only (layout rule D).
// See docs/standards/checkin.md §6.

export type { Profile, ProfileCheckin, ProfileGameStat } from "#/server/db/profile";
export type { BadgeDef, BadgeId, BadgeState, BadgeTier } from "#/lib/profile";

const requestHeaders = () => getRequestHeaders() as unknown as Headers;
const signedIn = () => currentUser(requestHeaders());
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

/**
 * Writes name/image through Better Auth's own updateUser, not drizzle: it also
 * re-signs the session cookie cache (5 min), whose Set-Cookie is forwarded on this
 * response — so the next getSession, on the server or the client, sees the change.
 */
async function updateSignedInUser(fields: { name?: string; image?: string | null }) {
  const { headers } = await getAuth().api.updateUser({ headers: requestHeaders(), body: fields, returnHeaders: true });
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) appendResponseHeader("set-cookie", cookies);
}

/**
 * Replace the signed-in player's avatar. Input: FormData with `file` (WebP
 * preferred; PNG/JPEG accepted), ≤ AVATAR_MAX_BYTES. Stores it in R2, points
 * user.image at it and deletes the player's older objects. Returns `{ image }`.
 * Throws `sign-in-required`, `avatar-invalid`, `avatar-too-large`.
 */
export const uploadAvatarFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("avatar-invalid");
    return data;
  })
  .handler(async ({ data }) => {
    const user = await signedIn();
    if (!user) throw new Error("sign-in-required");
    const upload = await readAvatarUpload(data.get("file"));
    const bucket = getAvatarBucket();
    const key = await putAvatar(bucket, user.id, upload);
    const image = avatarUrl(key);
    try {
      await updateSignedInUser({ image });
    } catch (e) {
      await bucket.delete(key).catch(() => {});
      throw e;
    }
    // Best effort: a leftover object is harmless and the next upload/remove sweeps it
    await deleteAvatars(bucket, user.id, key).catch((e) => console.warn("avatar cleanup failed", e));
    return { image };
  });

/**
 * Remove the signed-in player's avatar: user.image becomes null (this also drops
 * a Google profile picture) and every object under their prefix is deleted.
 * Returns `{ image: null }`. Throws `sign-in-required`.
 */
export const removeAvatarFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await signedIn();
  if (!user) throw new Error("sign-in-required");
  // Point away first: deleting first would leave user.image on a 404 if the update failed
  await updateSignedInUser({ image: null });
  await deleteAvatars(getAvatarBucket(), user.id);
  return { image: null };
});

/**
 * Change the signed-in player's display name (trimmed, whitespace collapsed,
 * 1..DISPLAY_NAME_MAX code points, no control characters). Returns the stored
 * `{ name }`. Throws `sign-in-required`, `name-invalid`.
 */
export const updateDisplayNameFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string() }))
  .handler(async ({ data }) => {
    const user = await signedIn();
    if (!user) throw new Error("sign-in-required");
    const name = sanitizeDisplayName(data.name);
    if (!name) throw new Error("name-invalid");
    await updateSignedInUser({ name });
    return { name };
  });
