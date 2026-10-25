import type { PointerInfo, Rect } from "@web-games/core";
import { type App, H, W, btn, close, top, viewRect } from "./app";
import { C, heart, panel, sprite, text } from "./art";
import {
  DOOR_TILE,
  type FurnitureId,
  GRID_COLS,
  GRID_ROWS,
  type Placed,
} from "./config";
import {
  arrange,
  charm,
  charmTier,
  furniture,
  layoutProblem,
  occupied,
  serviceTile,
  stored,
} from "./furniture";
import { K, pillWidth } from "./kit";
import {
  type Floor,
  ROOM,
  drawPiece,
  drawRoom,
  floorAt,
  pieceDepth,
  tileAt,
  tileRect,
} from "./storefront";

// Decor mode, from the night screen: the storefront as a grid. Drag a piece to
// move it (the tiles under it turn green where it fits, red where it doesn't),
// drop it on the storage drawer to put it away, drag one up from the drawer to
// place it; tap a piece for flip and store. The charm counts as you go, and
// "Done" only saves a layout the shop can open with.

export interface DecorState {
  placed: Placed[];
  /** A piece being dragged: where the finger is, and its offset from the piece's first tile. */
  drag: {
    piece: Placed;
    /** Where it came from, to go back to if the drop doesn't fit. */
    from: Placed | null;
    x: number;
    y: number;
    /** Where the press began. */
    sx: number;
    sy: number;
    dx: number;
    dy: number;
    moved: boolean;
  } | null;
  /** The piece tapped (index in `placed`), showing flip and store. */
  selected: number | null;
  page: number;
  /** The wall and floor showing, from those owned. */
  look: { wall: FurnitureId; floor: FurnitureId };
  /** Which drawer is open: stored furniture, walls or floors. */
  tab: "pieces" | "wall" | "floor";
}

export const newDecor = (decor: {
  placed: Placed[];
  wall: FurnitureId;
  floor: FurnitureId;
}): DecorState => ({
  placed: decor.placed.map((p) => ({ ...p })),
  drag: null,
  selected: null,
  page: 0,
  look: { wall: decor.wall, floor: decor.floor },
  tab: "pieces",
});

/** Pieces in the drawer, one card per kind with how many. */
const PER_PAGE = 4;
/** How far a finger must travel before a press becomes a drag. */
const DRAG_SLOP = 8;

function layout(app: App) {
  const y0 = Math.max(top(app), 0) + 12;
  const floor = floorAt(y0 + 92);
  const roomBottom = floor.top + ROOM.size;
  const drawer = { x: 14, y: roomBottom + 12, w: W - 28, h: 146 };
  return { y0, floor, drawer };
}

/** Drawer cards: the kinds in storage, in catalogue order, with a count. */
function storage(app: App, s: DecorState) {
  const owned = { ...app.save.decor, placed: s.placed };
  const left = stored(owned);
  const kinds: { id: FurnitureId; n: number }[] = [];
  for (const id of left) {
    const k = kinds.find((x) => x.id === id);
    if (k) k.n++;
    else kinds.push({ id, n: 1 });
  }
  return kinds;
}

/** Why a layout can't be saved, or null if it can. */
function problem(app: App, placed: Placed[]) {
  const why = layoutProblem(placed);
  return why ? app.tr().decor.problems[why] : null;
}

/** The piece under a point: its own tiles first, then a tall picture's top. */
function pieceAt(f: Floor, placed: Placed[], x: number, y: number) {
  const order = placed
    .map((p, i) => ({ p, i }))
    .sort((a, b) => pieceDepth(f, b.p) - pieceDepth(f, a.p));
  const hit = (rise: (kind: string) => number) => {
    for (const { p, i } of order) {
      const def = furniture(p.id);
      const r = tileRect(f, p.x, p.y, def.w, def.h);
      if (
        x >= r.x &&
        x <= r.x + r.w &&
        y >= r.y - rise(def.kind) &&
        y <= r.y + r.h
      )
        return i;
    }
    return -1;
  };
  const own = hit(() => 0);
  return own >= 0
    ? own
    : hit((kind) => (kind === "stand" ? f.th * 1.6 : f.th * 0.9));
}

/** Where a dragged piece would land, and whether it fits there. */
function landing(f: Floor, s: DecorState) {
  const d = s.drag;
  if (!d) return null;
  // The tile nearest the piece's first-tile centre
  const t = tileAt(f, d.x - d.dx + f.tw / 2, d.y - d.dy + f.th / 2);
  if (!t) return null;
  const piece = { ...d.piece, x: t.x, y: t.y };
  const fits = occupied([...s.placed, piece]) !== null;
  return { piece, fits };
}

