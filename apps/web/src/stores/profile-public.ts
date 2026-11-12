import { create } from "zustand";
import { setProfilePublicFn } from "#/server/profile";

interface ProfilePublic {
  /** What the player chose this session, over the session's `user.profilePublic`; null: not changed. */
  value: boolean | null;
  /** Whose choice it is, so another account never inherits it. */
  userId: string | null;
  pending: boolean;
  /** Save the choice; shows it at once and rolls back if the server refuses. */
  set: (userId: string, on: boolean) => Promise<void>;
}

/**
 * Whether others may open the player's profile at /u/<id>
 * (docs/standards/checkin.md §6). The session's user row carries the saved
 * value; this keeps a change visible everywhere (both account menus, the
 * profile page) without refetching the session.
 */
export const useProfilePublic = create<ProfilePublic>()((set, get) => ({
  value: null,
  userId: null,
  pending: false,
  set: async (userId, on) => {
    const before = get().userId === userId ? get().value : null;
    set({ userId, value: on, pending: true });
    try {
      const saved = await setProfilePublicFn({ data: { public: on } });
      if (get().userId === userId) set({ value: saved, pending: false });
    } catch {
      if (get().userId === userId) set({ value: before, pending: false });
    }
  },
}));

/** The value to show: this session's choice when there is one, else the session's own (default on). */
export function profilePublicOf(state: ProfilePublic, userId: string | undefined, fromSession: unknown): boolean {
  if (userId && state.userId === userId && state.value !== null) return state.value;
  return fromSession !== false;
}
