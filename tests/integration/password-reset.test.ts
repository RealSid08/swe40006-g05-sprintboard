import { describe, expect, it } from "vitest";
import { createVerifiedSession, latestEmailLink, signIn } from "../support/accounts";
import { readTargetEnv } from "../support/env";

const env = readTargetEnv();

describe("password reset through the test mailbox", () => {
  it("issues a reset link, accepts the new password and rejects the old one", async () => {
    const account = await createVerifiedSession(env, "reset");
    const requestedAt = Date.now() - 1000;
    const request = await fetch(`${env.convexSiteUrl}/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.siteUrl },
      body: JSON.stringify({ email: account.email, redirectTo: `${env.siteUrl}/reset-password` }),
    });
    expect(request.ok).toBe(true);

    const link = await latestEmailLink(env, account.email, "reset_password", { after: requestedAt });
    const token = new URL(link).pathname.split("/").pop();
    expect(token).toBeTruthy();

    const newPassword = `${account.password}-new`;
    const reset = await fetch(`${env.convexSiteUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.siteUrl },
      body: JSON.stringify({ token, newPassword }),
    });
    expect(reset.ok).toBe(true);

    await expect(signIn(env, account)).rejects.toThrow(/HTTP 401/);
    await expect(signIn(env, { ...account, password: newPassword })).resolves.toMatchObject({ token: expect.any(String) });
  });
});
