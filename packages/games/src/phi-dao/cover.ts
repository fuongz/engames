import type { Locale } from "@web-games/core";
import { knife, type KnifeSprites, target, text } from "./art";
import { CX, CY, PALETTE as P } from "./config";
import classicUrl from "./img/knife-classic.webp";
import backgroundUrl from "./img/orchard.webp";
import targetUrl from "./img/target.webp";
import { createRun } from "./logic";
import { STRINGS } from "./strings";
async function load(src: string) {
  const i = new Image();
  i.src = src;
  await i.decode();
  return i;
}
/** Crop to cover; never stretch the source image or a circular target. */
function background(
  c: CanvasRenderingContext2D,
  bg: HTMLImageElement,
  w: number,
  h: number,
) {
  const scale = Math.max(w / bg.naturalWidth, h / bg.naturalHeight);
  c.drawImage(
    bg,
    (w - bg.naturalWidth * scale) / 2,
    (h - bg.naturalHeight * scale) / 2,
    bg.naturalWidth * scale,
    bg.naturalHeight * scale,
  );
  c.fillStyle = "rgba(9,30,39,0.25)";
  c.fillRect(0, 0, w, h);
}
function centerpiece(
  c: CanvasRenderingContext2D,
  wood: HTMLImageElement,
  sprites: KnifeSprites,
  x: number,
  y: number,
  scale: number,
) {
  const s = createRun(1);
  s.angle = -0.15;
  s.knives = [
    { angle: 0.1, seat: 0 },
    { angle: 2.3, seat: 1 },
    { angle: 4.2, seat: 0 },
  ];
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  c.translate(-CX, -CY);
  target(c, s, wood, { sprites, reduced: true });
  c.restore();
}
export async function renderPoster(
  canvas: HTMLCanvasElement,
  locale: Locale = "vi",
) {
  canvas.width = 600;
  canvas.height = 800;
  const c = canvas.getContext("2d");
  if (!c) return;
  const [bg, wood, classic] = await Promise.all([
    load(backgroundUrl),
    load(targetUrl),
    load(classicUrl),
  ]);
  const sprites = { classic };
  background(c, bg, 600, 800);
  text(c, STRINGS[locale].subtitle, 300, 95, 22, P.muted);
  text(c, STRINGS[locale].title, 300, 157, locale === "en" ? 58 : 76);
  centerpiece(c, wood, sprites, 300, 350, 1.15);
  knife(c, 300, 575, 0, 0, 1.4, { sprites });
  text(
    c,
    locale === "vi" ? "CANH NHỊP · PHÓNG DAO" : "FIND YOUR RHYTHM",
    300,
    701,
    26,
    P.orange,
  );
}
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const c = canvas.getContext("2d");
  if (!c) return;
  const [bg, wood, classic] = await Promise.all([
    load(backgroundUrl),
    load(targetUrl),
    load(classicUrl),
  ]);
  const sprites = { classic };
  background(c, bg, 1200, 600);
  const shade = c.createLinearGradient(0, 0, 850, 0);
  shade.addColorStop(0, "rgba(9,30,39,0.8)");
  shade.addColorStop(1, "rgba(9,30,39,0)");
  c.fillStyle = shade;
  c.fillRect(0, 0, 1200, 600);
  centerpiece(c, wood, sprites, 900, 263, 1.45);
  knife(c, 900, 505, 0, 0, 1.2, { sprites });
}
