import type { GameJackpot } from "@web-games/core";
import { catalogs } from "#/content/messages";
import { MAX_CONTRIBUTION_COINS } from "#/lib/jackpot";
import { contributeJackpotFn, rollJackpotFn } from "#/server/jackpot";
import { getTicketBalanceFn } from "#/server/tickets";
import { useJackpot } from "#/stores/jackpot";
import { useLocaleStore } from "#/stores/locale";
import { useTickets } from "#/stores/tickets";

// Satellite of game-player.tsx: the `ctx.jackpot` it hands a Lucky Jar game
// (docs/standards/jackpot.md).

/** How long contributions gather before they go to the server together. */
const BATCH_MS = 3000;
/** `state()` answers from the store when it is this fresh. */
const FRESH_MS = 10_000;

/** A fetch that outlives the page, for the flush on `pagehide`. */
const keepaliveFetch = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, keepalive: true });

export interface JackpotBridge {
  jackpot: GameJackpot;
  /** Send the waiting coins now. `leaving`: the page is going away (keepalive). */
  flush(leaving?: boolean): Promise<void>;
  /** Stop the polling `onState` started. Call after the last flush. */
  dispose(): void;
}

/**
 * `ctx.jackpot` for one mount of a jackpot game. `userId` null (signed out):
 * `state` and `onState` still work, `contribute` does nothing and `roll`
 * rejects. Contributions are coalesced: they gather for BATCH_MS and go out as
 * one request. The owner flushes on unmount and on `pagehide`; a roll flushes
 * first, so the pool it rolls against includes the coins just fed.
 */
export function createJackpotBridge(slug: string, userId: string | null): JackpotBridge {
  let coins = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopWatch: (() => void) | undefined;

  const flush = async (leaving = false) => {
    clearTimeout(timer);
    timer = undefined;
    if (coins <= 0 || !userId) return;
    const batch = Math.min(coins, MAX_CONTRIBUTION_COINS);
    coins = 0;
    try {
      const r = await contributeJackpotFn({ data: { slug, coins: batch }, fetch: leaving ? keepaliveFetch : undefined });
      useJackpot.getState().setPool(r.pool);
    } catch {
      // Offline or signed out meanwhile: the house keeps its tickets, nobody loses anything
    }
  };

  const jackpot: GameJackpot = {
    contribute: (n) => {
      if (!userId || !Number.isSafeInteger(n) || n <= 0) return;
      coins += n;
      timer ??= setTimeout(() => void flush(), BATCH_MS);
    },
    roll: async () => {
      if (!userId) throw new Error("sign-in-required");
      await flush();
      const r = await rollJackpotFn({ data: { slug } });
      // The ticker and Hall show the new round (and the win) at once
      void useJackpot.getState().refresh();
      if (r.won) {
        void getTicketBalanceFn()
          .then((wallet) => {
            if (wallet && useTickets.getState().userId === userId) useTickets.getState().set(wallet.balance);
          })
          .catch(() => {});
      }
      return r.won ? { won: true, amount: r.amount, pool: r.pool } : { won: false, pool: r.pool };
    },
    state: async () => {
      const store = useJackpot.getState();
      const s = store.state && Date.now() - store.loadedAt < FRESH_MS ? store.state : await store.refresh();
      if (!s) throw new Error("offline");
      const someone = catalogs[useLocaleStore.getState().locale].jackpot.someone;
      return {
        pool: s.pool,
        cap: s.cap,
        recent: s.recent.map((w) => ({ ...w, name: w.name || someone })),
      };
    },
    onState: (cb) => {
      stopWatch ??= useJackpot.getState().watch();
      return useJackpot.subscribe((s, prev) => {
        if (s.state && (s.state.pool !== prev.state?.pool || s.state.cap !== prev.state?.cap)) {
          cb({ pool: s.state.pool, cap: s.state.cap });
        }
      });
    },
  };

  return {
    jackpot,
    flush,
    dispose: () => {
      clearTimeout(timer);
      stopWatch?.();
      stopWatch = undefined;
    },
  };
}

/** Send what a mount's bridge still holds, stop its polling, and forget it. */
export function releaseJackpot(ref: { current: JackpotBridge | null }) {
  const bridge = ref.current;
  ref.current = null;
  if (!bridge) return;
  void bridge.flush();
  bridge.dispose();
}
