import { HeadContent, Outlet, Scripts, createRootRoute, retainSearchParams } from "@tanstack/react-router";
import type { Locale } from "@web-games/core/i18n";
import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { AppShell } from "#/components/features/app-shell/app-shell";
import { TooltipProvider } from "#/components/ui/tooltip";
import { catalogs } from "#/content/messages";
import { registerServiceWorker } from "#/lib/pwa";
import { headLocale, socialMeta, urlLocale, websiteJsonLd } from "#/lib/seo";
import appCss from "#/styles/app.css?url";
import { listenForInstall } from "#/stores/install";
import { followUrlLocale, listenForLocale, storedLocale } from "#/stores/locale";
import { useInterfaceSounds } from "#/hooks/use-interface-sounds";
import { UrlLocaleContext, useLocale } from "#/hooks/use-messages";

// SPA build: there is no server at request time, so security headers live in
// public/_headers (applied by Cloudflare Workers static assets) instead of a server fn.
export const Route = createRootRoute({
  // ?lang=en is the English page; Vietnamese is the bare URL. Child routes'
  // validateSearch get it merged in (their match.search keeps it), and internal
  // links carry it along, so an English visitor stays on English URLs.
  validateSearch: (search: Record<string, unknown>): { lang?: Locale } => {
    const lang = urlLocale(search);
    return lang ? { lang } : {};
  },
  search: { middlewares: [retainSearchParams(["lang"])] },
  // The page's language comes from the URL (lib/seo headLocale), never from
  // shared state on the server. Canonical/hreflang links are each page's own.
  head: ({ match }) => {
    const locale = headLocale(match.search, storedLocale);
    const m = catalogs[locale];
    return {
      meta: [
        { charSet: "utf-8" },
        // viewport-fit=cover lets the game use the area under the notch; the UI
        // pads itself with env(safe-area-inset-*).
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { title: m.app.title },
        { name: "description", content: m.app.description },
        { name: "theme-color", content: "#14110f" },
        { name: "color-scheme", content: "dark" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: "Engames" },
        // Link previews; pages override what they know better (a game's own card)
        ...socialMeta({ title: m.app.title, description: m.app.description, locale }).meta,
      ],
      scripts: [websiteJsonLd(locale)],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest" },
        // ICO first for old browsers; SVG wins where supported. Browsers keep favicons
        // by URL for a long time, so a new logo ships under a new file name (or ?v=).
        { rel: "icon", href: "/favicon.ico?v=3", sizes: "32x32" },
        { rel: "icon", href: "/icons/logo.svg", type: "image/svg+xml" },
        { rel: "apple-touch-icon", href: "/icons/logo-apple-touch.png" },
      ],
    };
  },
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootLayout() {
  useInterfaceSounds();
  const lang = Route.useSearch({ select: (s) => s.lang });
  useEffect(() => {
    registerServiceWorker();
    listenForInstall();
    return listenForLocale();
  }, []);
  // After mount (never during SSR), a ?lang= in the URL becomes the stored language too
  useEffect(() => {
    if (lang) followUrlLocale(lang);
  }, [lang]);
  return (
    <TooltipProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </TooltipProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  // Per request: the server renders each URL's language without touching the store
  const lang = Route.useSearch({ select: (s) => s.lang });
  return (
    <UrlLocaleContext value={lang}>
      <Document>{children}</Document>
    </UrlLocaleContext>
  );
}

function Document({ children }: { children: React.ReactNode }) {
  // The URL's language, else the default while hydrating (as the server rendered
  // it), then the player's saved one.
  const locale = useLocale();
  return (
    // Dark-only launcher look: `.dark` is static, so no theme script is needed.
    <html lang={locale} className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/* One wrapper, and every animation in the tree degrades under
            prefers-reduced-motion without a per-component check. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <Scripts />
      </body>
    </html>
  );
}
