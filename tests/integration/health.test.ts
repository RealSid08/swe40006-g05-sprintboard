import { describe, expect, it } from "vitest";
import { readTargetEnv } from "../support/env";

const env = readTargetEnv();

describe("deployed health endpoints", () => {
  it("web liveness reports the environment and release", async () => {
    const response = await fetch(`${env.siteUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, service: "web" });
    expect(typeof body.release).toBe("string");
  });

  it("public readiness proves a database read without writing", async () => {
    const response = await fetch(`${env.siteUrl}/api/ready`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; backend: { ok: boolean; mode: string } };
    expect(body.ok).toBe(true);
    expect(body.backend).toMatchObject({ ok: true, mode: "read" });
  });

  it("an invalid readiness token does not unlock the write probe", async () => {
    const response = await fetch(`${env.convexSiteUrl}/health/ready`, {
      headers: { "x-readiness-token": "not-the-operator-token" },
    });
    expect(((await response.json()) as { mode: string }).mode).toBe("read");
  });

  it.runIf(env.readinessToken !== undefined)("operator readiness performs a write-then-read proof", async () => {
    const response = await fetch(`${env.siteUrl}/api/ready`, {
      headers: { "x-readiness-token": env.readinessToken! },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { backend: { mode: string; probeCount: number } };
    expect(body.backend.mode).toBe("write-read");
    expect(body.backend.probeCount).toBeGreaterThan(0);
  });

  it("the test mailbox rejects requests without the staging token", async () => {
    const response = await fetch(`${env.convexSiteUrl}/test/outbox?email=a@example.test&kind=verify_email`);
    expect(response.status).toBe(401);
  });

  it("backend liveness is reachable on the auth domain", async () => {
    const response = await fetch(`${env.convexSiteUrl}/health/live`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });
});
