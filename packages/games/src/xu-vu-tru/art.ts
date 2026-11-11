// Drawing for Xu Vũ Trụ in the chibi-cozy style. The painted parts are the v2
// sprites in img/v2/ (see its README): the cabinet, the wheel's prize tiles and
// hub, the gate, coins, orbs, the card back, the shelf floor, the pusher, the
// launch button and the two robots. game.ts imports them and makeSprites decodes
// each once; until one has decoded, a plain shape stands in for it. Everything
// that is text or live state (counters, marquee, reels, lamps, lights, pops) is
// drawn here in code, in the same palette, and so are the 1.2.0 parts: the
// robot jar on the front lip with its lane, and the hole's lid (no sprites, no
// art-src). The cat cards (img/cards-v3/<id>.webp)
// are loaded by game.ts too. The shelf is 2D physics seen from above; `proj`
// tilts it into a 3/4 view.
import { type Rect, clamp, lerp, mulberry32 } from "@web-games/core";
import {
  GATE_AMP,
  HOLE_HALF,
  isRare,
  JAR_W,
  JAR_X,
  LAND_X,
  PRIZE_QUEUE_MAX,
  SEG_SIZE,
  SEG_START,
  SHELF_D,
  SHELF_W,
  SIDE_WALL_D,
  type Segment,
  W,
  WHEEL,
} from "./config";
import type { Body } from "./physics";

type Ctx = CanvasRenderingContext2D;

export const FONT = '"Baloo 2", system-ui, sans-serif';
export const LED_FONT = '"Handjet", "Baloo 2", monospace';

// ---------------------------------------------------------------- palette (art/v2 style guide)

/** The gate's ready cue: the green orb's green. */
export const GO_GREEN = "#6CBF6A";
/** Outlines, and dark text strokes. */
export const BROWN = "#49332C";
export const CREAM = "#F5E4BE";
export const HONEY = "#EAB85D";
export const TERRA = "#CF795A";
export const TEAL = "#659E95";
/** Small light accents: cyan for coins, violet for the cat cards. */
export const CYAN = "#78E2D5";
export const VIOLET = "#B893DE";
/** Secondary text on the dark panels. */
export const MUTED = "#CDB98F";
/** Panels and windows: the cabinet's dusty space blue, darkened so cream text reads on it. */
const NIGHT = "#33404F";
const NIGHT_HI = "#46566A";
/** A deep brown for LED windows. */
const WELL = "#2E2420";
/** The six energy cores (the orb sprites): red, orange, yellow, green, blue, purple. */
export const CORE_COLORS = ["#E2584B", "#EE8E3E", "#F2CB4A", "#6CBF6A", "#4FA9D9", "#9C77D1"];

// ---------------------------------------------------------------- layout (logical px)

export const WHEEL_C = { x: 270, y: 262 };
/** The prize tiles fill the ring from WHEEL_IN to WHEEL_R; the rim with its bulbs sits outside it. */
export const WHEEL_R = 138;
export const WHEEL_IN = 70;
const RIM = 14;
export const MARQUEE: Rect = { x: 106, y: 12, w: 328, h: 48 };
export const LAMPS_Y = 88;
export const REEL: Rect = { x: 104, y: 420, w: 292, h: 52 };
export const SPINS_BOX: Rect = { x: 404, y: 420, w: 104, h: 52 };
export const MENU_BTN: Rect = { x: 8, y: 8, w: 78, h: 54 };
/** The card album, opposite the menu button. */
export const ALBUM_BTN: Rect = { x: 454, y: 8, w: 78, h: 54 };
/** The controls deck: two counters either side of the launch button, AUTO under the tickets. */
export const COINS_BOX: Rect = { x: 30, y: 860, w: 156, h: 56 };
export const TICKETS_BOX: Rect = { x: 354, y: 860, w: 156, h: 56 };
/** The launch button: `r` is its cap's radius (the hit circle adds a margin in game.ts). */
export const SHOOT = { x: 270, y: 880, r: 52 };
/** AUTO toggle under the tickets counter: clear of the button's hit circle and inside the canvas bottom. */
export const AUTO_BTN: Rect = { x: 354, y: 922, w: 156, h: 30 };
/** Screen rows of the shelf's back wall line and front edge, and the front's screen span. */
export const SHELF_TOP = 494;
export const SHELF_BOTTOM = 802;
const FRONT_L = 38;
const FRONT_R = 502;
const BACK_SCALE = 0.8;
/** The gate's centre: under the wheel's hub, where the hole swings (logic x 0 is here, 1 px = 1 px). */
export const GATE = { x: WHEEL_C.x, y: WHEEL_C.y + 82 };
/** Half the gate's swing room: the hole's full swing plus its rim. */
export const GATE_HALF = GATE_AMP + HOLE_HALF + 18;
/** The gate sprite's width: its U opening (43% of it) is the hole plus about half a coin's radius each side. */
const GATE_W = 124;
/** The chute from the button round the right side, ending at the wheel's rim level with the gate. */
export const CHUTE_X = 524;
export const CHUTE: { x: number; y: number }[] = [
  { x: SHOOT.x + 20, y: SHOOT.y + 30 },
  { x: 330, y: 944 },
  { x: CHUTE_X, y: 944 },
  { x: CHUTE_X, y: GATE.y - 34 },
  { x: GATE.x + GATE_HALF + 58, y: GATE.y - 34 },
];

// ---------------------------------------------------------------- projection

/** Shelf world (x across, y back→front) to the screen; `s` is the size factor there. */
export function proj(x: number, y: number) {
  const k = y / SHELF_D;
  const s = lerp(BACK_SCALE, 1, k) * ((FRONT_R - FRONT_L) / SHELF_W);
  return {
    x: W / 2 + (x - SHELF_W / 2) * s,
    y: SHELF_TOP + k * (SHELF_BOTTOM - SHELF_TOP),
    s,
  };
}

