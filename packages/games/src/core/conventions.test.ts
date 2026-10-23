import { describe, expect, it } from "vitest";

// The folder rules in docs/standards/game-engine.md, checked on every game so a
// new one can't quietly drift from them.
const logic = import.meta.glob<string>("../*/logic.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});
const entries = Object.entries(
  import.meta.glob<string>(["../*/index.ts", "!./index.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

describe("game conventions", () => {
  it.each(Object.entries(logic))("%s stays pure", (_, src) => {
    // Only core/math: logic must run in a test without a browser.
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.filter((p) => p.startsWith("..") && p !== "../core/math")).toEqual([]);
    expect(src).not.toMatch(/\b(document|window|requestAnimationFrame|localStorage)\./);
  });

  it.each(entries)("%s mounts through defineGame", (_, src) => {
    expect(src).toMatch(/export default defineGame\(/);
  });
});
