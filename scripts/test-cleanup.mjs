#!/usr/bin/env node
// Operator-only: remove one acceptance-test run's synthetic data from a NON-production deployment.
// Requires CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY (environment or .env.local).
//
//   node scripts/test-cleanup.mjs --prefix qa-<TEST_RUN_ID>
//
// The backend refuses when APP_ENVIRONMENT=production and only matches qa-*@example.test,
// so seeded demo accounts are never touched.
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { prefix: { type: "string" } } });
const prefix = values.prefix?.trim().toLowerCase();
if (!prefix || !/^qa-[a-z0-9-]*$/.test(prefix)) {
  console.error("Usage: test-cleanup --prefix qa-<run id>   (qa- alone removes every synthetic QA account)");
  process.exit(2);
}
const out = execFileSync("npx", ["convex", "run", "testData:purgeRun", JSON.stringify({ prefix })], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
console.log(JSON.stringify({ prefix, removed: JSON.parse(out.trim() || "null") }));
