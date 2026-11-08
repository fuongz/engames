import { create } from "zustand";
import { persist } from "zustand/middleware";
import { countPlay } from "#/server/stats";
import { usePlayCounts } from "./play-counts";

const RECENT_LIMIT = 12;
/** A device counts at most one play per game in this window, so refreshing doesn't inflate the count. */
const COUNT_EVERY_MS = 30 * 60 * 1000;

interface PlayStats {
  plays: Record<string, number>;
  /** Most recently played first. */
  recent: string[];
  /** When this device last added to each game's public play count (ms). */
  counted: Record<string, number>;
  recordPlay: (slug: string) => void;
}

/** Per-device play history, for the "Keep playing" shelf; also feeds the public play count. */
export const usePlayStats = create<PlayStats>()(
  persist(
    (set, get) => ({
      plays: {},
      recent: [],
      counted: {},
      recordPlay: (slug) => {
        const now = Date.now();
        const due = now - (get().counted[slug] ?? 0) >= COUNT_EVERY_MS;
        set((s) => ({
          plays: { ...s.plays, [slug]: (s.plays[slug] ?? 0) + 1 },
          recent: [slug, ...s.recent.filter((r) => r !== slug)].slice(0, RECENT_LIMIT),
          counted: due ? { ...s.counted, [slug]: now } : s.counted,
        }));
        if (due)
          countPlay({ data: { slug } })
            .then((plays) => usePlayCounts.getState().set(slug, plays))
            .catch(() => {});
      },
    }),
    { name: "engames:portal:stats" },
  ),
);
