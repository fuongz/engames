import { describe, expect, it } from "bun:test";
import {
  AVATAR_MAX_BYTES,
  AVATAR_SIZE,
  DISPLAY_NAME_MAX,
  avatarKey,
  avatarPrefix,
  avatarUrl,
  parseAvatarKey,
  sanitizeDisplayName,
  sniffAvatarType,
} from "./avatar";

const USER = "aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1dE";

describe("constants", () => {
  it("match the documented limits", () => {
    expect(AVATAR_SIZE).toBe(512);
    expect(AVATAR_MAX_BYTES).toBe(300_000);
    expect(DISPLAY_NAME_MAX).toBe(32);
  });
});

describe("avatarKey / avatarUrl / parseAvatarKey", () => {
  it("builds one prefix per player and a timestamped key", () => {
    expect(avatarPrefix(USER)).toBe(`avatars/${USER}/`);
    expect(avatarKey(USER, 1_762_934_400_000)).toBe(`avatars/${USER}/1762934400000.webp`);
    expect(avatarKey(USER, 5, "jpg")).toBe(`avatars/${USER}/5.jpg`);
    expect(avatarUrl(avatarKey(USER, 5))).toBe(`/media/avatars/${USER}/5.webp`);
  });

  it("refuses ids and timestamps that would break the layout", () => {
    expect(() => avatarKey("../etc", 1)).toThrow();
    expect(() => avatarKey("a/b", 1)).toThrow();
    expect(() => avatarKey("", 1)).toThrow();
    expect(() => avatarKey(USER, -1)).toThrow();
    expect(() => avatarKey(USER, 1.5)).toThrow();
  });

  it("round-trips what avatarKey writes", () => {
    expect(parseAvatarKey(avatarKey(USER, 1_762_934_400_000))).toEqual({
      userId: USER,
      uploadedAt: 1_762_934_400_000,
      ext: "webp",
      contentType: "image/webp",
    });
    expect(parseAvatarKey(avatarKey(USER, 7, "png"))?.contentType).toBe("image/png");
  });

  it("rejects every other shape", () => {
    for (const key of [
      `avatars/${USER}/1.gif`,
      `avatars/${USER}/abc.webp`,
      `avatars/${USER}/1.webp/x`,
      `avatars/${USER}/.webp`,
      `avatars/../1.webp`,
      `avatars/${USER}/1.WEBP`,
      `media/avatars/${USER}/1.webp`,
      `/avatars/${USER}/1.webp`,
      `avatars/${USER}/1.webp?x=1`,
      `avatars/${USER}/1234567890123456.webp`,
    ])
      expect(parseAvatarKey(key)).toBeNull();
  });
});

describe("sniffAvatarType", () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  it("reads the magic number", () => {
    expect(sniffAvatarType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56))).toBe("webp");
    expect(sniffAvatarType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("png");
    expect(sniffAvatarType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
  });
  it("rejects anything else, including a RIFF that is not WebP", () => {
    expect(sniffAvatarType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20))).toBeNull();
    expect(sniffAvatarType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffAvatarType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBeNull();
    expect(sniffAvatarType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffAvatarType(bytes())).toBeNull();
  });
});

describe("sanitizeDisplayName", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeDisplayName("  Phương   Trịnh  ")).toBe("Phương Trịnh");
    expect(sanitizeDisplayName("a\tb\nc d e")).toBe("a b c d e");
  });

  it("normalises to NFC so length counts letters, not combining marks", () => {
    const decomposed = "Ph\u01b0\u01a1ng".normalize("NFD");
    expect(sanitizeDisplayName(decomposed)).toBe(decomposed.normalize("NFC"));
    expect(sanitizeDisplayName("ệ".normalize("NFD").repeat(DISPLAY_NAME_MAX))).toBe("ệ".repeat(DISPLAY_NAME_MAX));
  });

  it("enforces 1..DISPLAY_NAME_MAX code points", () => {
    expect(sanitizeDisplayName("")).toBeNull();
    expect(sanitizeDisplayName("   \n ")).toBeNull();
    expect(sanitizeDisplayName("x")).toBe("x");
    expect(sanitizeDisplayName("x".repeat(DISPLAY_NAME_MAX))).toBe("x".repeat(DISPLAY_NAME_MAX));
    expect(sanitizeDisplayName("x".repeat(DISPLAY_NAME_MAX + 1))).toBeNull();
    // An emoji is one code point (two UTF-16 units)
    expect(sanitizeDisplayName("🎮".repeat(DISPLAY_NAME_MAX))).toBe("🎮".repeat(DISPLAY_NAME_MAX));
    expect(sanitizeDisplayName("x".repeat(10_000))).toBeNull();
  });

  it("rejects control and bidi-override characters but keeps emoji joiners", () => {
    expect(sanitizeDisplayName("bad\u0000name")).toBeNull();
    expect(sanitizeDisplayName("bad\u007fname")).toBeNull();
    expect(sanitizeDisplayName("bad\u0085name")).toBeNull(); // NEL is C1, not JS whitespace
    expect(sanitizeDisplayName("bad\u009bname")).toBeNull();
    expect(sanitizeDisplayName("evil‮gnp.exe")).toBeNull();
    expect(sanitizeDisplayName("evil⁧x")).toBeNull();
    expect(sanitizeDisplayName("👩‍💻 dev")).toBe("👩‍💻 dev");
  });
});
