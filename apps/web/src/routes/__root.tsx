import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { AppShell } from "#/components/features/app-shell/app-shell";
import { TooltipProvider } from "#/components/ui/tooltip";
import { catalogs } from "#/content/messages";
import { registerServiceWorker } from "#/lib/pwa";
import appCss from "#/styles/app.css?url";
import { listenForInstall } from "#/stores/install";
import { listenForLocale, useLocaleStore } from "#/stores/locale";
import { useInterfaceSounds } from "#/hooks/use-interface-sounds";

// SPA build: there is no server at request time, so security headers live in
// public/_headers (applied by Cloudflare Workers static assets) instead of a server fn.
export const Route = createRootRoute({
  // The prerendered shell gets the default (vi); client navigations use the current locale.
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // viewport-fit=cover lets the game use the area under the notch; the UI
      // pads itself with env(safe-area-inset-*).
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: catalogs[useLocaleStore.getState().locale].app.title },
      { name: "description", content: catalogs[useLocaleStore.getState().locale].app.description },
      { name: "theme-color", content: "#14110f" },
      { name: "color-scheme", content: "dark" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Engames" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootLayout() {
  useInterfaceSounds();
  useEffect(() => {
    registerServiceWorker();
    listenForInstall();
    return listenForLocale();
  }, []);
  return (
    <TooltipProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </TooltipProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // Dark-only launcher look: `.dark` is static, so no theme script is needed.
    // `lang` is the prerendered default; stores/locale updates it on the client.
    <html lang="vi" className="dark">
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
