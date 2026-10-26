import type { Rect } from "@web-games/core";
import type { App } from "./app";
import { FONT, panel, sprite, text } from "./art";
import { fitFontSize } from "@web-games/core";

/** The decor's line colour, for the sign. */
const LINE_COLOUR = "#765e4c";
const FONT_WEIGHT = 700;
import {
  type FurnitureId,
  GRID_COLS,
  GRID_ROWS,
  type Placed,
  type Weather,
} from "./config";
import { type Decor, furniture, tillOf } from "./furniture";
import type { StockItem } from "./logic";
import { DOOR_TILE, RECIPES } from "./config";

// The storefront as drawn, seen from above: a floor of tiles (no wall), a
// welcome mat at the door, the furniture standing on its tiles, and where
// customers walk. The floor art is the 1024-px room picture: its painted tiles
// (six across, below the baseboard at 388 px) are cut out one by one and laid
// on a GRID_COLS × GRID_ROWS grid; everything here is in game units for a
// floor `ROOM.size` wide whose top is at `top`.

export const ROOM = { size: 540, baseboard: 388 / 1024 };
/** Tiles across and down in the room art. */
const ART_COLS = 6;
const ART_ROWS = 5;
/** One tile in game units: narrower than the art's, so more fit across. */
const TILE_W = ROOM.size / GRID_COLS;
const TILE_H = (TILE_W * ((1 - ROOM.baseboard) * 6)) / ART_ROWS;
/** How much smaller pieces are drawn than on the art's own tiles. */
export const PIECE_K = TILE_W / (ROOM.size / ART_COLS);
/** Furniture sprites are stored at 2x the 1024-px room: this maps them to the screen. */
const SPRITE_SCALE = (ROOM.size / 2048) * PIECE_K;
/** Pieces stand a little above the tile's bottom edge, like in the art. */
const LIFT = 4;
/** The wall colour when no wall art has loaded. */
const WALL = "#f1c9a5";
/** A low back wall, two tiles high, with the lamps and shelf on it. */
const WALL_H = TILE_H * 2;
/** The room as drawn: the wall, then GRID_ROWS rows of floor. */
export const ROOM_H = WALL_H + GRID_ROWS * TILE_H;

export interface Floor {
  top: number;
  /** Where the tile grid starts, and one tile's size. */
  y0: number;
  tw: number;
  th: number;
}

export function floorAt(top: number): Floor {
  return { top, y0: top + WALL_H, tw: TILE_W, th: TILE_H };
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

/**
 * Which painted tile a grid tile copies: one of the art's own, chosen to vary
 * and to keep a checkerboard's parity (tile colour follows (col + row) % 2).
 */
function artTile(c: number, r: number) {
  const ar = 1 + ((((r * 5 + c * 3) % 3) + 3) % 3);
  const parity = (((c + r + ar) % 2) + 2) % 2;
  const ac = parity + 2 * ((((c * 7 + r * 11) % 3) + 3) % 3);
  return { ac, ar };
}

/**
 * The floor, tile by tile, from row `from` (negative: above the grid, to fill
 * a tall screen) down to `rows`; then the bought wall's colour as a trim
 * along the grid's top edge, and the welcome mat at the door.
 */
export function drawRoom(
  app: App,
  f: Floor,
  view: Rect,
  look: { wall: FurnitureId; floor: FurnitureId },
  rows = GRID_ROWS,
  from = 0,
) {
  const { ctx } = app;
  const plain = app.sprites.get("room-plain");
  // The crayon floors: 4 × 4 tiles, cut out one by one (checks keep alternating)
  const tiles = app.sprites.get(`tile-${look.floor}`);
  const floor = app.sprites.get(roomArt(look.floor)) ?? plain;
  if (tiles?.naturalWidth) {
    const sw = tiles.naturalWidth / 4;
    const sh = tiles.naturalHeight / 4;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < GRID_COLS; c++) {
        const ar = (((r * 3 + c) % 4) + 4) % 4;
        const ac =
          ((((c * 5 + r * 7) % 2) + 2) % 2) * 2 +
          ((((c + r + ar) % 2) + 2) % 2);
        ctx.drawImage(
          tiles,
          ac * sw + 2,
          ar * sh + 2,
          sw - 4,
          sh - 4,
          c * f.tw - 0.5,
          f.y0 + r * f.th - 0.5,
          f.tw + 1,
          f.th + 1,
        );
      }
  } else if (floor?.naturalWidth) {
    const iw = floor.naturalWidth;
    const ih = floor.naturalHeight;
    const sw = iw / ART_COLS;
    const sh = (ih * (1 - ROOM.baseboard)) / ART_ROWS;
    for (let r = Math.max(0, from); r < rows; r++)
      for (let c = 0; c < GRID_COLS; c++) {
        const { ac, ar } = artTile(c, r);
        ctx.drawImage(
          floor,
          ac * sw + 1,
          ih * ROOM.baseboard + ar * sh + 1,
          sw - 2,
          sh - 2,
          c * f.tw - 0.5,
          f.y0 + r * f.th - 0.5,
          f.tw + 1,
          f.th + 1,
        );
      }
  } else {
    ctx.fillStyle = "#efe4cf";
    ctx.fillRect(view.x, f.y0 + from * f.th, view.w, (rows - from) * f.th);
  }
  // The back wall: the crayon strip (lamps, picture, shelf) along the top,
  // its plain plaster carried on up behind the HUD
  const strip =
    app.sprites.get(`wallstrip-${look.wall}`) ??
    app.sprites.get("wallstrip-wall-plain");
  if (strip?.naturalWidth) {
    const sw = (strip.naturalWidth * WALL_H) / strip.naturalHeight;
    for (let x = 0; x < ROOM.size; x += sw - 1)
      ctx.drawImage(strip, x, f.top, sw, WALL_H);
    if (f.top > view.y)
      for (let x = 0; x < ROOM.size; x += sw - 1)
        ctx.drawImage(
          strip,
          0,
          2,
          strip.naturalWidth,
          strip.naturalHeight * 0.18,
          x,
          view.y,
          sw,
          f.top - view.y + 1,
        );
  } else {
    ctx.fillStyle = WALL;
    ctx.fillRect(view.x, view.y, view.w, f.y0 - view.y);
  }
  // The welcome mat on the door tile
  const d = tileRect(f, DOOR_TILE.x, DOOR_TILE.y);
  panel(
    ctx,
    { x: d.x + 6, y: d.y + 8, w: d.w - 12, h: d.h - 16 },
    { fill: "#b9d3a8", radius: 10, line: 2.5 },
  );
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(d.x + 12, d.y + 14, d.w - 24, d.h - 28);
  ctx.restore();
}

