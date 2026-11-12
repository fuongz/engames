import { type KeyboardEvent, type PointerEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Slider } from "#/components/ui/slider";
import { useMessages } from "#/hooks/use-messages";
import { type Crop, clampCrop, cropSide, drawCrop, MAX_ZOOM, MIN_ZOOM } from "./avatar-dialog.crop";

const KEY_STEP = 0.05; // arrow keys move the photo by this share of the frame
const KEY_ZOOM = 1.1;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The square frame over the picked photo, with a circle showing what the avatar
 * will look like. Drag to pan, wheel / pinch / slider to zoom; arrow keys and
 * +/- do the same from the keyboard. The picture is a canvas, so what you frame
 * is exactly what gets exported.
 */
export function AvatarCropper({
  bitmap,
  crop,
  onChange,
  disabled,
}: {
  bitmap: ImageBitmap;
  crop: Crop;
  onChange: (crop: Crop) => void;
  disabled?: boolean;
}) {
  const m = useMessages();
  const hintId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState(0);
  // Handlers read the latest crop here, so several events in one frame stack up
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchFrom = useRef(0);

  const apply = (next: Crop) => {
    const c = clampCrop(bitmap, next);
    cropRef.current = c;
    onChange(c);
  };
  const zoomBy = (factor: number) => apply({ ...cropRef.current, zoom: cropRef.current.zoom * factor });
  const panBy = (dx: number, dy: number) => {
    // dx, dy are in frame pixels; convert to photo pixels
    const c = cropRef.current;
    const k = cropSide(bitmap, c.zoom) / (frameRef.current?.clientWidth || 1);
    apply({ ...c, cx: c.cx - dx * k, cy: c.cy - dy * k });
  };

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    setBox(el.clientWidth);
    const ro = new ResizeObserver(() => setBox(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Paint at the screen's pixel density, before the browser paints the frame
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || box === 0) return;
    const px = Math.round(box * (window.devicePixelRatio || 1));
    canvas.width = px;
    canvas.height = px;
    drawCrop(ctx, bitmap, crop, px);
  }, [bitmap, crop, box]);

  // React's onWheel is passive, and zooming must stop the page scrolling under it
  const wheel = useRef<(e: WheelEvent) => void>(undefined);
  wheel.current = (e) => {
    if (disabled) return;
    e.preventDefault();
    const rate = e.ctrlKey ? 0.01 : e.deltaMode === 1 ? 0.05 : 0.0015; // ctrl+wheel is a trackpad pinch
    zoomBy(Math.exp(-e.deltaY * rate));
  };
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const on = (e: WheelEvent) => wheel.current?.(e);
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, []);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchFrom.current = dist(a, b);
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || disabled) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 1) {
      panBy(next.x - prev.x, next.y - prev.y);
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = dist(a, b);
      if (pinchFrom.current > 0 && d > 0) zoomBy(d / pinchFrom.current);
      pinchFrom.current = d;
    }
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    pinchFrom.current = 0;
  };

  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = (frameRef.current?.clientWidth ?? 0) * KEY_STEP;
    // Arrow keys move the photo in the direction of the arrow
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[e.key];
    if (move) panBy(move[0], move[1]);
    else if (e.key === "+" || e.key === "=") zoomBy(KEY_ZOOM);
    else if (e.key === "-" || e.key === "_") zoomBy(1 / KEY_ZOOM);
    else return;
    e.preventDefault();
  };

  return (
    <div className="grid gap-3">
      {/* biome-ignore lint/a11y/useSemanticElements: a pan/zoom surface has no native element; it is a labelled, keyboard-operable group */}
      <div
        ref={frameRef}
        role="group"
        tabIndex={disabled ? -1 : 0}
        aria-label={m.profile.avatar.cropArea}
        aria-describedby={hintId}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        className="relative mx-auto aspect-square w-full max-w-72 cursor-grab touch-none overflow-hidden rounded-3xl bg-muted outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
        {/* Everything outside the avatar's circle is dimmed */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-background/65 [mask-image:radial-gradient(circle_closest-side,transparent_calc(100%-1px),black_100%)]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-foreground/70" />
      </div>
      <p id={hintId} className="text-center text-xs text-muted-foreground">
        {m.profile.avatar.cropHint}
      </p>
      <fieldset className="mx-auto flex h-9 w-full min-w-0 max-w-72 items-center px-1.5">
        <legend className="sr-only">{m.profile.avatar.zoom}</legend>
        <Slider
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={[crop.zoom]}
          disabled={disabled}
          onValueChange={(v) => apply({ ...cropRef.current, zoom: Array.isArray(v) ? v[0] : v })}
        />
      </fieldset>
    </div>
  );
}
