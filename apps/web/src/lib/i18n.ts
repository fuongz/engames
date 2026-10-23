import { DEFAULT_LOCALE, type Locale } from "@web-games/games/i18n";

// Pure helpers for the portal's two languages. The catalogs live in
// content/messages, the current choice in stores/locale, React access in
// hooks/use-messages.

export type { Locale } from "@web-games/games/i18n";

/** BCP 47 tag for Intl formatters and <html lang>. */
export function intlTag(locale: Locale) {
  return locale === "vi" ? "vi-VN" : "en-US";
}

/** First-visit guess: Vietnamese browsers get "vi", everyone else English. */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  const first = languages?.[0]?.toLowerCase();
  if (!first) return DEFAULT_LOCALE;
  return first.startsWith("vi") ? "vi" : "en";
}

/** Fill `{name}` placeholders: `fmt("Hạng #{rank}", { rank: 3 })`. */
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Catalog entries that change with a count. Vietnamese uses the same text for both. */
export interface Plural {
  one: string;
  other: string;
}

export function plural(locale: Locale, n: number, forms: Plural) {
  const form = new Intl.PluralRules(intlTag(locale)).select(n) === "one" ? forms.one : forms.other;
  return fmt(form, { n });
}
