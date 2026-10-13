// Local development against the self-hosted Convex backend named in .env.local
// (CONVEX_SELF_HOSTED_URL + CONVEX_SELF_HOSTED_ADMIN_KEY; the parent's Docker stack on 3410/3411).
// Runs `convex dev` (push on change) and the Vite dev server on 127.0.0.1:3417.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const fileEnv = Object.fromEntries(
  readFileSync(path.join(root, ".env.local"), "utf8")
    .split("\n")
    .filter((line) => /^[A-Z_][A-Z0-9_]*=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
const env = { ...fileEnv, ...process.env };
const webPort = env.SPRINTBOARD_WEB_PORT ?? "3417";
if (!env.CONVEX_SELF_HOSTED_URL || !env.CONVEX_URL || !env.CONVEX_SITE_URL) {
  console.error("Set CONVEX_SELF_HOSTED_URL, CONVEX_SELF_HOSTED_ADMIN_KEY, CONVEX_URL and CONVEX_SITE_URL in .env.local.");
  process.exit(1);
}

const children = [
  spawn("npx", ["convex", "dev", "--typecheck=disable", "--tail-logs", "disable"], { cwd: root, stdio: "inherit", env }),
  spawn("npx", ["vite", "dev", "--host", "127.0.0.1", "--port", webPort, "--strictPort"], {
    cwd: root,
    stdio: "inherit",
    env: { ...env, APP_ENVIRONMENT: env.APP_ENVIRONMENT ?? "local", APP_RELEASE: env.APP_RELEASE ?? "local-dev" },
  }),
];
console.log(`SprintBoard: http://localhost:${webPort}  (Convex SITE_URL must match; see docs/runtime-config.md)`);

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
for (const child of children) child.on("exit", shutdown);
