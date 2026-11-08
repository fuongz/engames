import type { Locale } from "@web-games/core/i18n";

// Pure number formatting for the portal.

const UNITS = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
];

/**
 * A count rounded to K / M / B / T with at most one decimal, in the locale's
 * decimal mark: 950 → "950", 1234 → "1,2K" (vi) / "1.2K" (en), 15_600 → "15,6K",
 * 250_000 → "250K", 3_400_000 → "3,4M". Rounds down so it never overstates.
 */
export function compactCount(n: number, locale: Locale): string {
  const v = Math.max(0, Math.floor(n));
  const unit = UNITS.find((u) => v >= u.value);
  if (!unit) return String(v);
  const scaled = v / unit.value;
  // One decimal below 100 of a unit, none above; floor so 999_999 is "999K", not "1000K"
  const shown = scaled < 100 ? Math.floor(scaled * 10) / 10 : Math.floor(scaled);
  const text = Number.isInteger(shown) ? String(shown) : shown.toFixed(1);
  return `${locale === "vi" ? text.replace(".", ",") : text}${unit.suffix}`;
}
