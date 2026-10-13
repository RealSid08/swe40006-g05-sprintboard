import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { renderAuthEmail } from "./model/emailContent";
import { setup } from "./test.helpers";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const message = { to: "User@Example.test", kind: "verify_email" as const, url: "https://app.test/v?token=a&b=<c>" };

describe("auth email", () => {
  test("renders escaped HTML and a plain-text alternative", () => {
    const email = renderAuthEmail("reset_password", message.url);
    expect(email.subject).toBe("Reset your SprintBoard password");
    expect(email.text).toContain(message.url);
    expect(email.html).toContain("https://app.test/v?token=a&amp;b=&lt;c&gt;");
    expect(email.html).not.toContain("<c>");
  });

  test("outbox transport stores the message for automated tests", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "outbox");
    const t = setup();
    await t.mutation(internal.email.queue, message);
    await t.mutation(internal.email.queue, { ...message, kind: "reset_password", url: "https://app.test/r" });
    expect(
      await t.query(internal.email.latestOutboxMessage, { to: "user@example.test", kind: "verify_email" }),
    ).toMatchObject({ subject: "Verify your SprintBoard email", url: message.url });
    expect(
      await t.query(internal.email.latestOutboxMessage, { to: "user@example.test", kind: "reset_password" }),
    ).toMatchObject({ url: "https://app.test/r" });
    expect(
      await t.query(internal.email.latestOutboxMessage, { to: "other@example.test", kind: "verify_email" }),
    ).toBeNull();
  });

  test("disabled transport drops auth emails without storing or sending", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "disabled");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = setup();
    await t.mutation(internal.email.queue, message);
    await t.finishAllScheduledFunctions(() => {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await t.run(async (ctx) => ctx.db.query("emailOutbox").collect())).toEqual([]);
  });

  test("outbox transport is refused in production", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "outbox");
    vi.stubEnv("APP_ENVIRONMENT", "production");
    const t = setup();
    await expect(t.mutation(internal.email.queue, message)).rejects.toThrow(/not allowed in production/);
  });

  test("resend transport schedules delivery and posts to the Resend API", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("EMAIL_FROM", "SprintBoard <noreply@example.test>");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = setup();
    await t.mutation(internal.email.queue, message);
    await t.finishAllScheduledFunctions(() => {});
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toMatchObject({
      to: [message.to],
      subject: "Verify your SprintBoard email",
    });
    const stored = await t.run(async (ctx) => ctx.db.query("emailOutbox").collect());
    expect(stored).toEqual([]);
  });

  test("delivery fails loudly on misconfiguration or provider rejection", async () => {
    const t = setup();
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    await expect(t.action(internal.email.deliver, message)).rejects.toThrow(/EMAIL_FROM/);
    vi.stubEnv("EMAIL_FROM", "noreply@example.test");
    await expect(t.action(internal.email.deliver, message)).rejects.toThrow(/RESEND_API_KEY/);
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 422 })));
    await expect(t.action(internal.email.deliver, message)).rejects.toThrow(/HTTP 422/);
    vi.stubEnv("EMAIL_TRANSPORT", "ses");
    await expect(t.action(internal.email.deliver, message)).rejects.toThrow(/SES_REGION/);
    vi.stubEnv("EMAIL_TRANSPORT", "outbox");
    await expect(t.action(internal.email.deliver, message)).rejects.toThrow(/Unsupported/);
  });

  test("ses transport signs a SESv2 SendEmail request", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "ses");
    vi.stubEnv("EMAIL_FROM", "noreply@example.test");
    vi.stubEnv("SES_REGION", "ap-southeast-2");
    vi.stubEnv("SES_ACCESS_KEY_ID", "AKIDEXAMPLE");
    vi.stubEnv("SES_SECRET_ACCESS_KEY", "secret");
    const fetchMock = vi.fn(async (_input: Request | string) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = setup();
    await t.action(internal.email.deliver, message);
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    const signed = request as Request;
    expect(signed.url).toBe("https://email.ap-southeast-2.amazonaws.com/v2/email/outbound-emails");
    expect(signed.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    await expect(t.action(internal.email.deliver, message)).rejects.toThrow(/HTTP 403/);
  });
});
