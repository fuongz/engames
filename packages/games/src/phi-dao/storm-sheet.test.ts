import { describe, expect, it } from "vitest";
import { STORM_SHEET } from "./config";
import { stormSheetFrame } from "./storm-sheet";

describe("generated lightning sheet playback", () => {
  it("visits all 16 cells exactly once in row-major order without wrapping after the burst", () => {
    const frameTime = STORM_SHEET.duration / STORM_SHEET.frames;
    const seen = [];
    for (let i = 0; i < STORM_SHEET.frames; i++)
      seen.push(stormSheetFrame((i + 0.5) * frameTime));
    expect(seen).toEqual([
      { column: 0, row: 0 },
      { column: 1, row: 0 },
      { column: 2, row: 0 },
      { column: 3, row: 0 },
      { column: 0, row: 1 },
      { column: 1, row: 1 },
      { column: 2, row: 1 },
      { column: 3, row: 1 },
      { column: 0, row: 2 },
      { column: 1, row: 2 },
      { column: 2, row: 2 },
      { column: 3, row: 2 },
      { column: 0, row: 3 },
      { column: 1, row: 3 },
      { column: 2, row: 3 },
      { column: 3, row: 3 },
    ]);
    expect(stormSheetFrame(STORM_SHEET.duration)).toBeNull();
    for (const age of [-1, NaN, Infinity])
      expect(stormSheetFrame(age)).toBeNull();
  });
});