/** The light of the day over the room: grey for clouds and rain, gold at dusk. */
export function drawLight(app: App, f: Floor, weather: Weather, dusk: number) {
  const { ctx } = app;
  const r = { x: 0, y: f.top - 400, w: ROOM.size, h: ROOM_H + 800 };
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

/** The window's glass, where rain shows. */
export const glassRects = (_f: Floor): Rect[] => [];

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
  const { w, h } = pieceSize(img, def, f);
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
 * The trays on each stand's picture, as fractions of it: a row of `n` trays
 * between x0 and x1 whose floors sit at `y`. Measured on the crayon art.
 */
const TRAY_ROWS: Partial<
  Record<FurnitureId, { y: number; x0: number; x1: number; n: number }[]>
> = {
  // The original stands: two batches side by side on each shelf
  "basic-stand": [
    { y: 0.36, x0: 0.09, x1: 0.91, n: 2 },
    { y: 0.65, x0: 0.06, x1: 0.94, n: 2 },
  ],
  "pink-stand": [
    { y: 0.47, x0: 0.09, x1: 0.91, n: 2 },
    { y: 0.73, x0: 0.06, x1: 0.94, n: 2 },
  ],
  "wood-shelf": [
    { y: 0.27, x0: 0.08, x1: 0.92, n: 2 },
    { y: 0.5, x0: 0.06, x1: 0.94, n: 2 },
    { y: 0.78, x0: 0.07, x1: 0.93, n: 2 },
  ],
  "glass-case": [
    { y: 0.3, x0: 0.13, x1: 0.88, n: 2 },
    { y: 0.49, x0: 0.11, x1: 0.9, n: 2 },
    { y: 0.67, x0: 0.09, x1: 0.93, n: 2 },
  ],
  "lavender-cart": [
    { y: 0.44, x0: 0.1, x1: 0.9, n: 2 },
    { y: 0.66, x0: 0.08, x1: 0.92, n: 2 },
  ],
  "lavender-counter": [
    { y: 0.36, x0: 0.12, x1: 0.9, n: 2 },
    { y: 0.66, x0: 0.08, x1: 0.92, n: 2 },
  ],
  "glass-fridge": [
    { y: 0.31, x0: 0.08, x1: 0.92, n: 1 },
    { y: 0.48, x0: 0.08, x1: 0.92, n: 1 },
    { y: 0.64, x0: 0.08, x1: 0.92, n: 1 },
    { y: 0.81, x0: 0.08, x1: 0.92, n: 1 },
  ],
  // The tray counters: one row of trays along the top
  "counter-2": [{ y: 0.42, x0: 0.06, x1: 0.94, n: 4 }],
  "counter-3": [{ y: 0.42, x0: 0.05, x1: 0.95, n: 6 }],
};

/** Tray `i` of a stand: its centre and floor as fractions, and its width. */
function tray(id: FurnitureId, i: number) {
  let k = i;
  for (const row of TRAY_ROWS[id] ?? []) {
    if (k < row.n) {
      const tw = (row.x1 - row.x0) / row.n;
      return { cx: row.x0 + tw * (k + 0.5), y: row.y, w: tw };
    }
    k -= row.n;
  }
  return null;
}

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

/** Pieces drawn to fit their tiles exactly, whatever the art's size. */
const FIT_FOOTPRINT = new Set<FurnitureId>(["counter-2", "counter-3"]);

/** How big a piece's picture is drawn. */
function pieceSize(
  img: HTMLImageElement,
  def: { id: FurnitureId; w: number },
  f: Floor,
) {
  if (FIT_FOOTPRINT.has(def.id)) {
    const w = def.w * f.tw;
    return { w, h: (w * img.naturalHeight) / img.naturalWidth };
  }
  return {
    w: img.naturalWidth * SPRITE_SCALE,
    h: img.naturalHeight * SPRITE_SCALE,
  };
}

/** One batch in its tray: the recipe's little pile (or its plate as a stand-in). */
export function drawShelf(
  app: App,
  f: Floor,
  stand: Placed,
  shelf: number,
  recipeId: string,
) {
  const def = furniture(stand.id);
  const t = tray(stand.id, shelf);
  const img = app.sprites.get(def.sprite);
  const pic =
    app.sprites.get(`stand-${recipeId}`) ??
    app.sprites.get(RECIPES.find((r) => r.id === recipeId)?.sprite ?? "");
  if (!t || !img?.naturalWidth || !pic?.naturalWidth) return;
  const foot = tileRect(f, stand.x, stand.y, def.w, def.h);
  const { w, h } = pieceSize(img, def, f);
  const left = foot.x + foot.w / 2 - w / 2;
  const top = foot.y + foot.h - LIFT - h;
  // Mirrored stands keep their trays where the art has them
  const cx = stand.flip ? left + (1 - t.cx) * w : left + t.cx * w;
  // As wide as the tray, but never taller than the gap to the shelf above
  const pw = Math.min(t.w * w * 0.95, h * 0.34);
  sprite(app.ctx, pic, cx, top + t.y * h, pw, pw, "bottom");
}

/**
 * The bakery's name on a little wooden sign, hung on the wall band between the
 * door and the window.
 */
export function drawSign(app: App, f: Floor, name: string, top?: number) {
  const { ctx } = app;
  const cx = 282;
  const size = fitFontSize(ctx, name, 18, 160, FONT, FONT_WEIGHT);
  ctx.font = `${FONT_WEIGHT} ${size}px ${FONT}`;
  const w = Math.min(190, ctx.measureText(name).width + 34);
  const h = 34;
  const r = { x: cx - w / 2, y: top ?? f.top - h - 6, w, h };
  // Two strings up to a nail
  ctx.save();
  ctx.strokeStyle = LINE_COLOUR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r.x + 16, r.y + 4);
  ctx.lineTo(cx, r.y - 8);
  ctx.lineTo(r.x + r.w - 16, r.y + 4);
  ctx.stroke();
  ctx.restore();
  panel(ctx, r, {
    fill: "#f2d3a4",
    stroke: LINE_COLOUR,
    radius: 10,
    line: 2.5,
  });
  text(ctx, name, cx, r.y + r.h / 2 + 1, { size, fill: LINE_COLOUR });
}

