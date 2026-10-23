// Link previews for Facebook, X, Zalo and Messenger. Their crawlers read the
// server-rendered <head> and run no JavaScript, so every value here must be in
// the HTML the Worker returns — which TanStack Start does for each route's head().

/** The public origin: preview URLs must be absolute. */
export const SITE_URL = "https://engames.trinhvaphuong.com";
export const SITE_NAME = "Engames";
/** The portal's own 1200x630 card (made by `bun run --cwd packages/games art`). */
export const SITE_IMAGE = "/og-image.jpg";

export const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

interface Social {
  title: string;
  description: string;
  /** Site path or absolute URL of a 1200x630 image. */
  image?: string;
  imageAlt?: string;
  /** Site path of the page. */
  path?: string;
  /** Content language: the first locale is the page's, the rest alternates. */
  locales?: string[];
}

/** Open Graph + Twitter Card tags (Zalo and Messenger read the Open Graph ones). */
export function socialMeta({ title, description, image = SITE_IMAGE, imageAlt, path = "/", locales = ["vi_VN", "en_US"] }: Social) {
  const img = absolute(image);
  const [locale, ...alternates] = locales;
  return [
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: "website" },
    { property: "og:url", content: absolute(path) },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: img },
    { property: "og:image:secure_url", content: img },
    { property: "og:image:type", content: img.endsWith(".png") ? "image/png" : "image/jpeg" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: imageAlt ?? title },
    { property: "og:locale", content: locale },
    ...alternates.map((l) => ({ property: "og:locale:alternate", content: l })),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: img },
    { name: "twitter:image:alt", content: imageAlt ?? title },
  ];
}
