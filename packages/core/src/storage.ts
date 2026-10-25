export interface GameStorage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

export function createStorage(namespace: string): GameStorage {
  const prefix = `engames:${namespace}:`;
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const raw = localStorage.getItem(prefix + key);
        return raw === null ? fallback : (JSON.parse(raw) as T);
      } catch {
        return fallback;
      }
    },
    set<T>(key: string, value: T) {
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch {
        // Storage full or blocked (private mode): progress just won't persist.
      }
    },
  };
}
