import { randomBytes } from "node:crypto";
import type { TargetEnv } from "./env";

export type TestAccount = { email: string; password: string; name: string };

/**
 * Every synthetic account of one run shares the prefix `qa-<TEST_RUN_ID>-`, so the operator can
 * remove the run afterwards with `pnpm test:cleanup --prefix qa-<TEST_RUN_ID>`.
 */
export const RUN_ID = (process.env.TEST_RUN_ID || `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "")
  .slice(0, 32);
export const RUN_PREFIX = `qa-${RUN_ID}-`;
let counter = 0;
const processTag = randomBytes(2).toString("hex");

/** Unique synthetic identity on the reserved example.test domain; never a real mailbox. */
export function newAccount(label: string): TestAccount {
  counter += 1;
  const slug = `${RUN_ID}-${label}-${processTag}${counter}`.toLowerCase();
  return {
    email: `qa-${slug}@example.test`,
    password: `Qa-${randomBytes(9).toString("base64url")}`,
    name: `QA ${label} ${counter}`,
  };
}

function headers(env: TargetEnv, extra: Record<string, string> = {}): Record<string, string> {
  return { "content-type": "application/json", origin: env.siteUrl, ...extra };
}

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export async function signUp(env: TargetEnv, account: TestAccount): Promise<void> {
  const response = await fetch(`${env.convexSiteUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify(account),
  });
  if (!response.ok) throw new Error(`sign-up failed: HTTP ${response.status} ${await response.text()}`);
}

export type OutboxKind = "verify_email" | "reset_password";

/** Polls the staging test mailbox for the newest link of one kind. */
export async function latestEmailLink(
  env: TargetEnv,
  email: string,
  kind: OutboxKind,
  options: { after?: number; timeoutMs?: number } = {},
): Promise<string> {
  const deadline = Date.now() + (options.timeoutMs ?? 15_000);
  let last = "";
  while (Date.now() < deadline) {
    const response = await fetch(
      `${env.convexSiteUrl}/test/outbox?email=${encodeURIComponent(email)}&kind=${kind}`,
      { headers: { authorization: `Bearer ${env.outboxToken}` } },
    );
    if (response.ok) {
      const message = (await response.json()) as { url: string; createdAt: number };
      if (options.after === undefined || message.createdAt > options.after) return message.url;
      last = "only older messages";
    } else {
      last = `HTTP ${response.status}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`no ${kind} email for ${email} (${last})`);
}

/** Email links point at SITE_URL/api/auth/...; the same path is served by the Convex site. */
export function toBackendAuthUrl(env: TargetEnv, link: string): string {
  const url = new URL(link);
  return `${env.convexSiteUrl}${url.pathname}${url.search}`;
}

export async function verifyEmail(env: TargetEnv, email: string): Promise<void> {
  const link = await latestEmailLink(env, email, "verify_email");
  const response = await fetch(toBackendAuthUrl(env, link), { headers: { origin: env.siteUrl }, redirect: "manual" });
  if (response.status >= 400) throw new Error(`verification failed: HTTP ${response.status}`);
}

export type Session = { cookie: string; token: string };

export async function signIn(env: TargetEnv, account: TestAccount): Promise<Session> {
  const response = await fetch(`${env.convexSiteUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (!response.ok) throw new Error(`sign-in failed: HTTP ${response.status} ${await response.text()}`);
  const cookie = cookieHeader(response);
  const tokenResponse = await fetch(`${env.convexSiteUrl}/api/auth/convex/token`, {
    headers: { cookie, origin: env.siteUrl },
  });
  const body = (await tokenResponse.json()) as { token?: string };
  if (!body.token) throw new Error("no Convex token issued after sign-in");
  return { cookie, token: body.token };
}

/** Registers, verifies through the test mailbox and signs in a fresh synthetic account. */
export async function createVerifiedSession(env: TargetEnv, label: string): Promise<TestAccount & Session> {
  const account = newAccount(label);
  await signUp(env, account);
  await verifyEmail(env, account.email);
  return { ...account, ...(await signIn(env, account)) };
}
