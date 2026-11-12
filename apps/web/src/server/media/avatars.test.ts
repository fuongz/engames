import { describe, expect, it } from "bun:test";
import { AVATAR_MAX_BYTES, avatarKey } from "#/lib/avatar";
import { type AvatarBucket, deleteAvatars, getAvatar, listAvatarKeys, putAvatar, readAvatarUpload } from "./avatars";

type Stored = { bytes: Uint8Array; options: R2PutOptions | undefined };

/** In-memory stand-in for the four R2Bucket methods avatars.ts uses; lists 2 per page. */
function fakeBucket() {
  const store = new Map<string, Stored>();
  const deletes: string[][] = [];
  const bucket = {
    async put(key: string, value: Uint8Array, options?: R2PutOptions) {
      store.set(key, { bytes: value, options });
      return { key };
    },
    async get(key: string) {
      const hit = store.get(key);
      return hit ? { key, size: hit.bytes.byteLength } : null;
    },
    async list({ prefix = "", cursor }: R2ListOptions = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = keys.slice(start, start + 2);
      const truncated = start + 2 < keys.length;
      return { objects: page.map((key) => ({ key })), truncated, cursor: truncated ? String(start + 2) : undefined };
    },
    async delete(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      deletes.push(list);
      for (const k of list) store.delete(k);
    },
  };
  return { bucket: bucket as unknown as AvatarBucket, store, deletes };
}

const A = "userAAAA";
const B = "userBBBB";
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);

describe("readAvatarUpload", () => {
  it("accepts WebP, PNG and JPEG whose bytes match the declared type", async () => {
    expect((await readAvatarUpload(new Blob([WEBP], { type: "image/webp" }))).ext).toBe("webp");
    expect((await readAvatarUpload(new Blob([PNG], { type: "image/png" }))).ext).toBe("png");
    expect((await readAvatarUpload(new Blob([JPG], { type: "image/jpeg" }))).ext).toBe("jpg");
  });

  it("rejects non-blobs, empty files, other types and lying headers as avatar-invalid", async () => {
    for (const file of [
      null,
      "RIFF....WEBP",
      new Blob([], { type: "image/webp" }),
      new Blob([WEBP], { type: "image/gif" }),
      new Blob([WEBP], { type: "" }),
      new Blob([PNG], { type: "image/webp" }),
      new Blob(["<svg/>"], { type: "image/webp" }),
    ])
      await expect(readAvatarUpload(file)).rejects.toThrow("avatar-invalid");
  });

  it("rejects files over AVATAR_MAX_BYTES as avatar-too-large", async () => {
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
    big.set(WEBP);
    await expect(readAvatarUpload(new Blob([big], { type: "image/webp" }))).rejects.toThrow("avatar-too-large");
    const exact = new Uint8Array(AVATAR_MAX_BYTES);
    exact.set(WEBP);
    expect((await readAvatarUpload(new Blob([exact], { type: "image/webp" }))).ext).toBe("webp");
  });
});

describe("R2 helpers", () => {
  it("puts under the player's prefix with content type and metadata", async () => {
    const { bucket, store } = fakeBucket();
    const now = Date.UTC(2026, 10, 12, 9, 30);
    const key = await putAvatar(bucket, A, { bytes: WEBP, ext: "webp" }, now);
    expect(key).toBe(avatarKey(A, now));
    expect(store.get(key)?.options).toEqual({
      httpMetadata: { contentType: "image/webp" },
      customMetadata: { userId: A, uploadedAt: "2026-11-12T09:30:00.000Z" },
    });
  });

  it("lists across pages and deletes everything but the kept key, never another player's", async () => {
    const { bucket, store } = fakeBucket();
    for (const ts of [1, 2, 3, 4, 5]) await putAvatar(bucket, A, { bytes: WEBP, ext: "webp" }, ts);
    const other = await putAvatar(bucket, B, { bytes: JPG, ext: "jpg" }, 1);
    expect(await listAvatarKeys(bucket, A)).toHaveLength(5);

    const keep = avatarKey(A, 5);
    const deleted = await deleteAvatars(bucket, A, keep);
    expect(deleted.sort()).toEqual([1, 2, 3, 4].map((ts) => avatarKey(A, ts)));
    expect([...store.keys()].sort()).toEqual([keep, other].sort());

    expect(await deleteAvatars(bucket, A)).toEqual([keep]);
    expect([...store.keys()]).toEqual([other]);
  });

  it("does not call delete when there is nothing to remove", async () => {
    const { bucket, deletes } = fakeBucket();
    expect(await deleteAvatars(bucket, A)).toEqual([]);
    expect(deletes).toEqual([]);
  });

  it("gets only well-formed keys", async () => {
    const { bucket } = fakeBucket();
    const key = await putAvatar(bucket, A, { bytes: WEBP, ext: "webp" }, 9);
    expect(await getAvatar(bucket, key)).not.toBeNull();
    expect(await getAvatar(bucket, avatarKey(A, 10))).toBeNull();
    expect(await getAvatar(bucket, `avatars/${A}/../${B}/1.jpg`)).toBeNull();
  });
});
