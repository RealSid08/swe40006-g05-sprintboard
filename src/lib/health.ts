import { readServerConfig } from "./runtime-config";

const noStore = { "Cache-Control": "no-store" };

/** Web liveness: the server process is up and its runtime configuration parses. */
export function liveness(env: Record<string, string | undefined>): Response {
  const config = readServerConfig(env);
  return Response.json(
    { ok: true, service: "web", environment: config.environment, release: config.release },
    { headers: noStore },
  );
}

/**
 * Readiness: the web server reaches the Convex backend and the backend answers a real
 * database read (or a write-then-read proof when the operator token is forwarded).
 * Reports both release identifiers for traceability.
 */
export async function readiness(
  env: Record<string, string | undefined>,
  request?: Request,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  // Forward the operator token (if any) so the backend can run its write-then-read proof.
  const operatorToken = request?.headers.get("x-readiness-token");
  const config = readServerConfig(env);
  const web = { environment: config.environment, release: config.release };
  let backend: unknown = { ok: false, error: "CONVEX_SITE_URL is not set" };
  let ok = false;
  if (env.CONVEX_SITE_URL) {
    try {
      const response = await fetchImpl(`${env.CONVEX_SITE_URL}/health/ready`, {
        signal: AbortSignal.timeout(5000),
        headers: operatorToken ? { "x-readiness-token": operatorToken } : {},
      });
      backend = await response.json();
      ok = response.ok;
    } catch {
      backend = { ok: false, error: "backend unreachable" };
    }
  }
  return Response.json({ ok, web, backend }, { status: ok ? 200 : 503, headers: noStore });
}
