import { create } from "zustand";
import { getFavorites, toggleFavorite } from "#/server/favorites";

interface Favorites {
  /** For whom `slugs` was loaded. */
  userId: string | null;
  /** Favourite game slugs, newest first; undefined until loaded. */
  slugs: string[] | undefined;
  load: (userId: string) => void;
  toggle: (slug: string) => Promise<void>;
}

/** The signed-in player's favourite games, shared by the heart, the cards and the Favourites page. */
export const useFavoritesStore = create<Favorites>()((set, get) => ({
  userId: null,
  slugs: undefined,
  load: (userId) => {
    if (get().userId === userId && get().slugs !== undefined) return;
    set({ userId, slugs: undefined });
    getFavorites()
      .then((slugs) => {
        if (get().userId === userId) set({ slugs: slugs ?? [] });
      })
      .catch(() => {
        if (get().userId === userId) set({ slugs: [] });
      });
  },
  toggle: async (slug) => {
    const before = get().slugs ?? [];
    const on = !before.includes(slug);
    // Optimistic: the heart fills at once, and empties again if the server says no
    set({ slugs: on ? [slug, ...before] : before.filter((s) => s !== slug) });
    try {
      await toggleFavorite({ data: { slug, on } });
    } catch {
      set({ slugs: before });
    }
  },
}));
