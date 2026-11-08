import { create } from "zustand";
import { getPlayCounts } from "#/server/stats";

interface PlayCounts {
  /** Plays per game across every player, once loaded. */
  counts: Record<string, number> | null;
  load: () => void;
  /** The server's new count after this device counted a play. */
  set: (slug: string, plays: number) => void;
}

let loading = false;

/** Every game's play count, fetched once per visit and shared by every card. */
export const usePlayCounts = create<PlayCounts>()((set, get) => ({
  counts: null,
  load: () => {
    if (loading || get().counts) return;
    loading = true;
    getPlayCounts()
      .then((counts) => set((s) => ({ counts: { ...counts, ...s.counts } })))
      // Offline: cards simply show no count
      .catch(() => {})
      .finally(() => {
        loading = false;
      });
  },
  set: (slug, plays) => set((s) => ({ counts: { ...s.counts, [slug]: plays } })),
}));
