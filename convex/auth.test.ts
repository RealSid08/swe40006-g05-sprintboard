import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { GenericCtx } from "@convex-dev/better-auth";
import { createAuthOptions } from "./auth";
import { setup } from "./test.helpers";

describe("auth user sync", () => {
  test("creating a Better Auth user creates the app profile used for identity", async () => {
    const t = setup();
    await t.mutation(internal.auth.onCreate, {
      model: "user",
      doc: { _id: "auth-1", email: "Sam@Example.TEST", name: "" },
    });
    const as = t.withIdentity({ subject: "auth-1" });
    expect(await as.query(api.auth.me, {})).toMatchObject({ email: "sam@example.test", name: "Sam" });
    expect(await t.query(api.auth.me, {})).toBeNull();
    expect(await t.withIdentity({ subject: "auth-unknown" }).query(api.auth.me, {})).toBeNull();
  });

  test("profile follows Better Auth user updates", async () => {
    const t = setup();
    await t.mutation(internal.auth.onCreate, {
      model: "user",
      doc: { _id: "auth-2", email: "a@example.test", name: "Ann" },
    });
    await t.mutation(internal.auth.onUpdate, {
      model: "user",
      oldDoc: { _id: "auth-2", email: "a@example.test", name: "Ann" },
      newDoc: { _id: "auth-2", email: "ann@example.test", name: "Ann Lee" },
    });
    await t.mutation(internal.auth.onUpdate, {
      model: "user",
      oldDoc: { _id: "missing", email: "x@example.test", name: "X" },
      newDoc: { _id: "missing", email: "x@example.test", name: "X" },
    });
    expect(await t.withIdentity({ subject: "auth-2" }).query(api.auth.me, {})).toMatchObject({
      email: "ann@example.test",
      name: "Ann Lee",
    });
  });
});

describe("auth options", () => {
  afterEach(() => vi.unstubAllEnvs());
  const options = () => createAuthOptions({} as GenericCtx<DataModel>);

  test("deployments that can send email require verification before sign-in", () => {
    for (const transport of ["outbox", "resend", "ses"]) {
      vi.stubEnv("EMAIL_TRANSPORT", transport);
      const { emailAndPassword, emailVerification } = options();
      expect(emailAndPassword.requireEmailVerification).toBe(true);
      expect(emailVerification).toMatchObject({ sendOnSignUp: true, sendOnSignIn: true });
    }
  });

  test("with email disabled, new accounts can sign in without verification but keep password rules", () => {
    vi.stubEnv("EMAIL_TRANSPORT", "disabled");
    const { emailAndPassword, emailVerification } = options();
    expect(emailAndPassword).toMatchObject({
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    });
    expect(emailVerification).toMatchObject({ sendOnSignUp: false, sendOnSignIn: false });
  });
});
