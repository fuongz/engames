import { defineConfig } from "vitest/config";

// The balance tests simulate whole runs (bots, AI tournaments, physics); under the
// parallel `bun run test` they can pass 5 s, so give every test more room.
export default defineConfig({
  test: { testTimeout: 30_000 },
});
