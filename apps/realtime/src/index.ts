import { isRoomCode, verifyTicket } from "@web-games/core/online";
import { findOnlineGame } from "@web-games/games/online";

export { GameRoom } from "./game-room";

// engames-realtime: checks the join ticket and the Origin, then hands the
// socket to the room's Durable Object. Route: /rooms/<slug>/<code>?ticket=…

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");

    const match = /^\/rooms\/([a-z0-9-]{1,40})\/([A-Z0-9]{6})$/.exec(url.pathname);
    if (!match) return new Response("not found", { status: 404 });
    const [, slug, code] = match;
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });

    const origin = request.headers.get("Origin") ?? "";
    const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    if (!allowed.includes(origin)) return new Response("forbidden origin", { status: 403 });
    if (!isRoomCode(code) || !findOnlineGame(slug)) return new Response("unknown room", { status: 404 });

    const claims = await verifyTicket(env.TICKET_SECRET, url.searchParams.get("ticket") ?? "");
    if (!claims || claims.s !== slug || claims.r !== code) return new Response("bad ticket", { status: 401 });

    const headers = new Headers(request.headers);
    headers.set("x-claims", JSON.stringify(claims));
    return env.ROOMS.getByName(`${slug}:${code}`).fetch(new Request(request, { headers }));
  },
} satisfies ExportedHandler<Env>;
