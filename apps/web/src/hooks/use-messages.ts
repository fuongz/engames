import type { Locale } from "@web-games/games/i18n";
import { catalogs, type Messages } from "#/content/messages";
import { useLocaleStore } from "#/stores/locale";

/** The current UI language. */
export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

/** The portal copy in the current language: `const m = useMessages(); m.nav.library`. */
export function useMessages(): Messages {
  return catalogs[useLocale()];
}
