# Web stack — a portable standard

A decided baseline for a React web app, written down so the next project starts
from a stack instead of from a fresh round of picking. It is meant to be **copied
into a new repo and applied as-is**: every version below is one that has shipped
together, and every convention is one that has already cost something to learn.

**Fits:** a server-rendered React app with a client bundle, a typed server
boundary, and a component library it owns the source of.

**Does not fit:** a purely static site (Vite + React alone is less machinery), or
a backend with no browser bundle.

---

## Contents

1. [The stack at a glance](#1--the-stack-at-a-glance)
2. [One path alias, declared in exactly two places](#2--one-path-alias-declared-in-exactly-two-places)
3. [Build and tooling contract](#3--build-and-tooling-contract)
4. [Framework layer — TanStack Start](#4--framework-layer--tanstack-start)
5. [UI layer](#5--ui-layer)
6. [State and data](#6--state-and-data)
7. [Conventions that must travel with the stack](#7--conventions-that-must-travel-with-the-stack)
8. [Bootstrapping a new project](#8--bootstrapping-a-new-project)
9. [Traps this stack has already paid for](#9--traps-this-stack-has-already-paid-for)
10. [What this standard deliberately does not pick](#10--what-this-standard-deliberately-does-not-pick)

---

## 1 · The stack at a glance

Versions are what this standard was written against. Treat the major as the
decision and the minor as a starting point.

### Core — install all of it

| Layer | Choice | Version | What it buys you |
| --- | --- | --- | --- |
| Package manager | **Bun** workspaces | 1.3 | One lockfile for the monorepo, fast installs |
| Language | **TypeScript**, `strict` | 6.0 | `verbatimModuleSyntax` + `moduleResolution: Bundler` — an import means exactly what it says |
| Bundler / dev server | **Vite** (Rolldown) | 8.2 | Rust bundler behind a Vite API; SSR dev with real HMR |
| App framework | **TanStack Start** | 1.168 | SSR + typed server functions over Web `Request`/`Response`, so the same code deploys to Node or to an edge runtime |
| Router | **TanStack Router** | 1.170 | File-based routes, typed params, loaders with a first-class pending state |
| UI runtime | **React** | 19.2 | — |
| Styling | **Tailwind CSS v4** | 4.3 | CSS-first config: the token set lives in one stylesheet, no `tailwind.config.js` |
| Components | **shadcn** CLI over **Base UI** | `@base-ui/react` 1.6 | You own the source; the registry is the update channel, not a dependency bump |
| Icons | **Hugeicons** | 4.2 / 1.1 | One family, tree-shaken from `@hugeicons/core-free-icons` |
| Fonts | **Fontsource** variable | 5.x | Self-hosted — no third-party font request on first paint |
| Animation | **Motion** (`motion/react`) | 12.40 | Spring/layout animation with one global reduced-motion switch |
| Client state | **Zustand** | 5.0 | Stores for state that outlives a component; no provider tree |
| Server data | Router loaders + `createServerFn` | — | **No client data-fetching library.** See §6 |
| Validation | **Zod** | 4.4 | The server-function boundary validator |
| Lint + format | **Biome** | 2.5 | One binary, one config, at the repo root only |

### Per capability — add when the feature exists, not upfront

| Capability | Choice |
| --- | --- |
| Hosting | **Cloudflare Workers** — `@cloudflare/vite-plugin` + `wrangler` |
| Database | **Drizzle** + Cloudflare **D1** |
| Auth | **Better Auth** |
| Rendered markdown | `react-markdown` + `remark-gfm` |
| Charts | **Recharts** |
| Drag and drop | `@dnd-kit/core` |

Smaller primitives arrive as dependencies of the shadcn components you install
and are **not separate decisions**: `cmdk`, `vaul`, `sonner`, `embla-carousel-react`,
`react-day-picker`, `input-otp`, `react-resizable-panels`,
`class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`. Install
the component, not the package.

---

## 2 · One path alias, declared in exactly two places

The single convention that everything else hangs off. Cheap on day one,
expensive to retrofit on day ninety.

`#/*` → `./src/*`, declared in **`package.json` `imports`** and mirrored in
**`tsconfig.json` `paths`**. Nowhere else.

```jsonc
// package.json
"imports": { "#/*": "./src/*" }

// tsconfig.json
"paths": { "#/*": ["./src/*"] }
```

`#` is a Node subpath-imports prefix, so Vite, Rolldown and `bun run` all resolve
it natively — which is why there is deliberately **no `resolve.alias` for it in
the Vite config**. A third declaration is a third place to forget when the layout
moves. `tsc` reads only `paths`; every runtime reads only `imports`.

`@/*` is the common default and is worth avoiding: it is not a runtime-resolvable
specifier, so it always needs a bundler alias — which is exactly the third
declaration this rule removes.

---

## 3 · Build and tooling contract

```jsonc
// apps/<app>/package.json
"scripts": {
  "dev":       "vite dev",
  "build":     "vite build",
  "typecheck": "tsc --noEmit",
  "deploy":    "vite build && wrangler deploy"
}
```

### The gates

| Gate | Command | Pass condition |
| --- | --- | --- |
| Lint + format | `bun run lint` (Biome, at the root) | **zero** findings |
| Types | `bun run typecheck` | clean |
| Bundle | `bun run build` | clean — the real gate for any **structural** change |
| Layout | `node scripts/audit-layout.mjs` | exit 0 |

Three things about these that are worth stating, because each has been learned
the expensive way:

**Biome config lives at the repo root only, never per app.** Package managers,
component registries and codegen all rewrite files inside apps; a rule exception
parked in an app-level config is one regeneration away from being silently
dropped.

**Zero is the only defensible lint number.** The first tolerated finding is the
one that makes the count meaningless, because from then on nobody can tell a new
finding from the accepted ones at a glance.

**The layout audit exists because `tsc`, Biome and the bundler all pass on every
violation it catches** — importer counts, layer direction, a runtime edge that
should have been a type edge. None of them are visible with one file open. See
§7.

---

## 4 · Framework layer — TanStack Start

```ts
export const getThing = createServerFn({ method: "GET" })
  .validator((v: unknown) => schema.parse(v))   // .validator(), NOT .inputValidator()
  .handler(async ({ data }) => { /* server-only */ });
```

- **`getRequest()`** from `@tanstack/react-start/server` for headers and the
  incoming request; `setResponseHeader()` for response headers.
- **A server-only import is extracted out of the client bundle when it sits
  inside a `createServerFn` handler, and only then.** This is the mechanism for
  things like security headers on the root route: wrap it in a server function
  and the import never reaches the browser.
- **`src/routeTree.gen.ts` is generated.** Never hand-edit it, never commit a
  manual fix to it.
- **Plugin order matters:** `cloudflare()` (when present) → `tailwindcss()` →
  `tanstackStart()` → `viteReact()`.
- Router defaults worth copying:

  ```ts
  createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultStaleTime: Infinity,   // only if server data is cache-bounded elsewhere
  });
  ```

  Without `defaultStaleTime`, every window refocus re-runs every loader.
- **Heavy loaders ship a `pendingComponent` with a low `pendingMs`.** A loader
  with neither renders nothing at all for its entire duration.

---

## 5 · UI layer

### Tailwind v4, CSS-first

There is no `tailwind.config.js`. One stylesheet holds the imports, the content
sources and the token set:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";
/* every @import must precede every other at-rule — CSS spec, not Tailwind */

@source "../**/*.{ts,tsx}";
@plugin "@tailwindcss/typography";
@custom-variant dark (&:is(.dark *));
```

⚠️ **`@source` resolves relative to the stylesheet**, while Tailwind's automatic
content detection resolves against the Vite root. Put the stylesheet in
`src/styles/` and automatic detection misses `src/` entirely — you get a page
with no classes and no error. Declare the source explicitly.

### Components

`components.json` points the shadcn CLI at the `#/` aliases, so generated files
land on the same alias as everything else:

```jsonc
{
  "style": "base-rhea",
  "tailwind": { "css": "src/styles/app.css", "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "hugeicons",
  "aliases": {
    "components": "#/components", "ui": "#/components/ui",
    "utils": "#/lib/utils", "lib": "#/lib", "hooks": "#/hooks"
  },
  "registries": { "@svgl": "https://svgl.app/r/{name}.json" }
}
```

- **`components/ui/` is CLI territory.** Never move or rename a file in it — the
  next `shadcn add <name>` writes the old path back and now there are two, both
  compiling. Local edits get an in-file comment; lint exceptions go in the root
  Biome config, which regeneration cannot wipe.
- **Only `ui/` imports Base UI.** Feature code imports the wrapper, never
  `@base-ui/react/*` — that is the entire reason the wrapper exists.
- **Icons:** `<HugeiconsIcon icon={X} className="size-4" />`. One family, no
  second icon package.

### Motion and theme

Wrap the app once in `<MotionConfig reducedMotion="user">` and every animation in
the tree degrades correctly without a per-component check.

Theme is a `.dark` class on `<html>`, applied by a **module-constant inline
script rendered as the first `<body>` node**, before hydration. Nothing else
prevents the light-mode flash on a dark-theme load. Put `suppressHydrationWarning`
on `<html>` only — scoped to the one element whose class legitimately differs
from the SSR output.

### Picking a semantic color

Choosing one shade out of a color scale for `--primary` / `--destructive` is not
an eyeball decision. Convert to OKLCH and check WCAG contrast against **both**
the page background and the token's paired foreground, computing light and dark
separately. A scale's "500" is rarely the accessible pick in either mode.

---

## 6 · State and data

**There is no client data-fetching library — no react-query, no SWR.** Server
data enters through route loaders and `createServerFn`; Zustand holds only UI
state that outlives a component (open panels, selections, tab strips). Refresh is
`router.invalidate()`.

That split is worth stating explicitly, because the default instinct is to reach
for react-query — and the moment you do you have two caches with two invalidation
stories over the same data.

The signal that would actually justify adding one: many independent widgets
needing the same server data with their own keys, subscriptions and optimistic
updates. Not "it's a React app, so of course."

Zod validates at the boundary and nowhere else — one `.validator()` per server
function, so the parsed type flows outward and no handler re-checks its input.

---

## 7 · Conventions that must travel with the stack

A stack that is only a dependency list decays into the same folder argument in
every new repo. Copy these alongside the `package.json`:

| Document | What it decides |
| --- | --- |
| [`frontend-app-layout.md`](./frontend-app-layout.md) | Where a file goes — `components/` splits by importer count, `lib/` is isomorphic, dependencies point one way |
| `scripts/audit-layout.mjs` | The above, made checkable, printing its accepted exceptions on every run |
| A design-system doc set | Tokens, primitives, the corner language, status/priority/tag color mappings |

The short version of the layout law, since it is the part most often reinvented:

```
routes → components → hooks → stores → server → content → lib
```

`components/` has exactly three children — `ui/` (registry, exempt),
`shared/<domain>/` (2+ importers), `features/<feature>/` (exactly 1). The
importer count *is* the rule: a second importer promotes a file, and that move is
how the rest of the team finds out it became API.

---

## 8 · Bootstrapping a new project

```sh
bun init                                    # workspaces: ["apps/*", "packages/*"]
bun add -D @biomejs/biome typescript        # root only — these run across the tree
```

In the app package:

```sh
bun add react react-dom @tanstack/react-router @tanstack/react-start zod zustand motion
bun add -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/node @types/react @types/react-dom
bunx shadcn@latest init                     # then edit components.json aliases to #/
bun add @hugeicons/react @hugeicons/core-free-icons
bun add @fontsource-variable/geist @fontsource-variable/geist-mono
```

Then, in this order — each step prevents rework in the next:

1. **`imports` in `package.json` and `paths` in `tsconfig.json`** (§2). Do this
   before the first source file, or you will rewrite every import once.
2. **`src/styles/app.css` with an explicit `@source`** (§5).
3. **Copy `frontend-app-layout.md` and the audit script**, and wire the audit
   into the lint script — before there are enough files for the layout to be
   worth arguing about.
4. **`bun run lint` → zero**, and keep it there (§3).

---

## 9 · Traps this stack has already paid for

Each of these was a real failure, and each is invisible to `tsc`.

**1 · Tailwind only emits classes it can literally see.** `` `bg-${color}-500` ``
produces nothing at all. Map to full literal class strings in an array or record.

**2 · A green `tsc` does not prove a file move worked.** The failures that bite
live in config **strings** — a route directory, a bundler entry, a `files` glob.
After moving a file, grep for its path as a *string*, not just as an import
specifier, and let the **build** be the gate.

**3 · A relative specifier can survive a move by pointing somewhere else.**
Moving `x/index.tsx` one level deeper turns `./route` into a *different real
file*. It resolves, it compiles, it is wrong. Re-read every `./` specifier in a
file you just deepened.

**4 · A registry-installed component can drag in a dependency you do not use.**
The shadcn `sonner` wrapper ships with `import { useTheme } from "next-themes"`.
If the app has its own theme system and never mounts `ThemeProvider`, that hook
silently returns its default — toasts then follow the OS instead of the user's
in-app choice, while `next-themes` sits in the dependency list looking
load-bearing. Audit what the CLI installs: either adopt the dependency or replace
the import in the wrapper.

**5 · `<SelectValue>` renders the raw value.** Map it to a label
(`{(v) => OPTIONS.find(o => o.value === v)?.label ?? v}`) or the UI shows an id.

**6 · Load heavy, rarely-used packages with a dynamic `import()`.** A QR
generator, a PDF renderer, an export routine — all static-import-shaped, all
landing in the initial bundle for a feature most sessions never open.

**7 · A UMD dependency plus a global AMD `define` is a bundle fire.** Some
libraries ship a UMD factory that branches on `define.amd`; if anything in the
page assigns a global `define` — a CDN-loaded AMD loader, a `<script>` shim —
those factories stop setting `module.exports` and their importers receive
`{default: {}}`. The symptom is `X.default is not a constructor` on a page that
has nothing to do with whatever injected the loader, and only after navigating
*from* the page that did. Never inject an AMD loader into an ESM bundle.

---

## 10 · What this standard deliberately does not pick

Named so their absence reads as *undecided*, not as *decided against*:

- **Testing.** No unit, component or e2e framework. The gates in §3 are
  type-level and structural only.
- **CI.** The gates exist as local commands; wiring them to a provider is
  per-repo.
- **Error tracking, analytics, i18n.** Nothing installed, no shape assumed.
- **A client data-fetching library.** Deliberately absent — §6 states the signal
  that would justify adding one.
- **Code editing, syntax highlighting and diff views.** Advanced features, picked
  per project. Each pulls in a large, opinionated dependency (an editor core, a
  tokenizer with its own grammar and theme loading, a diff algorithm plus its
  renderer) with real bundle and lazy-loading consequences — none of which a baseline
  stack should decide on behalf of an app that may never show a line of code.

Adding any of these is a normal decision, not a deviation from the standard.
