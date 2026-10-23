import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// SERVER-ONLY. This module reads a Worker binding, so it must never enter the
// client bundle: reach it from `server/` code, from a `routes/api/` handler, or by
// `import type` — never from a component. The layout gate enforces exactly that
// (`server/db/` is in `serverOnly`).
//
// Bindings come from `cloudflare:workers`, never `process.env`. There is no
// `process` in a Worker, and the shim some setups add returns `undefined` for every
// key — which reads as "not configured yet" rather than as the bug it is.

/**
 * The Drizzle client, built per request.
 *
 * NOT a module-level singleton: `env` is only populated inside a request context,
 * so constructing this at import time captures an empty binding and every query
 * fails with a null database. Cheap to call — it wraps an existing binding.
 */
export function getDb() {
  return drizzle(env.DB, { schema });
}

export { schema };
