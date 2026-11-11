import { create } from "zustand";
import { getTicketBalanceFn } from "#/server/tickets";

interface Tickets {
  /** The signed-in player's balance, or null while unknown or signed out. */
  balance: number | null;
  /** Whose balance this is, so a different account never sees the last one's. */
  userId: string | null;
  /** Fetch the balance for `userId` (null: signed out, clear it). */
  load: (userId: string | null) => Promise<number | null>;
  /** The server's balance after a deposit. */
  set: (balance: number) => void;
}

let loading: { userId: string; promise: Promise<number | null> } | null = null;

/**
 * The shared arcade ticket balance. The top-bar / sidebar chip reads it, and a
 * game's `ctx.tickets.onBalance` subscribes to it, so a deposit in one place
 * shows everywhere at once (docs/standards/tickets.md).
 */
export const useTickets = create<Tickets>()((set, get) => ({
  balance: null,
  userId: null,
  load: (userId) => {
    if (!userId) {
      set({ balance: null, userId: null });
      return Promise.resolve(null);
    }
    if (get().userId === userId && get().balance !== null)
      return Promise.resolve(get().balance);
    if (get().userId !== userId) set({ balance: null, userId });
    if (loading?.userId === userId) return loading.promise;
    const promise = getTicketBalanceFn()
      .then((wallet) => {
        // Signed out (or switched) while this was in flight: drop it
        if (get().userId !== userId) return get().balance;
        const balance = wallet?.balance ?? null;
        set({ balance });
        return balance;
      })
      // Offline: the chip simply stays hidden
      .catch(() => get().balance)
      .finally(() => {
        if (loading?.promise === promise) loading = null;
      });
    loading = { userId, promise };
    return promise;
  },
  set: (balance) => set({ balance }),
}));
