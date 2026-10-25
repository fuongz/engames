import {
  type ClientMessage,
  INPUT_QUEUE,
  type LobbyPlayer,
  MAX_MESSAGES_PER_SECOND,
  type RoomGame,
  type RoomSim,
  type SeatResult,
  type ServerMessage,
  type TicketClaims,
} from "@web-games/core/online";

// A room's rules, free of Durable Object APIs so vitest can drive it with fake
// sockets. GameRoom (game-room.ts) owns the sockets, the timer and storage and
// forwards everything here. Protocol: docs/standards/online-multiplayer.md §4.

export interface Conn {
  send(text: string): void;
  close(code: number, reason: string): void;
}

export interface Player {
  id: string;
  name: string;
  userId: string | null;
  ready: boolean;
  joinedAt: number;
  conn: Conn | null;
  seat: number | null;
  /** Inputs waiting for the next ticks, oldest first. */
  inputs: { seq: number; input: unknown }[];
  /** Last input seq the simulation applied for this player. */
  acked: number;
  /** Rate limit window. */
  window: { start: number; count: number };
}

export interface MatchResult extends SeatResult {
  userId: string | null;
}

export interface RoomHooks {
  /** Start (or stop) calling tick() every `ms`. */
  setTicking(ms: number | null): void;
  /** A match finished: save the members' scores. */
  onResults(results: MatchResult[]): void;
  /** Lobby state changed: persist what must survive hibernation. */
  onLobbyChange?(): void;
}

/** A match with nobody connected for this long is abandoned. */
const ABANDON_MS = 30_000;

export class RoomCore {
  readonly players = new Map<string, Player>();
  private sim: RoomSim<unknown> | null = null;
  private seed = 0;
  private tickNo = 0;
  private last = 0;
  private emptySince: number | null = null;

  constructor(
    readonly slug: string,
    readonly code: string,
    private readonly game: RoomGame,
    private readonly hooks: RoomHooks,
    private readonly now: () => number = Date.now,
  ) {}

  get playing() {
    return this.sim !== null;
  }

  /** The earliest-joined connected player hosts. */
  get host(): string | null {
    let host: Player | null = null;
    for (const p of this.players.values()) if (p.conn && (!host || p.joinedAt < host.joinedAt)) host = p;
    return host?.id ?? null;
  }

  // ---------------------------------------------------------------- sockets

  join(claims: TicketClaims, conn: Conn, restore?: { ready: boolean; joinedAt: number }): boolean {
    const known = this.players.get(claims.p);
    if (!known && this.players.size >= this.game.maxPlayers) {
      this.sendTo(conn, { t: "error", code: "room-full" });
      conn.close(4003, "room-full");
      return false;
    }
    // A second tab or a reconnect takes over the same player
    known?.conn?.close(4000, "replaced");
    const p: Player = known ?? {
      id: claims.p,
      name: claims.n,
      userId: claims.u,
      ready: restore?.ready ?? false,
      joinedAt: restore?.joinedAt ?? this.now(),
      conn: null,
      seat: null,
      inputs: [],
      acked: 0,
      window: { start: 0, count: 0 },
    };
    p.conn = conn;
    p.name = claims.n;
    this.players.set(p.id, p);
    if (this.sim && p.seat !== null) {
      this.sim.setAutopilot(p.seat, false);
      this.sendStart(p);
      this.sendTo(conn, this.snapMessage());
    } else if (this.sim) {
      // Arrived mid-match: watch it, play the next one
      this.sendStart(p);
      this.sendTo(conn, this.snapMessage());
    }
    this.broadcastLobby();
    return true;
  }

  leave(id: string, conn?: Conn) {
    const p = this.players.get(id);
    if (!p || (conn && p.conn !== conn)) return;
    p.conn = null;
    if (this.sim && p.seat !== null) {
      this.sim.setAutopilot(p.seat, true);
      p.inputs = [];
    } else {
      this.players.delete(id);
    }
    this.broadcastLobby();
  }

  message(id: string, m: ClientMessage | null) {
    const p = this.players.get(id);
    if (!p?.conn) return;
    // Flood guard
    const now = this.now();
    if (now - p.window.start >= 1000) p.window = { start: now, count: 0 };
    if (++p.window.count > MAX_MESSAGES_PER_SECOND) {
      p.conn.close(4008, "too-many-messages");
      return;
    }
    if (!m) {
      this.sendTo(p.conn, { t: "error", code: "bad-message" });
      return;
    }
    switch (m.t) {
      case "ping":
        this.sendTo(p.conn, { t: "pong", at: m.at });
        return;
      case "ready":
        if (this.sim) return;
        p.ready = m.ready;
        this.broadcastLobby();
        return;
      case "start":
        if (this.sim) return this.sendTo(p.conn, { t: "error", code: "in-progress" });
        if (this.host !== p.id) return this.sendTo(p.conn, { t: "error", code: "not-host" });
        this.start();
        return;
      case "again":
        this.sendTo(p.conn, this.lobbyMessage(p.id));
        return;
      case "in": {
        if (!this.sim || p.seat === null) return;
        const input = this.game.parseInput({ move: m.move, actions: m.actions });
        if (!input) return;
        p.inputs.push({ seq: m.seq, input });
        if (p.inputs.length > INPUT_QUEUE) p.inputs.splice(0, p.inputs.length - INPUT_QUEUE);
        return;
      }
    }
  }

