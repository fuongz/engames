import { describe, expect, it } from "vitest";
import { games } from "./registry";
import { findSaveRules } from "./saves";

// The folder rules in docs/standards/game-engine.md, checked on every game so a
// new one can't quietly drift from them.
// Everything the realtime Worker bundles must stay free of DOM code: a game's
// rules (and any computer player they call), its data files and its online adapter.
const logic = import.meta.glob<string>(["./*/logic.ts", "./*/ai.ts", "./*/board.ts", "./*/cards.ts", "./*/sim.ts", "./*/physics.ts", "./*/config.ts", "./*/strings.ts", "./*/online.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
// The pure entry points of @web-games/core; its root entry pulls in the DOM runtime.
const PURE_IMPORTS = new Set(["@web-games/core/math", "@web-games/core/i18n", "@web-games/core/online"]);
const entries = Object.entries(
  import.meta.glob<string>("./*/index.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);

describe("game conventions", () => {
  it.each(Object.entries(logic))("%s stays pure", (_, src) => {
    // Only its own folder and pure core modules: this code runs in tests and in the realtime Worker.
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.filter((p) => !p.startsWith("./") && !PURE_IMPORTS.has(p))).toEqual([]);
    expect(src).not.toMatch(/\b(document|window|requestAnimationFrame|localStorage)\./);
  });

  it.each(entries)("%s mounts through defineGame", (_, src) => {
    expect(src).toMatch(/export default defineGame\(/);
  });
});

// semver.org's own pattern: MAJOR.MINOR.PATCH, optional -prerelease and +build
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

describe("manifest platform options", () => {
  it("the semver pattern means what it says", () => {
    for (const ok of ["0.1.0", "1.4.12", "2.0.0-beta.1", "1.0.0+build.7"]) expect(ok).toMatch(SEMVER);
    for (const bad of ["1.0", "v1.0.0", "01.0.0", "1.0.0-", "1.0.0 "]) expect(bad).not.toMatch(SEMVER);
  });

  it.each(games.map((g) => [g.slug, g] as const))("%s", (_, g) => {
    if (g.version !== undefined) expect(g.version, "version is semver").toMatch(SEMVER);
    // An optional account save goes through the same server checks as requiresAccount
    if (g.accountSave) {
      expect(findSaveRules(g.slug), "accountSave needs a save.ts").toBeDefined();
      expect(g.requiresAccount, "accountSave and requiresAccount are exclusive").not.toBe(true);
    }
    if (g.allowance) {
      expect(g.allowance.kind).toMatch(/^[a-z][a-z0-9-]*$/);
      for (const n of [g.allowance.welcome, g.allowance.daily]) {
        expect(Number.isSafeInteger(n) && n >= 0, "allowance amounts are whole and not negative").toBe(true);
      }
      const { streak } = g.allowance;
      if (streak !== undefined) {
        expect(streak.length, "a streak has at least one day").toBeGreaterThan(0);
        for (const n of streak) expect(Number.isSafeInteger(n) && n >= 0, "streak amounts are whole and not negative").toBe(true);
      }
      expect(g.allowance.welcome + g.allowance.daily + (streak ?? []).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
    // Prize Counter items reach the game through allowance.claim() (tickets.md §4)
    if (g.shop !== undefined) {
      expect(g.allowance, "a shop needs manifest.allowance to deliver its items").toBeDefined();
      const ids = g.shop.map((i) => i.id);
      expect(new Set(ids).size, "shop item ids are unique").toBe(ids.length);
      for (const item of g.shop) {
        expect(item.id).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
        expect(item.kind).toMatch(/^[a-z][a-z0-9-]*$/);
        expect(item.name.vi.trim() && item.name.en.trim(), "shop items are named in both languages").toBeTruthy();
        for (const n of [item.amount, item.price]) expect(Number.isSafeInteger(n) && n > 0, "amount and price are positive whole numbers").toBe(true);
        if (item.dailyLimit !== undefined) expect(Number.isSafeInteger(item.dailyLimit) && item.dailyLimit > 0, "dailyLimit is a positive whole number").toBe(true);
      }
    }
    if (g.tickets !== undefined) expect(typeof g.tickets).toBe("boolean");
  });
});
