import type { Rect } from "@web-games/core";
import type { App } from "./app";
import { sprite } from "./art";
import {
  DOOR_TILE,
  type FurnitureId,
  GRID_COLS,
  GRID_ROWS,
  type Placed,
  TILL_TILES,
  type Weather,
} from "./config";
import { furniture, walkPath } from "./furniture";

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

/** Door → till, as points for the customers' feet (the door step first). */
export function walkway(f: Floor, placed: Placed[]) {
  const tiles = walkPath(placed) ?? [DOOR_TILE, TILL_TILES[0]];
  // They come in through the door, a step above the first tile
  const door = feet(f, DOOR_TILE);
  return [{ x: door.x, y: f.y0 - 4 }, ...tiles.map((t) => feet(f, t))];
}

/** The room: wall colour above it on tall screens, then the room art. */
export function drawRoom(app: App, f: Floor, view: Rect) {
  const { ctx } = app;
  ctx.fillStyle = WALL;
  ctx.fillRect(view.x, view.y, view.w, f.top - view.y + 2);
  const img = app.sprites.get("room-plain");
  if (img?.naturalWidth) ctx.drawImage(img, 0, f.top, ROOM.size, ROOM.size);
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
