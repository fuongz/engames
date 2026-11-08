import { describe, expect, it } from "vitest";
import { parseClientMessage } from "./protocol";
import { applySettings, defaultSettings } from "./room-game";
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

describe("room settings", () => {
  const game = {
    settings: [{ key: "bestOf", label: { vi: "", en: "" }, choices: ["1", "3", "5"].map((v) => ({ value: v, label: { vi: v, en: v } })), default: "3" }],
  };
  it("defaults, and keeps only declared keys with allowed values", () => {
    expect(defaultSettings(game)).toEqual({ bestOf: "3" });
    expect(applySettings(game, { bestOf: "3" }, { bestOf: "5", other: "1" })).toEqual({ bestOf: "5" });
    expect(applySettings(game, { bestOf: "5" }, { bestOf: "7" })).toEqual({ bestOf: "5" });
    expect(applySettings({}, {}, { bestOf: "5" })).toEqual({});
  });
});

describe("protocol", () => {
  it("accepts well-formed messages and nothing else", () => {
    expect(parseClientMessage('{"t":"ready","ready":true}')).toEqual({ t: "ready", ready: true });
    expect(parseClientMessage('{"t":"in","seq":3,"move":{"x":0.5,"y":-1},"actions":[]}')).toMatchObject({ t: "in", seq: 3 });
    expect(parseClientMessage('{"t":"settings","settings":{"bestOf":"5","x":3}}')).toEqual({ t: "settings", settings: { bestOf: "5" } });
    expect(parseClientMessage('{"t":"settings","settings":[]}')).toBeNull();
    for (const bad of ["", "nope", "[]", '{"t":"ready"}', '{"t":"in","seq":"1","move":{},"actions":[]}', '{"t":"hack"}', `{"t":"start","pad":"${"x".repeat(5000)}"}`])
      expect(parseClientMessage(bad)).toBeNull();
  });
});