export function drawDecor(app: App, s: DecorState) {
  const { ctx, save } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const v = viewRect(app);
  const { y0, floor: f, drawer } = layout(app);
  ctx.fillStyle = C.page;
  ctx.fillRect(v.x, v.y, v.w, v.h);
  drawRoom(app, f, v, s.look);

  // The grid: faint lines, the door and the till kept clear
  ctx.save();
  ctx.strokeStyle = "rgba(118, 94, 76, 0.18)";
  ctx.lineWidth = 1.5;
  for (let x = 1; x < GRID_COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * f.tw, f.y0);
    ctx.lineTo(x * f.tw, f.y0 + GRID_ROWS * f.th);
    ctx.stroke();
  }
  for (let y = 1; y < GRID_ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, f.y0 + y * f.th);
    ctx.lineTo(ROOM.size, f.y0 + y * f.th);
    ctx.stroke();
  }
  ctx.restore();
  // The door, and where customers pay, are kept clear
  const pay = serviceTile(s.placed);
  for (const [t, label] of [
    [DOOR_TILE, tr.decor.door],
    ...(pay && pay.y < GRID_ROWS ? [[pay, tr.decor.till] as const] : []),
  ] as const) {
    const r = tileRect(f, t.x, t.y);
    panel(
      ctx,
      { x: r.x + 6, y: r.y + 6, w: r.w - 12, h: r.h - 12 },
      { fill: "rgba(255, 255, 255, 0.45)", radius: 12, line: 1.5 },
    );
    text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, {
      size: 12,
      fill: C.muted,
      maxWidth: r.w - 14,
    });
  }

  // Where a dragged piece would go
  const land = landing(f, s);
  if (land) {
    const def = furniture(land.piece.id);
    const r = tileRect(f, land.piece.x, land.piece.y, def.w, def.h);
    ctx.save();
    ctx.fillStyle = land.fits
      ? "rgba(120, 200, 120, 0.35)"
      : "rgba(230, 100, 100, 0.35)";
    ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.restore();
  }

  // The furniture, back to front
  const order = s.placed
    .map((p, i) => ({ p, i }))
    .sort((a, b) => pieceDepth(f, a.p) - pieceDepth(f, b.p));
  for (const { p, i } of order) {
    drawPiece(app, f, p);
    if (s.selected === i) {
      const def = furniture(p.id);
      const r = tileRect(f, p.x, p.y, def.w, def.h);
      ctx.save();
      ctx.strokeStyle = C.good;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      ctx.restore();
    }
  }

  // Title, charm, and the way out without saving
  const tw = Math.max(150, pillWidth(app, tr.decor.title, false) + 20);
  const title = { x: (W - tw) / 2, y: y0, w: tw, h: K.pill };
  panel(ctx, title, { fill: "#dff3f6", radius: K.pill / 2, line: K.line });
  text(ctx, tr.decor.title, W / 2, title.y + title.h / 2, { size: 22 });
  close(app, { x: 0, y: y0 + 12, w: W - 30, h: 0 }, () =>
    app.go({ kind: "hub" }),
  );
  const c = charm({ ...save.decor, placed: s.placed, ...s.look });
  const chip = { x: W / 2 - 110, y: y0 + 50, w: 220, h: 30 };
  panel(ctx, chip, { fill: "#fde3ea", radius: 15, line: 2 });
  heart(ctx, chip.x + 22, chip.y + 15, 8);
  text(
    ctx,
    tr.decor.charmNow(c, tr.decor.tiers[charmTier(c)]),
    chip.x + 38,
    chip.y + 15,
    { size: 15, align: "left", maxWidth: chip.w - 46 },
  );

  // The room takes presses: pick up a piece, drag it, tap it
  const room: Rect = { x: 0, y: f.top + 40, w: ROOM.size, h: ROOM.size - 40 };
  app.ui.add({
    rect: room,
    down: (p) => {
      const i = pieceAt(f, s.placed, p.x, p.y);
      if (i < 0) {
        s.selected = null;
        return;
      }
      const piece = s.placed[i];
      const r = tileRect(f, piece.x, piece.y);
      s.drag = {
        piece,
        from: piece,
        x: p.x,
        y: p.y,
        sx: p.x,
        sy: p.y,
        dx: p.x - r.x,
        dy: Math.min(p.y - r.y, f.th - 4),
        moved: false,
      };
    },
    move: (p) => follow(s, p),
    up: (p) => drop(app, s, p, f, drawer),
  });

  drawDrawer(app, s, drawer, f, locale);

  // The selected piece: flip it, or put it away
  if (s.selected !== null && !s.drag) {
    const p = s.placed[s.selected];
    if (p) {
      const def = furniture(p.id);
      const r = tileRect(f, p.x, p.y, def.w, def.h);
      const cy = Math.max(f.top + 30, r.y - f.th * 1.4);
      const cx = Math.min(W - 70, Math.max(70, r.x + r.w / 2));
      roundAction(app, "decor-flip", cx - 34, cy, "⇄", () => {
        s.placed[s.selected ?? 0] = { ...p, flip: !p.flip };
      });
      roundAction(app, "decor-store", cx + 34, cy, "▾", () => {
        s.placed = s.placed.filter((_, i) => i !== s.selected);
        s.selected = null;
      });
    }
  }

  // The dragged piece follows the finger
  if (s.drag?.moved) {
    const d = s.drag;
    const def = furniture(d.piece.id);
    drawPiece(app, f, d.piece, {
      alpha: 0.85,
      at: {
        x: d.x - d.dx + (def.w * f.tw) / 2,
        y: d.y - d.dy + def.h * f.th - 5,
      },
    });
  }

  // What stops the layout from being saved, then cancel or done
  const why = problem(app, s.placed);
  if (why)
    text(ctx, why, W / 2, drawer.y + drawer.h + 16, {
      size: 15,
      fill: C.bad,
      maxWidth: W - 40,
    });
  const by = Math.min(H - 90, drawer.y + drawer.h + 34);
  btn(
    app,
    "decor-cancel",
    { x: 18, y: by, w: 180, h: 64 },
    tr.decor.cancel,
    () => app.go({ kind: "hub" }),
  );
  btn(
    app,
    "decor-done",
    { x: 214, y: by, w: W - 232, h: 64 },
    tr.decor.done,
    () => {
      const res = arrange(save, s.placed, s.look.wall, s.look.floor);
      if (!res.ok) return;
      app.sfx.coin();
      app.commit(res.save);
      app.go({ kind: "hub" });
    },
    {
      fill: C.green,
      size: 22,
      disabled: why !== null,
      // The reason is already written above the buttons: just the buzz
      onDisabled: () => {},
    },
  );
}

