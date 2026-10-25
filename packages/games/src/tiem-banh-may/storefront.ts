import type { Rect } from "@web-games/core";
import type { App } from "./app";
import { sprite } from "./art";
import {
  type FurnitureId,
  GRID_COLS,
  GRID_ROWS,
  type Placed,
  type Weather,
} from "./config";
import { furniture } from "./furniture";

// The storefront as drawn: the room (wall above, a floor of tiles below), the
// furniture standing on its tiles, and where customers walk. The room art is
// 1024 px square with the baseboard at 388 px; everything here is in game
// units for a room `ROOM.size` wide whose top is at `top`.

export const ROOM = { size: 540, baseboard: 388 / 1024 };
/** Furniture sprites are stored at 2x the 1024-px room: this maps them to the screen. */
const SPRITE_SCALE = ROOM.size / 2048;
/** Pieces stand a little above the tile's bottom edge, like in the art. */
const LIFT = 5;
/** The wall colour, to fill above the room on tall screens. */
const WALL = "#ecedd9";

export interface Floor {
  top: number;
  /** Where the tile grid starts, and one tile's size. */
  y0: number;
  tw: number;
  th: number;
}

export function floorAt(top: number): Floor {
  const y0 = top + ROOM.size * ROOM.baseboard;
  return {
    top,
    y0,
    tw: ROOM.size / GRID_COLS,
    th: (top + ROOM.size - y0) / GRID_ROWS,
  };
}

export const tileRect = (
  f: Floor,
  x: number,
  y: number,
  w = 1,
  h = 1,
): Rect => ({
  x: x * f.tw,
  y: f.y0 + y * f.th,
  w: w * f.tw,
  h: h * f.th,
});

/** The tile under a point, or null off the floor. */
export function tileAt(f: Floor, px: number, py: number) {
  const x = Math.floor(px / f.tw);
  const y = Math.floor((py - f.y0) / f.th);
  if (x < 0 || y < 0 || x >= GRID_COLS || y >= GRID_ROWS) return null;
  return { x, y };
}

/** Where a customer's feet are on a tile. */
export const feet = (f: Floor, t: { x: number; y: number }) => ({
  x: (t.x + 0.5) * f.tw,
  y: f.y0 + (t.y + 0.8) * f.th,
});

/** A room picture: the plain room, or a variant painted for one wall or floor. */
const roomArt = (id: FurnitureId) =>
  id === "wall-plain" || id === "floor-plain" ? "room-plain" : `room-${id}`;

/** The room: wall colour above it on tall screens, then the wall and the floor. */
export function drawRoom(
  app: App,
  f: Floor,
  view: Rect,
  look: { wall: FurnitureId; floor: FurnitureId },
) {
  const { ctx } = app;
  ctx.fillStyle = WALL;
  ctx.fillRect(view.x, view.y, view.w, f.top - view.y + 2);
  const plain = app.sprites.get("room-plain");
  const wall = app.sprites.get(roomArt(look.wall)) ?? plain;
  const floor = app.sprites.get(roomArt(look.floor)) ?? plain;
  // Each picture is split on the baseboard: the wall's top, the floor's bottom
  const cut = ROOM.baseboard;
  for (const [img, from, to] of [
    [wall, 0, cut + 0.01],
    [floor, cut + 0.01, 1],
  ] as const) {
    if (!img?.naturalWidth) continue;
    const ih = img.naturalHeight;
    ctx.drawImage(
      img,
      0,
      from * ih,
      img.naturalWidth,
      (to - from) * ih,
      0,
      f.top + from * ROOM.size,
      ROOM.size,
      (to - from) * ROOM.size,
    );
  }
}

