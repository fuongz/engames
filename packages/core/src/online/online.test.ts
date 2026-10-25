import { describe, expect, it } from "vitest";
import { parseClientMessage } from "./protocol";
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