function follow(s: DecorState, p: PointerInfo) {
  const d = s.drag;
  if (!d) return;
  d.x = p.x;
  d.y = p.y;
  if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > DRAG_SLOP) {
    d.moved = true;
    // Lift it off the floor while it moves
    if (d.from) s.placed = s.placed.filter((x) => x !== d.from);
    s.selected = null;
  }
}

function drop(app: App, s: DecorState, p: PointerInfo, f: Floor, drawer: Rect) {
  const d = s.drag;
  s.drag = null;
  if (!d) return;
  if (!d.moved) {
    // A tap: select it (or let go of it)
    if (d.from) {
      const i = s.placed.indexOf(d.from);
      s.selected = s.selected === i ? null : i;
    }
    return;
  }
  d.x = p.x;
  d.y = p.y;
  const inDrawer =
    p.x >= drawer.x &&
    p.x <= drawer.x + drawer.w &&
    p.y >= drawer.y &&
    p.y <= drawer.y + drawer.h;
  if (inDrawer) {
    app.sfx.tap();
    return; // off the floor: it is in storage now
  }
  const land = landing(f, { ...s, drag: d });
  if (land?.fits) {
    s.placed = [...s.placed, land.piece];
    app.sfx.tap();
  } else {
    app.sfx.bad();
    if (d.from) s.placed = [...s.placed, d.from];
  }
}

