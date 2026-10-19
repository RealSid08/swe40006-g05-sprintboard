import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { createProjectWithMember, createUser, errorData, setup } from "./test.helpers";

describe("projects", () => {
  test("requires a signed-in user", async () => {
    const t = setup();
    expect(await errorData(t.query(api.projects.list, {}))).toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(
      await errorData(t.mutation(api.projects.create, { name: "X", description: "" })),
    ).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  test("creator becomes owner and sees the project", async () => {
    const t = setup();
    const owner = await createUser(t, "Olivia");
    const projectId = await owner.as.mutation(api.projects.create, {
      name: "  Capstone  ",
      description: "Semester project",
    });
    const projects = await owner.as.query(api.projects.list, {});
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ _id: projectId, name: "Capstone", role: "owner", ownerName: "Olivia" });
    const project = await owner.as.query(api.projects.get, { projectId });
    expect(project.members).toEqual([
      expect.objectContaining({ name: "Olivia", role: "owner" }),
    ]);
  });

  test("rejects blank and overlong names", async () => {
    const t = setup();
    const owner = await createUser(t, "Olivia");
    expect(
      await errorData(owner.as.mutation(api.projects.create, { name: "   ", description: "" })),
    ).toMatchObject({ code: "INVALID_INPUT" });
    expect(
      await errorData(owner.as.mutation(api.projects.create, { name: "x".repeat(81), description: "" })),
    ).toMatchObject({ code: "INVALID_INPUT" });
  });

  test("outsiders cannot read a project and get the same not-found response", async () => {
    const t = setup();
    const { outsider, projectId } = await createProjectWithMember(t);
    expect(await errorData(outsider.as.query(api.projects.get, { projectId }))).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await outsider.as.query(api.projects.list, {})).toEqual([]);
  });

  test("only the owner can update; no-op updates write nothing", async () => {
    const t = setup();
    const { owner, member, projectId } = await createProjectWithMember(t);
    expect(
      await errorData(
        member.as.mutation(api.projects.update, { projectId, name: "Hijacked", description: "" }),
      ),
    ).toMatchObject({ code: "FORBIDDEN" });
    await owner.as.mutation(api.projects.update, { projectId, name: "Capstone", description: "Semester project" });
    await owner.as.mutation(api.projects.update, { projectId, name: "Capstone 2", description: "New" });
    await owner.as.mutation(api.projects.update, { projectId, name: "Capstone 2", description: "Newer" });
    const activity = await owner.as.query(api.activity.list, { projectId });
    expect(activity.filter((a) => a.kind === "project_updated").map((a) => a.summary)).toEqual([
      "updated the project description",
      'renamed the project to "Capstone 2"',
    ]);
  });

  test("deletion is owner-only, needs the exact name, and removes all project data", async () => {
    const t = setup();
    const { owner, member, projectId } = await createProjectWithMember(t);
    await owner.as.mutation(api.tasks.create, {
      projectId,
      title: "Write report",
      description: "",
      priority: "high",
      dueDate: null,
      assigneeId: member.userId,
    });
    expect(
      await errorData(member.as.mutation(api.projects.remove, { projectId, confirmName: "Capstone" })),
    ).toMatchObject({ code: "FORBIDDEN" });
    expect(
      await errorData(owner.as.mutation(api.projects.remove, { projectId, confirmName: "capstone" })),
    ).toMatchObject({ code: "INVALID_INPUT" });

    await owner.as.mutation(api.projects.remove, { projectId, confirmName: "Capstone" });
    // Hidden immediately, before cleanup runs.
    expect(await errorData(member.as.query(api.projects.get, { projectId }))).toMatchObject({
      code: "NOT_FOUND",
    });
    await t.finishAllScheduledFunctions(() => {});
    const remaining = await t.run(async (ctx) => ({
      project: await ctx.db.get("projects", projectId),
      tasks: await ctx.db.query("tasks").collect(),
      members: await ctx.db.query("projectMembers").collect(),
      activity: await ctx.db.query("activity").collect(),
    }));
    expect(remaining).toEqual({ project: null, tasks: [], members: [], activity: [] });
  });

  test("large project deletion continues across batches", async () => {
    const t = setup();
    const owner = await createUser(t, "Olivia");
    const projectId = await owner.as.mutation(api.projects.create, { name: "Big", description: "" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 250; i++) {
        await ctx.db.insert("tasks", {
          projectId,
          title: `Task ${i}`,
          description: "",
          status: "todo",
          priority: "low",
          dueDate: null,
          assigneeId: null,
          createdBy: owner.userId,
          updatedAt: 0,
        });
      }
    });
    await owner.as.mutation(api.projects.remove, { projectId, confirmName: "Big" });
    await t.finishAllScheduledFunctions(() => {});
    expect(await t.run(async (ctx) => (await ctx.db.query("tasks").collect()).length)).toBe(0);
    expect(await t.run(async (ctx) => ctx.db.get("projects", projectId))).toBeNull();
  });
});
