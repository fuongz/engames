import {
  CHARM_MAX_BOOST,
  CHARM_REPEAT,
  CHARM_SCALE,
  CHARM_TIERS,
  DOOR_TILE,
  FURNITURE,
  type Furniture,
  type FurnitureId,
  GRID_COLS,
  GRID_ROWS,
  type Placed,
  SEAT_MAX,
  SEAT_PATIENCE,
  SET_BONUS,
  START_FLOOR,
  START_LAYOUT,
  START_WALL,
  TILL_TILES,
} from "./config";
import type { Outcome, SaveData } from "./logic";

// The storefront's furniture: what is owned, where it stands, and the charm it
// gives. Pure: the decor screen and the shop draw from these.

export interface Decor {
  /** Every piece bought (a piece twice is listed twice), walls and floors too. */
  owned: FurnitureId[];
  placed: Placed[];
  wall: FurnitureId;
  floor: FurnitureId;
}

export const furniture = (id: FurnitureId): Furniture => {
  const found = FURNITURE.find((f) => f.id === id);
  if (!found) throw new Error(`Unknown furniture ${id}`);
  return found;
};

export const startDecor = (): Decor => ({
  owned: [...START_LAYOUT.map((p) => p.id), START_WALL, START_FLOOR],
  placed: START_LAYOUT.map((p) => ({ ...p })),
  wall: START_WALL,
  floor: START_FLOOR,
});

const count = (ids: FurnitureId[]) => {
  const n = new Map<FurnitureId, number>();
  for (const id of ids) n.set(id, (n.get(id) ?? 0) + 1);
  return n;
};

/** Owned pieces not on the floor (walls and floors never count as stored). */
export function stored(decor: Decor): FurnitureId[] {
  const left = count(decor.placed.map((p) => p.id));
  const out: FurnitureId[] = [];
  for (const id of decor.owned) {
    const k = furniture(id).kind;
    if (k === "wall" || k === "floor") continue;
    const n = left.get(id) ?? 0;
    if (n > 0) left.set(id, n - 1);
    else out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------- the grid

const tiles = (p: Placed) => {
  const f = furniture(p.id);
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < f.h; dy++)
    for (let dx = 0; dx < f.w; dx++) out.push({ x: p.x + dx, y: p.y + dy });
  return out;
};

const key = (x: number, y: number) => y * GRID_COLS + x;
const BLOCKED = new Set([DOOR_TILE, ...TILL_TILES].map((t) => key(t.x, t.y)));

/** Tiles under furniture, or null if a piece is off the floor or on another. */
export function occupied(placed: Placed[]): Set<number> | null {
  const taken = new Set<number>();
  for (const p of placed) {
    for (const t of tiles(p)) {
      if (t.x < 0 || t.y < 0 || t.x >= GRID_COLS || t.y >= GRID_ROWS)
        return null;
      const k = key(t.x, t.y);
      if (taken.has(k) || BLOCKED.has(k)) return null;
      taken.add(k);
    }
  }
  return taken;
}

/** Free tiles a customer can walk to from the door. */
function reachable(taken: Set<number>) {
  const seen = new Set([key(DOOR_TILE.x, DOOR_TILE.y)]);
  const queue = [DOOR_TILE];
  while (queue.length) {
    const t = queue.shift() as { x: number; y: number };
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = t.x + dx;
      const y = t.y + dy;
      const k = key(x, y);
      if (x < 0 || y < 0 || x >= GRID_COLS || y >= GRID_ROWS) continue;
      if (seen.has(k) || taken.has(k)) continue;
      seen.add(k);
      queue.push({ x, y });
    }
  }
  return seen;
}

/** The shortest walk over free tiles from the door to the till, or null. */
export function walkPath(placed: Placed[]) {
  const taken = occupied(placed);
  if (!taken) return null;
  const goal = TILL_TILES[0];
  const from = new Map<number, number>([[key(DOOR_TILE.x, DOOR_TILE.y), -1]]);
  const queue = [DOOR_TILE];
  while (queue.length) {
    const t = queue.shift() as { x: number; y: number };
    if (t.x === goal.x && t.y === goal.y) {
      const path: { x: number; y: number }[] = [];
      for (let k = key(t.x, t.y); k !== -1; k = from.get(k) ?? -1)
        path.unshift({ x: k % GRID_COLS, y: Math.floor(k / GRID_COLS) });
      return path;
    }
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ]) {
      const x = t.x + dx;
      const y = t.y + dy;
      const k = key(x, y);
      if (x < 0 || y < 0 || x >= GRID_COLS || y >= GRID_ROWS) continue;
      if (from.has(k) || taken.has(k)) continue;
      from.set(k, key(t.x, t.y));
      queue.push({ x, y });
    }
  }
  return null;
}

/**
 * Can the shop open with this layout? Every piece on the floor and on no other,
 * the door and the till kept clear, a walkable way from the door to the till,
 * and every stand reachable from the tile in front of it.
 */
export function layoutOk(placed: Placed[]) {
  const taken = occupied(placed);
  if (!taken) return false;
  const walk = reachable(taken);
  if (!TILL_TILES.every((t) => walk.has(key(t.x, t.y)))) return false;
  return placed.every((p) => {
    const f = furniture(p.id);
    if (f.kind !== "stand") return true;
    const front = p.y + f.h;
    if (front >= GRID_ROWS) return false;
    for (let dx = 0; dx < f.w; dx++)
      if (walk.has(key(p.x + dx, front))) return true;
    return false;
  });
}

