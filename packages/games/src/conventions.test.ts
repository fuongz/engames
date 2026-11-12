import type { ChangelogEntry, GameManifest } from "@web-games/core";
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
    // The Lucky Jar pays into the shared ticket wallet (jackpot.md)
    if (g.jackpot !== undefined) {
      expect(typeof g.jackpot).toBe("boolean");
      if (g.jackpot) expect(g.tickets, "a jackpot game is a ticket game").toBe(true);
    }
  });
});

// ---------------------------------------------------------------- Changelog (docs/standards/changelog.md)

/** semver precedence (semver.org §11): <0 when a is older than b, 0 when equal (build metadata ignored). */
function compareSemver(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre] = v.split("+")[0].split(/-(.*)/s);
    return { nums: core.split(".").map(Number), pre: pre === undefined ? [] : pre.split(".") };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] - y.nums[i];
  // A release outranks its pre-releases
  if (x.pre.length === 0 || y.pre.length === 0) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) - Number(q);
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/** A real calendar day written as YYYY-MM-DD. */
const isIsoDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);

/** Everything wrong with a game's changelog, as readable lines (empty: it is fine). */
function changelogProblems(g: Pick<GameManifest, "version" | "changelog">): string[] {
  const log: ChangelogEntry[] = g.changelog ?? [];
  const out: string[] = [];
  if (g.changelog !== undefined && log.length === 0) out.push("an empty changelog: leave the field out instead");
  log.forEach((e, i) => {
    const at = `changelog[${i}] (${e.version})`;
    if (!SEMVER.test(e.version)) out.push(`${at}: version is not semver`);
    if (!isIsoDay(e.date)) out.push(`${at}: date "${e.date}" is not an ISO YYYY-MM-DD day`);
    for (const locale of ["vi", "en"] as const) {
      const lines = e.changes[locale] ?? [];
      if (lines.filter((c) => c.trim()).length === 0) out.push(`${at}: no change listed in ${locale}`);
      if (lines.some((c) => !c.trim())) out.push(`${at}: an empty change line in ${locale}`);
      if (e.title && !e.title[locale]?.trim()) out.push(`${at}: title missing in ${locale}`);
    }
    const prev = log[i - 1];
    if (prev) {
      if (SEMVER.test(prev.version) && SEMVER.test(e.version) && compareSemver(prev.version, e.version) <= 0)
        out.push(`${at}: versions must strictly descend (newest first), but ${prev.version} comes before it`);
      if (isIsoDay(prev.date) && isIsoDay(e.date) && prev.date < e.date)
        out.push(`${at}: dates must not increase (newest first), but ${prev.date} comes before ${e.date}`);
    }
  });
  if (g.version !== undefined && log.length > 0 && log[0].version !== g.version)
    out.push(`manifest.version ${g.version} is not the newest changelog entry (${log[0].version})`);
  return out;
}

describe("changelog", () => {
  const entry = (version: string, date: string, over: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
    version,
    date,
    changes: { vi: [`Bản ${version}`], en: [`Release ${version}`] },
    ...over,
  });
  const good = { version: "1.2.0", changelog: [entry("1.2.0", "2026-11-10"), entry("1.1.0", "2026-11-10"), entry("1.0.0", "2026-10-01")] };

  it("orders semver by precedence", () => {
    const ordered = ["2.0.0", "2.0.0-rc.1", "2.0.0-beta.11", "2.0.0-beta.2", "2.0.0-alpha", "1.10.0", "1.9.3", "1.9.0"];
    for (let i = 1; i < ordered.length; i++) expect(compareSemver(ordered[i - 1], ordered[i]), ordered[i]).toBeGreaterThan(0);
    expect(compareSemver("1.0.0+a", "1.0.0+b")).toBe(0);
  });

  it("accepts a well-formed changelog (same-day releases included)", () => {
    expect(changelogProblems(good)).toEqual([]);
    expect(changelogProblems({ changelog: good.changelog })).toEqual([]); // no manifest.version: nothing to match
  });

  it.each([
    ["a non-semver version", { changelog: [entry("1.2", "2026-11-10")] }, "not semver"],
    ["versions out of order", { changelog: [entry("1.0.0", "2026-11-10"), entry("1.1.0", "2026-10-01")] }, "strictly descend"],
    ["a repeated version", { changelog: [entry("1.0.0", "2026-11-10"), entry("1.0.0", "2026-10-01")] }, "strictly descend"],
    ["a date that is not ISO", { changelog: [entry("1.0.0", "10/11/2026")] }, "not an ISO"],
    ["a day that does not exist", { changelog: [entry("1.0.0", "2026-02-30")] }, "not an ISO"],
    ["dates going up", { changelog: [entry("1.1.0", "2026-10-01"), entry("1.0.0", "2026-11-10")] }, "must not increase"],
    ["manifest.version not the newest entry", { version: "1.3.0", changelog: good.changelog }, "is not the newest"],
    ["no English change", { changelog: [entry("1.0.0", "2026-11-10", { changes: { vi: ["Một"], en: [] } })] }, "no change listed in en"],
    ["no Vietnamese change", { changelog: [entry("1.0.0", "2026-11-10", { changes: { vi: [" "], en: ["One"] } })] }, "no change listed in vi"],
    ["a title in one language only", { changelog: [entry("1.0.0", "2026-11-10", { title: { vi: "Hũ", en: "" } })] }, "title missing in en"],
    ["an empty changelog", { changelog: [] }, "empty changelog"],
  ] as const)("rejects %s", (_, manifest, problem) => {
    const problems = changelogProblems(manifest as Pick<GameManifest, "version" | "changelog">);
    expect(problems.join("\n")).toContain(problem);
  });

  const withChangelog = games.filter((g) => g.changelog !== undefined);
  it.each(withChangelog.map((g) => [g.slug, g] as const))("%s has a well-formed changelog", (_, g) => {
    expect(changelogProblems(g)).toEqual([]);
  });
  // it.each refuses an empty table; until the first game writes a changelog there is nothing to check
  if (withChangelog.length === 0) it.skip("no game has a changelog yet", () => {});
});