/** A point along a polyline, `k` 0..1 by length. */
export function along(pts: { x: number; y: number }[], k: number) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let d = clamp(k, 0, 1) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= seg || i === pts.length - 1) {
      const f = seg > 0 ? Math.min(1, d / seg) : 0;
      return { x: lerp(pts[i - 1].x, pts[i].x, f), y: lerp(pts[i - 1].y, pts[i].y, f) };
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

// ---------------------------------------------------------------- sprites

/** The v2 sprites, by file name (img/v2/<name>.webp). */
export const ART = [
  "cabinet-bg",
  "wheel-hub",
  "gate",
  "coin",
  "coin-stack2",
  "coin-stack3",
  "card-back",
  "card-back-rare",
  "ticket",
  "orb-red",
  "orb-orange",
  "orb-yellow",
  "orb-green",
  "orb-blue",
  "orb-purple",
  "tile-t5",
  "tile-t10",
  "tile-t20",
  "tile-t30",
  "tile-t50",
  "tile-t100",
  "tile-c1",
  "tile-c2",
  "tile-c4",
  "tile-c6",
  "tile-c8",
  "tile-core",
  "tile-card",
  "shelf-floor",
  "pusher",
  "shoot-idle",
  "shoot-pressed",
  "robot-left",
  "robot-right",
] as const;
export type ArtName = (typeof ART)[number];
export type ArtSrc = Record<ArtName, string>;
/** The orb sprite of each energy core, in CORE_COLORS order. */
const ORBS: ArtName[] = ["orb-red", "orb-orange", "orb-yellow", "orb-green", "orb-blue", "orb-purple"];

export interface Sprites {
  /** The v2 sprites that have decoded (a missing one draws its stand-in). */
  img: Partial<Record<ArtName, HTMLImageElement>>;
  /** The ten cat cards, in CARD_IDS order (they may still be loading). */
  cards: HTMLImageElement[];
  /** The wheel's prize ring at 2×, rotated as one image each frame (plain wedges until the tiles decode). */
  wheel: HTMLCanvasElement;
  /** The shelf's floor, back wall and side walls at 2× (a plain floor until its texture decodes). */
  shelf: HTMLCanvasElement;
  /** One coin lying flat in the 3/4 view, built from coin.webp. */
  coin: HTMLCanvasElement | null;
  /** The launch button greyed out, for when there are no coins. */
  shootOff: HTMLCanvasElement | null;
}

/** Start decoding every sprite; the caches built from them are swapped in as they land. */
export function makeSprites(cards: HTMLImageElement[], src: ArtSrc): Sprites {
  const sp: Sprites = { img: {}, cards, wheel: wheelRing(null), shelf: shelfDeck(null), coin: null, shootOff: null };
  const loads = new Map<ArtName, Promise<void>>();
  for (const name of ART) {
    const img = new Image();
    img.src = src[name];
    loads.set(
      name,
      img.decode().then(
        () => {
          sp.img[name] = img;
        },
        () => {
          // Stays on its stand-in
        },
      ),
    );
  }
  const after = (names: readonly ArtName[], build: () => void) => {
    void Promise.all(names.map((n) => loads.get(n))).then(build);
  };
  after([...new Set(WHEEL.map(tileOf))], () => {
    sp.wheel = wheelRing(sp.img);
  });
  after(["shelf-floor"], () => {
    sp.shelf = shelfDeck(sp.img["shelf-floor"] ?? null);
  });
  after(["coin"], () => {
    sp.coin = sp.img.coin ? coinSide(sp.img.coin) : null;
  });
  after(["shoot-idle"], () => {
    sp.shootOff = sp.img["shoot-idle"] ? dimmed(sp.img["shoot-idle"]) : null;
  });
  return sp;
}

/** Draw `img` with its bottom centre at (x, bottom), `w` wide, at its own aspect. */
function stand(ctx: Ctx, img: HTMLImageElement | HTMLCanvasElement, x: number, bottom: number, w: number) {
  const h = (w * img.height) / img.width;
  ctx.drawImage(img, x - w / 2, bottom - h, w, h);
}

const COIN_FACE = 96;
const COIN_RY = COIN_FACE * 0.29;
const COIN_TH = COIN_FACE * 0.13;
/** A coin lying flat, seen at 3/4: the round face squashed onto its honey edge. */
function coinSide(face: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = COIN_FACE + 6;
  c.height = Math.ceil(COIN_RY * 2 + COIN_TH + 6);
  const g = c.getContext("2d") as Ctx;
  const cx = c.width / 2;
  const top = 3 + COIN_RY;
  const rx = COIN_FACE / 2;
  g.beginPath();
  g.moveTo(cx - rx, top);
  g.lineTo(cx - rx, top + COIN_TH);
  g.ellipse(cx, top + COIN_TH, rx, COIN_RY, 0, Math.PI, 0, true);
  g.lineTo(cx + rx, top);
  g.closePath();
  g.fillStyle = "#C38A33";
  g.fill();
  g.strokeStyle = BROWN;
  g.lineWidth = 4;
  g.stroke();
  g.drawImage(face, cx - rx - 1.5, top - COIN_RY - 1.5, COIN_FACE + 3, COIN_RY * 2 + 3);
  return c;
}

/** The launch button with a brown wash: there is nothing to shoot. */
function dimmed(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext("2d") as Ctx;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "rgba(73,51,44,0.55)";
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** A coin, top view, `w` across (flying coins squash it as they spin). */
function coinFace(ctx: Ctx, sp: Sprites, x: number, y: number, w: number, h: number) {
  const img = sp.img.coin;
  if (img) {
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    return;
  }
  ctx.fillStyle = HONEY;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = Math.max(1, w * 0.08);
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** An energy orb standing with its bottom at (x, bottom), `w` across. */
export function drawOrb(ctx: Ctx, sp: Sprites, core: number, x: number, bottom: number, w: number) {
  const img = sp.img[ORBS[core]];
  if (img) {
    stand(ctx, img, x, bottom, w);
    return;
  }
  ctx.fillStyle = CORE_COLORS[core];
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = Math.max(1.5, w * 0.06);
  ctx.beginPath();
  ctx.arc(x, bottom - w / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.fillRect(x - w / 2, bottom - w * 0.56, w, w * 0.14);
}

/** The card back (a card whose cat is still a surprise), filling the rect. */
export function drawCardBack(ctx: Ctx, sp: Sprites, x: number, y: number, w: number, h: number, rare = false) {
  const img = (rare ? sp.img["card-back-rare"] : null) ?? sp.img["card-back"];
  if (img) {
    // The art is a rounded card on square white corners: clip to its own corner radius
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, w * 0.065);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    return;
  }
  ctx.fillStyle = TEAL;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = Math.max(1.2, w * 0.05);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, w * 0.12);
  ctx.fill();
  ctx.stroke();
}

/** The card back's height for a width. */
export const cardBackH = (w: number) => (w * 4) / 3;

// ---------------------------------------------------------------- text and UI

export function text(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  size: number,
  fill = CREAM,
  align: CanvasTextAlign = "center",
  stroke: string | null = BROWN,
  font = FONT,
  weight = 800,
) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size * 0.2);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

/** A title: chunky letters with a brown outline over a brown drop, like a sticker. */
export function headline(ctx: Ctx, str: string, x: number, y: number, size: number, color = CREAM, font = FONT) {
  ctx.save();
  ctx.font = `800 ${size}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, size * 0.22);
  ctx.strokeStyle = BROWN;
  ctx.fillStyle = BROWN;
  const drop = Math.max(2, size * 0.07);
  ctx.strokeText(str, x, y + drop);
  ctx.fillText(str, x, y + drop);
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** Largest size ≤ `size` at which `str` fits `maxW`. */
export function fitSize(ctx: Ctx, str: string, size: number, maxW: number, font = FONT) {
  let s = size;
  for (; s > 10; s -= 1) {
    ctx.font = `800 ${s}px ${font}`;
    if (ctx.measureText(str).width <= maxW) break;
  }
  return s;
}

/** A dusty-blue card with a brown outline and a cream inner border. */
export function panel(ctx: Ctx, r: Rect, radius = 22) {
  ctx.save();
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 6, r.w, r.h, radius);
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, NIGHT_HI);
  g.addColorStop(1, NIGHT);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14, Math.max(4, radius - 6));
  ctx.stroke();
  ctx.restore();
}

/** A chunky toy button; `colors` top→bottom. */
export function button(ctx: Ctx, r: Rect, label: string, colors: [string, string], size = 26, pressed = false) {
  ctx.save();
  const dy = pressed ? 3 : 0;
  const rad = r.h / 2.4;
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 6, r.w, r.h, rad);
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + dy, r.w, r.h, rad);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,248,230,0.32)";
  ctx.beginPath();
  ctx.roundRect(r.x + 10, r.y + dy + 5, r.w - 20, r.h * 0.24, r.h * 0.12);
  ctx.fill();
  text(ctx, label, r.x + r.w / 2, r.y + dy + r.h / 2 + 2, fitSize(ctx, label, size, r.w - 24), CREAM);
  ctx.restore();
}

/** A cream tile with a brown outline: the menu and album buttons. */
function tile(ctx: Ctx, r: Rect, edge = BROWN, lw = 3) {
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 4, r.w, r.h, 14);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = edge;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 14);
  ctx.fill();
  ctx.stroke();
}

export function drawMenuButton(ctx: Ctx, r: Rect, label: string) {
  ctx.save();
  tile(ctx, r);
  ctx.fillStyle = BROWN;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.roundRect(r.x + r.w / 2 - 12, r.y + 11 + i * 7, 24, 4, 2);
    ctx.fill();
  }
  text(ctx, label, r.x + r.w / 2, r.y + 42, fitSize(ctx, label, 14, r.w - 10), BROWN, "center", null);
  ctx.restore();
}

/** The album button: the card back, the owned count, and the label. `pulse` 0..1 after a new card. */
export function drawAlbumButton(ctx: Ctx, sp: Sprites, r: Rect, label: string, owned: number, total: number, pulse: number) {
  ctx.save();
  if (pulse > 0) {
    ctx.fillStyle = VIOLET;
    ctx.globalAlpha = pulse * 0.6;
    ctx.beginPath();
    ctx.roundRect(r.x - 5 * pulse, r.y - 5 * pulse, r.w + 10 * pulse, r.h + 10 * pulse, 18);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  tile(ctx, r, pulse > 0 ? "#7A4FA6" : BROWN, 3 + pulse * 2);
  ctx.save();
  ctx.translate(r.x + 20, r.y + 21);
  ctx.rotate(-0.12);
  const k = 1 + pulse * 0.25;
  ctx.scale(k, k);
  drawCardBack(ctx, sp, -9, -cardBackH(18) / 2, 18, cardBackH(18));
  ctx.restore();
  text(ctx, `${owned}/${total}`, r.x + 52, r.y + 21, 17, BROWN, "center", null);
  text(ctx, label, r.x + r.w / 2, r.y + 43, fitSize(ctx, label, 14, r.w - 10), BROWN, "center", null);
  ctx.restore();
}

/** The small version label in the cabinet's corner ("v1.0.0"). */
export function versionTag(ctx: Ctx, x: number, y: number, label: string) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  text(ctx, label, x, y, 13, MUTED, "center", BROWN, LED_FONT, 700);
  ctx.restore();
}

/** A lamp: a brown-rimmed bulb with a soft halo when lit. */
export function bulb(ctx: Ctx, x: number, y: number, r: number, color: string, on: boolean) {
  if (on) {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.arc(x, y, r + 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = on ? color : "#8C7458";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (on) {
    ctx.fillStyle = "rgba(255,252,240,0.85)";
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A warm-white lamp colour for chase lights on honey and cream. */
const LAMP_ON = "#FFF3CF";

// ---------------------------------------------------------------- background and cabinet

/**
 * Where the cabinet art's rows land (source y0, y1 → screen y0, y1). Only the
 * plain stretch of the interior grows, so the orange lip lands on the shelf's
 * front edge and the deck under it; the rest is drawn 1:1 (the art is 2×).
 */
const CAB_SLICES = [
  [0, 1130, 0, 565],
  [1130, 1410, 565, 787],
  [1410, 1920, 787, 1042],
] as const;
const CAB_BOTTOM = 1042;
/** Below this source row the cabinet reaches the image's side edges; the side bleed carries the backdrop row above it down. */
const CAB_EDGE_Y = 860;

/** The cabinet, with its backdrop carried out to the view's edges on tall or wide screens. */
export function drawCabinet(ctx: Ctx, sp: Sprites, view: Rect) {
  const img = sp.img["cabinet-bg"];
  if (!img) {
    plainCabinet(ctx, view);
    return;
  }
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const right = view.x + view.w;
  const bottom = view.y + view.h;
  for (const [s0, s1, d0, d1] of CAB_SLICES) ctx.drawImage(img, 0, s0, sw, s1 - s0, 0, d0, W, d1 - d0);
  if (view.x < 0) {
    // The backdrop's outer columns, out to the view's sides
    for (const [s0, s1, d0, d1] of CAB_SLICES) {
      const e1 = Math.min(s1, CAB_EDGE_Y);
      if (e1 <= s0) continue;
      const h = ((e1 - s0) / (s1 - s0)) * (d1 - d0);
      ctx.drawImage(img, 0, s0, 2, e1 - s0, view.x, d0, 0.5 - view.x, h);
      ctx.drawImage(img, sw - 2, s0, 2, e1 - s0, W - 0.5, d0, right - W + 0.5, h);
    }
    const [s0, s1, d0, d1] = CAB_SLICES[1];
    const y = d0 + ((CAB_EDGE_Y - 4 - s0) / (s1 - s0)) * (d1 - d0);
    ctx.drawImage(img, 0, CAB_EDGE_Y - 4, 2, 4, view.x, y, 0.5 - view.x, bottom - y);
    ctx.drawImage(img, sw - 2, CAB_EDGE_Y - 4, 2, 4, W - 0.5, y, right - W + 0.5, bottom - y);
  }
  if (view.y < 0) {
    // The top row either side of the knob (it touches the art's top edge), carried up
    const knob = sw * 0.06;
    const half = sw / 2 - knob;
    ctx.drawImage(img, 0, 0, half, 2, view.x, view.y, W / 2 - view.x, 0.5 - view.y);
    ctx.drawImage(img, sw - half, 0, half, 2, W / 2, view.y, right - W / 2, 0.5 - view.y);
  }
  if (bottom > CAB_BOTTOM) ctx.drawImage(img, 0, sh - 2, sw, 2, view.x, CAB_BOTTOM - 0.5, view.w, bottom - CAB_BOTTOM + 0.5);
}

/** The stand-in cabinet while its art decodes: a cream frame, a night interior, the lip and deck. */
function plainCabinet(ctx: Ctx, view: Rect) {
  ctx.fillStyle = "#56607A";
  ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 4;
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.roundRect(6, 22, W - 12, CAB_BOTTOM, 34);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#526477";
  ctx.beginPath();
  ctx.roundRect(36, 94, W - 72, SHELF_BOTTOM - 94, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = HONEY;
  ctx.fillRect(26, SHELF_BOTTOM, W - 52, 30);
  ctx.strokeRect(26, SHELF_BOTTOM, W - 52, 30);
}

/** The top marquee: a cream sign with chase lights round its prize line, flashing when it pays. */
export function drawMarquee(ctx: Ctx, label: string, t: number, hot: boolean) {
  const r = MARQUEE;
  ctx.save();
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 4, r.w, r.h, 16);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 16);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = hot && Math.floor(t * 8) % 2 === 0 ? TERRA : HONEY;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 12);
  ctx.stroke();
  const n = 14;
  for (let i = 0; i < n; i++) {
    const x = r.x + 22 + (i / (n - 1)) * (r.w - 44);
    const on = (i + Math.floor(t * (hot ? 14 : 5))) % 2 === 0;
    bulb(ctx, x, r.y + 5, 2.4, hot ? CORE_COLORS[i % 6] : HONEY, on);
    bulb(ctx, x, r.y + r.h - 5, 2.4, hot ? CORE_COLORS[(i + 3) % 6] : HONEY, !on);
  }
  const size = fitSize(ctx, label, 28, r.w - 44);
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 2, size, hot ? HONEY : TERRA);
  ctx.restore();
}

/** The core meter on the cabinet's crown: `slots` sockets, the first `count` lit. `flash` blinks them all (Super spin). */
export function drawCoreLamps(ctx: Ctx, sp: Sprites, count: number, slots: number, t: number, flash: boolean, pulse: number[]) {
  const gap = 58;
  const x0 = W / 2 - (gap * (slots - 1)) / 2;
  for (let i = 0; i < slots; i++) {
    const x = x0 + i * gap;
    const y = LAMPS_Y;
    const lit = flash ? Math.floor(t * 10 + i) % 2 === 0 : i < count;
    const p = pulse[i] ?? 0;
    const r = 19 + p * 5;
    ctx.save();
    if (lit) {
      ctx.globalAlpha = 0.35 + p * 0.4;
      ctx.fillStyle = CORE_COLORS[i];
      ctx.beginPath();
      ctx.arc(x, y, r + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = BROWN;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NIGHT;
    ctx.strokeStyle = lit ? CORE_COLORS[i] : "rgba(245,228,190,0.4)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r - 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!lit) ctx.globalAlpha = 0.3;
    const w = lit ? 28 + p * 8 : 24;
    drawOrb(ctx, sp, i, x, y + w * 0.48, w);
    ctx.restore();
  }
}

/** The robots stand either side of the wheel, bobbing; `cheer` makes them hop. */
export function drawRobots(ctx: Ctx, sp: Sprites, t: number, cheer: number) {
  const hop = cheer > 0 ? Math.abs(Math.sin(t * 12)) * 12 * Math.min(1, cheer) : 0;
  const bob0 = Math.sin(t * 2.2) * 4 + hop;
  const bob1 = Math.sin(t * 2.2 + 1.7) * 2 + hop * 0.8;
  const left = sp.img["robot-left"];
  const right = sp.img["robot-right"];
  if (left) stand(ctx, left, 64, 254 - bob0, (112 * left.width) / left.height);
  if (right) stand(ctx, right, 476, 250 - bob1, (112 * right.width) / right.height);
}

// ---------------------------------------------------------------- wheel

/** A wheel slot's tile: tile-t<n>, tile-c<n>, tile-core or tile-card. */
function tileOf(seg: Segment): ArtName {
  if (seg.kind === "core") return "tile-core";
  if (seg.kind === "card") return "tile-card";
  return `tile-${seg.kind === "tickets" ? "t" : "c"}${seg.value}` as ArtName;
}

/** The ground colour under each kind of tile (and the whole slot until the tiles decode). */
function slotColor(seg: Segment) {
  return seg.kind === "tickets" ? "#E7B35A" : seg.kind === "card" ? "#B99BD9" : "#8CBDB0";
}

const RING_K = 2;
/** Px kept clear between a tile and its wedge's edges (screen px). */
const TILE_GAP = 2;
/**
 * The biggest a tile can be drawn whole inside a wedge `angle` radians wide, at
 * its own aspect (`aspect` = width / height): its height and its bottom edge's
 * distance from the hub, in screen px. The v2 tiles are themselves wedge-shaped:
 * full width a quarter of the way down, about 55% of it at the bottom edge, with
 * rounded top corners; those three rows are what must stay inside the wedge.
 */
export function tileFit(angle: number, aspect: number) {
  const tan = Math.tan(angle / 2);
  const R = WHEEL_R - TILE_GAP;
  let best = { h: 0, d: WHEEL_IN + TILE_GAP };
  for (let d = WHEEL_IN + TILE_GAP; d < R; d += 0.5) {
    for (let h = 8; d + h <= R; h += 0.5) {
      const w = h * aspect;
      const wide = d + 0.75 * h;
      if (w / 2 > wide * tan - TILE_GAP || w * 0.275 > d * tan - TILE_GAP) break;
      if (Math.hypot(wide, w / 2) > R || Math.hypot(d + h, w * 0.3) > R) break;
      if (h > best.h) best = { h, d };
    }
  }
  return best;
}

/**
 * The prize ring at 2×: every slot is a wedge exactly as wide as its weight (so a
 * slot's share of the circle is its chance), with its tile drawn whole inside it
 * at its own aspect (tileFit): never cropped, never squashed. MIN_SLOT_WEIGHT
 * keeps the narrowest tile at about 80% of the ring's depth.
 */
function wheelRing(img: Sprites["img"] | null) {
  const K = RING_K;
  const R = WHEEL_R * K;
  const r0 = WHEEL_IN * K;
  const c = document.createElement("canvas");
  c.width = Math.ceil(R * 2 + 8);
  c.height = c.width;
  const g = c.getContext("2d") as Ctx;
  const cx = c.width / 2;
  const cy = c.height / 2;
  for (let i = 0; i < WHEEL.length; i++) {
    const a0 = SEG_START[i];
    const a1 = a0 + SEG_SIZE[i];
    const seg = WHEEL[i];
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, a0, a1);
    g.arc(cx, cy, r0, a1, a0, true);
    g.closePath();
    g.fillStyle = slotColor(seg);
    g.fill();
    const tile = img?.[tileOf(seg)];
    if (tile) {
      const aspect = tile.naturalWidth / tile.naturalHeight;
      const fit = tileFit(SEG_SIZE[i], aspect);
      const th = fit.h * K;
      const tw = th * aspect;
      g.translate(cx, cy);
      g.rotate((a0 + a1) / 2 + Math.PI / 2);
      g.drawImage(tile, -tw / 2, -(fit.d * K + th), tw, th);
    }
    g.restore();
  }
  // Slot borders
  g.strokeStyle = BROWN;
  g.lineWidth = 2.5 * K;
  g.lineCap = "round";
  g.beginPath();
  for (const a of SEG_START) {
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  g.stroke();
  g.lineWidth = 3 * K;
  for (const r of [R - 1.5 * K, r0]) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  return c;
}

/** What the prize light shows: `segs[0]` is lit, the rest fade behind it; `won` blinks the stopped slot. */
export interface WheelLight {
  segs: number[];
  won: boolean;
}

/** One slot of the wheel as a wedge path (screen coords), from radius r0 to r1. */
function wedge(ctx: Ctx, angle: number, seg: number, r0: number, r1: number) {
  const { x, y } = WHEEL_C;
  const a0 = angle + SEG_START[seg];
  const a1 = a0 + SEG_SIZE[seg];
  ctx.beginPath();
  ctx.arc(x, y, r1, a0, a1);
  ctx.arc(x, y, r0, a1, a0, true);
  ctx.closePath();
}

/** The prize wheel behind glass, turning; a prize spin is a light chasing round its slots. */
export function drawWheel(ctx: Ctx, sp: Sprites, angle: number, t: number, chase: number, light: WheelLight | null) {
  const { x, y } = WHEEL_C;
  const R = WHEEL_R;
  ctx.save();
  // Rim: a honey band with a chase of bulbs
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.arc(x, y + 4, R + RIM + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = HONEY;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, R + RIM, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const on = (i + Math.floor(chase)) % 4 === 0 || (i + Math.floor(chase)) % 4 === 2;
    bulb(ctx, x + Math.cos(a) * (R + RIM / 2 + 0.5), y + Math.sin(a) * (R + RIM / 2 + 0.5), 3, LAMP_ON, on);
  }
  // The ring
  ctx.translate(x, y);
  ctx.rotate(angle);
  const d = sp.wheel.width / RING_K;
  ctx.drawImage(sp.wheel, -d / 2, -d / 2, d, d);
  ctx.restore();
  // The prize light: the lit slot glows cream with a fading trail; the stopped one blinks
  if (light) {
    ctx.save();
    light.segs.forEach((seg, i) => {
      ctx.globalAlpha = light.won && i === 0 ? (Math.floor(t * 8) % 2 === 0 ? 0.75 : 0.35) : 0.7 / (i + 1);
      ctx.fillStyle = "#FFF8E6";
      wedge(ctx, angle, seg, WHEEL_IN, R);
      ctx.fill();
    });
    const head = light.segs[0];
    if (head !== undefined) {
      ctx.globalAlpha = 1;
      ctx.lineJoin = "round";
      ctx.strokeStyle = BROWN;
      ctx.lineWidth = 10;
      wedge(ctx, angle, head, WHEEL_IN + 3, R - 3);
      ctx.stroke();
      ctx.strokeStyle = light.won && Math.floor(t * 8) % 2 === 1 ? TERRA : "#FFD36B";
      ctx.lineWidth = 5.5;
      ctx.stroke();
    }
    ctx.restore();
  }
  // Hub: the robot face, upright while the ring turns
  const hub = sp.img["wheel-hub"];
  if (hub) {
    const w = WHEEL_IN * 2 + 16;
    const h = (w * hub.height) / hub.width;
    ctx.drawImage(hub, x - w / 2, y - h * 0.557, w, h);
  } else {
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, WHEEL_IN - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2F4A44";
    ctx.beginPath();
    ctx.roundRect(x - 34, y - 20, 68, 40, 18);
    ctx.fill();
  }
}

/** Glass over the wheel and the shelf: two soft diagonal reflections. */
export function drawGlass(ctx: Ctx, r: Rect, t: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 16);
  ctx.clip();
  const sweep = ((t * 0.07) % 1.6) - 0.3;
  for (const [off, wd, a] of [
    [0, 60, 0.07],
    [90, 22, 0.05],
  ] as const) {
    const x = r.x + sweep * r.w + off;
    ctx.fillStyle = `rgba(255,250,235,${a})`;
    ctx.beginPath();
    ctx.moveTo(x, r.y);
    ctx.lineTo(x + wd, r.y);
    ctx.lineTo(x + wd - r.h * 0.5, r.y + r.h);
    ctx.lineTo(x - r.h * 0.5, r.y + r.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The clear tube the coin shoots up; a coin inside is drawn by the caller. */
export function drawChute(ctx: Ctx, glow: number) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const p of CHUTE) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 22;
  ctx.stroke();
  ctx.strokeStyle = "rgba(82,100,119,0.92)";
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.strokeStyle = `rgba(120,226,213,${0.18 + glow * 0.55})`;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,248,230,0.45)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

/** Where a shot coin lands: the gate's fixed target, a little above its rail. */
export const LAND = { x: GATE.x + LAND_X, y: GATE.y - 10 };

/** The shot coin's hop from the chute's mouth to LAND (`u` 0..1): a straight line with a small arc. */
export function hopAt(u: number) {
  const m = CHUTE[CHUTE.length - 1];
  return { x: lerp(m.x, LAND.x, u), y: lerp(m.y, LAND.y, u) - Math.sin(u * Math.PI) * 24 };
}

/**
 * The swinging gate under the hub: the rod it rides on, the dotted guide from
 * the chute's mouth to the landing spot, the gate itself with its U hole at
 * `hole` px from the centre, the target ring where every coin lands, and the
 * prize stock lamps under it. `flash` (0..1) rings the hole after a hit; `full`
 * blinks the lamps while the stock is full; `ready` (0..1, faded by the caller)
 * lights the hole green with a pulse and an arrow: a shot now drops in. `lid`
 * (0 open → 1 shut, eased by the caller) swings the hole's lid shut over the cup
 * while the stock is full; `knock` (1 → 0) jiggles it when a coin bounces off.
 */
export function drawGate(ctx: Ctx, sp: Sprites, hole: number, stock: number, flash: number, full: boolean, t: number, ready = 0, lid = 0, knock = 0) {
  const { x, y } = GATE;
  const gh = (GATE_W * 186) / 360;
  /** The sprite's top sits just under the coins' landing line; its side knobs ride the rod. */
  const top = y - 2;
  const rodY = top + gh * 0.54;
  const rod = GATE_AMP + GATE_W / 2 + 4;
  ctx.save();
  // Rod
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(x - rod - 4, rodY - 5, rod * 2 + 8, 10, 5);
  ctx.fill();
  ctx.fillStyle = HONEY;
  ctx.beginPath();
  ctx.roundRect(x - rod - 1, rodY - 2.5, rod * 2 + 2, 5, 2.5);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = TEAL;
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x + side * (rod + 4), rodY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // The guide: dots from the chute's mouth to the landing spot, drifting gently toward it
  const DOTS = 9;
  const drift = (t * 0.6) % 1;
  for (let i = 0; i < DOTS; i++) {
    const u = (i + drift) / DOTS;
    if (u > 0.9) continue;
    const p = hopAt(u);
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(u * Math.PI);
    ctx.fillStyle = ready > 0.5 ? "#C9F2B8" : "#FFE7A8";
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // The gate
  const hx = x + hole;
  const img = sp.img.gate;
  if (img) ctx.drawImage(img, hx - GATE_W / 2, top, GATE_W, gh);
  else {
    ctx.fillStyle = TEAL;
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx - GATE_W / 2, top + 4);
    ctx.lineTo(hx - HOLE_HALF - 9, top + 4);
    ctx.arc(hx, top + 4, HOLE_HALF + 9, Math.PI, 0, true);
    ctx.lineTo(hx + GATE_W / 2, top + 4);
    ctx.lineTo(hx + GATE_W / 2, top + gh - 6);
    ctx.lineTo(hx - GATE_W / 2, top + gh - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // Ready: the cup glows green, a ring pulses out of it and an arrow points at the landing spot
  if (ready > 0) {
    ctx.globalAlpha = ready;
    const glow = ctx.createRadialGradient(hx, y + 2, 2, hx, y + 2, HOLE_HALF + 12);
    glow.addColorStop(0, "rgba(186,240,170,0.95)");
    glow.addColorStop(0.55, "rgba(108,191,106,0.6)");
    glow.addColorStop(1, "rgba(108,191,106,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(hx, y + 2, HOLE_HALF + 12, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // A solid green ring round the cup: easy to see at a glance
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(hx, y + 3, HOLE_HALF + 6, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = GO_GREEN;
    ctx.lineWidth = 4;
    ctx.stroke();
    const k = (t * 1.6) % 1;
    ctx.globalAlpha = ready * (1 - k) * 0.9;
    ctx.strokeStyle = GO_GREEN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(hx, y + 2, HOLE_HALF + 4 + k * 14, 9 + k * 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = ready;
    const ay = LAND.y - 22 - Math.abs(Math.sin(t * 6)) * 4;
    ctx.fillStyle = GO_GREEN;
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(LAND.x, ay + 12);
    ctx.lineTo(LAND.x - 11, ay);
    ctx.lineTo(LAND.x - 5, ay);
    ctx.lineTo(LAND.x - 5, ay - 9);
    ctx.lineTo(LAND.x + 5, ay - 9);
    ctx.lineTo(LAND.x + 5, ay);
    ctx.lineTo(LAND.x + 11, ay);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // The target ring: every coin comes down here
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(LAND.x, LAND.y + 4, 18, 6.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = ready > 0.5 ? "#C9F2B8" : CREAM;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = ready > 0.5 ? "#C9F2B8" : CREAM;
  ctx.beginPath();
  ctx.ellipse(LAND.x, LAND.y + 4, 3, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (lid > 0) drawLid(ctx, hx, top, lid, knock, t);
  if (flash > 0) {
    ctx.globalAlpha = flash;
    ctx.strokeStyle = LAMP_ON;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(hx, y + 4, HOLE_HALF + 14 + (1 - flash) * 22, 12 + (1 - flash) * 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // Stock lamps on a little plate: one per waiting prize spin
  const ly = top + gh + 9;
  const pw = PRIZE_QUEUE_MAX * 20 + 8;
  ctx.fillStyle = NIGHT;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x - pw / 2, ly - 10, pw, 20, 10);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < PRIZE_QUEUE_MAX; i++) {
    const lx = x + (i - (PRIZE_QUEUE_MAX - 1) / 2) * 20;
    bulb(ctx, lx, ly, 5, full ? (Math.floor(t * 6) % 2 === 0 ? TERRA : "#F2B8A2") : CYAN, i < stock);
  }
}

/**
 * The hole's lid: a terracotta flap hinged on the cup's left rim. It swings up
 * and over as `k` goes 0 → 1, settling flat across the cup with a small bounce,
 * and hops when a coin knocks on it.
 */
function drawLid(ctx: Ctx, hx: number, top: number, k: number, knock: number, t: number) {
  // A plug that fills the cup: as wide as the U's mouth, rounded at the bottom like it
  const w = HOLE_HALF * 2 + 22;
  const h = 30;
  // Drops in from above, easing out with a small bounce; hops when a coin knocks on it
  const e = 1 - (1 - k) ** 3;
  const bounce = k < 1 ? Math.sin(k * Math.PI) * 3 : 0;
  const hop = knock * Math.abs(Math.sin(t * 30)) * 4;
  const y0 = top - 6 - (1 - e) * 30 + bounce - hop;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, k * 2.5);
  // Shadow, the plug, and its cream rim on top
  ctx.fillStyle = "rgba(46,36,32,0.35)";
  ctx.beginPath();
  ctx.roundRect(hx - w / 2 + 2, y0 + 4, w, h, [8, 8, w / 2.4, w / 2.4]);
  ctx.fill();
  ctx.fillStyle = TERRA;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(hx - w / 2, y0, w, h, [8, 8, w / 2.4, w / 2.4]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#E39272";
  ctx.beginPath();
  ctx.roundRect(hx - w / 2 + 4, y0 + 3, w - 8, 7, 4);
  ctx.fill();
  // A cream bar across it: shut
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(hx - 13, y0 + 13, 26, 7, 3.5);
  ctx.fill();
  ctx.stroke();
  // The honey knob on top
  ctx.fillStyle = HONEY;
  ctx.beginPath();
  ctx.arc(hx, y0 - 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A coin seen edge-on-ish, spinning as it flies (k: spin phase). */
export function drawFlyingCoin(ctx: Ctx, sp: Sprites, x: number, y: number, size: number, k: number) {
  coinFace(ctx, sp, x, y, size * Math.max(0.25, Math.abs(Math.cos(k))), size);
}

// ---------------------------------------------------------------- reels and counters

/** An LED counter: a cream bezel round a dark window, a label tab on top, ghost 8s behind the lit digits. */
export function drawCounter(ctx: Ctx, r: Rect, label: string, value: number, color: string, digits: number, bump = 0) {
  ctx.save();
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 4, r.w, r.h, 12);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = WELL;
  ctx.beginPath();
  ctx.roundRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 8);
  ctx.fill();
  // Label tab
  ctx.font = `800 15px ${FONT}`;
  const lw = Math.max(44, ctx.measureText(label).width + 18);
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(r.x + 10, r.y - 14, lw, 22, 9);
  ctx.fill();
  ctx.stroke();
  text(ctx, label, r.x + 10 + lw / 2, r.y - 2, 15, BROWN, "center", null);
  const size = (r.h - 8) * (1 + bump * 0.12);
  ctx.font = `700 ${size}px ${LED_FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const right = r.x + r.w - 14;
  const cy = r.y + r.h / 2 + 4;
  ctx.fillStyle = "rgba(245,228,190,0.08)";
  ctx.fillText("8".repeat(digits), right, cy);
  ctx.shadowColor = color;
  ctx.shadowBlur = 6 + bump * 14;
  ctx.fillStyle = color;
  ctx.fillText(String(Math.max(0, Math.round(value))).slice(-digits), right, cy);
  ctx.restore();
}

export interface ReelCell {
  value: number;
  coin: boolean;
}

/** A reel cell's prize icon, centred at (x, y): a coin, or a ticket. */
function reelIcon(ctx: Ctx, sp: Sprites, coin: boolean, x: number, y: number) {
  if (coin) {
    coinFace(ctx, sp, x, y, 24, 24);
    return;
  }
  drawTicketIcon(ctx, sp, x, y, 30);
}

/** The ticket sprite centred at (x, y), `w` wide (a plain stub until it decodes). */
export function drawTicketIcon(ctx: Ctx, sp: Sprites, x: number, y: number, w: number) {
  const h = (w * 2) / 3;
  const img = sp.img.ticket;
  if (img) {
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    return;
  }
  ctx.fillStyle = TERRA;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2, 4);
  ctx.fill();
  ctx.stroke();
}

/** The reels window for the Mini and Super spins. `offset` scrolls the strip (in cells); `hot` is the Super spin. */
export function drawReels(
  ctx: Ctx,
  sp: Sprites,
  label: string,
  cells: readonly ReelCell[],
  offset: number,
  active: boolean,
  won: boolean,
  t: number,
  hot = false,
) {
  const r = REEL;
  const accent = hot ? TERRA : HONEY;
  ctx.save();
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 4, r.w, r.h, 12);
  ctx.fill();
  ctx.fillStyle = NIGHT;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = active ? (hot ? CORE_COLORS[Math.floor(t * 10) % 6] : HONEY) : "rgba(245,228,190,0.5)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, 9);
  ctx.stroke();
  const split = r.x + 122;
  text(ctx, label, r.x + 63, r.y + r.h / 2 + 2, fitSize(ctx, label, 22, 104), active ? accent : CREAM, "center", active ? BROWN : null);
  // Reel strip
  const rw = r.x + r.w - 9 - split;
  const sy = r.y + 7;
  const cellH = r.h - 14;
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(split, sy, rw, cellH, 7);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  const base = Math.floor(offset);
  const frac = offset - base;
  for (let k = -1; k <= 1; k++) {
    const cell = cells[(((base + k) % cells.length) + cells.length) % cells.length];
    const yy = r.y + r.h / 2 + (k - frac) * cellH;
    const flash = won && k === 0 && Math.floor(t * 8) % 2 === 0;
    const str = String(cell.value);
    ctx.font = `700 ${cellH * 1.05}px ${LED_FONT}`;
    const tw = ctx.measureText(str).width;
    const iconW = 30;
    const x0 = split + rw / 2 - (tw + iconW + 8) / 2;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = flash ? TERRA : BROWN;
    ctx.fillText(str, x0, yy + 3);
    reelIcon(ctx, sp, cell.coin, x0 + tw + 8 + iconW / 2, yy);
  }
  // Curved-glass shading
  const sh = ctx.createLinearGradient(0, sy, 0, sy + cellH);
  sh.addColorStop(0, "rgba(73,51,44,0.45)");
  sh.addColorStop(0.35, "rgba(73,51,44,0)");
  sh.addColorStop(0.65, "rgba(73,51,44,0)");
  sh.addColorStop(1, "rgba(73,51,44,0.45)");
  ctx.fillStyle = sh;
  ctx.fillRect(split, sy, rw, cellH);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- the shelf

/** The top row of the cached shelf (the side walls rise above the back edge). */
const DECK_Y = 470;
const DECK_K = 2;
/** World units per floor tile. */
const FLOOR_TILE = 120;

/**
 * The shelf's static parts at 2×: the floor (its texture laid in perspective, a
 * row at a time), a shade toward the back, the back wall and the side walls.
 */
function shelfDeck(floor: HTMLImageElement | null) {
  const K = DECK_K;
  const c = document.createElement("canvas");
  c.width = W * K;
  c.height = (SHELF_BOTTOM + 6 - DECK_Y) * K;
  const g = c.getContext("2d") as Ctx;
  g.scale(K, K);
  g.translate(0, -DECK_Y);
  const bl = proj(0, 0);
  const br = proj(SHELF_W, 0);
  const fl = proj(0, SHELF_D);
  const fr = proj(SHELF_W, SHELF_D);
  const quad = () => {
    g.beginPath();
    g.moveTo(bl.x, bl.y);
    g.lineTo(br.x, br.y);
    g.lineTo(fr.x, fr.y);
    g.lineTo(fl.x, fl.y);
    g.closePath();
  };
  // Back wall above the pusher
  g.fillStyle = "#3E4B5C";
  g.fillRect(bl.x - 6, SHELF_TOP - 16, br.x - bl.x + 12, 16);
  // Floor
  if (floor) {
    const px = 2;
    const world = document.createElement("canvas");
    world.width = SHELF_W * px;
    world.height = SHELF_D * px;
    const wg = world.getContext("2d") as Ctx;
    const ts = FLOOR_TILE * px;
    for (let x = 0; x < world.width; x += ts) for (let y = 0; y < world.height; y += ts) wg.drawImage(floor, x, y, ts, ts);
    const span = SHELF_BOTTOM - SHELF_TOP;
    for (let y = 0; y < span; y++) {
      const k0 = y / span;
      const k1 = (y + 1) / span;
      const a = proj(0, k0 * SHELF_D);
      const b = proj(SHELF_W, k0 * SHELF_D);
      g.drawImage(world, 0, k0 * world.height, world.width, (k1 - k0) * world.height, a.x, a.y, b.x - a.x, 1.5);
    }
  } else {
    g.fillStyle = HONEY;
    quad();
    g.fill();
  }
  const shade = g.createLinearGradient(0, bl.y, 0, fl.y);
  shade.addColorStop(0, "rgba(73,51,44,0.32)");
  shade.addColorStop(1, "rgba(73,51,44,0)");
  g.fillStyle = shade;
  quad();
  g.fill();
  g.strokeStyle = BROWN;
  g.lineWidth = 2.5;
  g.stroke();
  // Side walls: a honey panel from the cabinet's wall to the shelf edge, cream along the top
  for (const side of [0, 1]) {
    const x = side === 0 ? 0 : SHELF_W;
    const a = proj(x, 0);
    const b = proj(x, SIDE_WALL_D);
    const out = side === 0 ? 30 : W - 30;
    g.fillStyle = "#D99A55";
    g.strokeStyle = BROWN;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(out, a.y - 16);
    g.lineTo(a.x, a.y - 16);
    g.lineTo(b.x, b.y - 20);
    g.lineTo(b.x, b.y);
    g.lineTo(out, b.y);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#C3814A";
    g.beginPath();
    g.moveTo(a.x, a.y - 16);
    g.lineTo(b.x, b.y - 20);
    g.lineTo(b.x, b.y);
    g.lineTo(a.x, a.y);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = CREAM;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(out, a.y - 14);
    g.lineTo(a.x, a.y - 14);
    g.lineTo(b.x, b.y - 20);
    g.stroke();
  }
  return c;
}

/** Shelf floor and walls, behind the bodies. */
export function drawShelf(ctx: Ctx, sp: Sprites) {
  ctx.drawImage(sp.shelf, 0, DECK_Y, W, sp.shelf.height / DECK_K);
}

/** The pusher: its top plate from the back wall to the bar, then the bar (pusher.webp) at its face. */
export function drawPusher(ctx: Ctx, sp: Sprites, py: number) {
  const bl = proj(-4, 0);
  const br = proj(SHELF_W + 4, 0);
  const fl = proj(-4, py);
  const fr = proj(SHELF_W + 4, py);
  const img = sp.img.pusher;
  const w = fr.x - fl.x + 14;
  const h = img ? (w * img.height) / img.width : w * 0.12;
  const top = fl.y - h;
  const face = h * 0.55 * (bl.s / fl.s);
  ctx.save();
  const plate = ctx.createLinearGradient(0, bl.y - face, 0, top);
  plate.addColorStop(0, "#C99247");
  plate.addColorStop(1, "#E4B262");
  ctx.fillStyle = plate;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y - face);
  ctx.lineTo(br.x, br.y - face);
  ctx.lineTo(fr.x, top + 3);
  ctx.lineTo(fl.x, top + 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Seams on the top plate
  ctx.strokeStyle = "rgba(73,51,44,0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 1; i < 6; i++) {
    const a = proj((i / 6) * SHELF_W, 0);
    const b = proj((i / 6) * SHELF_W, py);
    ctx.moveTo(a.x, a.y - face);
    ctx.lineTo(b.x, top + 3);
  }
  ctx.stroke();
  if (img) ctx.drawImage(img, W / 2 - w / 2, top, w, h);
  else {
    ctx.fillStyle = HONEY;
    ctx.fillRect(W / 2 - w / 2, top, w, h * 0.45);
    ctx.fillStyle = TERRA;
    ctx.fillRect(W / 2 - w / 2, top + h * 0.45, w, h * 0.55);
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(W / 2 - w / 2, top, w, h);
  }
  ctx.restore();
}

