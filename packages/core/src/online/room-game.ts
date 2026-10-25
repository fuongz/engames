// What a game implements to be played online. The realtime Worker drives any
// RoomGame the same way, so a new online game needs no server changes.

export interface Seated {
  name: string;
}

export interface RoomGame<Input = unknown> {
  slug: string;
  minPlayers: number;
  maxPlayers: number;
  /** Simulation steps per second; snapshots go out at half this rate. */
  tickRate: number;
  create(seed: number, humans: Seated[]): RoomSim<Input>;
  /** Untrusted input from a socket → a valid Input, or null to drop it. The only door into the simulation. */
  parseInput(raw: { move: { x: number; y: number }; actions: unknown[] }): Input | null;
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
  results(): { seat: number; score: number; detail: string }[];
}
