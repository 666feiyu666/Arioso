import { defineConfig } from "vitest/config";

// Automatic generation retries wait between dispatches in production. The suite
// runs them back to back so a test observes the retry instead of the backoff.
export default defineConfig({
  test: {
    env: {
      ARIOSO_GENERATION_RETRY_DELAYS_MS: "0,0",
    },
    // Server tests wait on background generations that now spend up to three
    // dispatches on a candidate, so the default five seconds is too tight when
    // files run in parallel.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