/** Customers' and Mây's size in the room (their sprites are drawn 250 × this tall). */
export const CUSTOMER_S = 0.46 * PIECE_K;

/** Batches on show, in the book's order, best stars first. */
export function standSlots(stock: StockItem[]) {
  const order = RECIPES.map((r) => r.id);
  return stock
    .filter((x) => x.count > 0)
    .map((x) => ({ recipe: x.recipe, stars: x.stars, count: x.count }))
    .sort(
      (a, b) =>
        order.indexOf(a.recipe) - order.indexOf(b.recipe) || b.stars - a.stars,
    );
}

/**
 * The storefront as a scene: furniture (stands showing their cakes), Mây
 * behind the counter and any `extras` (customers), back to front, then the
 * name sign on top.
 */
export function drawStorefront(
  app: App,
  f: Floor,
  decor: Decor,
  stock: StockItem[],
  name: string,
  extras: { y: number; draw: () => void }[] = [],
  /** Where the name sign hangs (when the wall band is hidden behind something). */
  signTop?: number,
) {
  const shelves = shelve(decor.placed, standSlots(stock));
  const scene: { y: number; draw: () => void }[] = [
    ...decor.placed.map((p) => ({
      y: pieceDepth(f, p),
      draw: () => {
        drawPiece(app, f, p);
        for (const spot of shelves)
          if (spot.stand === p)
            drawShelf(app, f, p, spot.shelf, spot.item.recipe);
      },
    })),
    ...extras,
  ];
  const till = tillOf(decor.placed);
  if (till)
    scene.push({
      y: f.y0 + (till.y + 1) * f.th - 1,
      draw: () => {
        const def = furniture(till.id);
        const r = tileRect(f, till.x, till.y, def.w, 1);
        const h = 250 * CUSTOMER_S * 1.05;
        const bob = Math.abs(Math.sin(app.time * 3)) * 2;
        sprite(
          app.ctx,
          app.sprites.get("mascot-shop") ?? app.sprites.get("mascot-happy"),
          r.x + r.w / 2,
          r.y + r.h - 2 - bob,
          h,
          h,
          "bottom",
        );
      },
    });
  for (const d of scene.sort((a, b) => a.y - b.y)) d.draw();
  drawSign(app, f, name, signTop);
}
