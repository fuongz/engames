import { type PointerInfo, type Rect, inRect } from "@web-games/core";

// Immediate-mode hit regions: every frame each screen draws its buttons and
// registers them here; pointer events between frames go to the topmost region
// under the finger. A tap fires on release inside the region, so a slip off a
// button cancels it, the way native buttons behave.

export interface Region {
  rect: Rect;
  /** Identifies the region across frames, for the pressed look. */
  key?: string;
  tap?(): void;
  /** Press, drag and release (hold buttons, stirring). */
  down?(p: PointerInfo): void;
  move?(p: PointerInfo): void;
  up?(p: PointerInfo): void;
}

const SLOP = 18;

export class Ui {
  private regions: Region[] = [];
  private active: Region | null = null;
  private start: PointerInfo | null = null;
  private travelled = 0;
  /** Key of the region currently held down, for drawing it pressed. */
  pressed: string | null = null;

  /** Call at the start of each render; screens re-register what they draw. */
  frame() {
    this.regions = [];
  }

  add(region: Region) {
    this.regions.push(region);
    return region;
  }

  /** A full-screen region that swallows taps behind a modal. */
  block(rect: Rect, tap?: () => void) {
    this.regions.push({ rect, tap });
  }

  isPressed(key: string) {
    return this.pressed === key;
  }

  down(p: PointerInfo) {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (!inRect(p, r.rect)) continue;
      this.active = r;
      this.start = p;
      this.travelled = 0;
      this.pressed = r.key ?? null;
      r.down?.(p);
      return;
    }
  }

  move(p: PointerInfo) {
    if (!this.active || !this.start) return;
    this.travelled = Math.max(
      this.travelled,
      Math.hypot(p.x - this.start.x, p.y - this.start.y),
    );
    if (this.pressed && !inRect(p, this.active.rect)) this.pressed = null;
    this.active.move?.(p);
  }

  up(p: PointerInfo) {
    const r = this.active;
    this.active = null;
    this.pressed = null;
    if (!r) return;
    r.up?.(p);
    if (r.tap && inRect(p, r.rect) && (this.travelled < SLOP || !r.move))
      r.tap();
  }

  /** Drop a hold when the game is suspended (tab hidden). */
  cancel() {
    const r = this.active;
    this.active = null;
    this.pressed = null;
    if (r && this.start) r.up?.(this.start);
  }
}
