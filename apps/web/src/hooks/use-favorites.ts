import { useEffect } from "react";
import { useSession } from "#/hooks/use-session";
import { useFavoritesStore } from "#/stores/favorites";

/** Favourite games for the signed-in player; `slugs` is undefined while loading or signed out. */
export function useFavorites() {
  const session = useSession();
  const userId = session.data?.user?.id ?? null;
  const { slugs, load, toggle, userId: loadedFor } = useFavoritesStore();
  useEffect(() => {
    if (userId) load(userId);
  }, [userId, load]);
  const mine = userId && loadedFor === userId ? slugs : undefined;
  return {
    signedIn: userId !== null,
    pending: session.isPending || (userId !== null && mine === undefined),
    slugs: mine,
    isFavorite: (slug: string) => mine?.includes(slug) ?? false,
    toggle,
  };
}
