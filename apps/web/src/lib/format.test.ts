import { describe, expect, it } from "bun:test";
import { compactCount, timeAgo } from "./format";

describe("compactCount", () => {
  it("rounds down to K/M/B with one decimal and the locale's decimal mark", () => {
    expect(compactCount(0, "vi")).toBe("0");
    expect(compactCount(950, "vi")).toBe("950");
    expect(compactCount(1000, "vi")).toBe("1K");
    expect(compactCount(1234, "vi")).toBe("1,2K");
    expect(compactCount(1234, "en")).toBe("1.2K");
    expect(compactCount(15_690, "en")).toBe("15.6K");
    expect(compactCount(250_400, "en")).toBe("250K");
    expect(compactCount(999_999, "en")).toBe("999K");
    expect(compactCount(3_400_000, "vi")).toBe("3,4M");
    expect(compactCount(2_000_000_000, "en")).toBe("2B");
  });
});

describe("timeAgo", () => {
  const now = Date.UTC(2026, 10, 11, 10);
  it("picks the largest whole unit, and 'now' under a minute", () => {
    expect(timeAgo(now - 20_000, now, "en")).toBe("now");
    expect(timeAgo(now - 5 * 60_000, now, "en")).toBe("5 minutes ago");
    expect(timeAgo(now - 3 * 3_600_000, now, "en")).toBe("3 hours ago");
    expect(timeAgo(now - 86_400_000, now, "en")).toBe("yesterday");
    expect(timeAgo(now - 3 * 3_600_000, now, "vi")).toBe("3 giờ trước");
    // A clock a little ahead never reads as the future
    expect(timeAgo(now + 5000, now, "en")).toBe("now");
  });
});
