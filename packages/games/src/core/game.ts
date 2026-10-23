import { type Locale, currentLocale } from "./i18n";
import { Loop, Stage, type StageHandlers } from "./stage";
import type { GameContext, GameModule } from "./types";

// The engine's one entry point. A game describes its canvas and returns its
// frame/input hooks; the runtime owns everything every game used to repeat —
// stage, loop, pause/visibility, keyboard listeners, audio unlock, teardown —
// so those behave the same in every game and are fixed in one place.

export interface GameSpec {
  /** Logical resolution; the stage letterboxes it at device pixel ratio. */
  width: number;
  height: number;
  /** Draw past the logical bounds into the letterbox; read `stage.view`. */
  bleed?: boolean;
  /** CSS font shorthands to warm before first draw, e.g. `'800 20px "Baloo 2"'`. */
  fonts?: string[];
  /**
   * Run `update` at this fixed step (seconds, e.g. `1 / 60`) and `render` once
   * per display frame with the leftover as `alpha`. Same input → same result on
   * a 60 Hz and a 120 Hz phone, which is what a fair leaderboard needs. Omit for
   * one `update(dt)` per frame with dt clamped to 1/20 s.
   */
  fixedStep?: number;
}

export interface Runtime {
  root: HTMLElement;
  game: GameContext;
  stage: Stage;
  ctx: CanvasRenderingContext2D;
  /** Held keys by `KeyboardEvent.code`; cleared whenever the run is held. */
  keys: ReadonlySet<string>;
  /** The language to draw in right now (it can change mid-run). */
  locale(): Locale;
}

export interface GameHooks {
  /** Advance the simulation. `dt` is in seconds. */
  update(dt: number): void;
  /**
   * Draw the current state. `alpha` (0..1) is how far the clock is between
   * the last two fixed updates; always 1 without `fixedStep`.
   */
  render?(alpha: number): void;
  pointer?: StageHandlers;
  keydown?(e: KeyboardEvent): void;
  keyup?(e: KeyboardEvent): void;
  /**
   * The run is being held — tab hidden, portal menu open, phone needs rotating.
   * Raise the in-game pause screen here; resuming is the player's call.
   */
  suspend?(): void;
  /** Last words on destroy (save the run), after the loop stops. */
  dispose?(): void;
}

/** Fixed-step bookkeeping, pure so it can be tested without a browser. */
export function fixedSteps(acc: number, dt: number, step: number, max = 5) {
  let left = acc + Math.min(dt, step * max);
  let steps = 0;
  while (left >= step && steps < max) {
    left -= step;
    steps++;
  }
  // Behind by more than `max` steps: drop the debt instead of spiralling.
  if (steps === max) left = Math.min(left, step);
  return { steps, acc: left, alpha: left / step };
}

export function defineGame(
  spec: GameSpec,
  setup: (rt: Runtime) => GameHooks,
): GameModule {
  return {
    mount(root, game) {
      for (const font of spec.fonts ?? []) void document.fonts?.load(font);
      const stage = new Stage(root, spec.width, spec.height, {
        bleed: spec.bleed,
      });
      const keys = new Set<string>();
      const hooks = setup({
        root,
        game,
        stage,
        ctx: stage.ctx,
        keys,
        locale: () => currentLocale(game),
      });

      const step = spec.fixedStep;
      let acc = 0;
      const loop = new Loop((dt) => {
        if (step) {
          const r = fixedSteps(acc, dt, step);
          acc = r.acc;
          for (let i = 0; i < r.steps; i++) hooks.update(step);
          hooks.render?.(r.alpha);
        } else {
          hooks.update(dt);
          hooks.render?.(1);
        }
      });

      // Running is derived from two independent holds, so coming back to the
      // tab never un-pauses a game the portal paused, and vice versa.
      let held = false;
      let running = false;
      const sync = () => {
        const run = !held && !document.hidden;
        if (run === running) return;
        running = run;
        if (run) return loop.start();
        loop.stop();
        keys.clear();
        hooks.suspend?.();
      };

      const { down } = hooks.pointer ?? {};
      stage.onPointer({
        ...hooks.pointer,
        down(p) {
          game.audio.unlock();
          down?.(p);
        },
      });
      const onKeyDown = (e: KeyboardEvent) => {
        game.audio.unlock();
        keys.add(e.code);
        hooks.keydown?.(e);
      };
      const onKeyUp = (e: KeyboardEvent) => {
        keys.delete(e.code);
        hooks.keyup?.(e);
      };
      // A key released while the window is unfocused never sends keyup.
      const onBlur = () => keys.clear();
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      document.addEventListener("visibilitychange", sync);
      sync();

      return {
        pause() {
          held = true;
          sync();
        },
        resume() {
          held = false;
          sync();
        },
        destroy() {
          loop.stop();
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("keyup", onKeyUp);
          window.removeEventListener("blur", onBlur);
          document.removeEventListener("visibilitychange", sync);
          hooks.dispose?.();
          stage.destroy();
        },
      };
    },
  };
}
