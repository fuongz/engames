import { describe, expect, it } from "vitest";

// The folder rules in docs/standards/game-engine.md, checked on every game so a
// new one can't quietly drift from them.
// Everything the realtime Worker bundles must stay free of DOM code: a game's
// rules, its data files and its online adapter.
const logic = import.meta.glob<string>(["../*/logic.ts", "../*/config.ts", "../*/strings.ts", "../*/online.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const PURE_IMPORTS = new Set(["../core/math", "../core/i18n", "../online/room-game"]);
const entries = Object.entries(
  import.meta.glob<string>(["../*/index.ts", "!./index.ts", "!../online/index.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

describe("game conventions", () => {
  it.each(Object.entries(logic))("%s stays pure", (_, src) => {
    // Only pure core modules: this code runs in tests and in the realtime Worker.
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.filter((p) => p.startsWith("..") && !PURE_IMPORTS.has(p))).toEqual([]);
    expect(src).not.toMatch(/\b(document|window|requestAnimationFrame|localStorage)\./);
  });

  it.each(entries)("%s mounts through defineGame", (_, src) => {
    expect(src).toMatch(/export default defineGame\(/);
  });
});
