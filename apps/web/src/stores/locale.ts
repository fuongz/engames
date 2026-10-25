import { DEFAULT_LOCALE, isLocale, type Locale } from "@web-games/core/i18n";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authClient } from "#/lib/auth-client";
import { detectLocale } from "#/lib/i18n";

interface LocaleState {
  locale: Locale;
  /** False until the player (or their account) picks one; until then we follow the browser. */
  chosen: boolean;
}

/**
 * The UI language. Persisted per device; for signed-in players the account's
 * `user.locale` wins, so the choice follows them to other devices.
 * The prerendered shell is Vietnamese, and zustand's persist renders the initial
 * state during hydration, so there is no mismatch: the saved locale applies right after.
 */
export const useLocaleStore = create<LocaleState>()(
  persist((): LocaleState => ({ locale: DEFAULT_LOCALE, chosen: false }), { name: "engames:portal:locale" }),
);

const signedInUser = () => authClient.useSession.get().data?.user ?? null;

/** The player picked a language: keep it on this device and on their account. */
export function chooseLocale(locale: Locale) {
  useLocaleStore.setState({ locale, chosen: true });
  if (signedInUser()) void authClient.updateUser({ locale }).catch(() => {});
}

/**
 * Call once at startup. Follows the browser language on a first visit, keeps
 * <html lang> current, and syncs with the account whenever someone signs in:
 * an account that already has a language applies it here; one that doesn't
 * adopts the language in use.
 */
export function listenForLocale() {
  const state = useLocaleStore.getState();
  if (!state.chosen) useLocaleStore.setState({ locale: detectLocale(navigator.languages) });

  const applyLang = () => {
    document.documentElement.lang = useLocaleStore.getState().locale;
  };
  applyLang();
  const unsubscribeLang = useLocaleStore.subscribe(applyLang);

  let syncedUserId: string | null = null;
  const onSession = () => {
    const user = signedInUser();
    if (!user) {
      syncedUserId = null;
      return;
    }
    if (user.id === syncedUserId) return;
    syncedUserId = user.id;
    if (isLocale(user.locale)) useLocaleStore.setState({ locale: user.locale, chosen: true });
    else void authClient.updateUser({ locale: useLocaleStore.getState().locale }).catch(() => {});
  };
  onSession();
  const unsubscribeSession = authClient.useSession.listen(onSession);

  return () => {
    unsubscribeLang();
    unsubscribeSession();
  };
}
