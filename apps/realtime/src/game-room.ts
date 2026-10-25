import { DurableObject } from "cloudflare:workers";
import { type TicketClaims, boardKey, hmac, parseClientMessage } from "@web-games/core/online";
import { findOnlineGame } from "@web-games/games/online";
import { type Conn, type MatchResult, RoomCore } from "./room-core";

/** What each socket carries through hibernation (≤ 16 KB). */
interface Attachment {
  claims: TicketClaims;
  ready: boolean;
  joinedAt: number;
}

/**
 * One online room. Sockets use the Hibernation API, so an idle lobby or a
 * finished room sleeps without dropping anyone; a running match keeps the
 * object awake with its 20 Hz timer. The rules live in RoomCore.
 */
export class GameRoom extends DurableObject<Env> {
  private core: RoomCore | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** The room for this object, rebuilt from the sockets' attachments after a wake-up. */
  private room(claims?: TicketClaims): RoomCore | null {
    if (this.core) return this.core;
    const sockets = this.ctx.getWebSockets();
    const first = claims ?? (sockets[0]?.deserializeAttachment() as Attachment | undefined)?.claims;
    const game = first && findOnlineGame(first.s);
    if (!first || !game) return null;
    const core = new RoomCore(first.s, first.r, game, {
      setTicking: (ms) => this.setTicking(ms),
      onResults: (results) => this.ctx.waitUntil(this.postResults(first.s, first.r, results)),
      onLobbyChange: () => this.saveAttachments(),
    });
    this.core = core;
    for (const ws of sockets) {
      const a = ws.deserializeAttachment() as Attachment;
      core.join(a.claims, conn(ws), { ready: a.ready, joinedAt: a.joinedAt });
    }
    return core;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    const claims = JSON.parse(request.headers.get("x-claims") ?? "null") as TicketClaims | null;
    const core = claims && this.room(claims);
    if (!claims || !core) return new Response("unknown game", { status: 404 });

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [claims.p]);
    const attachment: Attachment = { claims, ready: false, joinedAt: Date.now() };
    server.serializeAttachment(attachment);
    core.join(claims, conn(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const a = ws.deserializeAttachment() as Attachment;
    const text = typeof message === "string" ? message : "";
    this.room()?.message(a.claims.p, parseClientMessage(text));
  }

  async webSocketClose(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Attachment;
    this.room()?.leave(a.claims.p, conn(ws));
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  private setTicking(ms: number | null) {
    if (this.timer) clearInterval(this.timer);
    this.timer = ms === null ? null : setInterval(() => this.core?.tick(), ms);
  }

  /** Keep ready flags and join order on the sockets, so a hibernated lobby wakes up as it was. */
  private saveAttachments() {
    const core = this.core;
    if (!core) return;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment;
      const p = core.players.get(a.claims.p);
      if (p) ws.serializeAttachment({ ...a, ready: p.ready, joinedAt: p.joinedAt } satisfies Attachment);
    }
  }

  /** Members' scores go to the portal, which owns the leaderboard (signed, see docs §8). */
  private async postResults(slug: string, code: string, results: MatchResult[]) {
    const members = results.filter((r) => r.userId !== null && r.score > 0);
    if (members.length === 0) return;
    const body = JSON.stringify({ board: boardKey(slug, "coop"), slug, code, at: Date.now(), results: members });
    try {
      const res = await fetch(`${this.env.PORTAL_URL}/api/online/results`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-signature": await hmac(this.env.TICKET_SECRET, body) },
        body,
      });
      if (!res.ok) console.error("results rejected", res.status, await res.text());
    } catch (err) {
      console.error("results failed", err);
    }
  }
}

/** The socket as RoomCore sees it. Identity matters: leave() ignores a socket that was replaced. */
const conns = new WeakMap<WebSocket, Conn>();
function conn(ws: WebSocket): Conn {
  let c = conns.get(ws);
  if (!c) {
    c = {
      send: (text) => {
        try {
          ws.send(text);
        } catch {
          // Socket already closing: its close handler cleans up
        }
      },
      close: (code, reason) => ws.close(code, reason),
    };
    conns.set(ws, c);
  }
  return c;
}
