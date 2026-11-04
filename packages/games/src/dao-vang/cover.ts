// Key art for the portal. Not imported by the game: `bun run art` renders it to
// poster.webp / poster-en.webp / banner.webp. The paintings in img/ are generated
// art (see tools/dao-vang-sprites.py); only the titles are drawn here.
import { type Locale, type Localized, fitFontSize } from "@web-games/core";
import { FONT, text } from "./art";
import bannerArt from "./img/banner-art.webp";
import posterArt from "./img/poster-art.webp";

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

/** The poster's two title lines; the manifest holds the same name as one string. */
const POSTER_TITLE: Localized<[string, string]> = {
  vi: ["ĐÀO", "VÀNG"],
  en: ["GOLD", "DIG"],
};

/** 600×800 poster with the title baked in over the calm earth at the bottom. */
export async function renderPoster(
  canvas: HTMLCanvasElement,
  locale: Locale = "vi",
) {
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(posterArt);
  if (art) ctx.drawImage(art, 0, 0, 600, 800);
  else {
    ctx.fillStyle = "#562317";
    ctx.fillRect(0, 0, 600, 800);
  }
  const fade = ctx.createLinearGradient(0, 560, 0, 800);
  fade.addColorStop(0, "rgba(40,14,6,0)");
  fade.addColorStop(1, "rgba(40,14,6,0.9)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 560, 600, 240);
  const [line1, line2] = POSTER_TITLE[locale];
  const one = `${line1} ${line2}`;
  text(ctx, one, 300, 712, fitFontSize(ctx, one, 104, 540, FONT), "#ffd23f");
}

/** 1200×600 banner: the dig on the right, calm sky and earth on the left for the HTML title. */
export async function renderBanner(canvas: HTMLCanvasElement) {
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const art = await painted(bannerArt);
  if (art) ctx.drawImage(art, 0, 0, 1200, 600);
  else {
    ctx.fillStyle = "#20a8fe";
    ctx.fillRect(0, 0, 1200, 600);
  }
  const calm = ctx.createLinearGradient(0, 0, 560, 0);
  calm.addColorStop(0, "rgba(30,12,6,0.55)");
  calm.addColorStop(1, "rgba(30,12,6,0)");
  ctx.fillStyle = calm;
  ctx.fillRect(0, 0, 560, 600);
}
