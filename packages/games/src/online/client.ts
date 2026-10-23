import type { ClientMessage, ServerMessage } from "./protocol";

// The browser end of one room socket. Framework-free: the portal wraps it in
// a hook for the lobby and hands the game a narrow OnlineMatch view of it.

export type RoomClientEvent = ServerMessage | { t: "open" } | { t: "closed"; code: number };

const PING_EVERY_MS = 5000;

export class RoomClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(e: RoomClientEvent) => void>();
  private pinger = 0;
  /** Round-trip time of the last ping, ms (0 until measured). */
  rtt = 0;

  constructor(private readonly url: string) {}

  connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.emit({ t: "open" });
      this.pinger = window.setInterval(() => this.send({ t: "ping", at: performance.now() }), PING_EVERY_MS);
    };
    ws.onmessage = (e) => {
      let m: ServerMessage;
      try {
        m = JSON.parse(String(e.data)) as ServerMessage;
      } catch {
        return;
      }
      if (m.t === "pong") this.rtt = Math.round(performance.now() - m.at);
      this.emit(m);
    };
    ws.onclose = (e) => {
      window.clearInterval(this.pinger);
      if (this.ws === ws) this.ws = null;
      this.emit({ t: "closed", code: e.code });
    };
  }

  get open() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(m: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  on(fn: (e: RoomClientEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  close() {
    window.clearInterval(this.pinger);
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000, "bye");
  }

  private emit(e: RoomClientEvent) {
    for (const fn of this.listeners) fn(e);
  }
}
