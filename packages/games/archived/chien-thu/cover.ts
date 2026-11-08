// Key art for the portal (poster 3:4, banner 2:1), composed from the game's own
// drawing code. Not imported by the game: `tools/render-art` runs it in a
// browser and saves poster.webp / banner.webp next to this file.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import { drawBlade, drawBladeTrail, drawCritter, drawEgg, drawEnemy, drawKid, renderBackground, FONT, text } from "./art";
import { CENTER, TRACK_R, bladeCount, bladeHalf, bladeOrbit, speciesFor, type EnemyKind } from "./config";

type Ctx = CanvasRenderingContext2D;

function critterWithBlades(ctx: Ctx, level: number, x: number, y: number, scale: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const n = bladeCount(level);
  const orbit = bladeOrbit(level);
  const half = bladeHalf(level);
  const sp = speciesFor(level);
  for (let i = 0; i < n; i++) {
    const a = spin + (i * Math.PI * 2) / n;
    drawBladeTrail(ctx, 0, 0, orbit, half * 0.9, a, sp.blade === "gold" ? "#ffe14a" : "#5dffa8");
  }
  drawCritter(ctx, level, 0, 0, { t: 0, glow: true });
  for (let i = 0; i < n; i++) {
    const a = spin + (i * Math.PI * 2) / n;
    const c = Math.cos(a);
    const s = Math.sin(a);
    drawBlade(ctx, sp.blade, c * (orbit - half), s * (orbit - half), c * (orbit + half), s * (orbit + half));
  }
  ctx.restore();
}

function zombie(ctx: Ctx, kind: EnemyKind, angle: number, hp: number, t: number) {
  const x = CENTER.x + Math.cos(angle) * TRACK_R;
  const y = CENTER.y + Math.sin(angle) * TRACK_R;
  drawEnemy(ctx, kind, x, y, t, Math.sin(angle) >= 0 ? -1 : 1, 0);
  text(ctx, String(hp), x, y - 50, 22);
}

/** The ring scene in game-logical coordinates (540×900). */
function scene(ctx: Ctx) {
  ctx.drawImage(renderBackground(), 0, 0, 540, 900);
  drawKid(ctx, 50, 466, 0, 0);
  const crowd: [EnemyKind, number, number][] = [
    ["walker", -1.25, 96],
    ["walker", -0.95, 48],
    ["runner", -0.62, 15],
    ["miner", -0.3, 17],
    ["shield", 0.05, 40],
    ["walker", 0.4, 35],
    ["brute", 0.82, 120],
    ["miner", 1.25, 30],
    ["walker", 1.65, 35],
  ];
  for (const [i, [kind, a, hp]] of crowd.entries()) zombie(ctx, kind, a, hp, i * 0.7);
  drawEgg(ctx, CENTER.x + Math.cos(-2.2) * TRACK_R, CENTER.y + Math.sin(-2.2) * TRACK_R, 16);
  critterWithBlades(ctx, 1, 160, 600, 1.15, 2.2);
  critterWithBlades(ctx, 2, 390, 610, 1.15, 0.6);
  critterWithBlades(ctx, 3, 270, 470, 2.1, 0.35);
}

function vignette(ctx: Ctx, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,20,10,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** The poster's two title lines; the manifest holds the same name as one string. */
const POSTER_TITLE: Localized<[string, string]> = {
  vi: ["CHIẾN THÚ", "HỖN CHIẾN"],
  en: ["CRITTER", "BRAWL"],
};

/** 600×800 poster with the title baked in, for game cards. */
export function renderPoster(canvas: HTMLCanvasElement, locale: Locale = "vi") {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Crop the logical scene to 540×720 starting just above the camp
  const k = 600 / 540;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(0, -150);
  scene(ctx);
  ctx.restore();
  vignette(ctx, 600, 800);
  const fade = ctx.createLinearGradient(0, 520, 0, 800);
  fade.addColorStop(0, "rgba(10,25,12,0)");
  fade.addColorStop(1, "rgba(10,25,12,0.85)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 520, 600, 280);
  const [line1, line2] = POSTER_TITLE[locale];
  text(ctx, line1, 300, 668, fitFontSize(ctx, line1, 92, 540, FONT), "#ffe066");
  text(ctx, line2, 300, 742, fitFontSize(ctx, line2, 56, 540, FONT), "#fff");
}

/** 1200×600 banner: art on the right, room for HTML text on the left. */
export function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Grass fill, then the scene zoomed so the big critter sits right of centre
  ctx.fillStyle = "#6cbb3e";
  ctx.fillRect(0, 0, 1200, 600);
  // Subject in the right third; the left stays calm for the HTML title
  const k = 1.45;
  ctx.save();
  ctx.translate(900, 300);
  ctx.scale(k, k);
  ctx.translate(-270, -480);
  scene(ctx);
  ctx.restore();
  vignette(ctx, 1200, 600);
  const calm = ctx.createLinearGradient(0, 0, 720, 0);
  calm.addColorStop(0, "rgba(14,40,20,0.92)");
  calm.addColorStop(0.55, "rgba(14,40,20,0.6)");
  calm.addColorStop(1, "rgba(14,40,20,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 720, 600);
}
