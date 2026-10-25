// Key art for the portal, composed from the game's own drawing code. Not
// imported by the game: `bun run art` renders it to poster.webp / banner.webp.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import {
  FONT,
  type Layer,
  TUBE_W,
  drawBackdrop,
  drawStream,
  drawTube,
  makeBackdrop,
  text,
} from "./art";
import { CAPACITY } from "./config";

/** The poster's two title lines; the manifest holds the same name as one string. */
const POSTER_TITLE: Localized<[string, string]> = {
  vi: ["RÓT NƯỚC", "MÀU"],
  en: ["WATER", "SORT"],
};

const TUBES: number[][] = [
  [2, 1, 1, 0],
  [4, 5, 0, 3],
  [7, 6, 4, 3],
  [6, 5, 4, 5],
  [7, 1, 8, 2],
  [7, 8, 2, 0],
];
const layers = (tube: number[]): Layer[] =>
  tube.map((color) => ({ color, amount: 1 }));

/** A row of mixed tubes with one tilted over an empty tube, pouring sky blue. */
function scene(ctx: CanvasRenderingContext2D, ox: number) {
  const gap = 78;
  for (const [i, tube] of TUBES.entries()) {
    drawTube(ctx, ox + i * gap, 90, 0, layers(tube), CAPACITY, false);
  }
  // Bottom row: two tubes, an empty one being filled, and the pouring one above it
  drawTube(ctx, ox + gap * 0.5, 330, 0, layers([8, 3, 1, 3]), CAPACITY, false);
  drawTube(ctx, ox + gap * 1.5, 330, 0, layers([0, 4, 5, 8]), CAPACITY, false);
  drawTube(
    ctx,
    ox + gap * 3.5,
    330,
    0,
    [{ color: 6, amount: 0.6 }],
    CAPACITY,
    false,
  );
  drawTube(ctx, ox + gap * 4.5, 330, 0, layers([2, 2]), CAPACITY, false);
  const px = ox + gap * 3.5 - 12;
  drawTube(
    ctx,
    px,
    266,
    1.15,
    [
      { color: 7, amount: 1 },
      { color: 2, amount: 1 },
      { color: 6, amount: 1.4 },
    ],
    CAPACITY,
    true,
  );
  drawStream(
    ctx,
    px + (TUBE_W / 2) * Math.cos(1.15),
    266 + (TUBE_W / 2) * Math.sin(1.15),
    330 + 18 + 3.4 * 38,
    6,
    6,
  );
}

/** 600×800 poster with the title baked in. */
export function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawBackdrop(ctx, makeBackdrop(), 0, 0, 600, 800);
  ctx.save();
  ctx.translate(0, 40);
  scene(ctx, 105);
  ctx.restore();
  const fade = ctx.createLinearGradient(0, 560, 0, 800);
  fade.addColorStop(0, "rgba(20,20,24,0)");
  fade.addColorStop(1, "rgba(20,20,24,0.95)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 560, 600, 240);
  const [line1, line2] = POSTER_TITLE[locale];
  text(ctx, line1, 300, 668, fitFontSize(ctx, line1, 92, 540, FONT), "#5ae0ff");
  text(ctx, line2, 300, 744, fitFontSize(ctx, line2, 62, 540, FONT), "#ffe25a");
}

/** 1200×600 banner: tubes on the right, calm dark left for the HTML title. */
export function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawBackdrop(ctx, makeBackdrop(), 0, 0, 1200, 600);
  ctx.save();
  ctx.translate(0, 20);
  scene(ctx, 700);
  ctx.restore();
  const calm = ctx.createLinearGradient(0, 0, 640, 0);
  calm.addColorStop(0, "rgba(20,20,24,1)");
  calm.addColorStop(0.6, "rgba(20,20,24,0.8)");
  calm.addColorStop(1, "rgba(20,20,24,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 640, 600);
}
