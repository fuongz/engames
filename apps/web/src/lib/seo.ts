import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@web-games/core/i18n";
import { intlTag } from "#/lib/i18n";

// Link previews for Facebook, X, Zalo and Messenger, plus what search engines
// read to index both languages. Crawlers read the server-rendered <head> (link
// previews run no JavaScript at all), so every value here must be in the HTML
// the Worker returns — which TanStack Start does for each route's head().
//
// One URL per language: Vietnamese is the bare path, English the same path with
// `?lang=en`. The other query params (room, category, ...) are state, never part
// of a canonical.

/** The public origin: preview URLs must be absolute. */
export const SITE_URL = "https://engames.trinhvaphuong.com";
export const SITE_NAME = "Engames";
/** The portal's own 1200x630 card (made by `bun run --cwd packages/games art`). */
export const SITE_IMAGE = "/og-image.jpg";

export const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

/** The language a URL asks for (`?lang=en`, `?lang=vi`); anything else asks for none. */
export function urlLocale(search: unknown): Locale | undefined {
  const lang = typeof search === "object" && search !== null ? (search as { lang?: unknown }).lang : undefined;
  return isLocale(lang) ? lang : undefined;
}

/** The `lang` search param for a locale: Vietnamese is the bare URL, so it has none. */
export const langParam = (locale: Locale): Locale | undefined => (locale === DEFAULT_LOCALE ? undefined : locale);

/**
 * The language a route's head() renders in, from its `match.search`: the URL's
 * when it names one. Otherwise the server (which has no player, and serves many
 * requests at once) uses the default, and the client asks `clientLocale`.
 */
export function headLocale(search: unknown, clientLocale: () => Locale): Locale {
  return urlLocale(search) ?? (typeof window === "undefined" ? DEFAULT_LOCALE : clientLocale());
}

/** The absolute URL of `path` in `locale`. Any query or hash on `path` is dropped. */
export function localizedUrl(path: string, locale: Locale) {
  const lang = langParam(locale);
  return `${absolute(path.split(/[?#]/)[0] ?? "/")}${lang ? `?lang=${lang}` : ""}`;
}

const OG_LOCALE: Record<Locale, string> = { vi: "vi_VN", en: "en_US" };

interface Social {
  title: string;
  description: string;
  /** The page's language. */
  locale: Locale;
  /** Site path or absolute URL of a 1200x630 image. */
  image?: string;
  imageAlt?: string;
  /** Site path of the page, without a query. */
  path?: string;
}

/**
 * Open Graph + Twitter Card tags (Zalo and Messenger read the Open Graph ones),
 * and the canonical + hreflang links that tie the two language versions together.
 * `x-default` is the Vietnamese page.
 */
export function socialMeta({ title, description, locale, image = SITE_IMAGE, imageAlt, path = "/" }: Social) {
  const img = absolute(image);
  const url = localizedUrl(path, locale);
  const meta = [
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: img },
    { property: "og:image:secure_url", content: img },
    { property: "og:image:type", content: img.endsWith(".png") ? "image/png" : "image/jpeg" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: imageAlt ?? title },
    { property: "og:locale", content: OG_LOCALE[locale] },
    ...LOCALES.filter((l) => l !== locale).map((l) => ({ property: "og:locale:alternate", content: OG_LOCALE[l] })),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: img },
    { name: "twitter:image:alt", content: imageAlt ?? title },
  ];
  const links = [
    { rel: "canonical", href: url },
    ...LOCALES.map((l) => ({ rel: "alternate", hrefLang: l, href: localizedUrl(path, l) })),
    { rel: "alternate", hrefLang: "x-default", href: localizedUrl(path, DEFAULT_LOCALE) },
  ];
  return { meta, links };
}

/** A head() `scripts` entry holding structured data. `<` is escaped so no value can close the tag. */
export function jsonLd(data: Record<string, unknown>) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c"),
  };
}

const publisher = { "@type": "Organization", name: SITE_NAME, url: SITE_URL };

/** The site itself, in the page's language. */
export function websiteJsonLd(locale: Locale) {
  return jsonLd({ "@type": "WebSite", name: SITE_NAME, url: localizedUrl("/", locale), inLanguage: intlTag(locale) });
}

/** A game's page. `image` is a site path or absolute URL. */
export function videoGameJsonLd({ name, description, path, image, locale }: { name: string; description: string; path: string; image: string; locale: Locale }) {
  return jsonLd({
    "@type": "VideoGame",
    name,
    description,
    url: localizedUrl(path, locale),
    image: absolute(image),
    inLanguage: intlTag(locale),
    applicationCategory: "Game",
    operatingSystem: "Web browser",
    gamePlatform: "Web browser",
    publisher,
  });
}
