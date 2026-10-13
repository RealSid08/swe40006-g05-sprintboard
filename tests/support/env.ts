/**
 * Target environment for the integration and acceptance suites. Nothing here defaults to a
 * local fixture: the suites run against whichever deployed app and backend these variables
 * name (the staging runtime .env on the Test Server, or a local stack for development).
 *
 *   SITE_URL          public web origin (E2E_BASE_URL accepted as an override; BASE_URL is ignored
 *                     because Vite/Vitest set it to "/")
 *   CONVEX_URL        public Convex client URL (api.<domain>)
 *   CONVEX_SITE_URL   Convex HTTP actions URL (auth.<domain>)
 *   TEST_OUTBOX_TOKEN staging-only token for the test mailbox (verification and reset links)
 *   READINESS_TOKEN   optional; enables the operator write-then-read readiness check
 */
export type TargetEnv = {
  siteUrl: string;
  convexUrl: string;
  convexSiteUrl: string;
  outboxToken: string;
  readinessToken: string | undefined;
};

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function readTargetEnv(env: Record<string, string | undefined> = process.env): TargetEnv {
  const siteUrl = env.E2E_BASE_URL || env.SITE_URL;
  const missing = [
    !siteUrl && "SITE_URL",
    !env.CONVEX_URL && "CONVEX_URL",
    !env.CONVEX_SITE_URL && "CONVEX_SITE_URL",
    !env.TEST_OUTBOX_TOKEN && "TEST_OUTBOX_TOKEN",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Integration/acceptance suites need ${missing.join(", ")} for the target deployment (see docs/testing.md).`,
    );
  }
  for (const [name, value] of [["SITE_URL", siteUrl], ["CONVEX_URL", env.CONVEX_URL], ["CONVEX_SITE_URL", env.CONVEX_SITE_URL]]) {
    if (!/^https?:\/\//.test(value ?? "")) throw new Error(`${name} must be an absolute http(s) URL.`);
  }
  return {
    siteUrl: trimSlash(siteUrl!),
    convexUrl: trimSlash(env.CONVEX_URL!),
    convexSiteUrl: trimSlash(env.CONVEX_SITE_URL!),
    outboxToken: env.TEST_OUTBOX_TOKEN!,
    readinessToken: env.READINESS_TOKEN || undefined,
  };
}
