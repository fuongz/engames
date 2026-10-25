import type { IngredientId, RecipeId, Step, Weather } from "./config";
import { recipe } from "./logic";
import type { Sprites } from "./sprites";

// The pictures behind each baking step, and the little animations between them:
// what is in the bowl at every step, what goes into the oven raw and comes out
// baked, the bare cake before decoration, and a small particle system for
// flour puffs, steam and sparkles. Drawing only; the rules stay in logic.ts.

type Ctx = CanvasRenderingContext2D;

export type BowlState =
  | "empty"
  | "lumpy"
  | "creamed"
  | "batter"
  | "dough"
  | "custard"
  | "whipped"
  | "choux";

const BOWL_SPRITE: Record<BowlState, string> = {
  empty: "tool-bowl",
  lumpy: "bowl-lumpy",
  creamed: "bowl-creamed",
  batter: "bowl-batter",
  dough: "bowl-dough",
  custard: "bowl-custard",
  whipped: "bowl-whipped",
  choux: "bowl-choux",
};

/** What a mixing step turns the bowl into, for this recipe. */
export function mixResult(id: RecipeId, index: number): BowlState {
  const steps = recipe(id).steps;
  const step = steps[index];
  if (step?.kind !== "mix") return "batter";
  if (id === "choux" && step.mode !== "whisk") return "choux";
  if (id === "flan") return "custard";
  switch (step.mode) {
    case "cream":
      return "creamed";
    case "knead":
      return "dough";
    case "whisk": {
      // Whisking cream makes whipped cream; whisking eggs and sugar makes a batter
      const lastAdd = [...steps.slice(0, index)]
        .reverse()
        .find((s) => s.kind === "add");
      return lastAdd?.kind === "add" && lastAdd.ing === "cream"
        ? "whipped"
        : "batter";
    }
    default:
      return "batter";
  }
}

/**
 * The bowl's base as it looks just before step `index`: empty, or what the last
 * mixing made of it. Ingredients added since then lie on top as piles (see
 * `addedSinceMix`), so the bowl only ever shows what has really gone in.
 */
export function bowlBefore(id: RecipeId, index: number): BowlState {
  const steps = recipe(id).steps;
  let state: BowlState = "empty";
  for (let i = 0; i < index; i++) {
    const s: Step = steps[i];
    if (s.kind === "mix") state = mixResult(id, i);
    else if (s.kind === "oven") state = "empty";
  }
  return state;
}

/** What went into the bowl after its last mixing (or oven), in order, before step `index`. */
export function addedSinceMix(id: RecipeId, index: number): IngredientId[] {
  const steps = recipe(id).steps;
  const added: IngredientId[] = [];
  for (let i = 0; i < index; i++) {
    const s: Step = steps[i];
    if (s.kind === "add") added.push(s.ing);
    else if (s.kind === "mix" || s.kind === "oven") added.length = 0;
  }
  return added;
}

/** How each ingredient lies in the bowl: its pile picture, and whether it pools. */
export const PILE: Record<
  IngredientId,
  { sprite: string; liquid: boolean; color: string }
> = {
  flour: { sprite: "pile-flour", liquid: false, color: "#fbf7ef" },
  sugar: { sprite: "pile-sugar", liquid: false, color: "#ffffff" },
  butter: { sprite: "pile-butter", liquid: false, color: "#ffe28a" },
  eggs: { sprite: "pile-egg", liquid: false, color: "#ffc83d" },
  milk: { sprite: "pile-milk", liquid: true, color: "#fffdf6" },
  bakingPowder: { sprite: "pile-powder", liquid: false, color: "#f4f4f4" },
  vanilla: { sprite: "pile-vanilla", liquid: false, color: "#9a5b2a" },
  yeast: { sprite: "pile-yeast", liquid: false, color: "#d8b07a" },
  cream: { sprite: "pile-cream", liquid: true, color: "#fff6e6" },
  strawberry: { sprite: "pile-strawberry", liquid: false, color: "#e8505b" },
  oil: { sprite: "pile-oil", liquid: true, color: "#f5c84a" },
  chocolate: { sprite: "pile-chocolate", liquid: false, color: "#6b3a22" },
  coffee: { sprite: "pile-milk", liquid: true, color: "#6b3a22" },
  riceFlour: { sprite: "pile-flour", liquid: false, color: "#fbfbf6" },
  almondFlour: { sprite: "pile-flour", liquid: false, color: "#f1dfc2" },
  cocoa: { sprite: "pile-cocoa", liquid: false, color: "#6b3a22" },
  banana: { sprite: "pile-banana", liquid: false, color: "#f6e08a" },
  coconutMilk: { sprite: "pile-milk", liquid: true, color: "#fffdf6" },
  mascarpone: { sprite: "pile-cream", liquid: true, color: "#fff9ee" },
  saltedEgg: { sprite: "pile-egg", liquid: false, color: "#f79a2e" },
  porkFloss: { sprite: "pile-yeast", liquid: false, color: "#d9a35c" },
};

