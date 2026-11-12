import { useNavigate } from "@tanstack/react-router";
import type { Locale } from "@web-games/core/i18n";
import { createContext, use, useCallback } from "react";
import { catalogs, type Messages } from "#/content/messages";
import { langParam } from "#/lib/seo";
import { chooseLocale, useLocaleStore } from "#/stores/locale";

/**
 * The language the URL asks for (`?lang=`), provided by the root route for each
 * request. A context, not the store: the server renders many requests at once in
 * one isolate, so per-request state must never live in a module-level store.
 */
export const UrlLocaleContext = createContext<Locale | undefined>(undefined);

/**
 * The current UI language: the URL's when it names one, so the server and the
 * hydrating client render the same page; otherwise the player's (stores/locale).
 */
export function useLocale(): Locale {
  const fromUrl = use(UrlLocaleContext);
  const stored = useLocaleStore((s) => s.locale);
  return fromUrl ?? stored;
}

/** The portal copy in the current language: `const m = useMessages(); m.nav.library`. */
export function useMessages(): Messages {
  return catalogs[useLocale()];
}

/**
 * Switch language: saves the choice (stores/locale `chooseLocale`) and rewrites
 * `?lang=` in place, so the URL always names the language on screen.
 */
export function useChooseLocale() {
  const navigate = useNavigate();
  return useCallback(
    (locale: Locale) => {
      chooseLocale(locale);
      void navigate({ to: ".", search: (prev) => ({ ...prev, lang: langParam(locale) }), hash: true, replace: true, resetScroll: false });
    },
    [navigate],
  );
}
