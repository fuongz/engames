#!/usr/bin/env node
// `bun run ui:add <component...>` — shadcn add for apps/web, then repair the one
// thing the CLI gets wrong with our `#/` alias: it writes `import { cn } from "cn"`
// (and installs the unrelated npm package `cn`) instead of `#/lib/utils`.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const app = new URL("../apps/web/", import.meta.url).pathname;
const names = process.argv.slice(2);
if (!names.length) {
  console.error("usage: bun run ui:add <component...>");
  process.exit(1);
}
// The CLI prompts before overwriting a dependency that already exists (e.g.
// button.tsx) and aborts without a TTY. So: snapshot ui/, add with --overwrite
// (no prompts), then restore every file that existed before. Only new files land.
const ui = join(app, "src/components/ui");
const before = new Map(readdirSync(ui).map((f) => [f, readFileSync(join(ui, f), "utf8")]));
execFileSync("bunx", ["shadcn@latest", "add", "--yes", "--overwrite", ...names], { cwd: app, stdio: "inherit" });
for (const [file, src] of before) writeFileSync(join(ui, file), src);

for (const file of readdirSync(ui)) {
  const path = join(ui, file);
  const src = readFileSync(path, "utf8");
  const fixed = src.replace(/from "cn"/g, 'from "#/lib/utils"');
  if (fixed !== src) writeFileSync(path, fixed);
}
const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
if (pkg.dependencies?.cn) execFileSync("bun", ["remove", "cn"], { cwd: app, stdio: "inherit" });
