# Instructions for AI agents

Guidelines for how AI agents (Claude Code, Codex, Cursor, …) work on **web-games**.
Follow them for code-related tasks while respecting the user's latest explicit
instructions.

**Conflict order:** the user's latest explicit request wins, then the most specific
local repository instruction, then these general rules.

---

## The two documents that decide most questions

| Question | Read |
| --- | --- |
| What may I install? How is it configured? | [`docs/standards/tech-stack.md`](docs/standards/tech-stack.md) |
| Where does this file go? | [`docs/standards/frontend-app-layout.md`](docs/standards/frontend-app-layout.md) |
| How is a game built? | [`docs/standards/game-engine.md`](docs/standards/game-engine.md) |

Four things you will get wrong without them, so they are worth stating up front:

1. **`#/*`, never `@/*`**, and it is declared in exactly two places per app —
   `package.json` `imports` **and** `tsconfig.json` `paths`. Not in the vite config.
2. **`src/lib/` is isomorphic.** Anything importing `node:*`, a platform builtin, an
   ORM or an auth SDK belongs in `src/server/`.
3. **Nothing imports from `src/routes/*`**, and a `server/<domain>.ts` boundary file
   exports only server functions and types.
4. **`bun run lint` is ZERO.** If it isn't, that is the first thing to fix.

---

## Code organization

**A file's folder states what it is, and each folder answers ONE question:**

| Folder | The question it answers | The rule |
| --- | --- | --- |
| `routes/` | what URL is this? | exports exactly `Route` — and nothing imports it |
| `components/` | how widely is it used? | see the three buckets below |
| `hooks/` | do its consumers cross domains? | 2+ areas, or route-only; otherwise colocate |
| `stores/` | what UI state outlives a component? | Zustand only |
| `server/<domain>.ts` | what can the client call? | server functions and types — **nothing else runtime** |
| `content/` | what static data ships? | plain catalogs |
| `lib/` | is it pure and isomorphic? | no React, no server builtins, no upward imports |

Kebab-case throughout, and a filename never repeats its folder unless the prefix
distinguishes among siblings.

**Dependencies point one way**, and `import type` is exempt at every step:

```
routes → components → hooks → stores → server → content → lib
```

**`components/` states how widely a component is used.** Exactly three children:

```
components/
├── ui/                     # registry CLI territory — EXEMPT from the rule
├── shared/<domain>/        # imported by 2+ modules
└── features/<feature>/     # imported by exactly 1 module
```

The importer count is the whole rule. A second importer **promotes** a file to
`shared/` — the move is how everyone else finds out it became API.

---

## Components: the registry first, always

**Every component comes from the shadcn registry unless the registry has nothing
that fits.** Check before you write. Hand-rolling a primitive that `shadcn add`
would have given you means owning its a11y, keyboard handling, focus trap, RTL
behaviour and token wiring forever — a cost that is invisible on the day you write
it and permanent afterwards.

```sh
cd apps/web
bunx shadcn@latest add <name>       # ALWAYS look here first
```

In order:

1. **In the registry?** `shadcn add` it. Do not write it.
2. **Close but not right?** **Compose, don't fork** — wrap the primitive in
   `shared/` or `features/` and pass the difference in as props. A wrapper survives
   the next `shadcn add`; a fork is silently overwritten by it.
3. **Genuinely not there?** Hand-build it, and place it by importer count.

Three rules the layout gate enforces, so they are not up for debate:

- **A hand-written component NEVER goes in `components/ui/`.** That folder is CLI
  territory — the next `shadcn add <name>` overwrites whatever sits at that path.
- **Feature code never imports `@base-ui/react` directly.** Only a `ui/` wrapper
  wraps the primitive, so styling and behaviour live in one place.
- **A `ui/` file may not import app code.** Regeneration erases that edge silently.

Editing a registry file anyway: comment it in-file **and** put any lint exception in
the **root** `biome.jsonc`, which regeneration cannot wipe.

⚠️ No linter, `tsc` run or bundler sees any of this — a misplaced file compiles and
ships perfectly. One script is the only gate:

```sh
node scripts/audit-layout.mjs   # 0 = layout is correct
```

---

## This repo: Engames

- **Two workspaces.** `apps/web` is the portal (React, shadcn, SPA mode).
  `packages/games` holds the games as framework-free canvas TypeScript. The
  layout gate audits `apps/web/src` only.
- **Games never import React or portal code.** The portal talks to a game only
  through `GameModule.mount(root, ctx)` from `@web-games/games`.
- **A new game is a new folder** under `packages/games/src/<slug>/` (see README).
  The registry discovers it, so the portal needs no edits.
- **Games are built on the engine in `packages/games/src/core/`** — read
  [`docs/standards/game-engine.md`](docs/standards/game-engine.md) first.
  `index.ts` is one `defineGame(...)` call; never add `window`/`document` listeners
  or a `Loop` in a game; `logic.ts` stays pure (imports only `../core/math`).
- **Add shadcn components with `bun run ui:add <name>`**, not a bare `shadcn add`:
  the CLI writes `import { cn } from "cn"` under our `#/` alias and the script repairs it.
- **Server code** lives in `apps/web/src/server/`: `leaderboard.ts` is the
  boundary (server functions + types only), `db/` and `auth/` are server-only
  (enforced by `layout.audit.json`). Query functions take `db` as a parameter so
  `bun test` can run them on bun:sqlite with the real migrations.
- **Games report finished runs** with `ctx.reportScore({ score, detail })` — once
  per run end, never on quit. The portal owns the save/leaderboard UI.
- **Two languages, everywhere.** Portal copy goes in `content/messages/{vi,en}.ts`
  and is read with `useMessages()`; never a literal user-facing string in a
  component. Games keep a `strings.ts` `Localized` catalog and read
  `currentLocale(ctx)` at draw time. The language is saved per account
  (`user.locale`) for signed-in players.
- **Mobile first.** Check every UI change at 390×844; the player is full-screen
  below `lg` and must respect `env(safe-area-inset-*)`.

---

## Verification before done

Never mark a task complete without proving it works. From the repo root:

```sh
bun run gate     # lint (incl. layout audit) → typecheck → build
```

- For a **structural** change the build is the gate, not the typecheck.
- If verification can't run, explain why and state the remaining risk.
- Say plainly what remains **visually unverified**.
- End every completed task with a **"What's next for you"** handoff.

## Working rules

1. Decide whether the request is **read-only** or **requires edits**. If read-only,
   don't create/edit/delete files unless explicitly authorized.
2. For any UI work, reuse the documented tokens and components — never a literal
   hex/oklch in a component, never a dynamically-built Tailwind class name.
3. Inspect only the files relevant to the task; make the smallest correct change
   that fits the existing style.
4. Report changed files, verification result, and remaining risk.
