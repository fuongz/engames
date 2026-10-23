import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` ONLY — it turns the schema into SQL under ./drizzle and
// stops there. Applying is wrangler's job (`bun run db:migrate:local|remote`),
// because D1 tracks which migrations have run in its own table.
//
// That is why there are no credentials here: `generate` never connects to a
// database. Adding `driver: "d1-http"` plus tokens is only for `drizzle-kit
// studio`/`push` against a remote D1 — and `push` is the wrong tool for a database
// that has migration history, since it diffs live schema and skips the ledger.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
});
