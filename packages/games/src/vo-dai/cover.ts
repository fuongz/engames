// Key art for the portal, composed from the game's own drawing code. Not
// imported by the game: `bun run art` renders it to poster.webp / banner.webp.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import { FONT, drawFighter, drawRing, drawSpark, makeStage, text } from "./art";
import { FLOOR_Y, H, W } from "./config";
import bannerArt from "./img/banner-art.webp";
import posterArt from "./img/poster-art.webp";
import { createGame } from "./logic";

/** The painted key art (img/), or null if it is missing: then the rig scene is drawn instead. */
async function painted(src: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/** The arena stretched over `width` logical px, and the clash centred at `cx`. */
function scene(ctx: CanvasRenderingContext2D, width = W, cx = 495) {
  ctx.drawImage(makeStage(), 0, 0, width, H);
  const s = createGame("ho", "gau");
  const [tiger, bear] = s.fighters;
  // Both beasts out: Khang's tiger claws through, Tấn's bear reels from the hit
  Object.assign(tiger, { x: cx - 65, state: "attack", move: "rush", frame: 12, beastLeft: 1 });
  Object.assign(bear, { x: cx + 65, y: FLOOR_Y - 30, state: "juggle", vy: -6, beastLeft: 1 });
  drawRing(ctx, cx - 65, FLOOR_Y - 80, 0.45, "#ffe14a");
  drawFighter(ctx, bear, 0.6, false);
  drawFighter(ctx, tiger, 0.3, false);
  drawSpark(ctx, cx + 25, FLOOR_Y - 96, 0.25, "heavy");
}

/** The poster's two title lines; the manifest holds the same name as one string. */
const POSTER_TITLE: Localized<[string, string]> = {
  vi: ["VÕ ĐÀI", "HOÁ THÚ"],
  en: ["BEASTFORM", "FIGHTERS"],
};

/** 600×800 poster with the title baked in. */
export async function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  if (art) {
    ctx.drawImage(art, 0, 0, 600, 800);
    return posterTitle(ctx, locale);
  }
  const k = 800 / H;
  ctx.save();
  ctx.scale(k, k);
  // Lift the floor so the fighters stand clear of the title
  ctx.translate(-290, -120);
  ctx.fillStyle = "#2a1b4a";
  ctx.fillRect(290, 0, 405, 120);
  scene(ctx);
  // The floor runs on under the title
  ctx.fillStyle = "#4a2c1a";
  ctx.fillRect(290, H, 405, 200);
  ctx.restore();
  posterTitle(ctx, locale);
}

function posterTitle(ctx: CanvasRenderingContext2D, locale: Locale) {
  const fade = ctx.createLinearGradient(0, 500, 0, 800);
  fade.addColorStop(0, "rgba(20,10,22,0)");
  fade.addColorStop(1, "rgba(20,10,22,0.92)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 500, 600, 300);
  const [line1, line2] = POSTER_TITLE[locale];
  text(ctx, line1, 300, 652, fitFontSize(ctx, line1, 92, 540, FONT), "#ffe7a6");
  text(ctx, line2, 300, 734, fitFontSize(ctx, line2, 76, 540, FONT), "#ff8a3a");
}

/** 1200×600 banner: the clash on the right half, calm left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  if (art) {
    ctx.drawImage(art, 0, 0, 1200, 600);
  } else {
    const k = 600 / H;
    ctx.save();
    ctx.scale(k, k);
    // The arena covers the whole banner; the clash sits right of centre
    scene(ctx, 1200 / k, 760);
    ctx.restore();
  }
  const calm = ctx.createLinearGradient(0, 0, 520, 0);
  calm.addColorStop(0, "rgba(30,14,34,0.92)");
  calm.addColorStop(1, "rgba(30,14,34,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 520, 600);
}
