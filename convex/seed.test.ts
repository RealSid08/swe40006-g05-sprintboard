import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { createUser, setup } from "./test.helpers";

describe("operator demo seed", () => {
  test("creates an idempotent demo project with members and tasks", async () => {
    const t = setup();
    const owner = await createUser(t, "DemoOwner");
    const member = await createUser(t, "DemoMember");
    const projectId = await t.mutation(internal.seed.demoProject, {
      ownerEmail: owner.email,
      memberEmails: [member.email, owner.email],
    });
    const again = await t.mutation(internal.seed.demoProject, { ownerEmail: owner.email, memberEmails: [member.email] });
    expect(again).toBe(projectId);

    const project = await member.as.query(api.projects.get, { projectId });
    expect(project.name).toBe("G05 Release Sprint");
    expect(project.members).toHaveLength(2);
    const tasks = await owner.as.query(api.tasks.list, { projectId });
    expect(tasks.length).toBe(5);
    expect(new Set(tasks.map((task) => task.status))).toEqual(new Set(["todo", "in_progress", "review", "done"]));
    expect(tasks.some((task) => task.assigneeId === member.userId)).toBe(true);
  });

  test("requires existing accounts", async () => {
    const t = setup();
    await expect(t.mutation(internal.seed.demoProject, { ownerEmail: "ghost@example.test", memberEmails: [] })).rejects.toThrow(
      /No account/,
    );
  });

  test("discards queued verification mail for seeded accounts", async () => {
    const t = setup();
    await t.mutation(internal.email.queue, { to: "demo.owner@example.test", kind: "verify_email", url: "https://app/v" });
    await t.mutation(internal.seed.discardOutbox, { email: "demo.owner@example.test" });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("emailOutbox").collect()).toHaveLength(0);
    });
  });
});
