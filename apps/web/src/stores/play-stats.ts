import { create } from "zustand";
import { persist } from "zustand/middleware";

const RECENT_LIMIT = 12;

interface PlayStats {
  plays: Record<string, number>;
  /** Most recently played first. */
  recent: string[];
  recordPlay: (slug: string) => void;
}

/** Per-device play history, for the "Chơi tiếp" shelf. */
export const usePlayStats = create<PlayStats>()(
  persist(
    (set) => ({
      plays: {},
      recent: [],
      recordPlay: (slug) =>
        set((s) => ({
          plays: { ...s.plays, [slug]: (s.plays[slug] ?? 0) + 1 },
          recent: [slug, ...s.recent.filter((r) => r !== slug)].slice(0, RECENT_LIMIT),
        })),
    }),
    { name: "engames:portal:stats" },
  ),
);
