import { describe, expect, it } from "vitest";
import { GAP_FIRST, GAP_LAST, GRID, HIGH, JUMP_H, LEVEL_Y, MAX_ACTIVE, MAX_HEARTS, SEATS, STEP_UP, STORM_END, T, TREE, WORDS, WORD_IDS, WRITE_TIME, type WordId } from "./config";
import { createGame, fromSnapshot, gapFor, normalize, outcomeOf, placeOf, resolveWord, scoreOf, snapshotOf, step, suggestions } from "./logic";
import { type Input, type Player, type State, active, dangerAt, flying, groundAt, hurt, levelAt, living, makeHeights, movePlayer, roofAt, spawnHazard, stepHazards } from "./sim";

const DT = 1 / 20;
const idle: Input = { mx: 0, my: 0, dash: false, jump: false, word: null };

/** A match past the countdown, with every seat human so nothing moves unless a test moves it. */
function quiet(seed = 5): State {
  const s = createGame(
    seed,
    Array.from({ length: SEATS }, (_, i) => ({ name: `P${i}` })),
  );
  while (s.phase === "countdown") step(s, [], DT);
  return s;
}

/** The first tile centre of a ground level, away from the edge. */
function spot(s: State, level: number) {
  const i = s.h.findIndex((v, n) => v === level && n % GRID > 1 && n % GRID < GRID - 2 && n > GRID * 2);
  return { x: (i % GRID) + 0.5, y: Math.floor(i / GRID) + 0.5 };
}

/** Stand a player on a point, feet on the ground. */
function put(s: State, p: Player, at: { x: number; y: number }) {
  p.x = at.x;
  p.y = at.y;
  p.z = groundAt(s, at.x, at.y);
  p.vz = 0;
  p.grounded = true;
}

/** Make the whole bank plain grass, for movement tests that must not meet a hill. */
function flat(s: State) {
  s.h.fill(1);
  for (const p of s.players) put(s, p, { x: p.x, y: p.y });
}

const run = (s: State, seconds: number) => {
  for (let t = 0; t < seconds; t += DT) stepHazards(s, DT);
};

describe("matching what was typed", () => {
  it("ignores accents, case, spaces and punctuation", () => {
    expect(normalize("  Sóng  Thần! ")).toBe("songthan");
    expect(normalize("ĐỐNG RƠM")).toBe("dongrom");
  });

  it.each([
    ["Sóng thần", "song-than"],
    ["song than", "song-than"],
    ["TSUNAMI", "song-than"],
    ["lũ", "lu"],
    ["flood", "lu"],
    ["trâu", "trau-dien"],
    ["mad buffalo", "trau-dien"],
    ["vo chuoi", "vo-chuoi"],
    ["banana peel", "vo-chuoi"],
    ["đống rơm", "dong-rom"],
    ["tí hon", "ti-hon"],
    ["ice", "bang"],
    ["đầm lầy", "dam-lay"],
    ["kite", "dieu"],
    ["con rồng to", "rong"],
    ["lightn", "sam-set"],
  ] as const)("%s → %s", (text, word) => {
    expect(resolveWord(text)).toBe(word);
  });

  it("knows every word by its Vietnamese name, its English name and its id", () => {
    for (const w of WORD_IDS) {
      expect(resolveWord(WORDS[w].name.vi), WORDS[w].name.vi).toBe(w);
      expect(resolveWord(WORDS[w].name.en), WORDS[w].name.en).toBe(w);
      expect(resolveWord(normalize(WORDS[w].name.vi)), "without accents").toBe(w);
    }
  });

  it("sends an unknown word to the closest spelling, and nothing typed to nothing", () => {
    expect(resolveWord("tsunamy")).toBe("song-than");
    expect(resolveWord("dragoon")).toBe("rong");
    expect(WORD_IDS).toContain(resolveWord("qwertyuiop"));
    expect(resolveWord("")).toBeNull();
    expect(resolveWord("  !!! ")).toBeNull();
  });

  it("offers the writer four different words: two that hurt, a twist and a help", () => {
    const four = suggestions(123);
    expect(new Set(four).size).toBe(4);
    expect(four.map((w) => WORDS[w].kind)).toEqual(["harm", "harm", "twist", "help"]);
    expect(suggestions(123)).toEqual(four);
  });
});

