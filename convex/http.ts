import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function releaseInfo() {
  return {
    environment: env.APP_ENVIRONMENT ?? "local",
    release: env.APP_RELEASE ?? "unreleased",
  };
}

http.route({
  path: "/health/live",
  method: "GET",
  handler: httpAction(async () => json({ ok: true, ...releaseInfo() })),
});

/**
 * Readiness. Public callers get a read-only check (a real database query). A caller that
 * presents the operator READINESS_TOKEN as `x-readiness-token` also gets a write-then-read
 * proof against a single bounded probe row.
 */
http.route({
  path: "/health/ready",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const started = Date.now();
    const token = env.READINESS_TOKEN;
    const supplied = request.headers.get("x-readiness-token");
    const writeProof = supplied !== null && token !== undefined && token.length >= 16 && constantTimeEqual(supplied, token);
    try {
      if (writeProof) {
        const written = await ctx.runMutation(internal.health.touch, {});
        const row = await ctx.runQuery(internal.health.read, {});
        const ok = row !== null && row.count >= written;
        return json(
          { ok, mode: "write-read", ...releaseInfo(), probeCount: row?.count ?? null, latencyMs: Date.now() - started },
          ok ? 200 : 503,
        );
      }
      const row = await ctx.runQuery(internal.health.read, {});
      return json({
        ok: true,
        mode: "read",
        ...releaseInfo(),
        lastWriteProofAt: row?.checkedAt ?? null,
        latencyMs: Date.now() - started,
      });
    } catch {
      return json({ ok: false, ...releaseInfo(), error: "backend check failed" }, 503);
    }
  }),
});

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Test-only mailbox for automated suites. Disabled unless EMAIL_TRANSPORT=outbox and a
 * TEST_OUTBOX_TOKEN is configured, and never available in production.
 */
http.route({
  path: "/test/outbox",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const token = env.TEST_OUTBOX_TOKEN;
    const enabled =
      (env.EMAIL_TRANSPORT ?? "outbox") === "outbox" &&
      env.APP_ENVIRONMENT !== "production" &&
      token !== undefined &&
      token.length >= 16;
    if (!enabled) return json({ error: "not found" }, 404);
    const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!constantTimeEqual(supplied, token)) return json({ error: "unauthorized" }, 401);

    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    const kind = url.searchParams.get("kind");
    if (!email || (kind !== "verify_email" && kind !== "reset_password")) {
      return json({ error: "email and kind (verify_email|reset_password) are required" }, 400);
    }
    const message = await ctx.runQuery(internal.email.latestOutboxMessage, { to: email, kind });
    return message === null ? json({ error: "no message" }, 404) : json(message);
  }),
});

export default http;
