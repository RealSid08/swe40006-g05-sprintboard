import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { createUser, setup } from "./test.helpers";
import { assertCleanupAllowed, isEligibleEmail } from "./testData";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("test data cleanup guard rails", () => {
  test("refuses production and non-QA prefixes", () => {
    expect(() => assertCleanupAllowed("qa-run1-", "production")).toThrow(/production/);
    expect(() => assertCleanupAllowed("demo.", "staging")).toThrow(/prefix/);
    expect(() => assertCleanupAllowed("qa-Run 1", "staging")).toThrow(/prefix/);
    expect(() => assertCleanupAllowed("qa-run1-", "staging")).not.toThrow();
  });

  test("only qa-*@example.test addresses are eligible", () => {
    expect(isEligibleEmail("qa-run1-owner-1@example.test", "qa-run1-")).toBe(true);
    expect(isEligibleEmail("qa-run1-owner-1@gmail.com", "qa-run1-")).toBe(false);
    expect(isEligibleEmail("qa-run2-owner@example.test", "qa-run1-")).toBe(false);
    expect(isEligibleEmail("demo.owner@example.test", "demo.")).toBe(false);
  });
});

describe("purging one run's synthetic data", () => {
  test("removes the run's users, owned projects, memberships and mailbox, keeping others", async () => {
    vi.useFakeTimers();
    vi.stubEnv("APP_ENVIRONMENT", "staging");
    const t = setup();
    const qaOwner = await createUser(t, "qa-run1-owner");
    const qaMember = await createUser(t, "qa-run1-member");
    const demo = await createUser(t, "demo.owner");
    const otherRun = await createUser(t, "qa-run2-owner");

    const qaProject = await qaOwner.as.mutation(api.projects.create, { name: "QA board", description: "" });
    const demoProject = await demo.as.mutation(api.projects.create, { name: "Demo board", description: "" });
    await demo.as.mutation(api.members.add, { projectId: demoProject, email: qaMember.email });
    const taskId = await demo.as.mutation(api.tasks.create, {
      projectId: demoProject,
      title: "Assigned to QA",
      description: "",
      priority: "medium",
      dueDate: null,
      assigneeId: qaMember.userId,
    });
    await t.mutation(internal.email.queue, { to: qaOwner.email, kind: "verify_email", url: "https://app/x" });

    const found = await t.query(internal.testData.findRunUsers, { prefix: "qa-run1-" });
    expect(found.map((u) => u.email).sort()).toEqual([qaMember.email, qaOwner.email].sort());

    for (const user of found) {
      await t.mutation(internal.testData.purgeUserData, { userId: user._id, prefix: "qa-run1-" });
    }
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    expect(await t.query(internal.testData.findRunUsers, { prefix: "qa-run1-" })).toEqual([]);
    expect(await t.query(internal.testData.findRunUsers, { prefix: "qa-run2-" })).toHaveLength(1);
    await t.run(async (ctx) => {
      expect(await ctx.db.get("projects", qaProject)).toBeNull();
      expect((await ctx.db.get("projects", demoProject))?.state).toBe("active");
      expect((await ctx.db.get("tasks", taskId))?.assigneeId).toBeNull();
      expect(await ctx.db.query("emailOutbox").collect()).toHaveLength(0);
      expect(await ctx.db.get("users", demo.userId)).not.toBeNull();
      expect(await ctx.db.get("users", otherRun.userId)).not.toBeNull();
    });
  });

  test("never deletes a non-matching user even if called directly, and refuses production", async () => {
    vi.stubEnv("APP_ENVIRONMENT", "staging");
    const t = setup();
    const demo = await createUser(t, "demo.member");
    expect(await t.mutation(internal.testData.purgeUserData, { userId: demo.userId, prefix: "qa-" })).toEqual({
      projects: 0,
      memberships: 0,
      emails: 0,
    });
    await t.run(async (ctx) => {
      expect(await ctx.db.get("users", demo.userId)).not.toBeNull();
    });

    vi.stubEnv("APP_ENVIRONMENT", "production");
    const qa = await createUser(t, "qa-prod-run");
    await expect(t.mutation(internal.testData.purgeUserData, { userId: qa.userId, prefix: "qa-" })).rejects.toThrow(/production/);
    await expect(t.action(internal.testData.purgeRun, { prefix: "qa-" })).rejects.toThrow(/production/);
  });
});
