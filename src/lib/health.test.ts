import { describe, expect, it, vi } from "vitest";
import { liveness, readiness } from "./health";

const env = { CONVEX_URL: "https://api.example.test", CONVEX_SITE_URL: "https://auth.example.test", APP_ENVIRONMENT: "staging", APP_RELEASE: "sha1" };

describe("health", () => {
  it("liveness reports environment and release without caching", async () => {
    const response = liveness(env);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, service: "web", environment: "staging", release: "sha1" });
  });

  it("readiness is ready only when the backend answers", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true, mode: "read" }));
    const response = await readiness(env, undefined, fetchImpl as unknown as typeof fetch);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      web: { environment: "staging", release: "sha1" },
      backend: { ok: true, mode: "read" },
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://auth.example.test/health/ready", expect.objectContaining({ headers: {} }));
  });

  it("forwards the operator readiness token", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true, mode: "write-read" }));
    const request = new Request("https://app.example.test/api/ready", { headers: { "x-readiness-token": "secret-token-123456" } });
    await readiness(env, request, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { "x-readiness-token": "secret-token-123456" } }),
    );
  });

  it("reports 503 when the backend fails, is unreachable or unconfigured", async () => {
    const failing = vi.fn(async () => Response.json({ ok: false }, { status: 503 }));
    expect((await readiness(env, undefined, failing as unknown as typeof fetch)).status).toBe(503);
    const throwing = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const unreachable = await readiness(env, undefined, throwing as unknown as typeof fetch);
    expect(unreachable.status).toBe(503);
    expect((await unreachable.json()).backend).toEqual({ ok: false, error: "backend unreachable" });
    const unconfigured = await readiness({ CONVEX_URL: env.CONVEX_URL });
    expect((await unconfigured.json()).backend.error).toMatch(/CONVEX_SITE_URL/);
  });
});
