# Game engine standard

How every game in `packages/games` is built, and why it is built this way rather
than on Phaser, Pixi, Godot or Rust/WASM. Read it before starting a new game or
touching `packages/core/`.

---

## TL;DR

- **The engine is `packages/core/` (`@web-games/core`)**: a ~650-line, zero-dependency
  TypeScript layer over Canvas 2D, in its own package so it can never import a game.
  `packages/games/` holds only the games and the registry that lists them. A game is `defineGame(spec, setup)`; the runtime owns the
  stage, loop, pause/visibility, keyboard, audio unlock and teardown.
- **Keep TypeScript + Canvas 2D** as the default. Reach for PixiJS **per game** only
  when one game needs thousands of sprites, shaders or WebGPU. Do not adopt a full
  framework (Phaser, Godot) for the portal.
- **Functional core, imperative shell**: rules in a pure `logic.ts`, everything
  browser-facing in `game.ts`. A test enforces it.

---

## 1. A game's folder

```
packages/games/src/<slug>/
├── manifest.ts    # portal metadata (eager-loaded for listings) — no runtime code
├── index.ts       # export default defineGame({ width, height, bleed, fonts }, setup)
├── game.ts        # export function setup(rt): GameHooks — the imperative shell
├── logic.ts       # pure rules: state + update(state, input, dt) → events
├── logic.test.ts  # rules and balance, run in node by vitest
├── config.ts      # tuning numbers and tables, nothing else
├── art.ts         # drawing functions and offscreen caches
├── strings.ts     # Localized<…> catalog; resolved at draw time
├── cover.ts       # renderPoster / renderBanner for `bun run art`
└── RE_NOTES.md    # what the original does, and what we changed
```

| File | May import | Must not |
| --- | --- | --- |
| `logic.ts` | `@web-games/core/math`, `./config` | DOM, `window`, `document`, `localStorage`, the `@web-games/core` root |
| `game.ts` | `@web-games/core`, every sibling | write global listeners (the runtime owns them) |
| `art.ts` / `cover.ts` | `@web-games/core`, `./config`, `./logic` (types, geometry) | game state mutation |
| `index.ts` | `@web-games/core`, `./config`, `./game` | anything but the `defineGame` call |

`packages/games/src/conventions.test.ts` checks the `logic.ts` and `index.ts` rows on every
game, so `bun run gate` fails if a new game drifts.

**Why this split.** `logic.ts` is deterministic given a seed (`mulberry32` from
`@web-games/core/math`), so balance can be simulated thousands of runs in a unit test and a
reported score could later be replayed server-side. `game.ts` turns pointer/keys
into `Input`, feeds `update`, and turns the returned events into sound, particles
and HUD — the same "functional core, imperative shell" shape Elm and Redux use.

## 2. The engine API

```ts
// index.ts
export default defineGame(
  { width: W, height: H, bleed: true, fonts: ['800 20px "Baloo 2"'] },
  setup,
);

// game.ts
export function setup(rt: Runtime): GameHooks {
  const { stage, ctx, keys } = rt;          // keys: held KeyboardEvent.code set
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];     // read per draw: language can change mid-run
  return {
    update(dt) { /* advance state */ },
    render(alpha) { /* draw; alpha only matters with fixedStep */ },
    pointer: { down(p) {}, move(p) {}, up(p) {} },  // logical coordinates
    keydown(e) {}, keyup(e) {},
    suspend() { paused = true },             // tab hidden / portal menu / rotate prompt
    dispose() { saveRun() },                 // on destroy, after the loop stops
  };
}
```

What the runtime guarantees, so no game re-implements it:

- **One loop, two holds.** The loop runs only while the portal has not paused it
  *and* the tab is visible. Returning to the tab never resumes a game the portal
  paused (the old per-game `visibilitychange` handlers did).
- **Held keys are cleared** on every suspend and on window blur, so a key released
  in another tab never sticks.
