import { useEffect } from "react";
import { useSession } from "#/hooks/use-session";
import { useHistoryConsentStore } from "#/stores/history-consent";

/**
 * Whether the signed-in player keeps their online match history. `value` is
 * undefined while loading or signed out, null if they were never asked.
 */
export function useHistoryConsent() {
  const session = useSession();
  const userId = session.data?.user?.id ?? null;
  const { value, load, set, userId: loadedFor } = useHistoryConsentStore();
  useEffect(() => {
    if (userId) load(userId);
  }, [userId, load]);
  return { value: userId && loadedFor === userId ? value : undefined, set, signedIn: userId !== null };
}