export const bowlSprite = (state: BowlState) => BOWL_SPRITE[state];

/** The shop's backdrop for a weather and time of day ("bg-shop" is the sunny day). */
export const shopBackdrop = (weather: Weather, dusk: boolean) =>
  weather === "sunny" && !dusk
    ? "bg-shop"
    : `bg-shop-${weather}-${dusk ? "dusk" : "day"}`;

/** What a waiting step shows: rising dough, a cooling sponge, or a chilling dish. */
export function waitArt(id: RecipeId, mode: "proof" | "cool") {
  if (mode === "proof") return "dough-proofed";
  // Nothing baked yet (tiramisu): the dish itself sets in the cold
  return recipe(id).steps.some((s) => s.kind === "oven")
    ? "sponge-cooling"
    : rawSprite(id);
}

/** Raw in the tin / baked and bare / finished, per recipe. */
export const rawSprite = (id: RecipeId) =>
  id === "donut" ? "raw-donut" : `raw-${id}`;
export const plainSprite = (id: RecipeId) =>
  id === "cookie" || id === "flan" ? recipe(id).sprite : `plain-${id}`;

/**
 * The oven sprite's glass, for the oven drawn fitted in a w×h box standing on
 * `bottom` at `cx`. Measured on the 330×330 kitchen oven and scaled from there.
 */
export function ovenWindow(
  img: HTMLImageElement | undefined,
  cx: number,
  bottom: number,
  w: number,
  h: number,
) {
  if (!img?.naturalWidth)
    return { x: cx - 91, y: bottom - 194, w: 205, h: 118 };
  const at = (box: number) =>
    Math.min(box / img.naturalWidth, box / img.naturalHeight);
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight) / at(330);
  return { x: cx - 91 * k, y: bottom - 194 * k, w: 205 * k, h: 118 * k };
}

/** An image, or a fallback while it is missing (older builds, failed decode). */
export function pick(sprites: Sprites, name: string, fallback: string) {
  const img = sprites.get(name);
  return img?.naturalWidth ? img : sprites.get(fallback);
}

function fitSize(img: HTMLImageElement, w: number, h: number) {
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  return { w: img.naturalWidth * k, h: img.naturalHeight * k };
}

/** Draw `a` fading into `b` (k: 0 → 1), both fitted to the same box. */
export function crossfade(
  ctx: Ctx,
  a: HTMLImageElement | undefined,
  b: HTMLImageElement | undefined,
  k: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  anchor: "center" | "bottom" = "center",
) {
  const t = Math.min(1, Math.max(0, k));
  const draw = (img: HTMLImageElement | undefined, alpha: number) => {
    if (!img?.naturalWidth || alpha <= 0) return;
    const d = fitSize(img, w, h);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(
      img,
      cx - d.w / 2,
      anchor === "center" ? cy - d.h / 2 : cy - d.h,
      d.w,
      d.h,
    );
    ctx.restore();
  };
  draw(a, 1 - t);
  draw(b, t);
}

let tintCanvas: HTMLCanvasElement | null = null;

/**
 * The raw batch as it bakes: the same picture, going golden (k: 0 → 1) under a
 * warm tint that follows its own outline. Raw and finished pictures are framed
 * differently (the finished cake sits on a plate), so the oven never fades
 * between them.
 */
