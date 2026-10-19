import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createProjectWithMember, errorData, setup, type TestBackend } from "./test.helpers";

type Ctx = Awaited<ReturnType<typeof createProjectWithMember>>;

async function addTask(
  ctx: Ctx,
  overrides: Partial<{
    title: string;
    priority: "low" | "medium" | "high" | "urgent";
    status: "todo" | "in_progress" | "review" | "done";
    dueDate: string | null;
    assigneeId: Id<"users"> | null;
  }> = {},
) {
  return ctx.owner.as.mutation(api.tasks.create, {
    projectId: ctx.projectId,
    title: overrides.title ?? "Task",
    description: "",
    priority: overrides.priority ?? "medium",
    status: overrides.status,
    dueDate: overrides.dueDate ?? null,
    assigneeId: overrides.assigneeId ?? null,
  });
}

async function seed(t: TestBackend) {
  const ctx = await createProjectWithMember(t);
  return ctx;
}

describe("tasks", () => {
  test("members create tasks; defaults to To do and records activity", async () => {
    const t = setup();
    const ctx = await seed(t);
    const taskId = await ctx.member.as.mutation(api.tasks.create, {
      projectId: ctx.projectId,
      title: "  Draft slides ",
      description: "Four to eight slides",
      priority: "high",
      dueDate: "2026-10-22",
      assigneeId: ctx.owner.userId,
    });
    const [task] = await ctx.owner.as.query(api.tasks.list, { projectId: ctx.projectId });
    expect(task).toMatchObject({
      _id: taskId,
      title: "Draft slides",
      status: "todo",
      priority: "high",
      dueDate: "2026-10-22",
      assigneeId: ctx.owner.userId,
      createdBy: ctx.member.userId,
    });
    const [entry] = await ctx.owner.as.query(api.activity.list, { projectId: ctx.projectId });
    expect(entry).toMatchObject({
      actorName: "Max",
      kind: "task_created",
      summary: 'created "Draft slides" in To do and assigned it to Olivia',
      taskId,
    });
  });

  test("validation rejects blank titles, bad dates and non-member assignees", async () => {
    const t = setup();
    const ctx = await seed(t);
    expect(await errorData(addTask(ctx, { title: "   " }))).toMatchObject({ code: "INVALID_INPUT" });
    expect(await errorData(addTask(ctx, { title: "x".repeat(121) }))).toMatchObject({ code: "INVALID_INPUT" });
    expect(await errorData(addTask(ctx, { dueDate: "2026-02-30" }))).toMatchObject({ code: "INVALID_INPUT" });
    expect(await errorData(addTask(ctx, { dueDate: "22/10/2026" }))).toMatchObject({ code: "INVALID_INPUT" });
    expect(await errorData(addTask(ctx, { assigneeId: ctx.outsider.userId }))).toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(
      await errorData(
        ctx.owner.as.mutation(api.tasks.create, {
          projectId: ctx.projectId,
          title: "T",
          description: "d".repeat(2001),
          priority: "low",
          dueDate: null,
          assigneeId: null,
        }),
      ),
    ).toMatchObject({ code: "INVALID_INPUT" });
  });

  test("invalid states are rejected by the argument validator", async () => {
    const t = setup();
    const ctx = await seed(t);
    const taskId = await addTask(ctx);
    await expect(
      // @ts-expect-error deliberately invalid status
      ctx.owner.as.mutation(api.tasks.setStatus, { taskId, status: "archived" }),
    ).rejects.toThrow();
  });

  test("outsiders cannot list, create, edit, move or delete", async () => {
    const t = setup();
    const ctx = await seed(t);
    const taskId = await addTask(ctx);
    const as = ctx.outsider.as;
    for (const attempt of [
      as.query(api.tasks.list, { projectId: ctx.projectId }),
      as.mutation(api.tasks.create, {
        projectId: ctx.projectId,
        title: "Sneaky",
        description: "",
        priority: "low",
        dueDate: null,
        assigneeId: null,
      }),
      as.mutation(api.tasks.update, { taskId, title: "Hacked" }),
      as.mutation(api.tasks.setStatus, { taskId, status: "done" }),
      as.mutation(api.tasks.remove, { taskId }),
      as.query(api.activity.list, { projectId: ctx.projectId }),
    ]) {
      expect(await errorData(attempt)).toMatchObject({ code: "NOT_FOUND" });
    }
    const [task] = await ctx.owner.as.query(api.tasks.list, { projectId: ctx.projectId });
    expect(task).toMatchObject({ title: "Task", status: "todo" });
  });

  test("unauthenticated callers are rejected", async () => {
    const t = setup();
    const ctx = await seed(t);
    const taskId = await addTask(ctx);
    expect(await errorData(t.mutation(api.tasks.setStatus, { taskId, status: "done" }))).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await errorData(t.query(api.tasks.list, { projectId: ctx.projectId }))).toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  test("moving through all four states records each transition", async () => {
    const t = setup();
    const ctx = await seed(t);
    const taskId = await addTask(ctx, { title: "Pipeline" });
    for (const status of ["in_progress", "review", "done"] as const) {
      await ctx.member.as.mutation(api.tasks.setStatus, { taskId, status });
    }
    await ctx.member.as.mutation(api.tasks.setStatus, { taskId, status: "done" });
    const activity = await ctx.owner.as.query(api.activity.list, { projectId: ctx.projectId });
    expect(activity.filter((a) => a.kind === "task_moved").map((a) => a.summary)).toEqual([
      'moved "Pipeline" from Review to Done',
      'moved "Pipeline" from In progress to Review',
      'moved "Pipeline" from To do to In progress',
    ]);
  });

  test("update patches only changed fields and summarises them", async () => {
    const t = setup();
    const ctx = await seed(t);
    const taskId = await addTask(ctx, { title: "Old", dueDate: "2026-10-01" });
    await ctx.owner.as.mutation(api.tasks.update, {
      taskId,
      title: "New",
      description: "Details",
      priority: "urgent",
      dueDate: null,
      assigneeId: ctx.member.userId,
    });
    await ctx.owner.as.mutation(api.tasks.update, { taskId, title: "New" });
    await ctx.owner.as.mutation(api.tasks.update, { taskId, assigneeId: null, dueDate: "2026-11-01" });
    const [task] = await ctx.owner.as.query(api.tasks.list, { projectId: ctx.projectId });
    expect(task).toMatchObject({
      title: "New",
      description: "Details",
      priority: "urgent",
      dueDate: "2026-11-01",
      assigneeId: null,
    });
    const updates = (await ctx.owner.as.query(api.activity.list, { projectId: ctx.projectId }))
      .filter((a) => a.kind === "task_updated")
      .map((a) => a.summary);
    expect(updates).toEqual([
      'updated "New": set the due date to 2026-11-01, unassigned it',
      'updated "New": renamed it to "New", edited the description, set priority to Urgent, cleared the due date, assigned it to Max',
    ]);
    expect(
      await errorData(ctx.owner.as.mutation(api.tasks.update, { taskId, assigneeId: ctx.outsider.userId })),
    ).toMatchObject({ code: "INVALID_INPUT" });
  });

  test("filters by status, priority and assignee and sorts by priority then due date", async () => {
    const t = setup();
    const ctx = await seed(t);
    await addTask(ctx, { title: "low-todo", priority: "low" });
    await addTask(ctx, { title: "urgent-todo", priority: "urgent", assigneeId: ctx.member.userId });
    await addTask(ctx, { title: "high-late", priority: "high", dueDate: "2026-12-01" });
    await addTask(ctx, { title: "high-soon", priority: "high", dueDate: "2026-10-25" });
    await addTask(ctx, { title: "done", status: "done", priority: "urgent", assigneeId: ctx.member.userId });
    const list = (args: object) =>
      ctx.member.as
        .query(api.tasks.list, { projectId: ctx.projectId, ...args })
        .then((tasks) => tasks.map((task) => task.title));

    expect(await list({})).toEqual(["urgent-todo", "high-soon", "high-late", "low-todo", "done"]);
    expect(await list({ status: "done" })).toEqual(["done"]);
    expect(await list({ priority: "high" })).toEqual(["high-soon", "high-late"]);
    expect(await list({ assignee: ctx.member.userId })).toEqual(["urgent-todo", "done"]);
    expect(await list({ assignee: "unassigned", priority: "high" })).toEqual(["high-soon", "high-late"]);
    expect(await list({ assignee: ctx.member.userId, status: "todo" })).toEqual(["urgent-todo"]);
    expect(await list({ status: "todo", priority: "urgent" })).toEqual(["urgent-todo"]);
  });

  test("deleting a task keeps an activity record", async () => {
    const t = setup();
    const ctx = await seed(t);
    const taskId = await addTask(ctx, { title: "Temp" });
    await ctx.member.as.mutation(api.tasks.remove, { taskId });
    expect(await ctx.owner.as.query(api.tasks.list, { projectId: ctx.projectId })).toEqual([]);
    const [entry] = await ctx.owner.as.query(api.activity.list, { projectId: ctx.projectId });
    expect(entry).toMatchObject({ kind: "task_deleted", summary: 'deleted "Temp"', taskId: null });
    expect(await errorData(ctx.owner.as.mutation(api.tasks.remove, { taskId }))).toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
