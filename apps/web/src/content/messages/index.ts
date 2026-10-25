import type { Locale } from "@web-games/core/i18n";
import { en } from "./en";
import { type Messages, vi } from "./vi";

export type { Messages } from "./vi";

/** Every portal catalog by locale. Outside React, index with `useLocaleStore.getState().locale`. */
export const catalogs: Record<Locale, Messages> = { vi, en };
