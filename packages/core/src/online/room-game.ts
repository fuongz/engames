import type { Localized } from "../i18n";
import type { OnlineMode, Outcome, RoomSettings } from "./protocol";

// What a game implements to be played online. The realtime Worker drives any
// RoomGame the same way, so a new online game needs no server changes.

export interface Seated {
  name: string;
}

/** A choice the host makes in the lobby before a match, e.g. Caro's best-of-N. */
export interface RoomSetting {
  key: string;
  label: Localized<string>;
  choices: { value: string; label: Localized<string> }[];
  /** Must be one of `choices`. */
  default: string;
}

export interface RoomGame<Input = unknown> {
  slug: string;
  /** Which online board results go to ("<slug>:<mode>"); matches the manifest's `online.modes[0]`. */
  mode: OnlineMode;
  minPlayers: number;
  maxPlayers: number;
  /** Simulation steps per second; snapshots go out at half this rate. */
  tickRate: number;
  /** Lobby choices for the host; the match receives them, checked, in `create`. */
  settings?: RoomSetting[];
  create(seed: number, humans: Seated[], settings: RoomSettings): RoomSim<Input>;
  /** Untrusted input from a socket → a valid Input, or null to drop it. The only door into the simulation. */
  parseInput(raw: { move: { x: number; y: number }; actions: unknown[] }, context?: { cosmetics: readonly string[] }): Input | null;
}

export interface RoomSim<Input> {
  /** One step of 1/tickRate seconds with one input (or none) per human seat. */
  step(inputs: (Input | null)[]): void;
  /** A dropped player's seat plays itself until they return. */
  setAutopilot(seat: number, on: boolean): void;
  /** Everything a client needs to draw the match. JSON-safe. */
  snapshot(): unknown;
  /** Events since the last call, JSON-safe, for sound and effects. */
  drainEvents(): unknown[];
  readonly over: boolean;
  /** Per human seat, computed by the simulation (never by a client). */
  results(): { seat: number; score: number; detail: string; outcome?: Outcome }[];
}

/** Every setting at its default. */
export const defaultSettings = (game: Pick<RoomGame, "settings">): RoomSettings =>
  Object.fromEntries((game.settings ?? []).map((s) => [s.key, s.default]));

/**
 * `current` with each known key of `raw` applied when it is one of the setting's
 * choices; unknown keys and values are dropped.
 */
export function applySettings(game: Pick<RoomGame, "settings">, current: RoomSettings, raw: Record<string, unknown>): RoomSettings {
  const next = { ...defaultSettings(game), ...current };
  for (const s of game.settings ?? []) {
    const v = raw[s.key];
    if (typeof v === "string" && s.choices.some((c) => c.value === v)) next[s.key] = v;
  }
  return next;
}
