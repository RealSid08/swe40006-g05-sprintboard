import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { createProjectWithMember, createUser, errorData, setup } from "./test.helpers";

describe("membership", () => {
  test("owner adds an existing user by email (case-insensitive)", async () => {
    const t = setup();
    const owner = await createUser(t, "Olivia");
    const member = await createUser(t, "Max");
    const projectId = await owner.as.mutation(api.projects.create, { name: "P", description: "" });
    await owner.as.mutation(api.members.add, { projectId, email: "  MAX@example.test " });
    const project = await member.as.query(api.projects.get, { projectId });
    expect(project.role).toBe("member");
    expect(project.members.map((m) => m.name)).toEqual(["Olivia", "Max"]);
  });

  test("rejects unknown, duplicate and malformed emails", async () => {
    const t = setup();
    const { owner, member, projectId } = await createProjectWithMember(t);
    expect(
      await errorData(owner.as.mutation(api.members.add, { projectId, email: "nobody@example.test" })),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(
      await errorData(owner.as.mutation(api.members.add, { projectId, email: member.email })),
    ).toMatchObject({ code: "CONFLICT" });
    expect(
      await errorData(owner.as.mutation(api.members.add, { projectId, email: "not-an-email" })),
    ).toMatchObject({ code: "INVALID_INPUT" });
  });

  test("members cannot manage membership", async () => {
    const t = setup();
    const { owner, member, outsider, projectId } = await createProjectWithMember(t);
    expect(
      await errorData(member.as.mutation(api.members.add, { projectId, email: outsider.email })),
    ).toMatchObject({ code: "FORBIDDEN" });
    expect(
      await errorData(member.as.mutation(api.members.remove, { projectId, userId: owner.userId })),
    ).toMatchObject({ code: "FORBIDDEN" });
    expect(
      await errorData(outsider.as.mutation(api.members.add, { projectId, email: outsider.email })),
    ).toMatchObject({ code: "NOT_FOUND" });
  });

  test("owner cannot be removed and cannot leave", async () => {
    const t = setup();
    const { owner, projectId } = await createProjectWithMember(t);
    expect(
      await errorData(owner.as.mutation(api.members.remove, { projectId, userId: owner.userId })),
    ).toMatchObject({ code: "FORBIDDEN" });
    expect(await errorData(owner.as.mutation(api.members.leave, { projectId }))).toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("removing a member revokes access and clears only their assignments", async () => {
    const t = setup();
    const { owner, member, outsider, projectId } = await createProjectWithMember(t);
    const assigned = await owner.as.mutation(api.tasks.create, {
      projectId,
      title: "Member task",
      description: "",
      priority: "medium",
      dueDate: null,
      assigneeId: member.userId,
    });
    const ownerTask = await owner.as.mutation(api.tasks.create, {
      projectId,
      title: "Owner task",
      description: "",
      priority: "medium",
      dueDate: null,
      assigneeId: owner.userId,
    });
    expect(
      await errorData(owner.as.mutation(api.members.remove, { projectId, userId: outsider.userId })),
    ).toMatchObject({ code: "NOT_FOUND" });

    await owner.as.mutation(api.members.remove, { projectId, userId: member.userId });
    expect(await errorData(member.as.query(api.tasks.list, { projectId }))).toMatchObject({
      code: "NOT_FOUND",
    });
    const tasks = await owner.as.query(api.tasks.list, { projectId });
    expect(tasks.find((task) => task._id === assigned)?.assigneeId).toBeNull();
    expect(tasks.find((task) => task._id === ownerTask)?.assigneeId).toBe(owner.userId);
    const activity = await owner.as.query(api.activity.list, { projectId });
    expect(activity[0]?.summary).toBe("removed Max from the project");
    // History about the removed member's task is kept.
    expect(activity.some((a) => a.summary.includes("assigned it to Max"))).toBe(true);
  });

  test("a member can leave; large assignment sets are cleared in batches", async () => {
    const t = setup();
    const { owner, member, projectId } = await createProjectWithMember(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 205; i++) {
        await ctx.db.insert("tasks", {
          projectId,
          title: `T${i}`,
          description: "",
          status: "todo",
          priority: "low",
          dueDate: null,
          assigneeId: member.userId,
          createdBy: owner.userId,
          updatedAt: 0,
        });
      }
    });
    await member.as.mutation(api.members.leave, { projectId });
    await t.finishAllScheduledFunctions(() => {});
    const tasks = await owner.as.query(api.tasks.list, { projectId });
    expect(tasks.every((task) => task.assigneeId === null)).toBe(true);
    expect(await member.as.query(api.projects.list, {})).toEqual([]);
    const activity = await owner.as.query(api.activity.list, { projectId });
    expect(activity[0]).toMatchObject({ actorName: "Max", summary: "left the project" });
  });

  test("a scheduled unassign continuation is skipped if the member rejoined", async () => {
    const t = setup();
    const { owner, member, projectId } = await createProjectWithMember(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 201; i++) {
        await ctx.db.insert("tasks", {
          projectId,
          title: `T${i}`,
          description: "",
          status: "todo",
          priority: "low",
          dueDate: null,
          assigneeId: member.userId,
          createdBy: owner.userId,
          updatedAt: 0,
        });
      }
    });
    await owner.as.mutation(api.members.remove, { projectId, userId: member.userId });
    await owner.as.mutation(api.members.add, { projectId, email: member.email });
    await t.finishAllScheduledFunctions(() => {});
    const stillAssigned = await t.run(
      async (ctx) =>
        (await ctx.db.query("tasks").collect()).filter((task) => task.assigneeId === member.userId).length,
    );
    expect(stillAssigned).toBe(1);
  });
});
