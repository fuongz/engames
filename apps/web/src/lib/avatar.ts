// Player avatars and display names: the pure half. Isomorphic, so the profile UI
// imports the same limits the server enforces. See docs/standards/avatars.md.
//
// Storage layout (R2 bucket bound as AVATARS):
//
//   avatars/<userId>/<epochMs>.<ext>      ext: webp (preferred) | png | jpg
//
// One prefix per player, so listing `avatars/<userId>/` shows every object that
// player owns. A key is never reused (the timestamp changes on every upload), which
// is what lets /media/* be served `immutable`: a new avatar is a new URL.

/** Edge of the square the UI crops and encodes to before upload. */
export const AVATAR_SIZE = 512;
/** Upload ceiling. A 512² WebP is ~20–60 KB; this leaves room for a JPEG fallback. */
export const AVATAR_MAX_BYTES = 300_000;
/** Longest display name, in code points, after sanitising. */
export const DISPLAY_NAME_MAX = 32;

/** The image formats an avatar may be stored in, keyed by file extension. */
export const AVATAR_TYPES = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
} as const;

export type AvatarExt = keyof typeof AVATAR_TYPES;
export type AvatarContentType = (typeof AVATAR_TYPES)[AvatarExt];

/** Better Auth ids are 32 alphanumerics; allow `-`/`_` and some slack, never `/` or `.`. */
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^avatars\/([A-Za-z0-9_-]{1,64})\/(\d{1,15})\.(webp|png|jpg)$/;

export const isAvatarUserId = (userId: string) => USER_ID_RE.test(userId);

/** The prefix holding every avatar object of one player (ends with `/`). */
export function avatarPrefix(userId: string): string {
  if (!isAvatarUserId(userId)) throw new Error(`invalid avatar user id: ${userId}`);
  return `avatars/${userId}/`;
}

/** The R2 key of an avatar uploaded at `ts` (epoch ms). */
export function avatarKey(userId: string, ts: number, ext: AvatarExt = "webp"): string {
  if (!Number.isSafeInteger(ts) || ts < 0) throw new Error(`invalid avatar timestamp: ${ts}`);
  return `${avatarPrefix(userId)}${ts}.${ext}`;
}

/** The public URL of an avatar key (served by routes/media.avatars.$userId.$file.ts). */
export const avatarUrl = (key: string) => `/media/${key}`;

export type AvatarKeyParts = { userId: string; uploadedAt: number; ext: AvatarExt; contentType: AvatarContentType };

/** Parses a key of exactly the shape avatarKey() writes, or null for anything else. */
export function parseAvatarKey(key: string): AvatarKeyParts | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const uploadedAt = Number(m[2]);
  if (!Number.isSafeInteger(uploadedAt)) return null;
  const ext = m[3] as AvatarExt;
  return { userId: m[1], uploadedAt, ext, contentType: AVATAR_TYPES[ext] };
}

/**
 * The image format of `bytes` by its magic number, or null when it is none of the
 * accepted ones. Trust this, never the client's declared `type`.
 *
 *   webp  "RIFF" ???? "WEBP"
 *   png   89 50 4E 47 0D 0A 1A 0A
 *   jpg   FF D8 FF
 */
export function sniffAvatarType(bytes: Uint8Array): AvatarExt | null {
  const at = (offset: number, sig: number[]) => sig.every((b, i) => bytes[offset + i] === b);
  if (bytes.length >= 12 && at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "webp";
  if (bytes.length >= 8 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (bytes.length >= 3 && at(0, [0xff, 0xd8, 0xff])) return "jpg";
  return null;
}

// Control characters (C0, DEL, C1) and the bidi embedding/override/isolate marks,
// which let a name reorder the text around it on the leaderboard. ZWJ (U+200D) stays
// allowed: emoji sequences need it.
const FORBIDDEN_RE = /[\p{Cc}‎‏‪-‮⁦-⁩]/u;

/**
 * A display name as stored: NFC, trimmed, inner whitespace collapsed to one space,
 * 1..DISPLAY_NAME_MAX code points, no control or bidi-override characters. Null when
 * nothing acceptable is left (the server answers `name-invalid`).
 */
export function sanitizeDisplayName(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > DISPLAY_NAME_MAX * 8) return null;
  const name = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (FORBIDDEN_RE.test(name)) return null;
  const length = [...name].length;
  return length >= 1 && length <= DISPLAY_NAME_MAX ? name : null;
}