// ---------------------------------------------------------------- charm

/** The storefront's charm: placed pieces (repeats count less), set bonuses, wall and floor. */
export function charm(decor: Decor) {
  const seen = new Map<FurnitureId, number>();
  const bySet = new Map<string, { pieces: number; charm: number }>();
  for (const p of decor.placed) {
    const f = furniture(p.id);
    const n = seen.get(p.id) ?? 0;
    seen.set(p.id, n + 1);
    const c = f.charm * (CHARM_REPEAT[n] ?? 0);
    const s = bySet.get(f.set) ?? { pieces: 0, charm: 0 };
    bySet.set(f.set, { pieces: s.pieces + 1, charm: s.charm + c });
  }
  let total = furniture(decor.wall).charm + furniture(decor.floor).charm;
  for (const [set, s] of bySet) {
    const bonus =
      set === "basic"
        ? 0
        : (SET_BONUS.find((b) => s.pieces >= b.pieces)?.bonus ?? 0);
    total += s.charm * (1 + bonus);
  }
  return Math.round(total * 10) / 10;
}

/** 0 Giản dị, 1 Ấm cúng, 2 Dễ thương, 3 Nổi tiếng. */
export function charmTier(c: number) {
  let t = 0;
  CHARM_TIERS.forEach((need, i) => {
    if (c >= need) t = i;
  });
  return t;
}

/** How much charm multiplies the day's customers (saturating, at most +50%). */
export const charmBoost = (c: number) =>
  1 + CHARM_MAX_BOOST * (1 - Math.exp(-c / CHARM_SCALE));

/** Extra patience from the seats on the floor. */
export function seatPatience(decor: Decor) {
  const seats = decor.placed.filter(
    (p) => furniture(p.id).kind === "seat",
  ).length;
  return 1 + Math.min(SEAT_MAX, seats * SEAT_PATIENCE);
}

/** Coins spent on furniture beyond the free starting set (leaderboard worth). */
export function furnitureWorth(decor: Decor) {
  const free = count(startDecor().owned);
  let worth = 0;
  for (const id of decor.owned) {
    const n = free.get(id) ?? 0;
    if (n > 0) free.set(id, n - 1);
    else worth += furniture(id).price;
  }
  return worth;
}

/** Pieces the Furniture aisle sells (the plain wall and floor come with the shop). */
export const forSale = (id: FurnitureId) => {
  const f = furniture(id);
  return f.price > 0 && f.kind !== "wall" && f.kind !== "floor";
};

// ---------------------------------------------------------------- actions

/** The first free spot (row by row) where a piece can stand, or null. */
export function freeSpot(placed: Placed[], id: FurnitureId): Placed | null {
  for (let y = 0; y < GRID_ROWS; y++)
    for (let x = 0; x < GRID_COLS; x++) {
      const p = { id, x, y, flip: false };
      if (layoutOk([...placed, p])) return p;
    }
  return null;
}

/**
 * New pieces into the storefront: each stands in the first free spot that keeps
 * the layout valid, or waits in storage when the floor is full.
 */
export function receive(decor: Decor, ids: FurnitureId[]): Decor {
  let placed = decor.placed;
  for (const id of ids) {
    const k = furniture(id).kind;
    if (k === "wall" || k === "floor") continue;
    const spot = freeSpot(placed, id);
    if (spot) placed = [...placed, spot];
  }
  return { ...decor, owned: [...decor.owned, ...ids], placed };
}

/** Buy a piece: it stands in a free spot, or goes to storage (walls and floors once). */
export function buyFurniture(save: SaveData, id: FurnitureId): Outcome {
  const f = furniture(id);
  const once = f.kind === "wall" || f.kind === "floor";
  if (once && save.decor.owned.includes(id)) return { ok: false, why: "owned" };
  if (f.tier > charmTier(charm(save.decor)))
    return { ok: false, why: "locked" };
  if (f.price > save.coins) return { ok: false, why: "coins" };
  return {
    ok: true,
    save: {
      ...save,
      coins: save.coins - f.price,
      decor: receive(save.decor, [id]),
    },
  };
}

/** The decor screen's result: a new layout, wall and floor, from what is owned. */
export function arrange(
  save: SaveData,
  placed: Placed[],
  wall: FurnitureId = save.decor.wall,
  floor: FurnitureId = save.decor.floor,
): Outcome {
  const have = count(save.decor.owned);
  const used = count(placed.map((p) => p.id));
  for (const [id, n] of used)
    if (n > (have.get(id) ?? 0)) return { ok: false, why: "owned" };
  if (
    !save.decor.owned.includes(wall) ||
    furniture(wall).kind !== "wall" ||
    !save.decor.owned.includes(floor) ||
    furniture(floor).kind !== "floor" ||
    placed.some((p) => {
      const k = furniture(p.id).kind;
      return k === "wall" || k === "floor";
    })
  )
    return { ok: false, why: "owned" };
  if (!layoutOk(placed)) return { ok: false, why: "layout" };
  return {
    ok: true,
    save: { ...save, decor: { ...save.decor, placed, wall, floor } },
  };
}