/** The light of the day over the room: grey for clouds and rain, gold at dusk. */
export function drawLight(app: App, f: Floor, weather: Weather, dusk: number) {
  const { ctx } = app;
  const r = { x: 0, y: f.top, w: ROOM.size, h: ROOM.size };
  ctx.save();
  if (weather !== "sunny") {
    ctx.fillStyle =
      weather === "rainy"
        ? "rgba(84, 104, 140, 0.16)"
        : "rgba(120, 128, 150, 0.1)";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  if (dusk > 0) {
    ctx.fillStyle = `rgba(255, 150, 80, ${0.16 * dusk})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.restore();
}

/** The door's and the window's glass, where rain shows (room-art pixels). */
const GLASS = [
  { x: 125, y: 80, w: 153, h: 182 },
  { x: 725, y: 75, w: 215, h: 223 },
];
export const glassRects = (f: Floor): Rect[] =>
  GLASS.map((g) => {
    const k = ROOM.size / 1024;
    return { x: g.x * k, y: f.top + g.y * k, w: g.w * k, h: g.h * k };
  });

/** A piece's picture on its tiles: standing on its footprint, mirrored if flipped. */
export function drawPiece(
  app: App,
  f: Floor,
  p: { id: FurnitureId; x: number; y: number; flip: boolean },
  opts: { alpha?: number; at?: { x: number; y: number } } = {},
) {
  const def = furniture(p.id);
  const img = app.sprites.get(def.sprite);
  if (!img?.naturalWidth) return;
  const { ctx } = app;
  const foot = tileRect(f, p.x, p.y, def.w, def.h);
  const w = img.naturalWidth * SPRITE_SCALE;
  const h = img.naturalHeight * SPRITE_SCALE;
  const cx = opts.at?.x ?? foot.x + foot.w / 2;
  const bottom = opts.at?.y ?? foot.y + foot.h - LIFT;
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.translate(cx, bottom);
  if (p.flip) ctx.scale(-1, 1);
  sprite(ctx, img, 0, 0, w, h, "bottom");
  ctx.restore();
}

/** Where a piece's feet are on screen, for drawing back to front. */
export const pieceDepth = (f: Floor, p: Placed) => {
  const def = furniture(p.id);
  return f.y0 + (p.y + def.h) * f.th;
};

/**
 * Where cakes stand on each stand's picture: per shelf, the shelf's top as a
 * fraction of the picture's height and its usable width (measured on the art).
 */
const SHELF_ART: Partial<
  Record<FurnitureId, { y: number; x0: number; x1: number }[]>
> = {
  "basic-stand": [
    { y: 0.36, x0: 0.09, x1: 0.91 },
    { y: 0.65, x0: 0.06, x1: 0.94 },
  ],
  "pink-stand": [
    { y: 0.47, x0: 0.09, x1: 0.91 },
    { y: 0.73, x0: 0.06, x1: 0.94 },
  ],
  "wood-shelf": [
    { y: 0.27, x0: 0.08, x1: 0.92 },
    { y: 0.5, x0: 0.06, x1: 0.94 },
    { y: 0.78, x0: 0.07, x1: 0.93 },
  ],
  "glass-case": [
    { y: 0.3, x0: 0.13, x1: 0.88 },
    { y: 0.49, x0: 0.11, x1: 0.9 },
    { y: 0.67, x0: 0.09, x1: 0.93 },
  ],
  "lavender-cart": [
    { y: 0.44, x0: 0.1, x1: 0.9 },
    { y: 0.66, x0: 0.08, x1: 0.92 },
  ],
  "lavender-counter": [
    { y: 0.36, x0: 0.12, x1: 0.9 },
    { y: 0.66, x0: 0.08, x1: 0.92 },
  ],
  "glass-fridge": [
    { y: 0.31, x0: 0.08, x1: 0.92 },
    { y: 0.48, x0: 0.08, x1: 0.92 },
    { y: 0.64, x0: 0.08, x1: 0.92 },
    { y: 0.81, x0: 0.08, x1: 0.92 },
  ],
};

export interface ShelfSpot<T> {
  stand: Placed;
  shelf: number;
  item: T;
}

/**
 * Batches onto shelves: stands back to front, left to right, each shelf top
 * down, one batch a shelf. Batches past the last shelf aren't shown (they
 * still sell).
 */
export function shelve<T>(placed: Placed[], items: T[]): ShelfSpot<T>[] {
  const stands = placed
    .filter((p) => furniture(p.id).kind === "stand")
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const out: ShelfSpot<T>[] = [];
  let i = 0;
  for (const stand of stands)
    for (let shelf = 0; shelf < (furniture(stand.id).shelves ?? 0); shelf++) {
      if (i >= items.length) return out;
      out.push({ stand, shelf, item: items[i++] });
    }
  return out;
}

/** The cakes on one shelf: up to three pieces (two in a narrow fridge). */
export function drawShelf(
  app: App,
  f: Floor,
  stand: Placed,
  shelf: number,
  cake: string,
  count: number,
) {
  const def = furniture(stand.id);
  const art = SHELF_ART[stand.id]?.[shelf];
  const img = app.sprites.get(def.sprite);
  const pic = app.sprites.get(cake);
  if (!art || !img?.naturalWidth || !pic?.naturalWidth) return;
  const { ctx } = app;
  const foot = tileRect(f, stand.x, stand.y, def.w, def.h);
  const w = img.naturalWidth * SPRITE_SCALE;
  const h = img.naturalHeight * SPRITE_SCALE;
  const left = foot.x + foot.w / 2 - w / 2;
  const top = foot.y + foot.h - LIFT - h;
  const per = def.w > 1 ? 3 : 2;
  const n = Math.min(per, count);
  const span = (art.x1 - art.x0) * w;
  const cw = (span / per) * 0.86;
  for (let i = 0; i < n; i++) {
    // Mirrored stands keep their shelves; cakes sit centred in thirds
    const x = left + art.x0 * w + (span * (2 * i + 1 + (per - n))) / (2 * per);
    ctx.save();
    sprite(ctx, pic, x, top + art.y * h, cw, cw * 0.95, "bottom");
    ctx.restore();
  }
}
