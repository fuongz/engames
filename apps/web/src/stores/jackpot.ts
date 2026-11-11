import { create } from "zustand";
import { getJackpotFn, type JackpotState, type JackpotWinner } from "#/server/jackpot";

/** How often the pool is re-read while someone is watching and the tab is visible. */
const POLL_MS = 30_000;
/** localStorage: `wonAt` of the newest win this browser has already announced. */
const SEEN_KEY = "engames:portal:jackpotSeen";
/** On a first visit (nothing seen yet), only a win this recent is still news. */
const NEWS_MS = 24 * 3_600_000;

/**
 * The newest win, when this browser has not announced it yet, and marks it
 * seen so it is announced once (per browser, not per tab or ticker).
 */
function takeNews(state: JackpotState): JackpotWinner | null {
  const [latest] = state.recent;
  if (!latest) return null;
  try {
    const seen = Number(localStorage.getItem(SEEN_KEY));
    const fresh = seen > 0 ? latest.wonAt > seen : Date.now() - latest.wonAt < NEWS_MS;
    if (!seen || fresh) localStorage.setItem(SEEN_KEY, String(latest.wonAt));
    return fresh ? latest : null;
  } catch {
    // Storage blocked: never announce rather than announce on every poll
    return null;
  }
}

interface Jackpot {
  /** The pool and the last 20 winners, or null until the first answer (or offline). */
  state: JackpotState | null;
  /** Unix ms of the last answer. */
  loadedAt: number;
  /** A win that just arrived, for the ticker to announce once; null when there is none. */
  announcement: JackpotWinner | null;
  /** The ticker has finished announcing it. */
  dismissAnnouncement: () => void;
  /** Re-read now (shared by concurrent callers). Resolves null when offline. */
  refresh: () => Promise<JackpotState | null>;
  /** The server's pool after a contribution, without waiting for the next poll. */
  setPool: (pool: number) => void;
  /**
   * Keep the state fresh while the caller is mounted: poll every 30 s while the
   * tab is visible, and at once when it comes back after a while. Returns the
   * stop function; polling ends when the last watcher stops.
   */
  watch: () => () => void;
}

let inflight: Promise<JackpotState | null> | null = null;
let watchers = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/**
 * The shared Lucky Jar (docs/standards/jackpot.md). The top-bar ticker and the
 * Hall of Jackpot read it; a game's `ctx.jackpot.onState` subscribes to it, and
 * a roll refreshes it at once.
 */
export const useJackpot = create<Jackpot>()((set, get) => {
  const tick = () => {
    if (document.visibilityState === "visible") void get().refresh();
  };
  const startTimer = () => {
    clearInterval(timer);
    timer = setInterval(tick, POLL_MS);
  };
  const onVisibility = () => {
    if (document.visibilityState !== "visible") {
      clearInterval(timer);
      timer = undefined;
      return;
    }
    if (Date.now() - get().loadedAt >= POLL_MS) void get().refresh();
    startTimer();
  };

  return {
    state: null,
    loadedAt: 0,
    announcement: null,
    dismissAnnouncement: () => set({ announcement: null }),
    refresh: () => {
      inflight ??= getJackpotFn({ data: { limit: 20 } })
        .then((state) => {
          const news = takeNews(state);
          set(news ? { state, loadedAt: Date.now(), announcement: news } : { state, loadedAt: Date.now() });
          return state;
        })
        // Offline: keep showing what we had
        .catch(() => get().state)
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
    setPool: (pool) => {
      const { state } = get();
      if (state && state.pool !== pool) set({ state: { ...state, pool } });
    },
    watch: () => {
      watchers++;
      if (watchers === 1) {
        document.addEventListener("visibilitychange", onVisibility);
        if (Date.now() - get().loadedAt >= POLL_MS) void get().refresh();
        if (document.visibilityState === "visible") startTimer();
      }
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        watchers--;
        if (watchers === 0) {
          document.removeEventListener("visibilitychange", onVisibility);
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };
});
