import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getMembership, requireProjectMember, requireTaskAccess } from "./model/access";
import { recordActivity } from "./model/activity";
import {
  LIMITS,
  PRIORITY_LABELS,
  PRIORITY_RANK,
  STATUS_LABELS,
  TASK_STATUSES,
  taskPriorityValidator,
  taskStatusValidator,
} from "./model/domain";
import { appError } from "./model/errors";
import { parseDueDate, validateTaskDescription, validateTaskTitle } from "./model/validation";

const taskView = v.object({
  _id: v.id("tasks"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  title: v.string(),
  description: v.string(),
  status: taskStatusValidator,
  priority: taskPriorityValidator,
  dueDate: v.union(v.string(), v.null()),
  assigneeId: v.union(v.id("users"), v.null()),
  createdBy: v.id("users"),
  updatedAt: v.number(),
});

function compareTasks(a: Doc<"tasks">, b: Doc<"tasks">): number {
  const byStatus = TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status);
  if (byStatus !== 0) return byStatus;
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return a._creationTime - b._creationTime;
}

/**
 * Board tasks for one project. The most selective filter picks the index; remaining
 * filters apply to that bounded result.
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(taskStatusValidator),
    priority: v.optional(taskPriorityValidator),
    assignee: v.optional(v.union(v.id("users"), v.literal("unassigned"))),
  },
  returns: v.array(taskView),
  handler: async (ctx, args) => {
    const { project } = await requireProjectMember(ctx, args.projectId);
    const { status, priority, assignee } = args;
    let tasks: Doc<"tasks">[];
    if (assignee !== undefined) {
      const assigneeId = assignee === "unassigned" ? null : assignee;
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_project_and_assigneeId", (q) =>
          q.eq("projectId", project._id).eq("assigneeId", assigneeId),
        )
        .take(LIMITS.boardTasks);
    } else if (status !== undefined) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_project_and_status", (q) =>
          q.eq("projectId", project._id).eq("status", status),
        )
        .take(LIMITS.boardTasks);
    } else if (priority !== undefined) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_project_and_priority", (q) =>
          q.eq("projectId", project._id).eq("priority", priority),
        )
        .take(LIMITS.boardTasks);
    } else {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_project_and_status", (q) => q.eq("projectId", project._id))
        .take(LIMITS.boardTasks);
    }
    return tasks
      .filter(
        (task) =>
          (status === undefined || task.status === status) &&
          (priority === undefined || task.priority === priority),
      )
      .sort(compareTasks);
  },
});

async function requireAssignableMember(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  assigneeId: Id<"users"> | null,
): Promise<Doc<"users"> | null> {
  if (assigneeId === null) return null;
  const membership = await getMembership(ctx, projectId, assigneeId);
  const assignee = membership === null ? null : await ctx.db.get("users", assigneeId);
  if (assignee === null) {
    throw appError("INVALID_INPUT", "Tasks can only be assigned to project members.");
  }
  return assignee;
}

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    status: v.optional(taskStatusValidator),
    priority: taskPriorityValidator,
    dueDate: v.union(v.string(), v.null()),
    assigneeId: v.union(v.id("users"), v.null()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectMember(ctx, args.projectId);
    const title = validateTaskTitle(args.title);
    const description = validateTaskDescription(args.description);
    const dueDate = parseDueDate(args.dueDate);
    const assignee = await requireAssignableMember(ctx, project._id, args.assigneeId);
    const status = args.status ?? "todo";
    const taskId = await ctx.db.insert("tasks", {
      projectId: project._id,
      title,
      description,
      status,
      priority: args.priority,
      dueDate,
      assigneeId: assignee?._id ?? null,
      createdBy: user._id,
      updatedAt: Date.now(),
    });
    await recordActivity(ctx, {
      projectId: project._id,
      actorId: user._id,
      taskId,
      kind: "task_created",
      summary:
        `created "${title}" in ${STATUS_LABELS[status]}` +
        (assignee ? ` and assigned it to ${assignee.name}` : ""),
    });
    return taskId;
  },
});

export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(taskPriorityValidator),
    dueDate: v.optional(v.union(v.string(), v.null())),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, task } = await requireTaskAccess(ctx, args.taskId);
    const patch: Partial<Doc<"tasks">> = {};
    const changes: string[] = [];

    if (args.title !== undefined) {
      const title = validateTaskTitle(args.title);
      if (title !== task.title) {
        patch.title = title;
        changes.push(`renamed it to "${title}"`);
      }
    }
    if (args.description !== undefined) {
      const description = validateTaskDescription(args.description);
      if (description !== task.description) {
        patch.description = description;
        changes.push("edited the description");
      }
    }
    if (args.priority !== undefined && args.priority !== task.priority) {
      patch.priority = args.priority;
      changes.push(`set priority to ${PRIORITY_LABELS[args.priority]}`);
    }
    if (args.dueDate !== undefined) {
      const dueDate = parseDueDate(args.dueDate);
      if (dueDate !== task.dueDate) {
        patch.dueDate = dueDate;
        changes.push(dueDate === null ? "cleared the due date" : `set the due date to ${dueDate}`);
      }
    }
    if (args.assigneeId !== undefined && args.assigneeId !== task.assigneeId) {
      const assignee = await requireAssignableMember(ctx, task.projectId, args.assigneeId);
      patch.assigneeId = assignee?._id ?? null;
      changes.push(assignee ? `assigned it to ${assignee.name}` : "unassigned it");
    }

    if (changes.length === 0) return null;
    await ctx.db.patch("tasks", task._id, { ...patch, updatedAt: Date.now() });
    await recordActivity(ctx, {
      projectId: task.projectId,
      actorId: user._id,
      taskId: task._id,
      kind: "task_updated",
      summary: `updated "${patch.title ?? task.title}": ${changes.join(", ")}`,
    });
    return null;
  },
});

export const setStatus = mutation({
  args: { taskId: v.id("tasks"), status: taskStatusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, task } = await requireTaskAccess(ctx, args.taskId);
    if (task.status === args.status) return null;
    await ctx.db.patch("tasks", task._id, { status: args.status, updatedAt: Date.now() });
    await recordActivity(ctx, {
      projectId: task.projectId,
      actorId: user._id,
      taskId: task._id,
      kind: "task_moved",
      summary: `moved "${task.title}" from ${STATUS_LABELS[task.status]} to ${STATUS_LABELS[args.status]}`,
    });
    return null;
  },
});

export const remove = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, task } = await requireTaskAccess(ctx, args.taskId);
    await ctx.db.delete("tasks", task._id);
    await recordActivity(ctx, {
      projectId: task.projectId,
      actorId: user._id,
      taskId: null,
      kind: "task_deleted",
      summary: `deleted "${task.title}"`,
    });
    return null;
  },
});
