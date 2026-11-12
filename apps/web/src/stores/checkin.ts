import { create } from "zustand";
import { useLevel } from "#/stores/level";
import { type CheckinClaim, type CheckinState, claimCheckinFn, getCheckinFn } from "#/server/checkin";

interface Checkin {
  /** The signed-in player's check-in state, or null while unknown or signed out. */
  state: CheckinState | null;
  /** Whose state this is, so a different account never sees the last one's. */
  userId: string | null;
  /** Fetch it for `userId` (null: signed out, clear it). Cached until `nextResetAt`; `force` refetches. */
  load: (userId: string | null, force?: boolean) => Promise<CheckinState | null>;
  /**
   * Check in for today and keep this state in step. The caller hands the new
   * balance to stores/tickets when its tickets land (the chip counts up then).
   * Throws on a network or server error.
   */
  claim: () => Promise<CheckinClaim>;
}

let loading: { userId: string; promise: Promise<CheckinState | null> } | null = null;

/**
 * Today's check-in (docs/standards/checkin.md): the account button's red dot and
 * the profile's check-in track read it, so a claim on the profile clears the dot
 * at once. A light GET, cached for the Vietnam day it describes.
 */
export const useCheckin = create<Checkin>()((set, get) => ({
  state: null,
  userId: null,
  load: (userId, force = false) => {
    if (!userId) {
      set({ state: null, userId: null });
      return Promise.resolve(null);
    }
    const { state } = get();
    const fresh = state !== null && Date.now() < state.nextResetAt;
    if (!force && get().userId === userId && fresh) return Promise.resolve(state);
    if (get().userId !== userId) set({ state: null, userId });
    if (loading?.userId === userId) return loading.promise;
    const promise = getCheckinFn()
      .then((next) => {
        if (get().userId !== userId) return get().state;
        set({ state: next });
        return next;
      })
      // Offline: the dot simply stays hidden
      .catch(() => get().state)
      .finally(() => {
        if (loading?.promise === promise) loading = null;
      });
    loading = { userId, promise };
    return promise;
  },
  claim: async () => {
    const userId = get().userId;
    const result = await claimCheckinFn();
    if (get().userId === userId) set({ state: result.state });
    // A check-in earns XP: refresh the avatar's XP ring
    if (result.claimed && userId) void useLevel.getState().load(userId, true);
    return result;
  },
}));
