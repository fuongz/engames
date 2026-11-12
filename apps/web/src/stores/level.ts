import { create } from "zustand";
import { getMyProfileFn } from "#/server/profile";

export interface LevelInfo {
  level: number;
  /** XP into the current level. */
  xpIntoLevel: number;
  /** XP still needed for the next level. */
  xpToNext: number;
}

interface Level {
  /** The signed-in player's level, or null while unknown or signed out. */
  info: LevelInfo | null;
  /** Whose level this is, so a different account never sees the last one's. */
  userId: string | null;
  /** Fetch it for `userId` (null: signed out, clear it). Cached for the session; `force` refetches. */
  load: (userId: string | null, force?: boolean) => Promise<LevelInfo | null>;
}

let loading: { userId: string; promise: Promise<LevelInfo | null> } | null = null;

/**
 * The player's level and XP for the account avatar's XP ring
 * (docs/standards/checkin.md §6). Read once per session from the profile;
 * a check-in (which earns XP) refetches it.
 */
export const useLevel = create<Level>()((set, get) => ({
  info: null,
  userId: null,
  load: (userId, force = false) => {
    if (!userId) {
      set({ info: null, userId: null });
      return Promise.resolve(null);
    }
    const { info } = get();
    if (!force && get().userId === userId && info) return Promise.resolve(info);
    if (get().userId !== userId) set({ info: null, userId });
    if (!force && loading?.userId === userId) return loading.promise;
    const promise = getMyProfileFn()
      .then((p) => {
        if (get().userId !== userId) return get().info;
        const next = { level: p.level, xpIntoLevel: p.xpIntoLevel, xpToNext: p.xpToNext };
        set({ info: next });
        return next;
      })
      // Offline: the ring simply shows no progress
      .catch(() => get().info)
      .finally(() => {
        if (loading?.promise === promise) loading = null;
      });
    loading = { userId, promise };
    return promise;
  },
}));