  // ---------------------------------------------------------------- match

  private start() {
    const seated = [...this.players.values()]
      .filter((p) => p.conn)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .slice(0, this.game.maxPlayers);
    if (seated.length < this.game.minPlayers) return;
    seated.forEach((p, seat) => {
      p.seat = seat;
      p.inputs = [];
      p.acked = 0;
    });
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.sim = this.game.create(
      seed,
      seated.map((p) => ({ name: p.name })),
    );
    this.seed = seed;
    this.tickNo = 0;
    this.last = this.now();
    this.emptySince = null;
    for (const p of this.players.values()) if (p.conn) this.sendStart(p);
    this.broadcastLobby();
    this.hooks.setTicking(1000 / this.game.tickRate);
  }

  /** Called by the timer: runs as many fixed steps as real time allows (at most 5 to catch up). */
  tick() {
    const sim = this.sim;
    if (!sim) return;
    const stepMs = 1000 / this.game.tickRate;
    const now = this.now();
    let steps = Math.min(5, Math.floor((now - this.last) / stepMs));
    if (steps <= 0) return;
    this.last += steps * stepMs;
    if (now - this.last > stepMs * 5) this.last = now;

    const seated = [...this.players.values()].filter((p) => p.seat !== null);
    if (seated.some((p) => p.conn)) this.emptySince = null;
    else if (this.emptySince === null) this.emptySince = now;
    else if (now - this.emptySince > ABANDON_MS) return this.finish(false);

    while (steps-- > 0 && !sim.over) {
      const inputs: unknown[] = new Array(seated.length).fill(null);
      for (const p of seated) {
        const next = p.inputs.shift();
        if (next && p.seat !== null) {
          inputs[p.seat] = next.input;
          p.acked = next.seq;
        }
      }
      sim.step(inputs);
      this.tickNo++;
      const events = sim.drainEvents();
      if (events.length > 0) this.broadcast({ t: "ev", tick: this.tickNo, events });
      if (this.tickNo % 2 === 0 || sim.over) this.broadcast(this.snapMessage());
    }
    if (sim.over) this.finish(true);
  }

  private finish(completed: boolean) {
    const sim = this.sim;
    if (!sim) return;
    this.hooks.setTicking(null);
    const bySeat = new Map([...this.players.values()].filter((p) => p.seat !== null).map((p) => [p.seat, p]));
    if (completed) {
      const results: MatchResult[] = sim.results().map((r) => {
        const p = bySeat.get(r.seat);
        return { ...r, name: p?.name ?? "", userId: p?.userId ?? null };
      });
      this.broadcast({ t: "end", results: results.map(({ userId: _, ...r }) => r) });
      this.hooks.onResults(results);
    }
    this.sim = null;
    for (const [id, p] of this.players) {
      p.seat = null;
      p.ready = false;
      p.inputs = [];
      if (!p.conn) this.players.delete(id);
    }
    this.broadcastLobby();
  }

  // ---------------------------------------------------------------- messages

  private snapMessage(): ServerMessage {
    const acks: Record<number, number> = {};
    for (const p of this.players.values()) if (p.seat !== null) acks[p.seat] = p.acked;
    return { t: "snap", tick: this.tickNo, state: this.sim?.snapshot() ?? null, acks };
  }

  private sendStart(p: Player) {
    if (!p.conn) return;
    const seats = [...this.players.values()]
      .filter((q) => q.seat !== null)
      .map((q) => ({ seat: q.seat as number, name: q.name }))
      .sort((a, b) => a.seat - b.seat);
    this.sendTo(p.conn, { t: "start", seed: this.seed, tickRate: this.game.tickRate, you: p.seat ?? -1, seats });
  }

  lobbyMessage(you: string): ServerMessage {
    const players: LobbyPlayer[] = [...this.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ id: p.id, name: p.name, ready: p.ready, connected: p.conn !== null, member: p.userId !== null, seat: p.seat }));
    return {
      t: "lobby",
      code: this.code,
      slug: this.slug,
      status: this.sim ? "playing" : "lobby",
      host: this.host,
      you,
      players,
      maxPlayers: this.game.maxPlayers,
    };
  }

  private broadcastLobby() {
    for (const p of this.players.values()) if (p.conn) this.sendTo(p.conn, this.lobbyMessage(p.id));
    this.hooks.onLobbyChange?.();
  }

  private broadcast(m: ServerMessage) {
    const text = JSON.stringify(m);
    for (const p of this.players.values()) p.conn?.send(text);
  }

  private sendTo(conn: Conn, m: ServerMessage) {
    conn.send(JSON.stringify(m));
  }
}
