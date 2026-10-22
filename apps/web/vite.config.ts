import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { type Plugin, defineConfig } from "vite";

/**
 * The games registry discovers games with import.meta.glob, but the dev server
 * only watches this app's root, so a new folder in packages/games/src was not
 * picked up until a restart. Watching the source makes the glob re-evaluate.
 */
function watchGames(): Plugin {
  const gamesSrc = fileURLToPath(new URL("../../packages/games/src", import.meta.url));
  return {
    name: "engames:watch-games",
    apply: "serve",
    configureServer(server) {
      server.watcher.add(gamesSrc);
    },
  };
}

// There is deliberately NO `resolve.alias` for `#`: the alias is declared once in
// package.json `imports` (which vite, rolldown and `bun run` all resolve through)
// and mirrored in tsconfig `paths` (which is all tsc reads). A third declaration
// here would be a third place to forget when the layout moves.
export default defineConfig({
  // Order matters. A host-platform plugin (e.g. `cloudflare()`) goes FIRST, before
  // tanstackStart(); viteReact() goes last.
  plugins: [
    tailwindcss(),
    tanstackStart({
      // SPA: the portal is pure client code (games run on canvas, progress lives in
      // localStorage), so it ships as static files any host can serve and the
      // service worker can cache for offline play. The shell is prerendered to
      // index.html; hosts must rewrite unknown paths to it (see public/_redirects).
      spa: { enabled: true, prerender: { outputPath: "/index.html" } },
    }),
    viteReact(),
    watchGames(),
  ],
});
