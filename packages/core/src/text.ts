/**
 * Largest font size (up to `size`) at which `str` fits in `maxWidth`, for titles
 * whose length changes with the language. `family` is the CSS font-family list.
 */
export function fitFontSize(ctx: CanvasRenderingContext2D, str: string, size: number, maxWidth: number, family: string, weight = 800) {
  let s = size;
  for (; s > 12; s -= 2) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(str).width <= maxWidth) break;
  }
  return s;
}