/** Soft shadow under a body (drawn in a pass before the bodies). */
export function drawShadow(ctx: Ctx, b: Body) {
  const p = proj(b.x, b.y);
  const r = b.r * p.s;
  ctx.fillStyle = "rgba(73,51,44,0.3)";
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 5 * p.s, r * 1.02, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * One body on the shelf. Coins: a coin or a stack sprite; capsules: their orb;
 * cards: the card back lying tilted on the deck. `drop` 0..1 raises it (just landed).
 */
export function drawBody(ctx: Ctx, sp: Sprites, b: Body, t: number, drop = 0) {
  const p = proj(b.x, b.y);
  const lift = drop * 40 * p.s;
  const d = b.r * 2 * p.s;
  if (b.kind === "card") {
    // Each card keeps its own slant (from its id), lying flat in the 3/4 view
    const tilt = ((((b.id * 47) % 70) - 35) * Math.PI) / 180;
    const w = d * 0.95;
    const h = cardBackH(w);
    ctx.save();
    ctx.translate(p.x, p.y - 2 * p.s - lift);
    ctx.scale(1, 0.66);
    ctx.rotate(tilt);
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3 + b.id);
    ctx.fillStyle = VIOLET;
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawCardBack(ctx, sp, -w / 2, -h / 2, w, h, b.card >= 0 && isRare(b.card));
    ctx.restore();
    return;
  }
  if (b.kind === "coin") {
    const stackImg = b.stack >= 3 ? sp.img["coin-stack3"] : b.stack === 2 ? sp.img["coin-stack2"] : undefined;
    if (stackImg) {
      stand(ctx, stackImg, p.x, p.y + d * 0.3 - lift, d * 1.06);
      return;
    }
    const one = sp.coin;
    if (one) {
      // The coin's underside centred on the body; a stack (before its sprite decodes) piles up
      const m = d / COIN_FACE;
      const th = COIN_TH * m;
      for (let i = 0; i < b.stack; i++)
        ctx.drawImage(one, p.x - (one.width * m) / 2, p.y - (3 + COIN_RY + COIN_TH) * m - i * th - lift, one.width * m, one.height * m);
      return;
    }
    for (let i = 0; i < b.stack; i++) coinFace(ctx, sp, p.x, p.y - i * 5 * p.s - lift, d, d * 0.58);
    return;
  }
  drawOrb(ctx, sp, b.core, p.x, p.y + d * 0.12 - lift, d);
}