function drawDrawer(
  app: App,
  s: DecorState,
  r: Rect,
  f: Floor,
  locale: "vi" | "en",
) {
  const { ctx } = app;
  const tr = app.tr();
  panel(ctx, r, { fill: "#f6e7cd", radius: 22, line: 2.5 });
  // Three drawers: stored pieces, walls, floors
  const tabs = [
    ["pieces", tr.decor.storage],
    ["wall", tr.decor.walls],
    ["floor", tr.decor.floors],
  ] as const;
  tabs.forEach(([id, label], i) => {
    const tw = (r.w - 24) / 3;
    const t = { x: r.x + 12 + i * tw, y: r.y + 6, w: tw - 6, h: 24 };
    const on = s.tab === id;
    panel(ctx, t, {
      fill: on ? "#dff3f6" : "rgba(255,255,255,0.5)",
      radius: 12,
      line: on ? 2 : 1.2,
    });
    text(ctx, label, t.x + t.w / 2, t.y + t.h / 2, {
      size: 13,
      fill: on ? C.text : C.muted,
      maxWidth: t.w - 8,
    });
    app.ui.add({
      rect: { x: t.x, y: t.y - 6, w: t.w, h: t.h + 10 },
      key: `decor-tab-${id}`,
      tap: () => {
        app.sfx.tap();
        s.tab = id;
        s.page = 0;
      },
    });
  });
  if (s.tab !== "pieces") return drawLooks(app, s, r, locale);
  const kinds = storage(app, s);
  if (!kinds.length) {
    text(ctx, tr.decor.storageEmpty, r.x + r.w / 2, r.y + r.h / 2 + 8, {
      size: 15,
      fill: C.muted,
      maxWidth: r.w - 30,
    });
    return;
  }
  const pages = Math.ceil(kinds.length / PER_PAGE);
  const page = Math.min(s.page, pages - 1);
  const shown = kinds.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const arrows = pages > 1 ? 30 : 0;
  const cw = (r.w - 20 - arrows * 2) / PER_PAGE;
  shown.forEach((k, i) => {
    const def = furniture(k.id);
    const card = {
      x: r.x + 10 + arrows + i * cw + 4,
      y: r.y + 32,
      w: cw - 8,
      h: r.h - 42,
    };
    panel(ctx, card, { fill: C.white, radius: 14, line: 2 });
    sprite(
      ctx,
      app.sprites.get(def.sprite),
      card.x + card.w / 2,
      card.y + card.h - 26,
      card.w - 16,
      card.h - 36,
      "bottom",
    );
    text(ctx, def.name[locale], card.x + card.w / 2, card.y + card.h - 12, {
      size: 11,
      maxWidth: card.w - 8,
    });
    if (k.n > 1)
      text(ctx, `×${k.n}`, card.x + card.w - 14, card.y + 14, {
        size: 13,
        fill: C.good,
      });
    app.ui.add({
      rect: card,
      down: (p) => {
        s.selected = null;
        s.drag = {
          piece: { id: k.id, x: 0, y: 0, flip: false },
          from: null,
          x: p.x,
          y: p.y,
          sx: p.x,
          sy: p.y,
          // Held above the finger, so the piece stays in sight
          dx: (def.w * f.tw) / 2,
          dy: f.th,
          moved: true,
        };
      },
      move: (p) => follow(s, p),
      up: (p) => drop(app, s, p, f, r),
    });
  });
  if (pages > 1) {
    const cy = r.y + 32 + (r.h - 42) / 2;
    if (page > 0)
      roundAction(app, "decor-prev", r.x + 22, cy, "‹", () => {
        s.page = page - 1;
      });
    if (page < pages - 1)
      roundAction(app, "decor-next", r.x + r.w - 22, cy, "›", () => {
        s.page = page + 1;
      });
  }
}

/** A small round button with one glyph, registered for taps. */
function roundAction(
  app: App,
  key: string,
  cx: number,
  cy: number,
  glyph: string,
  onTap: () => void,
) {
  const { ctx } = app;
  const sink = app.ui.isPressed(key) ? 2 : 0;
  ctx.beginPath();
  ctx.arc(cx, cy + sink, 22, 0, Math.PI * 2);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  text(ctx, glyph, cx, cy + sink - 1, { size: 22 });
  app.ui.add({
    rect: { x: cx - 26, y: cy - 26, w: 52, h: 52 },
    key,
    tap: () => {
      app.sfx.tap();
      onTap();
    },
  });
}

/** The wall or floor drawer: every one owned, the showing one ticked. */
function drawLooks(app: App, s: DecorState, r: Rect, locale: "vi" | "en") {
  const { ctx, save } = app;
  const kind = s.tab === "wall" ? "wall" : "floor";
  const owned = [...new Set(save.decor.owned)].filter(
    (id) => furniture(id).kind === kind,
  );
  const per = PER_PAGE;
  const pages = Math.max(1, Math.ceil(owned.length / per));
  const page = Math.min(s.page, pages - 1);
  const cw = (r.w - 20 - (pages > 1 ? 60 : 0)) / per;
  owned.slice(page * per, page * per + per).forEach((id, i) => {
    const def = furniture(id);
    const card = {
      x: r.x + 10 + (pages > 1 ? 30 : 0) + i * cw + 4,
      y: r.y + 36,
      w: cw - 8,
      h: r.h - 46,
    };
    const on = s.look[kind] === id;
    panel(ctx, card, {
      fill: on ? "#eaf7e1" : C.white,
      radius: 14,
      line: on ? 3 : 2,
    });
    sprite(
      ctx,
      app.sprites.get(def.sprite),
      card.x + card.w / 2,
      card.y + card.h / 2 - 8,
      card.w - 14,
      card.h - 36,
    );
    text(ctx, def.name[locale], card.x + card.w / 2, card.y + card.h - 12, {
      size: 11,
      maxWidth: card.w - 8,
    });
    app.ui.add({
      rect: card,
      key: `decor-look-${id}`,
      tap: () => {
        app.sfx.tap();
        s.look = { ...s.look, [kind]: id };
      },
    });
  });
  if (pages > 1) {
    const cy = r.y + 36 + (r.h - 46) / 2;
    if (page > 0)
      roundAction(app, "decor-prev", r.x + 22, cy, "‹", () => {
        s.page = page - 1;
      });
    if (page < pages - 1)
      roundAction(app, "decor-next", r.x + r.w - 22, cy, "›", () => {
        s.page = page + 1;
      });
  }
}
