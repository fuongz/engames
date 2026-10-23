// Client-side helpers for online games, game-agnostic.

/**
 * Inputs sent but not yet confirmed by the server. On each snapshot the game
 * resets its own avatar to the server's position, drops what the server has
 * applied (`ack`) and replays the rest, so movement feels instant yet agrees
 * with the server.
 */
export class InputLog<I> {
  private seq = 0;
  private pending: { seq: number; input: I }[] = [];

  /** Record an input; returns the sequence number to send with it. */
  push(input: I) {
    this.seq += 1;
    this.pending.push({ seq: this.seq, input });
    // Never grow without bound if the server stops acking (about 6 s at 20 Hz)
    if (this.pending.length > 120) this.pending.shift();
    return this.seq;
  }

  ack(seq: number) {
    while (this.pending.length > 0 && this.pending[0].seq <= seq) this.pending.shift();
  }

  get unacked(): readonly { seq: number; input: I }[] {
    return this.pending;
  }
}

/** Ease a value toward a target, frame-rate independent (for other players and the hunter). */
export const approach = (from: number, to: number, dt: number, rate = 15) => from + (to - from) * (1 - Math.exp(-dt * rate));
