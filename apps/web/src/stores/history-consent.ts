import { create } from "zustand";
import { getHistoryConsent, setHistoryConsent } from "#/server/history";

interface HistoryConsent {
  /** undefined: not loaded; null: never asked; else the player's answer. */
  value: boolean | null | undefined;
  /** For whom `value` was loaded, so another account on this device asks again. */
  userId: string | null;
  load: (userId: string) => void;
  set: (enabled: boolean) => Promise<void>;
}

/** The signed-in player's "save my online match history" answer, shared by the lobby and the account menu. */
export const useHistoryConsentStore = create<HistoryConsent>()((set, get) => ({
  value: undefined,
  userId: null,
  load: (userId) => {
    if (get().userId === userId && get().value !== undefined) return;
    set({ userId, value: undefined });
    getHistoryConsent()
      .then((value) => {
        if (get().userId === userId) set({ value });
      })
      .catch(() => {});
  },
  set: async (enabled) => {
    const before = get().value;
    set({ value: enabled });
    try {
      await setHistoryConsent({ data: { enabled } });
    } catch {
      set({ value: before });
    }
  },
}));
