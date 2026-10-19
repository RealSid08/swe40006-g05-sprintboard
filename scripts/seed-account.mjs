#!/usr/bin/env node
// Operator-only: create or repair a verified synthetic account on a self-hosted deployment.
// Requires CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY (environment or .env.local).
//
//   SEED_ACCOUNT_PASSWORD='...' node scripts/seed-account.mjs --email demo.owner@example.test --name "Demo Owner"
//   node scripts/seed-account.mjs --demo-project --owner demo.owner@example.test --member demo.member@example.test
//
// SEED_ACCOUNT_PASSWORD is required (12+ characters) and is never printed. It is passed to the
// Convex CLI as a process argument on the operator host only.
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    "demo-project": { type: "boolean", default: false },
    owner: { type: "string" },
    member: { type: "string", multiple: true, default: [] },
    "project-name": { type: "string" },
  },
});

function run(fn, args) {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out.trim() || "null");
}

if (values["demo-project"]) {
  if (!values.owner) throw new Error("--owner is required with --demo-project");
  const projectId = run("seed:demoProject", {
    ownerEmail: values.owner,
    memberEmails: values.member,
    ...(values["project-name"] ? { name: values["project-name"] } : {}),
  });
  console.log(JSON.stringify({ projectId }));
} else {
  if (!values.email || !values.name) throw new Error("--email and --name are required");
  const password = process.env.SEED_ACCOUNT_PASSWORD ?? "";
  if (password.length < 12) {
    console.error("Set SEED_ACCOUNT_PASSWORD (12+ characters) in the environment; it is never printed.");
    process.exit(2);
  }
  const result = run("seed:createVerifiedAccount", { email: values.email, name: values.name, password });
  console.log(JSON.stringify({ email: result.email, created: result.created }));
}
