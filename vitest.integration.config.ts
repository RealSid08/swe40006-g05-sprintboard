import path from "node:path";
import { defineConfig } from "vitest/config";

/** Real-backend integration suite. Targets the deployment named by SITE_URL / CONVEX_URL / CONVEX_SITE_URL. */
export default defineConfig({
  resolve: { alias: { "~": path.resolve(import.meta.dirname, "src") } },
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    reporters: ["default", "junit"],
    outputFile: { junit: "test-results/integration-junit.xml" },
  },
});
