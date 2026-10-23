// The two languages the portal and every game speak. Games stay framework-free:
// they get the current locale through `GameContext.locale()` and keep their own
// strings as a `Localized` catalog next to the code that draws them.

export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";

/** One value per locale, e.g. `{ vi: "Chơi lại", en: "Play again" }`. */
export type Localized<T> = Record<Locale, T>;

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/** The locale a game should draw in right now. */
export function currentLocale(ctx: { locale?(): Locale }): Locale {
  return ctx.locale?.() ?? DEFAULT_LOCALE;
}
