# Engames

A small web game portal in the spirit of the old flash game sites: lots of quick
games behind one modern front page, styled as a Steam-like game launcher and
built mobile-first. It installs to the iPhone and
Android home screen (PWA) and keeps opened games playable offline.

Live target: <https://engames.trinhvaphuong.com> (Cloudflare Workers).

## Layout

```
apps/web/          portal — TanStack Start (SPA mode on Workers) + Tailwind v4 + shadcn/Base UI
  src/server/      Better Auth (Google) + leaderboard server functions over D1/Drizzle
  drizzle/         generated SQL migrations (never hand-edit)
  public/          manifest.webmanifest, sw.js, icons/, _headers
  wrangler.jsonc   Worker, D1 binding `DB` (prod-engames), custom domain
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
bun run secrets    # gitleaks over the whole git history (CI runs the same)
```

CI: `.github/workflows/secret-scan.yml` runs gitleaks on every push to `main`,
every PR and weekly; findings fail the job and appear under Security → Code scanning.

## Accounts, leaderboard and D1

Sign-in (Google via Better Auth) exists only to put a name on leaderboards.
Signed-in players keep their best score per game; guests type a name at game
over and every guest run is its own row. Games report a finished run with
`ctx.reportScore({ score, detail })`; the portal shows the save dialog.

One-time setup:

1. Google Cloud Console → Credentials → OAuth client ID (Web). Redirect URIs:
   `http://localhost:5173/api/auth/callback/google` and
   `https://engames.trinhvaphuong.com/api/auth/callback/google`.
2. Local: `cp apps/web/.dev.vars.example apps/web/.dev.vars` and fill it in.
3. Production secrets (from `apps/web`):
   `bunx wrangler secret put BETTER_AUTH_SECRET` (and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

## Languages (Tiếng Việt / English)

The whole portal and every game ship in Vietnamese and English. The choice lives
in `stores/locale.ts`: a first visit follows the browser language, a pick from the
language menu is kept per device, and for signed-in players it is saved on the
account (`user.locale`, a Better Auth additional field) so it follows them to
other devices. Portal copy is in `apps/web/src/content/messages/{vi,en}.ts`
(`en` is typed against `vi`, and a test checks placeholders match).

Schema changes (from `apps/web`): edit `src/server/db/schema.ts`, then
`bun run db:generate` → `bun run db:migrate:local` → `bun run db:migrate:remote`
before deploying code that needs the new columns.

## Adding a game

1. Create `packages/games/src/<slug>/` with:
   - `manifest.ts` — default-export a `GameManifest` (`slug` must equal the folder name).
   - `index.ts` — default-export a `GameModule`: `mount(root, ctx)` returns `{ destroy, pause?, resume? }`.
   - key art imported from the manifest: `poster` (3:4, title baked in, for cards;
     one per language, `{ vi: poster.webp, en: poster-en.webp }`) and `banner`
     (2:1, no text, subject on the right, for the home hero).
     Easiest: write `cover.ts` with `renderPoster(canvas, locale)` / `renderBanner` using
     the game's own drawing code, then `bun run --cwd packages/games art` writes the `.webp` files.
   - `title`, `tagline`, `description`, `controls`, `tags` and `inspiredBy` are `{ vi, en }`.
   - keep every drawn string in a `strings.ts` `Localized` catalog and resolve it at
     draw time with `currentLocale(ctx)` from `../core/i18n`, so a language switch
     shows on the next frame; report `detail` in the current language.
   - optionally write a one-line best result to `ctx.storage` under `SUMMARY_KEY`,
     as `{ vi, en }`; cards show it instead of the release year.
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

## License

[MIT](LICENSE) © 2026 fuongz. The games are original code and art inspired by
other titles (credited in each game's `inspiredBy` and `RE_NOTES.md`); those
titles and their trademarks belong to their owners.
