import { describe, expect, it } from "bun:test";
import { detectLocale, fmt, plural } from "#/lib/i18n";

describe("i18n helpers", () => {
  it("fills placeholders and leaves unknown ones alone", () => {
    expect(fmt("Hạng #{rank}", { rank: 3 })).toBe("Hạng #3");
    expect(fmt("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });

  it("picks English plural forms; Vietnamese has one", () => {
    const forms = { one: "{n} game", other: "{n} games" };
    expect(plural("en", 1, forms)).toBe("1 game");
    expect(plural("en", 4, forms)).toBe("4 games");
    expect(plural("vi", 1, { one: "{n} game", other: "{n} game!" })).toBe("1 game!");
  });

  it("guesses Vietnamese only for Vietnamese browsers", () => {
    expect(detectLocale(["vi-VN", "en"])).toBe("vi");
    expect(detectLocale(["en-US", "vi"])).toBe("en");
    expect(detectLocale(["fr"])).toBe("en");
    expect(detectLocale([])).toBe("vi");
  });
});
