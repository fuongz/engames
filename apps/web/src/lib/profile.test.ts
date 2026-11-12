import { describe, expect, it } from "bun:test";
import { type ProfileFacts, badgeUnlocks } from "./profile";

const FACTS: ProfileFacts = {
  gamesFirstPlayed: [1, 2, 3],
  catalogSize: 12,
  plays: 40,
  earnedTotal: 1_500,
  onlineWinAt: null,
  top10At: null,
  jackpotWinAt: null,
  favoriteAt: null,
  purchaseAt: null,
  milestoneAt: {},
  shieldAt: null,
};

const byId = (facts: ProfileFacts) => Object.fromEntries(badgeUnlocks(facts).map((b) => [b.id, b]));

describe("badge progress", () => {
  it("counts locked badges toward their target, in their unit", () => {
    const b = byId(FACTS);
    expect(b["explorer-5"]?.progress).toEqual({ current: 3, target: 5, unit: "games" });
    expect(b["explorer-all"]?.progress).toEqual({ current: 3, target: 12, unit: "games" });
    expect(b["plays-100"]?.progress).toEqual({ current: 40, target: 100, unit: "plays" });
    expect(b["tickets-10k"]?.progress).toEqual({ current: 1_500, target: 10_000, unit: "tickets" });
  });

  it("drops progress once unlocked, and never on yes/no badges", () => {
    const b = byId(FACTS);
    expect(b["tickets-1k"]).toEqual({ id: "tickets-1k", unlocked: true });
    expect(b["top-10"]?.progress).toBeUndefined();
    expect(b["streak-7"]?.progress).toBeUndefined();
  });

  it("has no explorer-all progress without a catalogue", () => {
    expect(byId({ ...FACTS, catalogSize: 0 })["explorer-all"]?.progress).toBeUndefined();
  });
});
