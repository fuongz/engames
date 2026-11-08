import { describe, expect, it } from "bun:test";
import { inviteUrl, roomFromQr } from "./online";

describe("room QR codes", () => {
  it("reads invite links from any host, and bare codes", () => {
    const link = inviteUrl("https://engames.trinhvaphuong.com", "caro", "K7M2QX");
    expect(roomFromQr(link, "noi-thu")).toEqual({ slug: "caro", code: "K7M2QX" });
    expect(roomFromQr("http://localhost:5173/games/ky-tuc-xa?room=k7m2qx", "caro")).toEqual({ slug: "ky-tuc-xa", code: "K7M2QX" });
    expect(roomFromQr(" k7m2qx ", "caro")).toEqual({ slug: "caro", code: "K7M2QX" });
  });

  it("refuses anything that isn't a room", () => {
    for (const bad of ["", "hello", "https://example.com/", "https://x.com/games/caro", "https://x.com/games/caro?room=0OO1", "javascript:alert(1)", "https://x.com/games/../admin?room=K7M2QX"])
      expect(roomFromQr(bad, "caro")).toBeNull();
  });
});
