import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
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
