import type { ServerMessage, TicketClaims } from "@web-games/core/online";
import { onlineGames } from "@web-games/games/online";
import { describe, expect, it } from "vitest";
import { type Conn, type MatchResult, RoomCore } from "./room-core";

const game = onlineGames["ky-tuc-xa"];

class FakeConn implements Conn {
  inbox: ServerMessage[] = [];
  closed: number | null = null;
  send(text: string) {
    this.inbox.push(JSON.parse(text));
  }
  close(code: number) {
    this.closed = code;
  }
  last<T extends ServerMessage["t"]>(t: T) {
    return this.inbox.filter((m) => m.t === t).at(-1) as Extract<ServerMessage, { t: T }> | undefined;
  }
}

function setup() {
  let now = 1000;
  let ticking: number | null = null;
  const results: MatchResult[][] = [];
  const room = new RoomCore("ky-tuc-xa", "ABC234", game, { setTicking: (ms) => (ticking = ms), onResults: (r) => results.push(r) }, () => now);
  const claims = (p: string, u: string | null = null): TicketClaims => ({ r: "ABC234", s: "ky-tuc-xa", p, n: p.toUpperCase(), u, e: now + 60_000 });
  const join = (p: string, u: string | null = null) => {
    const c = new FakeConn();
    room.join(claims(p, u), c);
    now += 1;
    return c;
  };
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 50) {
      now += 50;
      room.tick();
    }
  };
  return { room, join, advance, results, ticking: () => ticking, claims };
}

describe("RoomCore lobby", () => {
  it("the first player hosts; everyone sees everyone", () => {
    const { join } = setup();
    const a = join("a");
    const b = join("b");
    expect(a.last("lobby")?.host).toBe("a");
    expect(b.last("lobby")?.players.map((p) => p.id)).toEqual(["a", "b"]);
    expect(b.last("lobby")?.you).toBe("b");
  });

  it("only the host starts, and a full room refuses the seventh", () => {
    const { room, join } = setup();
    const conns = ["a", "b", "c", "d", "e", "f"].map((p) => join(p));
    const late = join("g");
    expect(late.last("error")?.code).toBe("room-full");
    expect(late.closed).toBe(4003);
    room.message("b", { t: "start" });
    expect(conns[1].last("error")?.code).toBe("not-host");
    expect(room.playing).toBe(false);
  });

  it("the host leaving hands hosting to the next in line", () => {
    const { room, join } = setup();
    const a = join("a");
    const b = join("b");
    room.leave("a", a);
    expect(b.last("lobby")?.host).toBe("b");
  });
});

describe("RoomCore match", () => {
  it("starts with a seat per player and ticks at the game's rate", () => {
    const { room, join, ticking } = setup();
    const a = join("a");
    const b = join("b");
    room.message("a", { t: "start" });
    expect(ticking()).toBe(1000 / game.tickRate);
    expect(a.last("start")).toMatchObject({ you: 0, seats: [{ seat: 0, name: "A" }, { seat: 1, name: "B" }] });
    expect(b.last("start")?.you).toBe(1);
  });

  it("applies one queued input per tick and acks it in snapshots", () => {
    const { room, join, advance } = setup();
    const a = join("a");
    room.message("a", { t: "start" });
    const y0 = (a.inbox.find((m) => m.t === "snap") as { state: { occupants: { y: number }[] } } | undefined)?.state.occupants[0].y;
    for (let seq = 1; seq <= 4; seq++) room.message("a", { t: "in", seq, move: { x: 0, y: -1 }, actions: [] });
    advance(400);
    const snap = a.last("snap") as { acks: Record<number, number>; state: { occupants: { y: number }[] } };
    expect(snap.acks[0]).toBe(4);
    expect(snap.state.occupants[0].y).toBeLessThan(y0 ?? Number.POSITIVE_INFINITY);
  });

  it("a dropped seat goes on autopilot and the same player takes it back", () => {
    const { room, join, claims } = setup();
    const a = join("a");
    join("b");
    room.message("a", { t: "start" });
    room.leave("b");
    const b2 = new FakeConn();
    room.join(claims("b"), b2);
    expect(b2.last("start")?.you).toBe(1);
    expect(b2.last("snap")).toBeDefined();
    expect(a.last("lobby")?.players.find((p) => p.id === "b")?.connected).toBe(true);
  });

  it("someone arriving mid-match watches it (seat -1)", () => {
    const { room, join } = setup();
    join("a");
    room.message("a", { t: "start" });
    const c = join("c");
    expect(c.last("start")?.you).toBe(-1);
  });

  it("closes a socket that floods", () => {
    const { room, join } = setup();
    const a = join("a");
    for (let i = 0; i < 70; i++) room.message("a", { t: "ping", at: i });
    expect(a.closed).toBe(4008);
  });

  it("a finished match reports per-seat results, saves members only upstream, and returns to the lobby", () => {
    const { room, join, advance, results } = setup();
    const a = join("a", "user-a");
    join("b");
    room.message("a", { t: "start" });
    // Nobody sleeps: both are caught when night falls (30 s countdown)
    advance(32_000);
    const end = a.last("end");
    expect(end?.results.map((r) => r.seat)).toEqual([0, 1]);
    expect(results[0].map((r) => r.userId)).toEqual(["user-a", null]);
    expect(room.playing).toBe(false);
    expect(a.last("lobby")?.status).toBe("lobby");
  });
});
