import type { GameJackpot, JackpotRoll } from "@web-games/core";
import type { GameEvent } from "./logic";

// The machine's side of the shared Lucky Jar (Hũ may mắn, docs/standards/jackpot.md),
// kept out of game.ts so it can be tested without a canvas. It reads the
// machine's events and turns them into calls on `ctx.jackpot`:
//
// - every coin the robot jar eats (logic's `eaten` event) feeds the pool:
//   `contribute(coins)` per event, batched by the portal;
// - every Super spin that has paid asks for one roll (`roll()`), one at a time.
//
// Signed in only: a guest's trial machine never feeds the jar or rolls (the
// portal would refuse anyway). The pool itself is public, so `pool`/`cap` are
// followed for everyone. Every failure (offline, signed out meanwhile, the
// server) is swallowed: the game carries on, nothing blocks.

/** Coins the robot jar ate in these events (coins only: logic never emits `eaten` for capsules or cards). */
export function jarCoins(evs: readonly GameEvent[]): number {
  let n = 0;
  for (const e of evs) if (e.type === "eaten") n += e.coins;
  return n;
}

/** Super spins that finished paying in these events. */
export function supersPaid(evs: readonly GameEvent[]): number {
  let n = 0;
  for (const e of evs) if (e.type === "spinWin" && e.kind === "super") n++;
  return n;
}

export interface JarFeedOptions {
  /** `ctx.jackpot`: missing outside the portal (and online). */
  jackpot: GameJackpot | null | undefined;
  /** Whether the player is signed in on the account machine right now (not the guest trial). */
  signedIn: () => boolean;
  /** A roll asked for (the suspense starts). */
  onRollStart?: () => void;
  /** A roll answered: a win is already in the player's ticket wallet. */
  onRoll?: (r: JackpotRoll) => void;
  /** A roll failed (offline, signed out, rate limited by an error): drop the suspense silently. */
  onRollFailed?: () => void;
  /** The pool or its cap changed. */
  onPool?: (pool: number, cap: number) => void;
}

export interface JarFeed {
  /** Feed one step's events: contributions and rolls (signed in only). Returns what it asked for. */
  feed(evs: readonly GameEvent[]): { coins: number; rolls: number };
  /** The live pool and cap, once known (null until the first answer). */
  readonly pool: number | null;
  readonly cap: number | null;
  /** A roll is on its way (or waiting its turn). */
  readonly rolling: boolean;
  dispose(): void;
}

export function createJarFeed(o: JarFeedOptions): JarFeed {
  const jp = o.jackpot ?? null;
  let pool: number | null = null;
  let cap: number | null = null;
  let inFlight = false;
  /** Super spins that paid while a roll was still out: each gets its own roll after it. */
  let waiting = 0;
  let disposed = false;

  const setPool = (p: number, c: number | null) => {
    if (disposed || !Number.isFinite(p)) return;
    pool = p;
    if (c !== null && Number.isFinite(c)) cap = c;
    o.onPool?.(pool, cap ?? pool);
  };

  const off = jp?.onState((st) => setPool(st.pool, st.cap));
  jp?.state().then(
    (st) => setPool(st.pool, st.cap),
    () => {},
  );

  function roll() {
    if (!jp) return;
    inFlight = true;
    o.onRollStart?.();
    let p: Promise<JackpotRoll>;
    try {
      p = jp.roll();
    } catch {
      p = Promise.reject(new Error("roll"));
    }
    p.then(
      (r) => {
        if (disposed) return;
        if (Number.isFinite(r.pool)) setPool(r.pool, cap);
        o.onRoll?.(r);
      },
      () => {
        if (!disposed) o.onRollFailed?.();
      },
    ).finally(() => {
      inFlight = false;
      if (disposed) return;
      if (waiting > 0 && o.signedIn()) {
        waiting--;
        roll();
      } else waiting = 0;
    });
  }

  return {
    feed(evs) {
      if (!jp || disposed || !o.signedIn()) return { coins: 0, rolls: 0 };
      const coins = jarCoins(evs);
      if (coins > 0) jp.contribute(coins);
      const rolls = supersPaid(evs);
      for (let i = 0; i < rolls; i++) {
        if (inFlight) waiting++;
        else roll();
      }
      return { coins, rolls };
    },
    get pool() {
      return pool;
    },
    get cap() {
      return cap;
    },
    get rolling() {
      return inFlight || waiting > 0;
    },
    dispose() {
      disposed = true;
      off?.();
    },
  };
}
