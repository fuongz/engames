import { describe, expect, it } from "vitest";
import { games } from "../registry";
import { parseClientMessage } from "./protocol";
import { kyTucXaOnline } from "../ky-tuc-xa/online";
import { findOnlineGame, onlineGames } from "./registry";
import { TICKET_TTL_MS, signTicket, verifyTicket } from "./ticket";

const SECRET = "test-secret";
const claims = { r: "ABC234", s: "ky-tuc-xa", p: "guest-1", n: "An", u: null, e: Date.now() + TICKET_TTL_MS };

describe("tickets", () => {
  it("round-trips the claims", async () => {
    const t = await signTicket(SECRET, claims);
    expect(await verifyTicket(SECRET, t)).toEqual(claims);
  });

  it("rejects a wrong secret, a tampered payload and an expired ticket", async () => {
    const t = await signTicket(SECRET, claims);
    expect(await verifyTicket("other", t)).toBeNull();
    const [, sig] = t.split(".");
    const forged = btoa(JSON.stringify({ ...claims, p: "someone-else" })).replace(/=+$/, "");
    expect(await verifyTicket(SECRET, `${forged}.${sig}`)).toBeNull();
    expect(await verifyTicket(SECRET, t, claims.e + 1)).toBeNull();
    expect(await verifyTicket(SECRET, "garbage")).toBeNull();
  });
});

describe("protocol", () => {
  it("accepts well-formed messages and nothing else", () => {
    expect(parseClientMessage('{"t":"ready","ready":true}')).toEqual({ t: "ready", ready: true });
    expect(parseClientMessage('{"t":"in","seq":3,"move":{"x":0.5,"y":-1},"actions":[]}')).toMatchObject({ t: "in", seq: 3 });
    for (const bad of ["", "nope", "[]", '{"t":"ready"}', '{"t":"in","seq":"1","move":{},"actions":[]}', '{"t":"hack"}', `{"t":"start","pad":"${"x".repeat(5000)}"}`])
      expect(parseClientMessage(bad)).toBeNull();
  });
});

describe("registry", () => {
  it("lists exactly the games whose manifest declares online play", () => {
    const declared = games.filter((g) => g.online).map((g) => g.slug).sort();
    expect(Object.keys(onlineGames).sort()).toEqual(declared);
    for (const slug of declared) expect(findOnlineGame(slug)?.slug).toBe(slug);
    expect(findOnlineGame("constructor")).toBeUndefined();
  });
});

describe("Night Dorm online adapter", () => {
  const game = kyTucXaOnline;

  it("clamps moves and drops invalid actions", () => {
    expect(
      game.parseInput({
        move: { x: 9, y: -9 },
        actions: [{ type: "sleep" }, { type: "build", tile: 99, kind: "turret" }, { type: "build", tile: 1, kind: "nuke" }, { type: "repair" }],
      }),
    ).toEqual({ move: { x: 1, y: -1 }, actions: [{ type: "sleep" }, { type: "repair" }] });
    // At most four actions a tick, whatever is sent
    const flood = Array.from({ length: 9 }, () => ({ type: "repair" }));
    expect(game.parseInput({ move: { x: 0, y: 0 }, actions: flood })?.actions).toHaveLength(4);
  });

  it("runs a whole match to an end with a result per human seat", () => {
    const sim = game.create(7, [{ name: "An" }, { name: "Bình" }]);
    let ticks = 0;
    const seen = new Set<string>();
    while (!sim.over && ticks < game.tickRate * 600) {
      sim.step([null, null]);
      for (const e of sim.drainEvents() as { type: string }[]) seen.add(e.type);
      ticks++;
    }
    expect(sim.over).toBe(true);
    // Nobody went to bed, so both are caught at nightfall
    expect(seen.has("caught")).toBe(true);
    const results = sim.results();
    expect(results.map((r) => r.seat)).toEqual([0, 1]);
    expect(JSON.parse(JSON.stringify(sim.snapshot()))).toMatchObject({ phase: "over" });
  });
});
