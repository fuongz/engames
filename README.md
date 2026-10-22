# Engames

A small web game portal in the spirit of the old flash game sites: lots of quick
games behind one modern front page, styled as a Steam-like game launcher and
built mobile-first. It installs to the iPhone and
Android home screen (PWA) and keeps opened games playable offline.

Live target: <https://engames.trinhvaphuong.com> (Cloudflare Workers).

## Layout

```
apps/web/          portal — TanStack Start (SPA mode) + Tailwind v4 + shadcn/Base UI
  public/          manifest.webmanifest, sw.js, icons/, _headers
  wrangler.jsonc   assets-only Worker + custom domain
packages/games/    the games — framework-free TypeScript on <canvas>
  src/core/        Stage (DPR canvas, letterbox, pointer mapping), Loop, AudioBus, storage
  src/registry.ts  discovers every src/<slug>/manifest.ts
  src/chien-thu/   Chiến Thú Hỗn Chiến (portrait merge-defense), see RE_NOTES.md
  src/tinh-tu/     Tinh Tú Phi Hành (landscape shoot 'em up), see RE_NOTES.md
```

## Commands

```sh
bun install
bun run dev        # portal on http://localhost:5173 (Vite default)
bun run gate       # build → lint + layout audit → typecheck → tests (keep it green)
bun run deploy     # build and `wrangler deploy` (needs Cloudflare credentials)
bun run ui:add x   # shadcn add for apps/web, with the `#/` alias fix applied
```

## Adding a game

1. Create `packages/games/src/<slug>/` with:
   - `manifest.ts` — default-export a `GameManifest` (`slug` must equal the folder name).
   - `index.ts` — default-export a `GameModule`: `mount(root, ctx)` returns `{ destroy, pause?, resume? }`.
   - key art imported from the manifest: `poster` (3:4, title baked in, for cards)
     and `banner` (2:1, no text, subject on the right, for the home hero).
     Easiest: write `cover.ts` with `renderPoster` / `renderBanner` using the game's
     own drawing code, then `bun run --cwd packages/games art` writes the `.webp` files.
   - optionally write a one-line best result to `ctx.storage` under `SUMMARY_KEY`;
     cards show it instead of the release year.
   - set `orientation: "landscape"` for sideways games: phones held upright get a
     "rotate your phone" overlay, and Android locks to landscape when play starts.
2. Draw on a `Stage` from `../core/stage` (pass `{ bleed: true }` and anchor HUD to `stage.view`
   so wide or tall screens have no black bars) and use `ctx.audio` / `ctx.storage` so the
   portal's mute button and per-game saves work.
3. That's it: the registry finds the folder, the home grid lists it, and
   `/games/<slug>` lazy-loads its chunk. No portal code changes.

Keep game rules in a pure module (like `chien-thu/logic.ts`) so they can be
unit-tested and balance-simulated without a browser.

## Mobile and PWA notes

- The player takes the whole screen below `lg`, pads for the notch and home
  indicator, and blocks page scroll and long-press menus while playing.
- `Stage` supports `bleed`: the game paints into the letterbox so tall phones show
  no black bars.
- iOS has no install prompt; the header's "Cài app" button shows the Share →
  Add to Home Screen steps there and uses the native prompt on Android and desktop.
- `sw.js` serves the shell offline and caches hashed assets as they load, so a game
  is playable offline once it has been opened. Bump `VERSION` there when the
  caching strategy changes.
