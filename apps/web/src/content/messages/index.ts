import type { Locale } from "@web-games/core/i18n";
import { en } from "./en";
import { type Messages, vi } from "./vi";

export type { Messages } from "./vi";

/** Every portal catalog by locale. In React use `useMessages()`; in a route's head(), lib/seo `headLocale`. */
export const catalogs: Record<Locale, Messages> = { vi, en };
