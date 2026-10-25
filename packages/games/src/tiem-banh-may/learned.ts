import { type App, H, W, viewRect } from "./app";
import { C, nine, panel, sprite, text } from "./art";
import { easeOutBack } from "./bakeart";
import { recipe } from "./logic";

// A recipe just bought: the dish on a painted splash over a doodle wallpaper,
// its name on a taped ribbon, and a tap to go back to its page. Few words,
// one big picture.

let doodle: { img: HTMLImageElement; pattern: CanvasPattern | null } | null =
  null;

export function drawLearned(
  app: App,
  s: Extract<App["screen"], { kind: "learned" }>,
) {
  const { ctx } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const v = viewRect(app);
  const t = app.time - s.at;

  // The wallpaper: a tiled doodle, or plain butter yellow until it loads
  ctx.fillStyle = "#fbe7a6";
  ctx.fillRect(v.x, v.y, v.w, v.h);
  const tile = app.sprites.get("bg-doodle");
  if (tile?.naturalWidth) {
    if (doodle?.img !== tile)
      doodle = { img: tile, pattern: ctx.createPattern(tile, "repeat") };
    if (doodle.pattern) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.translate(v.x, v.y);
      ctx.scale(0.5, 0.5);
      ctx.fillStyle = doodle.pattern;
      ctx.fillRect(0, 0, v.w * 2, v.h * 2);
      ctx.restore();
    }
  }

  const r = recipe(s.recipe);
  const cy = H / 2 - 30;
  text(ctx, tr.learned, W / 2, cy - 230, {
    size: 34,
    maxWidth: W - 40,
    outline: "#fbe7a6",
  });

  // The dish pops onto its splash
  const pop = easeOutBack(Math.min(1, t / 0.6));
  const splash = app.sprites.get("splash");
  sprite(ctx, splash, W / 2, cy, 330 * pop, 290 * pop);
  const bob = Math.sin(app.time * 2.2) * 4;
  sprite(ctx, app.sprites.get(r.sprite), W / 2, cy + bob, 240 * pop, 220 * pop);
  // A few sparkles around it
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + app.time * 0.6;
    const twinkle = 0.5 + 0.5 * Math.sin(app.time * 4 + i * 1.7);
    ctx.save();
    ctx.globalAlpha = twinkle * Math.min(1, t * 2);
    sparkle(ctx, W / 2 + Math.cos(a) * 170, cy + Math.sin(a) * 140, 9);
    ctx.restore();
  }

  // The name on a taped ribbon
  const rib = { x: 60, y: cy + 150, w: W - 120, h: 84 };
  const ribbon = app.sprites.get("ribbon");
  if (ribbon?.naturalWidth)
    sprite(ctx, ribbon, W / 2, rib.y + rib.h / 2, rib.w + 60, rib.h + 30);
  else if (!nine(ctx, ribbon, rib, 40, 20))
    panel(ctx, rib, { fill: "#d9ecf7", radius: 14, line: 2.5 });
  text(ctx, r.name[locale], W / 2, rib.y + rib.h / 2 + 2, {
    size: 26,
    maxWidth: rib.w - 80,
  });

  // Tap anywhere
  const blink = 0.45 + 0.35 * Math.sin(app.time * 3);
  ctx.save();
  ctx.globalAlpha = blink;
  text(ctx, tr.tapContinue, W / 2, H - 70, { size: 20, fill: C.muted });
  ctx.restore();
  app.ui.add({
    rect: v,
    tap: () => {
      if (t < 0.4) return;
      app.sfx.tap();
      app.go({ kind: "book", tab: s.tab, detail: s.recipe, page: s.page });
    },
  });
}

/** A four-point twinkle. */
function sparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const d = i % 2 ? r * 0.35 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = "#fff6c8";
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "#c98a3a";
  ctx.stroke();
}
