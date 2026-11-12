import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  type AvatarExt,
  avatarKey,
  avatarPrefix,
  parseAvatarKey,
  sniffAvatarType,
} from "#/lib/avatar";

// SERVER-ONLY. R2 access for player avatars; see docs/standards/avatars.md for the
// key layout (avatars/<userId>/<epochMs>.<ext>). Every function takes the bucket as
// a parameter so `bun test` can drive it with a fake; the binding itself is read
// in server/media/index.ts.

/** The slice of R2Bucket this module uses (a fake in tests implements just this). */
export type AvatarBucket = Pick<R2Bucket, "put" | "get" | "list" | "delete">;

/** An upload that passed validation: its bytes and the format its magic number says. */
export type AvatarUpload = { bytes: Uint8Array; ext: AvatarExt };

/**
 * Validates the `file` field of an upload. Throws `avatar-invalid` (missing, not a
 * Blob, empty, or not a WebP/PNG/JPEG by declared type AND magic bytes) or
 * `avatar-too-large` (over AVATAR_MAX_BYTES).
 */
export async function readAvatarUpload(file: unknown): Promise<AvatarUpload> {
  if (!(file instanceof Blob) || file.size === 0) throw new Error("avatar-invalid");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("avatar-too-large");
  const declared = file.type.split(";")[0].trim().toLowerCase();
  if (!Object.values(AVATAR_TYPES).includes(declared as never)) throw new Error("avatar-invalid");
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Blob.size can't lie, but re-check what was actually read
  if (bytes.byteLength === 0) throw new Error("avatar-invalid");
  if (bytes.byteLength > AVATAR_MAX_BYTES) throw new Error("avatar-too-large");
  const ext = sniffAvatarType(bytes);
  // The stored type comes from the bytes; the declared one must merely agree
  if (!ext || AVATAR_TYPES[ext] !== declared) throw new Error("avatar-invalid");
  return { bytes, ext };
}

/** Writes a new avatar object and returns its key. Never overwrites: the key is new. */
export async function putAvatar(
  bucket: AvatarBucket,
  userId: string,
  upload: AvatarUpload,
  now: number = Date.now(),
): Promise<string> {
  const key = avatarKey(userId, now, upload.ext);
  await bucket.put(key, upload.bytes, {
    httpMetadata: { contentType: AVATAR_TYPES[upload.ext] },
    customMetadata: { userId, uploadedAt: new Date(now).toISOString() },
  });
  return key;
}

/** Every key under the player's prefix (follows the list cursor). */
export async function listAvatarKeys(bucket: AvatarBucket, userId: string): Promise<string[]> {
  const prefix = avatarPrefix(userId);
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    for (const o of page.objects) keys.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

/**
 * Deletes every object under the player's prefix except `keep` (the avatar just
 * uploaded). Returns the deleted keys. R2 takes at most 1000 keys per delete.
 */
export async function deleteAvatars(bucket: AvatarBucket, userId: string, keep?: string): Promise<string[]> {
  const doomed = (await listAvatarKeys(bucket, userId)).filter((k) => k !== keep);
  for (let i = 0; i < doomed.length; i += 1000) await bucket.delete(doomed.slice(i, i + 1000));
  return doomed;
}

/** The stored object for a /media/avatars/… key, or null when the key is malformed or absent. */
export async function getAvatar(bucket: AvatarBucket, key: string): Promise<R2ObjectBody | null> {
  if (!parseAvatarKey(key)) return null;
  return bucket.get(key);
}
