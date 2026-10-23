import type { Rect } from "./math";

export type { Rect } from "./math";

export interface PointerInfo {
  x: number;
  y: number;
  id: number;
}

export interface StageOptions {
  /**
   * Let the game draw past its logical bounds into the letterbox, so a 3:5 game
   * on a 9:19.5 phone has no black bars. Read `view` for the visible area.
   */
  bleed?: boolean;
}

export interface StageHandlers {
  down?(p: PointerInfo): void;
  move?(p: PointerInfo): void;
  up?(p: PointerInfo): void;
}

/**
 * A canvas with a fixed logical resolution, letterboxed into its parent and
 * rendered at device pixel ratio. Games draw in logical units and receive
 * pointer events already mapped to them.
 */
export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private observer: ResizeObserver;
  private cleanup: (() => void)[] = [];

  /** Visible area in logical units; wider/taller than width×height when letterboxed. */
  readonly view: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    private root: HTMLElement,
    readonly width: number,
    readonly height: number,
    private options: StageOptions = {},
  ) {
    this.canvas = document.createElement("canvas");
    // touch-action:none stops the browser from scrolling/zooming while dragging
    this.canvas.style.cssText =
      "display:block;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none";
    root.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(root);
    this.resize();
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.root.clientWidth;
    const ch = this.root.clientHeight;
    this.canvas.width = Math.max(1, Math.round(cw * dpr));
    this.canvas.height = Math.max(1, Math.round(ch * dpr));
    const s = Math.min(cw / this.width, ch / this.height);
    this.scale = s * dpr;
    this.offsetX = ((cw - this.width * s) / 2) * dpr;
    this.offsetY = ((ch - this.height * s) / 2) * dpr;
    this.view.x = -this.offsetX / this.scale;
    this.view.y = -this.offsetY / this.scale;
    this.view.w = this.canvas.width / this.scale;
    this.view.h = this.canvas.height / this.scale;
  }

  /** Reset the transform so subsequent drawing uses logical coordinates. */
  begin() {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
    ctx.save();
    if (!this.options.bleed) {
      ctx.beginPath();
      ctx.rect(0, 0, this.width, this.height);
      ctx.clip();
    }
  }

  end() {
    this.ctx.restore();
  }

  onPointer(handlers: StageHandlers) {
    const map = (e: PointerEvent): PointerInfo => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = this.canvas.width / rect.width;
      return {
        x: ((e.clientX - rect.left) * dpr - this.offsetX) / this.scale,
        y: ((e.clientY - rect.top) * dpr - this.offsetY) / this.scale,
        id: e.pointerId,
      };
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      handlers.down?.(map(e));
    };
    const move = (e: PointerEvent) => handlers.move?.(map(e));
    const up = (e: PointerEvent) => handlers.up?.(map(e));
    // iOS Safari still fires a magnifier/long-press menu without this
    const block = (e: Event) => e.preventDefault();
    this.canvas.addEventListener("pointerdown", down);
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
    this.canvas.addEventListener("contextmenu", block);
    this.canvas.addEventListener("touchstart", block, { passive: false });
    this.cleanup.push(() => {
      this.canvas.removeEventListener("pointerdown", down);
      this.canvas.removeEventListener("pointermove", move);
      this.canvas.removeEventListener("pointerup", up);
      this.canvas.removeEventListener("pointercancel", up);
      this.canvas.removeEventListener("contextmenu", block);
      this.canvas.removeEventListener("touchstart", block);
    });
  }

  destroy() {
    this.observer.disconnect();
    for (const fn of this.cleanup) fn();
    this.canvas.remove();
  }
}

/**
 * requestAnimationFrame loop with a clamped delta so a backgrounded tab does
 * not resume with a giant simulation step.
 */
export class Loop {
  private raf = 0;
  private last = 0;
  private running = false;

  constructor(private frame: (dt: number) => void) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