- **Audio unlocks** on the first pointerdown/keydown (browsers' gesture rule).
- **Teardown is complete**: every listener, the observer and the canvas go on
  `destroy()`.
- **`fixedStep` (opt-in).** `fixedStep: 1 / 60` runs `update` at a fixed rate with an
  accumulator and passes the leftover to `render(alpha)` ("Fix Your Timestep").
  The result is the same on a 60 Hz and a 120 Hz phone. Without it, `update(dt)`
  gets a variable dt clamped to 1/20 s — what the six launch games use.

`packages/core/src/math.ts` holds the helpers games kept re-writing: `Rect`, `Point`, `inRect`,
`clamp`, `lerp`, `smoothstep`, `easeOutCubic`, `mulberry32`.

## 3. Research: how other engines are organised

| Engine | Model | Size / runtime | Fit for Engames |
| --- | --- | --- | --- |
| **Phaser 4** | Full framework: scenes, loader, arcade physics, tweens, WebGL/Canvas | ~1 MB min (~300 KB gz), shared across games | Strong and stable on Safari, but our games are procedural canvas drawings, not sprite atlases; we would rewrite 17k lines to use 20% of it |
| **PixiJS v8** | Renderer only (scene graph, batching, WebGL/WebGPU) | ~200 KB+ | Best *renderer* if a game needs mass sprites or filters. Usable per game behind `GameModule` |
| **Excalibur** | TS-first actors + scenes + physics | ~300 KB | Clean API, smaller community; same rewrite cost as Phaser |
| **Kaplay (Kaboom)** | Component bags on game objects, very terse | small | Easiest to learn; performance ceiling shows on larger games |
| **LittleJS** | Tiny engine, fixed 60 Hz update, WebGL sprites | tiny | Good ideas (fixed step, tiny core) — we borrowed the fixed step |
| **Godot / Unity / Defold web export** | Scene tree / components / message passing, exported to WASM | 5–40 MB download | Wrong trade for a quick-play PWA portal: slow first load, heavy offline cache, no shared portal UI |
| **Bevy / macroquad (Rust → WASM)** | ECS (data-oriented) / immediate-mode | 1–10 MB WASM | ECS shines at 10k+ entities; every canvas call crosses the JS boundary; much slower iteration |

Patterns worth knowing, and whether we use them:

- **Scene tree (Godot), components (Unity), ECS (Bevy).** These solve
  composition across hundreds of entity types and editors. Our games have a
  handful of entity kinds and < 2k live objects; plain arrays of plain objects in
  `logic.ts` are faster to write, trivially serialisable, and fast enough. *Not adopted.*
- **Scenes / state machines (Phaser, Excalibur).** Every game hand-rolls
  `phase: "intro" | "play" | "over"`. A typed `phase` field in the logic state is
  enough today. *Candidate for core when a game needs 4+ screens.*
- **Fixed timestep (LittleJS, Glenn Fiedler).** Determinism and fairness across
  refresh rates. *Adopted, opt-in.*
- **Asset pipelines (Phaser loader, Godot import).** We draw procedurally and cache
  to offscreen canvases, so there is nothing to load beyond a font. *Not needed.*

## 4. Recommendation

| Concern | Choice | Why |
| --- | --- | --- |
| Language | **TypeScript** | Same toolchain as the portal, instant HMR, vitest for logic. WASM only pays off for heavy compute, which no game has |
| Renderer | **Canvas 2D** default; **PixiJS per game** on demand | Canvas 2D handles the current scenes at 60 fps on phones; Pixi is added inside one game's chunk, never to core |
| Engine | **Own thin runtime (`core/`)** | Zero dependencies, 18–43 KB game chunks, no rewrite, lifecycle bugs fixed once |
| Architecture | **Pure `logic.ts` + shell `game.ts`** | Testable, deterministic, replayable for leaderboards |
| Loop | Variable dt (existing); **`fixedStep: 1/60` for new action games** | Fair scores across 60/120 Hz |

## 5. Roadmap (not built yet — add when a second game needs it)

1. **Particle pool** — the games rebuild particle arrays with `filter()` each frame;
   a swap-remove pool cuts GC pauses on low-end Android.
2. **Tween / timeline** — the `t += dt; k = t / DURATION` pattern recurs in every game.
3. **Input actions** — map keyboard, touch stick and gamepad to named actions once.
4. **Canvas UI kit** — button, toast, overlay panel: each `art.ts` draws its own.
5. **Move `tinh-tu` and `phi-doi` to `fixedStep`** — needs play-testing, since
   their tuning was done against variable dt.

Sources: [Phaser vs Kaplay vs Excalibur (Phaser, 2026)](https://phaser.io/news/2026/04/phaser-vs-kaplay-vs-excalibur-2d-web-game-framework),
[web game engines comparison (Cinevva)](https://app.cinevva.com/zh-CN/guides/web-game-engines-comparison),
["Fix your timestep" discussion (gamedev.net)](https://gamedev.net/forums/topic/691776-fix-your-timestep).
