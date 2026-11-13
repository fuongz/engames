// Key art for `bun run art`. The posters and banner are finished, reviewed
// renders (sources in packages/games/art-src/qua-duong/), shipped as
// poster.webp, poster-en.webp and banner.webp; this cover only paints them back
// so a re-run of `bun run art` keeps them instead of drawing something else.
import type { Locale } from "@web-games/core";
import banner from "./banner.webp";
import posterEn from "./poster-en.webp";
import posterVi from "./poster.webp";

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });
}

async function paint(canvas: HTMLCanvasElement, src: string) {
  const img = await load(src);
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")?.drawImage(img, 0, 0);
}

/** The poster with the title, per language. */
export const renderPoster = (canvas: HTMLCanvasElement, locale: Locale = "vi") => paint(canvas, locale === "en" ? posterEn : posterVi);

/** The 2:1 banner, calm on the left for the HTML title. */
export const renderBanner = (canvas: HTMLCanvasElement) => paint(canvas, banner);
