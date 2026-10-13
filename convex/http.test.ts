import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { setup } from "./test.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
});

const TOKEN = "outbox-token-1234567890";

describe("operational HTTP routes", () => {
  test("liveness reports environment and release", async () => {
    vi.stubEnv("APP_ENVIRONMENT", "staging");
    vi.stubEnv("APP_RELEASE", "abc1234");
    const t = setup();
    const response = await t.fetch("/health/live");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, environment: "staging", release: "abc1234" });
  });

  test("public readiness is read-only and never writes", async () => {
    const t = setup();
    const response = await t.fetch("/health/ready");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, mode: "read", lastWriteProofAt: null });
    vi.stubEnv("READINESS_TOKEN", "readiness-token-1234567890");
    const wrong = await t.fetch("/health/ready", { headers: { "x-readiness-token": "wrong-token-123456789012" } });
    expect(await wrong.json()).toMatchObject({ mode: "read" });
    expect(await t.query(internal.health.read, {})).toBeNull();
  });

  test("operator token enables a bounded write-then-read proof", async () => {
    const token = "readiness-token-1234567890";
    const t = setup();
    const headers = { "x-readiness-token": token };
    expect(await (await t.fetch("/health/ready", { headers })).json()).toMatchObject({ mode: "read" });
    vi.stubEnv("READINESS_TOKEN", token);
    const first = await t.fetch("/health/ready", { headers });
    const second = await t.fetch("/health/ready", { headers });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, mode: "write-read", probeCount: 1, release: "unreleased" });
    expect(await second.json()).toMatchObject({ ok: true, mode: "write-read", probeCount: 2 });
    const publicView = await (await t.fetch("/health/ready")).json();
    expect(publicView.lastWriteProofAt).toEqual(expect.any(Number));
    expect(await t.run(async (ctx) => (await ctx.db.query("healthProbes").collect()).length)).toBe(1);
  });

  test("test outbox is hidden unless explicitly enabled", async () => {
    const t = setup();
    expect((await t.fetch("/test/outbox?email=a@b.test&kind=verify_email")).status).toBe(404);
    vi.stubEnv("TEST_OUTBOX_TOKEN", TOKEN);
    vi.stubEnv("APP_ENVIRONMENT", "production");
    expect(
      (await t.fetch("/test/outbox?email=a@b.test&kind=verify_email", { headers: { Authorization: `Bearer ${TOKEN}` } }))
        .status,
    ).toBe(404);
  });

  test("test outbox requires the bearer token and returns the latest link", async () => {
    vi.stubEnv("TEST_OUTBOX_TOKEN", TOKEN);
    vi.stubEnv("APP_ENVIRONMENT", "test");
    const t = setup();
    const auth = { headers: { Authorization: `Bearer ${TOKEN}` } };
    expect((await t.fetch("/test/outbox?email=a@b.test&kind=verify_email")).status).toBe(401);
    expect(
      (await t.fetch("/test/outbox?email=a@b.test&kind=verify_email", { headers: { Authorization: "Bearer wrong-token-000000000" } }))
        .status,
    ).toBe(401);
    expect((await t.fetch("/test/outbox?email=a@b.test&kind=other", auth)).status).toBe(400);
    expect((await t.fetch("/test/outbox?email=a@b.test&kind=verify_email", auth)).status).toBe(404);
    await t.mutation(internal.email.queue, { to: "a@b.test", kind: "verify_email", url: "https://x.test/v" });
    const response = await t.fetch("/test/outbox?email=A@B.test&kind=verify_email", auth);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ url: "https://x.test/v" });
  });
});
