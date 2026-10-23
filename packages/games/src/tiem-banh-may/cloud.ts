import type { CloudSave, GameStorage, ScoreReport } from "../core";
import { type SaveData, newGame } from "./logic";
import { parseSave } from "./save";

// The bakery lives on the player's account. Every change is written to a local
// backup at once and to the server shortly after (coalesced), so closing the tab
// mid-save loses nothing: the next load finds the backup and sends it.

export type SyncStatus = "idle" | "saving" | "offline" | "conflict";

interface Backup {
  /** Server version this data was built on. */
  base: number;
  data: SaveData;
  score?: ScoreReport;
}

const DEBOUNCE = 800;
const RETRY_MIN = 4000;
const RETRY_MAX = 30000;

export class SaveSync {
  status: SyncStatus = "idle";
  private version = 0;
  private pending: Backup | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private busy = false;
  private retry = RETRY_MIN;
  private disposed = false;

  constructor(
    private cloud: CloudSave,
    private storage: GameStorage,
  ) {}

  private get key() {
    return `backup:${this.cloud.playerId}`;
  }

  /** The player's bakery: the server's copy, or a newer unsent local one, or a new one. Throws when offline. */
  async load(): Promise<SaveData> {
    const slot = await this.cloud.load();
    this.version = slot?.version ?? 0;
    const backup = this.storage.get<Backup | null>(this.key, null);
    const local =
      backup && backup.base === this.version ? parseSave(backup.data) : null;
    if (local && backup) {
      // Made here after the server's copy and never sent: it wins, and goes up now
      this.queue(local, backup.score, true);
      return local;
    }
    const remote = slot ? parseSave(slot.data) : null;
    if (remote) return remote;
    const fresh = newGame((Math.random() * 2 ** 31) | 0);
    this.queue(fresh, undefined, true);
    return fresh;
  }

  /** Save `data` soon (or now); `score` files the leaderboard entry with it. */
  queue(data: SaveData, score?: ScoreReport, now = false) {
    if (this.disposed || this.status === "conflict") return;
    // A score waiting to go up is kept until a later save carries its own
    this.pending = {
      base: this.version,
      data,
      score: score ?? this.pending?.score,
    };
    this.storage.set(this.key, this.pending);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), now ? 0 : DEBOUNCE);
  }

  private async flush() {
    if (this.busy || !this.pending || this.disposed) return;
    this.busy = true;
    const sending = this.pending;
    this.status = "saving";
    try {
      const result = await this.cloud.save(
        sending.data,
        this.version,
        sending.score,
      );
      if (!result.ok) {
        this.status = "conflict";
        this.pending = null;
        this.storage.set(this.key, null);
        return;
      }
      this.version = result.version;
      this.retry = RETRY_MIN;
      if (this.pending === sending) {
        this.pending = null;
        this.storage.set(this.key, null);
        this.status = "idle";
      } else if (this.pending) {
        // Newer data arrived while this one was in flight: rebase it and send
        this.pending = { ...this.pending, base: this.version };
        this.storage.set(this.key, this.pending);
        this.timer = setTimeout(() => void this.flush(), 0);
      }
    } catch {
      this.status = "offline";
      this.timer = setTimeout(() => void this.flush(), this.retry);
      this.retry = Math.min(RETRY_MAX, this.retry * 2);
    } finally {
      this.busy = false;
    }
  }

  dispose() {
    // The backup is already on disk; the next load sends it
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
