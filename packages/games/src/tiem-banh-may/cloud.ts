import type { CloudSave, GameStorage, ScoreReport } from "../core";
import { type SaveData, newGame } from "./logic";
import { parseSave } from "./save";

// The bakery lives on the player's account, in one of SLOTS save slots. Every
// change is written to a local backup at once and to the server shortly after
// (coalesced), so closing the tab mid-save loses nothing: the next load finds
// the backup and sends it.

export type SyncStatus = "idle" | "saving" | "offline" | "conflict";

interface Backup {
  /** Server version this data was built on. */
  base: number;
  data: SaveData;
  score?: ScoreReport;
}

/** Bakeries per account (the manifest's `saveSlots`). */
export const SLOTS = 3;

/** One slot as the picker shows it: its save, or null while empty. */
export interface SlotSummary {
  slot: number;
  save: SaveData | null;
}

// Slot 0 keeps the key from before slots existed, so an unsent backup survives
const backupKey = (playerId: string, slot: number) =>
  slot === 0 ? `backup:${playerId}` : `backup:${playerId}:${slot}`;

/** Every slot, newest data first: an unsent local backup beats the server's copy. */
export async function listSlots(
  cloud: CloudSave,
  storage: GameStorage,
): Promise<SlotSummary[]> {
  const saved = await cloud.list();
  return Array.from({ length: SLOTS }, (_, slot) => {
    const remote = saved.find((s) => s.slot === slot);
    const backup = storage.get<Backup | null>(
      backupKey(cloud.playerId, slot),
      null,
    );
    const local =
      backup && backup.base === (remote?.version ?? 0)
        ? parseSave(backup.data)
        : null;
    return { slot, save: local ?? (remote ? parseSave(remote.data) : null) };
  });
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
    readonly slot: number,
  ) {}

  private get key() {
    return backupKey(this.cloud.playerId, this.slot);
  }

  /** The player's bakery: the server's copy, or a newer unsent local one, or a new one. Throws when offline. */
  async load(): Promise<SaveData> {
    const slot = await this.cloud.load(this.slot);
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
        this.slot,
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

  /** Empty this slot for good, here and on the server. Throws when offline. */
  async erase() {
    this.dispose();
    // Let a save already on its way land first, so the delete comes after it
    while (this.busy) await new Promise((r) => setTimeout(r, 50));
    this.storage.set(this.key, null);
    await this.cloud.remove(this.slot);
  }

  dispose() {
    // The backup is already on disk; the next load sends it
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
