import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
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
  // ⚠️ Plugin order. `cloudflare()` MUST come before `tanstackStart()` — it
  // installs the workerd environment that Start's server build then targets.
  // Reversed, the build still succeeds and produces a server bundle that has no
  // bindings at runtime. viteReact() goes last.
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      // SPA: pages render in the browser (games run on canvas), so the shell is
      // prerendered once and cached by the service worker for offline play. The
      // Worker still serves /api/auth/* and server functions (leaderboard).
      spa: { enabled: true, prerender: { outputPath: "/index.html" } },
    }),
    viteReact(),
    watchGames(),
  ],
});