export function baked(
  ctx: Ctx,
  raw: HTMLImageElement | undefined,
  k: number,
  cx: number,
  y: number,
  w: number,
  h: number,
  anchor: "center" | "bottom" = "center",
  /** How golden it gets (steamed cakes barely colour). */
  tint = 0.5,
) {
  if (!raw?.naturalWidth) return;
  const d = fitSize(raw, w, h);
  const x = cx - d.w / 2;
  const top = anchor === "center" ? y - d.h / 2 : y - d.h;
  const t = Math.min(1, Math.max(0, k));
  if (t <= 0) {
    ctx.drawImage(raw, x, top, d.w, d.h);
    return;
  }
  // Tint a copy, kept inside the picture's own pixels
  const pw = Math.ceil(d.w);
  const ph = Math.ceil(d.h);
  tintCanvas ??= document.createElement("canvas");
  if (tintCanvas.width < pw) tintCanvas.width = pw;
  if (tintCanvas.height < ph) tintCanvas.height = ph;
  const tc = tintCanvas.getContext("2d");
  if (!tc) {
    ctx.drawImage(raw, x, top, d.w, d.h);
    return;
  }
  tc.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
  tc.globalCompositeOperation = "source-over";
  tc.drawImage(raw, 0, 0, d.w, d.h);
  tc.globalCompositeOperation = "source-atop";
  tc.fillStyle = `rgba(214, 128, 40, ${tint * t})`;
  tc.fillRect(0, 0, pw, ph);
  tc.globalCompositeOperation = "source-over";
  ctx.drawImage(tintCanvas, 0, 0, pw, ph, x, top, pw, ph);
}

/** Draw the bottom `k` of an image (decoration piped on from the bottom up). */
export function reveal(
  ctx: Ctx,
  img: HTMLImageElement | undefined,
  k: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
) {
  if (!img?.naturalWidth || k <= 0) return;
  const d = fitSize(img, w, h);
  const t = Math.min(1, k);
  const x = cx - d.w / 2;
  const y = cy - d.h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y + d.h * (1 - t) - 2, d.w + 8, d.h * t + 6);
  ctx.clip();
  ctx.drawImage(img, x, y, d.w, d.h);
  ctx.restore();
}

export const easeOutBack = (k: number) => {
  const t = Math.min(1, Math.max(0, k)) - 1;
  return 1 + 2.4 * t * t * t + 1.4 * t * t;
};

// ---------------------------------------------------------------- particles

export type FxKind = "puff" | "steam" | "spark" | "drip";

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export function emit(
  list: Fx[],
  kind: FxKind,
  x: number,
  y: number,
  n: number,
  color = "#fff7ea",
) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed =
      kind === "spark"
        ? 90 + Math.random() * 120
        : kind === "steam"
          ? 10 + Math.random() * 20
          : 30 + Math.random() * 50;
    const max =
      kind === "steam"
        ? 1.4 + Math.random() * 0.6
        : kind === "spark"
          ? 0.6 + Math.random() * 0.3
          : 0.7;
    list.push({
      kind,
      x: x + (kind === "steam" ? (Math.random() - 0.5) * 80 : 0),
      y,
      vx: kind === "steam" ? (Math.random() - 0.5) * 12 : Math.cos(a) * speed,
      vy:
        kind === "steam"
          ? -40 - Math.random() * 30
          : kind === "drip"
            ? 60 + Math.random() * 60
            : Math.sin(a) * speed - (kind === "puff" ? 30 : 0),
      life: 0,
      max,
      size:
        kind === "steam"
          ? 10 + Math.random() * 8
          : kind === "spark"
            ? 5 + Math.random() * 4
            : 4 + Math.random() * 5,
      color,
    });
  }
}

export function stepFx(list: Fx[], dt: number) {
  for (const f of list) {
    f.life += dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.kind === "spark" || f.kind === "puff") {
      f.vx *= 1 - dt * 3;
      f.vy *= 1 - dt * 3;
    }
    if (f.kind === "drip") f.vy += 400 * dt;
  }
  for (let i = list.length - 1; i >= 0; i--)
    if (list[i].life >= list[i].max) list.splice(i, 1);
}

export function drawFx(ctx: Ctx, list: Fx[]) {
  for (const f of list) {
    const k = f.life / f.max;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k);
    if (f.kind === "spark") {
      // Four-point twinkle
      const r = f.size * (1 - k * 0.5);
      ctx.translate(f.x, f.y);
      ctx.rotate(k * 2);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const d = i % 2 ? r * 0.35 : r;
        ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      ctx.closePath();
      ctx.fillStyle = f.color;
      ctx.fill();
    } else if (f.kind === "steam") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      const s = f.size * (1 + k);
      ctx.moveTo(f.x, f.y);
      ctx.bezierCurveTo(
        f.x - s * 0.5,
        f.y - s * 0.4,
        f.x + s * 0.5,
        f.y - s * 0.8,
        f.x,
        f.y - s * 1.2,
      );
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(
        f.x,
        f.y,
        f.size * (f.kind === "puff" ? 1 + k : 1),
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = f.color;
      ctx.fill();
    }
    ctx.restore();
  }
}