/** The chase lights along the cabinet's lip, where the shelf's front edge meets it. */
export function drawFrontLip(ctx: Ctx, chase: number, rainbow: boolean) {
  const fl = proj(0, SHELF_D);
  const fr = proj(SHELF_W, SHELF_D);
  const n = 20;
  for (let i = 0; i < n; i++) {
    const x = fl.x + 10 + (i / (n - 1)) * (fr.x - fl.x - 20);
    // The robot jar sits on the middle of the lip
    if (Math.abs(x - JAR_MOUTH.x) < JAR_HALF + 8) continue;
    const on = (i + Math.floor(chase)) % 4 < 2;
    bulb(ctx, x, fl.y + 15, 3.2, rainbow ? CORE_COLORS[i % 6] : LAMP_ON, on || rainbow);
  }
}

// ---------------------------------------------------------------- the robot jar

/** Half the jar's section on screen at the front edge (JAR_W world units), and its mouth's centre. */
const JAR_HALF = (proj(JAR_X + JAR_W / 2, SHELF_D).x - proj(JAR_X - JAR_W / 2, SHELF_D).x) / 2;
/** The jar stands in front of the shelf's front edge, its mouth a little above the edge (coins hop in). */
export const JAR_MOUTH = { x: proj(JAR_X, SHELF_D).x, y: SHELF_BOTTOM - 18 };
const BLUSH = "#F2A6A0";
const GLASS = "rgba(206,240,233,0.9)";