describe("the sandbank", () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);

  it("has a shore all round, mostly grass, some hills and a few trees, the same for the same seed", () => {
    for (const seed of seeds) {
      const h = makeHeights(seed);
      expect(h).toEqual(makeHeights(seed));
      expect(h).toHaveLength(GRID * GRID);
      for (let i = 0; i < GRID; i++) expect([h[i], h[(GRID - 1) * GRID + i], h[i * GRID], h[i * GRID + GRID - 1]]).toEqual([0, 0, 0, 0]);
      const share = (f: (v: number) => boolean) => h.filter(f).length / h.length;
      expect(share((v) => v === 0), `shore, seed ${seed}`).toBeLessThan(0.4);
      expect(share((v) => v === 1), `grass, seed ${seed}`).toBeGreaterThan(0.4);
      expect(share((v) => v === 2 || v === 3), `hills, seed ${seed}`).toBeGreaterThan(0.05);
      expect(h.filter((v) => v === TREE).length).toBeGreaterThanOrEqual(4);
    }
  });

  it("never has a cliff: neighbours differ by one level at most, so every step is a jump or less", () => {
    expect(LEVEL_Y[2] - LEVEL_Y[1]).toBeLessThanOrEqual(JUMP_H);
    expect(LEVEL_Y[3] - LEVEL_Y[2]).toBeLessThanOrEqual(JUMP_H);
    expect(LEVEL_Y[1] - LEVEL_Y[0]).toBeLessThanOrEqual(STEP_UP);
    for (const seed of seeds) {
      const h = makeHeights(seed);
      for (let i = 0; i < h.length; i++) {
        if (h[i] === TREE) continue;
        const right = i % GRID < GRID - 1 ? h[i + 1] : undefined;
        const below = h[i + GRID];
        for (const n of [right, below]) if (n !== undefined && n !== TREE) expect(Math.abs(h[i] - n), `seed ${seed} tile ${i}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("lets you reach every open tile from every other, walking and jumping", () => {
    for (const seed of seeds) {
      const h = makeHeights(seed);
      const open = h.flatMap((v, i) => (v === TREE ? [] : [i]));
      const seen = new Set([open[0]]);
      const queue = [open[0]];
      while (queue.length > 0) {
        const i = queue.pop() as number;
        const tx = i % GRID;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = tx + dx;
          const n = i + dx + dy * GRID;
          if (nx < 0 || nx >= GRID || n < 0 || n >= h.length || seen.has(n) || h[n] === TREE) continue;
          if (LEVEL_Y[h[n]] - LEVEL_Y[h[i]] > JUMP_H) continue;
          seen.add(n);
          queue.push(n);
        }
      }
      expect(seen.size, `seed ${seed}`).toBe(open.length);
    }
  });
});

describe("a match", () => {
  it("seats the humans first and fills the eight with bots", () => {
    const s = createGame(1, [{ name: "An" }, { name: "Bình" }]);
    expect(s.players).toHaveLength(SEATS);
    expect(s.players.map((p) => p.bot)).toEqual([false, false, true, true, true, true, true, true]);
    expect(s.players[0].name).toBe("An");
    expect(s.players.every((p) => p.hearts === MAX_HEARTS && p.alive)).toBe(true);
    expect([...s.order].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("is the same match for the same seed and inputs", () => {
    const play = () => {
      const s = createGame(77, [{ name: "An" }]);
      for (let i = 0; i < 20 * 40; i++) step(s, [{ mx: Math.sin(i / 9), my: Math.cos(i / 13), dash: i % 50 === 0, jump: i % 23 === 0, word: i % 90 === 0 ? "lũ" : null }], DT);
      return JSON.stringify(snapshotOf(s));
    };
    expect(play()).toBe(play());
  });

  it("gives every seat a turn to write, and shortens the wait as words land", () => {
    expect(gapFor(0)).toBe(GAP_FIRST);
    expect(gapFor(999)).toBe(GAP_LAST);
    const s = createGame(3, []);
    const writers: number[] = [];
    for (let i = 0; i < 20 * 150 && writers.length < SEATS; i++) for (const e of step(s, [], DT)) if (e.type === "writer") writers.push(e.seat);
    expect([...writers].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("lands the writer's word, only the writer's, and draws one for a writer who runs out of time", () => {
    const s = quiet(9);
    let writer = -1;
    while (writer < 0) for (const e of step(s, [], DT)) if (e.type === "writer") writer = e.seat;
    // Somebody else typing changes nothing
    const other = (writer + 1) % SEATS;
    const inputs: (Input | null)[] = Array(SEATS).fill(null);
    inputs[other] = { ...idle, word: "rồng" };
    expect(step(s, inputs, DT).some((e) => e.type === "word")).toBe(false);
    inputs[other] = null;
    inputs[writer] = { ...idle, word: "Song Than" };
    const landed = step(s, inputs, DT).find((e) => e.type === "word");
    expect(landed).toMatchObject({ word: "song-than", by: writer, auto: false });
    expect(s.words).toBe(1);
    expect(s.players.every((p) => p.survived === 1)).toBe(true);
    // The next writer says nothing: the room draws a word when the time is up
    let auto: unknown = null;
    for (let i = 0; i < 20 * (GAP_FIRST + WRITE_TIME + 2) && !auto; i++) auto = step(s, [], DT).find((e) => e.type === "word") ?? null;
    expect(auto).toMatchObject({ auto: true });
  });

  it("lets a ghost keep writing", () => {
    const s = quiet(11);
    const ghost = s.order[s.orderI % s.order.length];
    for (let i = 0; i < MAX_HEARTS; i++) hurt(s, s.players[ghost], "bom", true);
    expect(s.players[ghost].alive).toBe(false);
    let writer = -1;
    while (writer < 0) for (const e of step(s, [], DT)) if (e.type === "writer") writer = e.seat;
    expect(writer).toBe(ghost);
    const inputs: (Input | null)[] = Array(SEATS).fill(null);
    inputs[ghost] = { ...idle, word: "bom" };
    expect(step(s, inputs, DT).find((e) => e.type === "word")).toMatchObject({ word: "bom", by: ghost });
  });

  it("ends with one player standing, well before the storm has to finish it, across many bot matches", () => {
    const times: number[] = [];
    for (let n = 0; n < 12; n++) {
      const s = createGame(900 + n * 131, []);
      for (let i = 0; i < 20 * (STORM_END + 40) && s.phase !== "over"; i++) step(s, [], DT);
      expect(s.phase, `seed ${900 + n * 131}`).toBe("over");
      expect(living(s).length).toBeLessThanOrEqual(1);
      times.push(s.time);
    }
    times.sort((a, b) => a - b);
    expect(times[times.length >> 1]).toBeLessThan(STORM_END);
    expect(times[0]).toBeGreaterThan(20);
  });

  it("ranks by who fell last, shares a place between players who fall together, and pays the winner", () => {
    const s = quiet(4);
    const out = (seat: number) => {
      for (let i = 0; i < MAX_HEARTS; i++) hurt(s, s.players[seat], "bom", true);
    };
    out(7);
    step(s, [], DT);
    out(5);
    out(6);
    for (const seat of [1, 2, 3, 4]) {
      step(s, [], DT);
      out(seat);
    }
    step(s, [], DT);
    expect(s.phase).toBe("over");
    expect(placeOf(s, 0)).toBe(1);
    expect(placeOf(s, 7)).toBe(8);
    expect(placeOf(s, 5)).toBe(6);
    expect(placeOf(s, 6)).toBe(6);
    expect(outcomeOf(s, 0)).toBe("win");
    expect(outcomeOf(s, 4)).toBe("loss");
    expect(scoreOf(s, 0)).toBeGreaterThan(scoreOf(s, 4));
    expect(scoreOf(s, 4)).toBeGreaterThan(scoreOf(s, 7));
  });

  it("round-trips through a snapshot without the tile heights", () => {
    const s = quiet(8);
    spawnHazard(s, "ong", 0);
    const snap = JSON.parse(JSON.stringify(snapshotOf(s)));
    expect(snap.h).toBeUndefined();
    expect(snap.events).toBeUndefined();
    const back = fromSnapshot(snap);
    expect(back.h).toEqual(s.h);
    expect(back.players).toEqual(s.players);
    expect(back.hazards).toEqual(s.hazards);
  });
});

describe("moving", () => {
  it("walks at the stick, stays on the bank, and dashes on a cooldown", () => {
    const s = quiet();
    flat(s);
    const p = s.players[0];
    p.x = 7;
    p.y = 7;
    for (let i = 0; i < 20; i++) movePlayer(s, p, { ...idle, mx: 1 }, DT);
    expect(p.x).toBeGreaterThan(10);
    expect(p.y).toBeCloseTo(7, 6);
    for (let i = 0; i < 200; i++) movePlayer(s, p, { ...idle, mx: 1 }, DT);
    expect(p.x).toBeLessThan(GRID);
    p.x = 3;
    const before = p.x;
    movePlayer(s, p, { ...idle, mx: 1, dash: true }, DT);
    const dashed = p.x - before;
    expect(p.dashCd).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) movePlayer(s, p, { ...idle, mx: 1 }, DT);
    const at = p.x;
    movePlayer(s, p, { ...idle, mx: 1, dash: true }, DT);
    expect(p.x - at).toBeLessThan(dashed);
  });

  it("reverses the stick under the reverse word and slides on ice", () => {
    const s = quiet();
    flat(s);
    const p = s.players[0];
    p.x = 7;
    p.y = 7;
    spawnHazard(s, "nguoc", 1);
    movePlayer(s, p, { ...idle, mx: 1 }, DT);
    expect(p.x).toBeLessThan(7);
    s.hazards = [];
    spawnHazard(s, "bang", 1);
    p.x = 7;
    p.vx = 0;
    movePlayer(s, p, { ...idle, mx: 1 }, DT);
    const slow = p.x - 7;
    expect(slow).toBeGreaterThan(0);
    expect(slow).toBeLessThan(0.05);
    for (let i = 0; i < 10; i++) movePlayer(s, p, idle, DT);
    expect(p.vx).toBeGreaterThan(0);
  });

  it("nods off when standing still under the sleep word, but not while walking", () => {
    const s = quiet();
    flat(s);
    spawnHazard(s, "ngu", 1);
    const [still, walker] = s.players;
    walker.x = 3;
    for (let i = 0; i < 20 * (T.sleep.still + 0.2); i++) {
      movePlayer(s, still, idle, DT);
      movePlayer(s, walker, { ...idle, mx: i % 40 < 20 ? 1 : -1 }, DT);
    }
    expect(still.asleep).toBe(true);
    expect(still.stun).toBeGreaterThan(0);
    expect(walker.asleep).toBe(false);
  });
});

describe("jumping and climbing", () => {
  /** A strip of rising ground in front of a player standing on grass at (4.5, 7.5). */
  function stairs(s: State) {
    flat(s);
    const p = s.players[0];
    put(s, p, { x: 4.5, y: 7.5 });
    s.h[7 * GRID + 6] = 2;
    s.h[7 * GRID + 7] = 3;
    s.h[7 * GRID + 8] = TREE;
    return p;
  }

  it("walks up a small step, but a hill face stops you until you jump", () => {
    const s = quiet();
    const p = stairs(s);
    for (let i = 0; i < 20; i++) movePlayer(s, p, { ...idle, mx: 1 }, DT);
    expect(p.x).toBeLessThan(6);
    expect(p.z).toBe(LEVEL_Y[1]);
    movePlayer(s, p, { ...idle, mx: 1, jump: true }, DT);
    expect(p.grounded).toBe(false);
    for (let i = 0; i < 20; i++) movePlayer(s, p, { ...idle, mx: 1 }, DT);
    expect(p.x).toBeGreaterThan(6);
    expect(p.z).toBeCloseTo(LEVEL_Y[2], 6);
  });

  it("goes up one more step with another jump, and never into a tree", () => {
    const s = quiet();
    const p = stairs(s);
    for (let n = 0; n < 4; n++) {
      movePlayer(s, p, { ...idle, mx: 1, jump: true }, DT);
      for (let i = 0; i < 20; i++) movePlayer(s, p, { ...idle, mx: 1 }, DT);
    }
    expect(p.x).toBeLessThan(8);
    expect(p.z).toBeCloseTo(LEVEL_Y[3], 6);
  });

  it("only jumps from the ground, and lands again", () => {
    const s = quiet();
    flat(s);
    const p = s.players[0];
    movePlayer(s, p, { ...idle, jump: true }, DT);
    const up = p.vz;
    expect(up).toBeGreaterThan(0);
    movePlayer(s, p, { ...idle, jump: true }, DT);
    expect(p.vz).toBeLessThan(up);
    let top = 0;
    for (let i = 0; i < 40; i++) {
      movePlayer(s, p, idle, DT);
      top = Math.max(top, p.z - LEVEL_Y[1]);
    }
    expect(top).toBeGreaterThan(JUMP_H * 0.8);
    expect(p.grounded).toBe(true);
    expect(p.z).toBe(LEVEL_Y[1]);
  });
});

describe("every word", () => {
  it.each(WORD_IDS.map((w) => [w] as const))("%s starts, runs and ends on its own", (word) => {
    const s = quiet(21);
    const hz = spawnHazard(s, word, 0);
    expect(active(s, word)).toBe(hz);
    expect(JSON.parse(JSON.stringify(s.hazards))).toEqual(s.hazards);
    run(s, WORDS[word].dur + 1);
    expect(active(s, word)).toBeUndefined();
    expect(Number.isFinite(dangerAt(s, 7, 7))).toBe(true);
  });

  it("keeps at most MAX_ACTIVE running, the oldest giving way, and restarts a word written again", () => {
    const s = quiet();
    const many: WordId[] = ["lu", "ong", "dau", "toi", "ngu", "ti-hon", "nguoc"];
    for (const w of many) spawnHazard(s, w, 0);
    expect(s.hazards).toHaveLength(MAX_ACTIVE);
    expect(active(s, "lu")).toBeUndefined();
    run(s, 2);
    const again = spawnHazard(s, "ong", 0);
    expect(s.hazards.filter((h) => h.word === "ong")).toEqual([again]);
    expect(again.t).toBe(0);
  });

  it("flood: the shore drowns after the warning, the grass stays dry, a kite lifts you clear", () => {
    const s = quiet();
    const [wet, dry] = s.players;
    put(s, wet, spot(s, 0));
    put(s, dry, spot(s, 1));
    for (const p of s.players.slice(2)) put(s, p, spot(s, HIGH));
    spawnHazard(s, "lu", 2);
    run(s, T.flood.warn - 0.2);
    expect(wet.hearts).toBe(MAX_HEARTS);
    run(s, 0.5);
    expect(wet.hearts).toBe(MAX_HEARTS - 1);
    expect(dry.hearts).toBe(MAX_HEARTS);
    wet.inv = 0;
    spawnHazard(s, "dieu", 2);
    expect(flying(s)).toBe(true);
    run(s, 1);
    expect(wet.hearts).toBe(MAX_HEARTS - 1);
  });

  it("tsunami: sweeps everyone off low ground once, and spares the mound", () => {
    const s = quiet();
    const [low, high] = s.players;
    put(s, low, spot(s, 1));
    put(s, high, spot(s, HIGH));
    for (const p of s.players.slice(2)) put(s, p, spot(s, HIGH));
    spawnHazard(s, "song-than", 2);
    run(s, WORDS["song-than"].dur);
    expect(low.hearts).toBe(MAX_HEARTS - 1);
    expect(high.hearts).toBe(MAX_HEARTS);
  });

  it("tsunami, lava and the buffalo all miss someone high in a jump", () => {
    const s = quiet();
    flat(s);
    const p = s.players[0];
    for (const q of s.players.slice(1)) put(s, q, { x: 20, y: 20 });
    put(s, p, { x: 6, y: 6 });
    p.z = LEVEL_Y[1] + JUMP_H * 0.95;
    p.grounded = false;
    const wave = spawnHazard(s, "song-than", 1);
    wave.a = 0;
    wave.t = T.tsunami.warn + 5.9 / T.tsunami.speed;
    stepHazards(s, DT);
    expect(p.hearts).toBe(MAX_HEARTS);
    s.hazards = [];
    const buffalo = spawnHazard(s, "trau-dien", 1);
    Object.assign(buffalo.ents[0], { x: p.x, y: p.y, k: 1, vx: 1, vy: 0 });
    stepHazards(s, DT);
    expect(p.hearts).toBe(MAX_HEARTS);
    // The same buffalo tramples someone standing
    p.z = groundAt(s, p.x, p.y);
    Object.assign(buffalo.ents[0], { x: p.x, y: p.y });
    stepHazards(s, DT);
    expect(p.hearts).toBe(MAX_HEARTS - 1);
  });

  it("lightning: strikes where people stand, but not under the hut roof", () => {
    const strikes = (sheltered: boolean) => {
      const s = quiet();
      const hut = spawnHazard(s, "choi", 0);
      expect(roofAt(s, hut.a + 1, hut.b + 1)).toBe(true);
      expect(levelAt(s, hut.a + 1, hut.b + 1)).toBe(HIGH);
      for (const p of s.players) {
        p.x = sheltered ? hut.a + 1 : hut.a + 1 < GRID / 2 ? hut.a + 5 : hut.a - 3;
        p.y = hut.b + 1;
      }
      spawnHazard(s, "sam-set", 0);
      let struck = 0;
      for (let t = 0; t < WORDS["sam-set"].dur; t += DT) {
        stepHazards(s, DT);
        struck += s.events.filter((e) => e.type === "strike").length;
        s.events = [];
      }
      expect(struck).toBeGreaterThan(5);
      return s.players.filter((p) => p.hearts < MAX_HEARTS).length;
    };
    expect(strikes(true)).toBe(0);
    expect(strikes(false)).toBeGreaterThan(0);
  });

  it("bombs: hurt inside the circle when the fuse runs out", () => {
    const s = quiet();
    for (const p of s.players) {
      p.x = 7;
      p.y = 7;
    }
    spawnHazard(s, "bom", 0);
    run(s, T.bomb.fuse + 0.3);
    expect(s.players.every((p) => p.hearts < MAX_HEARTS)).toBe(true);
  });

  it("banana peel: a slip, not a wound", () => {
    const s = quiet();
    const hz = spawnHazard(s, "vo-chuoi", 0);
    const p = s.players[0];
    put(s, p, hz.ents[0]);
    const peels = hz.ents.length;
    stepHazards(s, DT);
    expect(p.stun).toBeGreaterThan(0);
    expect(p.hearts).toBe(MAX_HEARTS);
    expect(hz.ents.length).toBeLessThan(peels);
  });

  it("medicine: gives a heart back to the hurt, never more than three", () => {
    const s = quiet();
    const hz = spawnHazard(s, "thuoc", 0);
    const [full, hurtOne] = s.players;
    for (const p of s.players.slice(2)) p.x = p.y = 0.4;
    full.x = hz.ents[0].x;
    full.y = hz.ents[0].y;
    hurtOne.hearts = 1;
    hurtOne.x = hz.ents[1].x;
    hurtOne.y = hz.ents[1].y;
    stepHazards(s, DT);
    expect(full.hearts).toBe(MAX_HEARTS);
    expect(hurtOne.hearts).toBe(2);
    expect(hz.ents).toHaveLength(T.medkit.count - 1);
  });

  it("the ground words replace one another, and sun or frost ends the flood", () => {
    const s = quiet();
    spawnHazard(s, "lu", 0);
    spawnHazard(s, "ca-sau", 0);
    spawnHazard(s, "dam-lay", 0);
    spawnHazard(s, "bang", 0);
    expect(s.hazards.map((h) => h.word)).toEqual(["bang"]);
    spawnHazard(s, "sa-mac", 0);
    expect(s.hazards.map((h) => h.word)).toEqual(["sa-mac"]);
  });

  it("the hut and the haystacks are high ground while they stand", () => {
    const s = quiet();
    const hay = spawnHazard(s, "dong-rom", 0);
    expect(hay.ents).toHaveLength(2);
    const at = hay.ents[0];
    expect(levelAt(s, at.x + 0.5, at.y + 0.5)).toBe(HIGH);
    expect(roofAt(s, at.x + 0.5, at.y + 0.5)).toBe(false);
    run(s, WORDS["dong-rom"].dur + 0.1);
    expect(levelAt(s, at.x + 0.5, at.y + 0.5)).toBeLessThan(HIGH);
  });
});
