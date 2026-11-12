# Avatars and display names

Players can upload or remove an avatar and change their display name. Avatars
live in Cloudflare R2; the name and the avatar URL live on the Better Auth `user`
row (`user.name`, `user.image`), so every surface that already shows a player
(leaderboard, profile, header) picks the change up without a new column.

| Piece | File |
| --- | --- |
| Limits, key layout, magic-byte sniffing, name sanitiser (pure, isomorphic) | `apps/web/src/lib/avatar.ts` |
| R2 reads/writes (server-only, bucket passed in) | `apps/web/src/server/media/avatars.ts` |
| The `AVATARS` binding | `apps/web/src/server/media/index.ts`, `wrangler.jsonc` `r2_buckets` |
| Server functions | `apps/web/src/server/profile.ts` |
| Public URL `/media/avatars/<userId>/<file>` | `apps/web/src/routes/media.avatars.$userId.$file.ts` |

## 1 · Storage layout

```
bucket  prod-engames            (binding AVATARS)
key     avatars/<userId>/<epochMs>.<ext>     ext = webp | png | jpg
url     /media/avatars/<userId>/<epochMs>.<ext>
```

- **One prefix per player.** `list({ prefix: "avatars/<userId>/" })` returns every
  object that player owns. Nothing else lives under `avatars/`.
- **A key is never reused.** The upload time is part of it, so the URL changes
  with every new avatar and `/media/*` is served
  `Cache-Control: public, max-age=31536000, immutable` with the R2 `ETag`.
- **Metadata:** `httpMetadata.contentType` is the sniffed type (`image/webp`,
  `image/png` or `image/jpeg`); `customMetadata` is
  `{ userId, uploadedAt: <ISO 8601> }`.
- **Cleanup:** after a successful upload, every other object under the player's
  prefix is deleted. Remove deletes them all. Cleanup is best-effort after the
  user row has changed. A leftover object is harmless: the next upload or remove
  clears it.
- `userId` is `[A-Za-z0-9_-]{1,64}`. Anything that does not parse as a key of
  exactly this shape is a 404 at `/media/*` and is refused by `avatarKey()`.

WebP is the format to send. PNG and JPEG are also accepted because some browsers
(Safari on older iOS) can't encode WebP from a canvas, and `toBlob("image/webp")`
quietly returns a PNG there. The UI should crop to `AVATAR_SIZE` (512²), try
WebP, and use `image/jpeg` (quality ≈ 0.85) when the blob is not WebP. A 512²
PNG photo usually goes over the size limit.

## 2 · Limits (`#/lib/avatar`)

| Constant | Value |
| --- | --- |
| `AVATAR_SIZE` | 512 (px, square) |
| `AVATAR_MAX_BYTES` | 300 000 |
| `DISPLAY_NAME_MAX` | 32 (code points, after sanitising) |

An upload is accepted only when it is a non-empty `Blob` of at most
`AVATAR_MAX_BYTES`. Its declared `type` must be one of the three formats, **and**
its magic bytes must say the same format (`RIFF…WEBP`, `89 50 4E 47 0D 0A 1A 0A`,
`FF D8 FF`). The stored type comes from the bytes. SVG, GIF and anything else are
rejected.

A display name is normalised to NFC, its whitespace is collapsed to single spaces
and trimmed, and it must then be 1–32 code points with no control characters (C0,
DEL, C1) and no bidi embedding, override or isolate marks. Emoji, including ZWJ
sequences, are allowed.

## 3 · Server functions (`#/server/profile`)

| Function | Input | Returns | Errors |
| --- | --- | --- | --- |
| `uploadAvatarFn` | `FormData` with `file` | `{ image: string }` | `sign-in-required`, `avatar-invalid`, `avatar-too-large` |
| `removeAvatarFn` | — | `{ image: null }` | `sign-in-required` |
| `updateDisplayNameFn` | `{ name: string }` | `{ name: string }` (as stored) | `sign-in-required`, `name-invalid` |

All three are POST. They write through Better Auth's `auth.api.updateUser`, not
through drizzle, because that call also re-signs the **session cookie cache**
(`session.cookieCache`, 5 min). Its `Set-Cookie` headers are forwarded on the
server function's response. Without that, `getSession` would keep returning the
old name and image for up to five minutes.

**What the UI must do after a successful call:** the cookie is already fresh, but
the in-memory session store of `authClient` (what `useSession()` reads) is not.
Refetch it once:

```ts
await authClient.getSession({ query: { disableCookieCache: true } });
// or, from a component, the `refetch()` returned by authClient.useSession()
```

`removeAvatarFn` sets `user.image` to null even when the current image is the
Google profile picture. That is intended: "remove" means no picture.

## 4 · Google sign-in never overwrites a custom name or avatar

Google's profile seeds `name` and `image` once, when the account is created. On
later sign-ins Better Auth updates the user only when
`socialProviders.google.overrideUserInfoOnSignIn` is true, and on account
linking only when `account.accountLinking.updateUserInfoOnLink` is true. Both are
off. The first is set to `false` explicitly in `server/auth/index.ts`, so nobody
turns it on to "refresh" avatars. Turning either on would wipe players' custom
names and avatars on their next login.