/**
 * The jar's lane: its section of the front edge, tinted terracotta from a
 * little way back, with dashed rails along its sides and chevrons that run
 * toward the jar. Drawn over the bodies, see-through, so it reads on a full
 * shelf. `munch` (1 → 0) flashes it after the jar eats.
 */
export function drawJarLane(ctx: Ctx, t: number, munch: number) {
  const x0 = JAR_X - JAR_W / 2;
  const x1 = JAR_X + JAR_W / 2;
  const back = SHELF_D - 96;
  const a = proj(x0, back);
  const b = proj(x1, back);
  const c = proj(x1, SHELF_D);
  const d = proj(x0, SHELF_D);
  ctx.save();
  const fill = ctx.createLinearGradient(0, a.y, 0, d.y);
  fill.addColorStop(0, "rgba(207,121,90,0)");
  fill.addColorStop(0.35, "rgba(207,121,90,0.16)");
  fill.addColorStop(1, `rgba(207,121,90,${0.6 + 0.25 * munch})`);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
  // Dashed rails, fading in toward the front
  ctx.setLineDash([7, 5]);
  ctx.lineWidth = 3;
  for (const [p, q] of [
    [a, d],
    [b, c],
  ]) {
    const g = ctx.createLinearGradient(0, p.y, 0, q.y);
    g.addColorStop(0, "rgba(255,243,207,0)");
    g.addColorStop(0.4, "rgba(255,243,207,0.7)");
    g.addColorStop(1, "rgba(255,243,207,1)");
    // A brown underline first, so the cream dashes read on gold coins
    ctx.strokeStyle = "rgba(73,51,44,0.55)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Chevrons sliding toward the jar
  for (let i = 0; i < 3; i++) {
    const k = (i / 3 + t * 0.5) % 1;
    const p = proj(JAR_X, back + 18 + k * (SHELF_D - back - 26));
    ctx.globalAlpha = Math.sin(k * Math.PI);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - 10 * p.s, p.y - 5);
    ctx.lineTo(p.x, p.y + 2);
    ctx.lineTo(p.x + 10 * p.s, p.y - 5);
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The robot jar on the middle of the front lip: a round glass jar with a robot
 * face, little arms and an antenna, its open mouth exactly as wide as the jar's
 * section of the edge. The coins it has eaten this session (`fill`) pile up
 * inside. `munch` (1 → 0) after coins drop in: it squashes and bounces, shuts its
 * eyes happily, chews and waves; the antenna bulb lights. `label` is the small
 * tag on its belly.
 */
export function drawJar(ctx: Ctx, sp: Sprites, t: number, munch: number, fill: number, label: string) {
  const { x, y } = JAR_MOUTH;
  const m = munch > 0 ? Math.sin((1 - munch) * Math.PI * 3) * munch : 0;
  const rx = JAR_HALF + 3;
  const bodyH = 50;
  ctx.save();
  // Squash and stretch from its base
  const base = y + bodyH;
  ctx.translate(x, base);
  ctx.scale(1 + 0.08 * m, 1 - 0.1 * m + Math.sin(t * 2.4) * 0.015);
  ctx.translate(-x, -base);
  // Arms: little teal stubs, waving while it munches
  for (const side of [-1, 1]) {
    const wave = munch > 0 ? Math.sin(t * 22 + side) * 0.6 * munch : Math.sin(t * 1.8 + side) * 0.08;
    ctx.save();
    ctx.translate(x + side * (rx + 2), y + 24);
    ctx.rotate(side * (0.5 + wave) - (munch > 0 ? side * 0.9 * munch : 0));
    ctx.fillStyle = TEAL;
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(side > 0 ? 0 : -14, -4, 14, 8, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(side * 14, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Antenna on the right shoulder, its bulb lit while it munches
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + rx - 6, y + 4);
  ctx.quadraticCurveTo(x + rx + 4, y - 6, x + rx + 2, y - 14);
  ctx.stroke();
  bulb(ctx, x + rx + 2, y - 16, 4, munch > 0.05 ? HONEY : LAMP_ON, munch > 0.05 || Math.sin(t * 3) > 0.6);
  // The glass body
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(x - rx - 2, y + 2, rx * 2 + 4, bodyH + 2, [10, 10, 18, 18]);
  ctx.fill();
  ctx.fillStyle = GLASS;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - rx, y, rx * 2, bodyH, [10, 10, 16, 16]);
  ctx.fill();
  ctx.stroke();
  // Coins it ate, piling up inside (a few always there: the jar is never empty)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - rx + 2, y + 2, rx * 2 - 4, bodyH - 4, [8, 8, 14, 14]);
  ctx.clip();
  const pile = Math.min(14, 4 + Math.floor(fill / 3));
  const r = mulberry32(7);
  for (let i = 0; i < pile; i++) {
    const row = Math.floor(i / 5);
    const cx = x - rx + 9 + (i % 5) * ((rx * 2 - 18) / 4) + (r() - 0.5) * 4;
    const cy = y + bodyH - 7 - row * 6 + (r() - 0.5) * 2;
    coinFace(ctx, sp, cx, cy, 14, 7);
  }
  ctx.restore();
  // The face plate: cream, on the jar's belly
  const fy = y + 19;
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - rx + 6, fy - 9, rx * 2 - 12, 19, 9);
  ctx.fill();
  ctx.stroke();
  // Eyes: dots with a glint, or happy arcs while it munches
  ctx.fillStyle = BROWN;
  ctx.strokeStyle = BROWN;
  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    const ex = x + side * 8;
    if (munch > 0.05) {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ex, fy + 1, 3.5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      const blink = Math.sin(t * 0.9) > 0.985 ? 0.25 : 1;
      ctx.beginPath();
      ctx.ellipse(ex, fy - 1, 2.8, 3.3 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(ex + 1, fy - 2.2, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BROWN;
    }
  }
  // Blush
  ctx.fillStyle = BLUSH;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 14, fy + 4, 3.2, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mouth: a small smile, a chewing "o" while it munches
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (munch > 0.05) {
    const open = 2 + Math.abs(Math.sin(t * 18)) * 2.5;
    ctx.ellipse(x, fy + 5, 3, open, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#8C4A3C";
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.arc(x, fy + 3, 3, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  // The open mouth of the jar: a honey rim ring, dark inside, right under the edge
  ctx.fillStyle = HONEY;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, JAR_HALF + 2, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = WELL;
  ctx.beginPath();
  ctx.ellipse(x, y, JAR_HALF - 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Its name tag, hanging under the mouth's right side
  if (label) {
    ctx.save();
    ctx.font = `800 13px ${FONT}`;
    const w = ctx.measureText(label).width + 12;
    ctx.translate(x - rx - 8 - w / 2, y + 40);
    ctx.rotate(-0.14);
    ctx.fillStyle = TERRA;
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -9, w, 18, 7);
    ctx.fill();
    ctx.stroke();
    text(ctx, label, 0, 0.5, 13, CREAM, "center", null);
    ctx.restore();
  }
}

/** The launch button (shoot-idle / shoot-pressed), greyed out with no coins; its label sits on the base. */
export function drawShootButton(ctx: Ctx, sp: Sprites, label: string, pressed: boolean, t: number, enabled: boolean) {
  const { x, y, r } = SHOOT;
  const idle = sp.img["shoot-idle"];
  /** The cap is 82% of the sprite's width, and its centre 36% of the way down. */
  const w = (r * 2) / 0.82;
  const ih = idle ? (w * idle.height) / idle.width : w * 0.96;
  const top = y - ih * 0.36;
  const bottom = top + ih;
  ctx.save();
  if (enabled) {
    ctx.globalAlpha = 0.22 + 0.14 * Math.sin(t * 5);
    ctx.fillStyle = HONEY;
    ctx.beginPath();
    ctx.ellipse(x, y + 6, r + 16, r + 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const img = !enabled ? sp.shootOff : pressed ? (sp.img["shoot-pressed"] ?? idle) : idle;
  if (img) stand(ctx, img, x, bottom, w);
  else {
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 3;
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(x, bottom - ih * 0.3, w / 2 - 2, ih * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = enabled ? TERRA : "#8C7458";
    ctx.beginPath();
    ctx.arc(x, y + (pressed ? 6 : 0), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  text(ctx, label, x, bottom - ih * 0.12, fitSize(ctx, label, 16, w * 0.46), CREAM);
  ctx.restore();
}

/** The AUTO toggle: a cream pill when off, lit teal when on, with its state spelled out. */
export function drawAutoButton(ctx: Ctx, r: Rect, label: string, state: string, on: boolean, enabled: boolean) {
  ctx.save();
  ctx.globalAlpha = enabled || on ? 1 : 0.55;
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y + 3, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.fillStyle = on ? TEAL : CREAM;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.stroke();
  const msg = `${label}: ${state}`;
  text(ctx, msg, r.x + r.w / 2, r.y + r.h / 2 + 1, fitSize(ctx, msg, 17, r.w - 20), on ? CREAM : BROWN, "center", null);
  ctx.restore();
}

/** The coin tray on the deck under the controls (seen on tall phones): a little heap that grows with your coins. */
export function drawTray(ctx: Ctx, sp: Sprites, coins: number, view: Rect) {
  const y = 970;
  if (view.y + view.h < y + 30) return;
  const r: Rect = { x: 206, y, w: 128, h: 50 };
  ctx.save();
  ctx.fillStyle = WELL;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 16);
  ctx.fill();
  ctx.stroke();
  ctx.clip();
  const n = Math.min(18, Math.ceil(Math.max(0, coins) / 10));
  const rnd = mulberry32(77);
  for (let i = 0; i < n; i++) {
    const row = i < 8 ? 0 : i < 14 ? 1 : 2;
    const x = r.x + 16 + rnd() * (r.w - 32) * (1 - row * 0.25) + row * 14;
    const yy = r.y + r.h - 10 - row * 8 - rnd() * 5;
    if (sp.coin) stand(ctx, sp.coin, x, yy + 6, 24);
    else coinFace(ctx, sp, x, yy, 22, 13);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- cards and the album

const ready = (img: HTMLImageElement | null) => (img?.complete && img.naturalWidth > 0 ? img : null);
const silhouettes = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

/**
 * The card's art as a dim dusty-blue monochrome (an unowned album slot). The art
 * is opaque, so a flat fill would be a blank rectangle; keeping a trace of the
 * brightness lets the cat's shape show through like a shadow.
 */
function silhouette(img: HTMLImageElement) {
  let c = silhouettes.get(img);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = 120;
  c.height = 160;
  const g = c.getContext("2d", { willReadFrequently: true }) as Ctx;
  g.drawImage(img, 0, 0, c.width, c.height);
  try {
    const px = g.getImageData(0, 0, c.width, c.height);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
      const k = 0.18 + lum * 0.62;
      d[i] = 92 * k;
      d[i + 1] = 108 * k;
      d[i + 2] = 132 * k;
    }
    g.putImageData(px, 0, 0);
  } catch {
    // A tainted canvas can't be read: fall back to a flat tint
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(40,48,60,0.92)";
    g.fillRect(0, 0, c.width, c.height);
  }
  silhouettes.set(img, c);
  return c;
}

/**
 * A cat card in a cream frame. `owned` false shows its silhouette on a dark
 * card; while the image is still loading a plain card stands in. `rare` is the
 * Rare badge's label for the rare card (null for the others).
 */
export function drawCardFace(
  ctx: Ctx,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  owned: boolean,
  rare: string | null = null,
) {
  const r = Math.max(3, w * 0.09);
  const pad = Math.max(1.5, w * 0.05);
  ctx.save();
  ctx.fillStyle = owned ? CREAM : NIGHT;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  const art = ready(img);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + pad, y + pad, w - pad * 2, h - pad * 2, r * 0.7);
  ctx.clip();
  if (art) ctx.drawImage(owned ? art : silhouette(art), x + pad, y + pad, w - pad * 2, h - pad * 2);
  else {
    ctx.fillStyle = owned ? VIOLET : NIGHT_HI;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = owned ? BROWN : "rgba(245,228,190,0.25)";
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
  if (rare && w >= 28) {
    ctx.globalAlpha = owned ? 1 : 0.75;
    drawRareBadge(ctx, x + pad + w * 0.02, y + pad + w * 0.11, Math.max(12, w * 0.17), rare);
  }
  ctx.restore();
}

/**
 * The Rare badge: a honey pill with a little star, its left edge at `x` and its
 * middle at `y`, `size` tall. Returns its width.
 */
export function drawRareBadge(ctx: Ctx, x: number, y: number, size: number, label: string) {
  ctx.save();
  const fs = size * 0.68;
  ctx.font = `800 ${fs}px ${FONT}`;
  const star = size * 0.34;
  const w = ctx.measureText(label).width + size * 0.5 + star * 2 + size * 0.1;
  ctx.fillStyle = BROWN;
  ctx.beginPath();
  ctx.roundRect(x, y - size / 2 + size * 0.08, w, size, size / 2);
  ctx.fill();
  const g = ctx.createLinearGradient(x, y - size / 2, x + w, y + size / 2);
  g.addColorStop(0, "#F7D77E");
  g.addColorStop(1, HONEY);
  ctx.fillStyle = g;
  ctx.strokeStyle = BROWN;
  ctx.lineWidth = Math.max(1, size * 0.1);
  ctx.beginPath();
  ctx.roundRect(x, y - size / 2, w, size, size / 2);
  ctx.fill();
  ctx.stroke();
  // A four-point sparkle, then the label
  const sx = x + size * 0.25 + star;
  ctx.fillStyle = "#FFF8E6";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? star : star * 0.38;
    ctx.lineTo(sx + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = Math.max(0.8, size * 0.06);
  ctx.stroke();
  ctx.fillStyle = BROWN;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, sx + star + size * 0.12, y + size * 0.04);
  ctx.restore();
  return w;
}

// ---------------------------------------------------------------- the card viewer

/** The cat card (or its back) as a flat texture for the viewer, `w`×`h` px. */
export function cardTexture(draw: (g: Ctx, w: number, h: number) => void, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  draw(c.getContext("2d") as Ctx, c.width, c.height);
  return c;
}

/** Columns and rows of the mesh a tilted card is drawn with (each cell is two triangles). */
const MESH_X = 6;
const MESH_Y = 8;
/** The viewer's camera distance in px: smaller is a stronger perspective. */
const CAMERA = 1600;

/**
 * Draw a flat card texture in 3D: turned `yaw` radians about its upright axis
 * and `pitch` about its horizontal one, centred on (cx, cy), `w`×`h` px at rest,
 * in perspective. Canvas 2D has no perspective transform, so the card is cut
 * into a grid; each corner is projected exactly and each half-cell drawn with
 * the affine map that fits its three corners (clipped a hair large so no seams
 * show). When the card faces away, `back` is drawn instead, mirrored as a real
 * card's back would be. Returns the projected corners (for a shadow or a tap).
 */
export function drawCard3D(
  ctx: Ctx,
  front: HTMLCanvasElement,
  back: HTMLCanvasElement,
  cx: number,
  cy: number,
  w: number,
  h: number,
  yaw: number,
  pitch: number,
) {
  const cy0 = Math.cos(yaw);
  const sy0 = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp0 = Math.sin(pitch);
  const project = (u: number, v: number) => {
    const X = (u - 0.5) * w;
    const Y = (v - 0.5) * h;
    const x1 = X * cy0;
    const z1 = -X * sy0;
    const y2 = Y * cp - z1 * sp0;
    const z2 = Y * sp0 + z1 * cp;
    const f = CAMERA / (CAMERA + z2);
    return { x: cx + x1 * f, y: cy + y2 * f };
  };
  const facing = cy0 * cp >= 0;
  const tex = facing ? front : back;
  const pts: { x: number; y: number }[][] = [];
  for (let j = 0; j <= MESH_Y; j++) {
    const row: { x: number; y: number }[] = [];
    for (let i = 0; i <= MESH_X; i++) row.push(project(i / MESH_X, j / MESH_Y));
    pts.push(row);
  }
  const tw = tex.width;
  const th = tex.height;
  // Texture px for grid corner (i, j): the back is mirrored left to right
  const src = (i: number, j: number) => ({ x: (facing ? i / MESH_X : 1 - i / MESH_X) * tw, y: (j / MESH_Y) * th });
  const tri = (a: [number, number], b: [number, number], c: [number, number]) => {
    const d0 = pts[a[1]][a[0]];
    const d1 = pts[b[1]][b[0]];
    const d2 = pts[c[1]][c[0]];
    const s0 = src(a[0], a[1]);
    const s1 = src(b[0], b[1]);
    const s2 = src(c[0], c[1]);
    const ux = s1.x - s0.x;
    const uy = s1.y - s0.y;
    const vx = s2.x - s0.x;
    const vy = s2.y - s0.y;
    const det = ux * vy - vx * uy;
    if (Math.abs(det) < 1e-6) return;
    const px = d1.x - d0.x;
    const py = d1.y - d0.y;
    const qx = d2.x - d0.x;
    const qy = d2.y - d0.y;
    const ma = (px * vy - qx * uy) / det;
    const mb = (py * vy - qy * uy) / det;
    const mc = (qx * ux - px * vx) / det;
    const md = (qy * ux - py * vx) / det;
    // Clip to the triangle grown ~0.8 px about its centre, so neighbours overlap
    const gx = (d0.x + d1.x + d2.x) / 3;
    const gy = (d0.y + d1.y + d2.y) / 3;
    const grow = (p: { x: number; y: number }) => {
      const dx = p.x - gx;
      const dy = p.y - gy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / len) * 0.8, y: p.y + (dy / len) * 0.8 };
    };
    const g0 = grow(d0);
    const g1 = grow(d1);
    const g2 = grow(d2);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g0.x, g0.y);
    ctx.lineTo(g1.x, g1.y);
    ctx.lineTo(g2.x, g2.y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(ma, mb, mc, md, d0.x - ma * s0.x - mc * s0.y, d0.y - mb * s0.x - md * s0.y);
    ctx.drawImage(tex, 0, 0);
    ctx.restore();
  };
  for (let j = 0; j < MESH_Y; j++)
    for (let i = 0; i < MESH_X; i++) {
      tri([i, j], [i + 1, j], [i, j + 1]);
      tri([i + 1, j], [i + 1, j + 1], [i, j + 1]);
    }
  return { facing, corners: [pts[0][0], pts[0][MESH_X], pts[MESH_Y][MESH_X], pts[MESH_Y][0]] };
}

/**
 * The holographic shine over a card texture (drawn into `out`, a canvas the
 * size of `tex`): a soft light band and a glint that slide across as the card
 * tilts (`tx`, `ty` in -1..1), and for the rare card a moving rainbow shimmer.
 */
export function shineCard(out: HTMLCanvasElement, tex: HTMLCanvasElement, tx: number, ty: number, t: number, rainbow: boolean) {
  const g = out.getContext("2d") as Ctx;
  const w = out.width;
  const h = out.height;
  g.clearRect(0, 0, w, h);
  g.drawImage(tex, 0, 0, w, h);
  g.save();
  g.globalCompositeOperation = "source-atop";
  // The light band runs corner to corner, across from where the card leans
  const k = 0.5 - tx * 0.55 - ty * 0.35;
  const band = g.createLinearGradient(0, 0, w, h);
  const at = (x: number) => clamp(x, 0, 1);
  band.addColorStop(at(k - 0.28), "rgba(255,250,235,0)");
  band.addColorStop(at(k - 0.06), "rgba(255,250,235,0.12)");
  band.addColorStop(at(k), "rgba(255,252,240,0.38)");
  band.addColorStop(at(k + 0.06), "rgba(255,250,235,0.12)");
  band.addColorStop(at(k + 0.28), "rgba(255,250,235,0)");
  g.fillStyle = band;
  g.fillRect(0, 0, w, h);
  if (rainbow) {
    const off = (t * 0.08 + tx * 0.35 + ty * 0.2) % 1;
    const rb = g.createLinearGradient(-w * 0.2, h, w * 1.2, 0);
    const hues = [0, 45, 90, 180, 240, 300, 360];
    for (let r = 0; r < 2; r++)
      hues.forEach((hue, i) => {
        const stop = (((i / (hues.length - 1)) * 0.5 + r * 0.5 + off) % 1 + 1) % 1;
        rb.addColorStop(stop, `hsla(${hue}, 90%, 70%, 0.2)`);
      });
    g.fillStyle = rb;
    g.fillRect(0, 0, w, h);
  }
  // A glint that follows the light
  const gx = w * (0.5 - tx * 0.45);
  const gy = h * (0.35 - ty * 0.4);
  const glint = g.createRadialGradient(gx, gy, 0, gx, gy, w * 0.5);
  glint.addColorStop(0, "rgba(255,255,248,0.28)");
  glint.addColorStop(1, "rgba(255,255,248,0)");
  g.fillStyle = glint;
  g.fillRect(0, 0, w, h);
  g.restore();
}
