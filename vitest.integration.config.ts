import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Integration vitest config — runs scenarios against real OpenRouter.
 * Use:
 *   pnpm test:agent
 *
 * The setup file loads .env.local before tests start so OPENROUTER_API_KEY
 * is available. Each scenario takes ~3-10s (real LLM call); the suite of
 * ~10 scenarios runs in ~1 minute. Cost ≈ $0.01 per full run.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/integration/**/*.test.ts"],
    setupFiles: ["src/__tests__/integration/setup.ts"],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(
        __dirname,
        "src/__tests__/__mocks__/server-only.ts",
      ),
    },
  },
});
