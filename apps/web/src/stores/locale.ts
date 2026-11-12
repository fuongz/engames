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
 * The player's language. Persisted per device; for signed-in players the account's
 * `user.locale` wins, so the choice follows them to other devices.
 * A `?lang=` in the URL outranks it (hooks/use-messages `useLocale`): that is the
 * page's language, the one the server rendered. Without one the server renders the
 * default, and zustand's persist renders the initial state during hydration, so
 * there is no mismatch: the saved locale applies right after.
 *
 * Never set this during SSR: one Worker isolate serves many requests at once.
 */
export const useLocaleStore = create<LocaleState>()(
  persist((): LocaleState => ({ locale: DEFAULT_LOCALE, chosen: false }), { name: "engames:portal:locale" }),
);

/** True once the app has mounted in a browser (set by listenForLocale, never on the server). */
let mounted = false;

/**
 * The player's language for code outside React (a route's head()). The default
 * until the app has mounted, so the head the client computes while hydrating
 * matches the server's.
 */
export function storedLocale(): Locale {
  return mounted ? useLocaleStore.getState().locale : DEFAULT_LOCALE;
}

const signedInUser = () => authClient.useSession.get().data?.user ?? null;

/**
 * The player picked a language: keep it on this device and on their account.
 * Call it through hooks/use-messages `useChooseLocale`, which also updates `?lang=`.
 */
export function chooseLocale(locale: Locale) {
  useLocaleStore.setState({ locale, chosen: true });
  if (signedInUser()) void authClient.updateUser({ locale }).catch(() => {});
}

/** The URL names a language: the store follows it without counting as the player's choice. */
export function followUrlLocale(locale: Locale) {
  if (useLocaleStore.getState().locale !== locale) useLocaleStore.setState({ locale });
}

/**
 * Call once after mount. Follows the browser language on a first visit, and
 * syncs with the account whenever someone signs in:
 * an account that already has a language applies it here; one that doesn't
 * adopts the language in use.
 */
export function listenForLocale() {
  mounted = true;
  const state = useLocaleStore.getState();
  if (!state.chosen) useLocaleStore.setState({ locale: detectLocale(navigator.languages) });

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

  return unsubscribeSession;
}
