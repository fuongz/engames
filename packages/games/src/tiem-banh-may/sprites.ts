// The bakery's art (img/*.svg, traced from the hand-drawn bitmaps at the
// same pixel size, so source rects and 9-slices still line up). Vite gives each file a hashed /assets URL, which the service worker
// keeps once fetched, so a played day works offline next time.

const URLS = import.meta.glob<string>("./img/*.svg", {
  eager: true,
  import: "default",
});

export interface Sprites {
  /** True once every image has decoded (or failed: a missing one just isn't drawn). */
  readonly ready: boolean;
  readonly progress: number;
  get(name: string): HTMLImageElement | undefined;
}

export function loadSprites(): Sprites {
  const images = new Map<string, HTMLImageElement>();
  const entries = Object.entries(URLS);
  let settled = 0;
  for (const [path, url] of entries) {
    const name = path.slice(path.lastIndexOf("/") + 1, -".svg".length);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    images.set(name, img);
    img
      .decode()
      .catch(() => undefined)
      .finally(() => settled++);
  }
  return {
    get ready() {
      return settled >= entries.length;
    },
    get progress() {
      return entries.length ? settled / entries.length : 1;
    },
    get: (name) => images.get(name),
  };
}
