// Key art for the portal, composed from the game's own drawing code. Not
// imported by the game: `bun run art` renders it to poster.webp / banner.webp.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import {
  FONT,
  PALETTES,
  drawBuilding,
  drawHunter,
  drawMapInto,
  drawSleeper,
  glow,
  text,
} from "./art";
import { bedTile, doorPos, tileCenter, tilesByDoor } from "./logic";

/** The poster's two title lines; the manifest holds the same name as one string. */
const POSTER_TITLE: Localized<[string, string]> = {
  vi: ["KÝ TÚC XÁ", "ĐÊM"],
  en: ["NIGHT", "DORM"],
};

/** Two rooms facing the corridor, turrets firing at the hunter at a door. */
function scene(ctx: CanvasRenderingContext2D) {
  drawMapInto(ctx);
  for (const room of [0, 1, 4, 5]) {
    const bed = tileCenter(room, bedTile(room));
    drawSleeper(ctx, bed.x, bed.y, PALETTES[room], 2 + (room % 3));
    const tiles = tilesByDoor(room);
    for (let i = 0; i < 4; i++) {
      const c = tileCenter(room, tiles[i]);
      drawBuilding(
        ctx,
        i === 3 ? "arcade" : "turret",
        c.x,
        c.y,
        38,
        i === 3 ? 1 : 2 + i,
        i,
      );
    }
  }
  const d = doorPos(4);
  const hx = d.x + 34;
  const hy = d.y + 6;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const room of [4, 5]) {
    for (const t of tilesByDoor(room).slice(0, 3)) {
      const c = tileCenter(room, t);
      ctx.strokeStyle = "rgba(255,236,150,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 6);
      ctx.lineTo(hx, hy - 18);
      ctx.stroke();
    }
  }
  glow(ctx, hx, hy - 18, 30, "rgba(255,230,140,0.9)", 0.8);
  ctx.restore();
  drawHunter(ctx, hx, hy, 0.6, 0, true, 1.6);
}

/** 600×800 poster with the title baked in. */
export function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Zoom into corridor A, centred on the hunter at room 201's door
  const k = 1.5;
  ctx.save();
  ctx.translate(300 - 300 * k, 360 - 290 * k);
  ctx.scale(k, k);
  scene(ctx);
  ctx.restore();
  const shade = ctx.createRadialGradient(300, 330, 120, 300, 400, 520);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 600, 800);
  const fade = ctx.createLinearGradient(0, 540, 0, 800);
  fade.addColorStop(0, "rgba(10,6,12,0)");
  fade.addColorStop(1, "rgba(10,6,12,0.95)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 540, 600, 260);
  const [line1, line2] = POSTER_TITLE[locale];
  text(ctx, line1, 300, 668, fitFontSize(ctx, line1, 90, 540, FONT), "#ff5a5a");
  text(ctx, line2, 300, 742, fitFontSize(ctx, line2, 60, 540, FONT), "#f2eee8");
}

/** 1200×600 banner: the hunter at a door on the right, calm dark left for the title. */
export function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#151214";
  ctx.fillRect(0, 0, 1200, 600);
  const k = 1.25;
  ctx.save();
  ctx.translate(900 - 300 * k, 300 - 290 * k);
  ctx.scale(k, k);
  scene(ctx);
  ctx.restore();
  const calm = ctx.createLinearGradient(0, 0, 640, 0);
  calm.addColorStop(0, "rgba(10,6,12,1)");
  calm.addColorStop(0.6, "rgba(10,6,12,0.85)");
  calm.addColorStop(1, "rgba(10,6,12,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 640, 600);
}
