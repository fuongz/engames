import { env } from "cloudflare:workers";

// SERVER-ONLY. The avatar bucket binding (wrangler.jsonc `r2_buckets`, AVATARS).
// Read per call for the same reason as getDb(): `env` is only populated inside a
// request. Kept apart from avatars.ts so that module stays importable by `bun test`.

export function getAvatarBucket(): R2Bucket {
  return env.AVATARS;
}
