import type { GameTickets } from "@web-games/core";
import { MAX_DEPOSIT } from "#/lib/tickets";
import { depositTicketsFn } from "#/server/tickets";
import { useTickets } from "#/stores/tickets";

// Satellite of game-player.tsx: the `ctx.tickets` it hands a ticket game
// (docs/standards/tickets.md).

/** How long deposits gather before they go to the server together. */
const BATCH_MS = 2000;

interface Waiting {
  amount: number;
  resolve: (r: { balance: number; accepted: number }) => void;
  reject: (e: unknown) => void;
}

/** A fetch that outlives the page, for the flush on `pagehide`. */
const keepaliveFetch = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, keepalive: true });

export interface TicketQueue {
  tickets: GameTickets;
  /** Send what is waiting now. `leaving`: the page is going away (keepalive). */
  flush(leaving?: boolean): void;
}

/**
 * `ctx.tickets` for one mount of a ticket game. Deposits are coalesced: they
 * gather for BATCH_MS and go out as one request (split at MAX_DEPOSIT, so a
 * legitimate burst is never clamped by the per-deposit cap). The owner flushes
 * on unmount and on `pagehide`. Each caller's promise settles with its share of
 * what the server accepted, first come first served.
 */
export function createTicketQueue(slug: string, userId: string): TicketQueue {
  let waiting: Waiting[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const send = async (batch: Waiting[], leaving: boolean) => {
    let left = batch.reduce((n, w) => n + w.amount, 0);
    let accepted = 0;
    let balance = useTickets.getState().balance ?? 0;
    try {
      while (left > 0) {
        const amount = Math.min(left, MAX_DEPOSIT);
        left -= amount;
        const r = await depositTicketsFn({
          data: { slug, amount },
          fetch: leaving ? keepaliveFetch : undefined,
        });
        accepted += r.accepted;
        balance = r.balance;
        // Today's cap is used up: the rest would be refused too
        if (r.clamped === "daily") break;
      }
    } catch (e) {
      if (accepted === 0) {
        for (const w of batch) w.reject(e);
        return;
      }
    }
    if (useTickets.getState().userId === userId) useTickets.getState().set(balance);
    for (const w of batch) {
      const mine = Math.min(w.amount, accepted);
      accepted -= mine;
      w.resolve({ balance, accepted: mine });
    }
  };

  const flush = (leaving = false) => {
    clearTimeout(timer);
    timer = undefined;
    if (waiting.length === 0) return;
    const batch = waiting;
    waiting = [];
    void send(batch, leaving);
  };

  const tickets: GameTickets = {
    balance: async () => {
      const state = useTickets.getState();
      if (state.userId === userId && state.balance !== null) return state.balance;
      return (await state.load(userId)) ?? 0;
    },
    deposit: (amount) =>
      new Promise((resolve, reject) => {
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          reject(new Error("bad-amount"));
          return;
        }
        waiting.push({ amount, resolve, reject });
        timer ??= setTimeout(flush, BATCH_MS);
      }),
    onBalance: (cb) =>
      useTickets.subscribe((s, prev) => {
        if (s.userId === userId && s.balance !== null && s.balance !== prev.balance) cb(s.balance);
      }),
  };

  return { tickets, flush };
}
