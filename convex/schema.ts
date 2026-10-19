import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { memberRoleValidator, taskPriorityValidator, taskStatusValidator } from "./model/domain";

export const activityKindValidator = v.union(
  v.literal("project_created"),
  v.literal("project_updated"),
  v.literal("member_added"),
  v.literal("member_removed"),
  v.literal("member_left"),
  v.literal("task_created"),
  v.literal("task_updated"),
  v.literal("task_moved"),
  v.literal("task_deleted"),
);

export const emailKindValidator = v.union(v.literal("verify_email"), v.literal("reset_password"));

export default defineSchema({
  /** App profile linked one-to-one with a Better Auth user (authId = auth user id = JWT subject). */
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.string(),
  })
    .index("by_authId", ["authId"])
    .index("by_email", ["email"]),

  projects: defineTable({
    name: v.string(),
    description: v.string(),
    ownerId: v.id("users"),
    state: v.union(v.literal("active"), v.literal("deleting")),
  }),

  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: memberRoleValidator,
  })
    .index("by_project_and_user", ["projectId", "userId"])
    .index("by_user", ["userId"]),

  tasks: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    description: v.string(),
    status: taskStatusValidator,
    priority: taskPriorityValidator,
    /** Calendar date in YYYY-MM-DD form, or null. */
    dueDate: v.union(v.string(), v.null()),
    assigneeId: v.union(v.id("users"), v.null()),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_project_and_status", ["projectId", "status"])
    .index("by_project_and_priority", ["projectId", "priority"])
    .index("by_project_and_assigneeId", ["projectId", "assigneeId"]),

  activity: defineTable({
    projectId: v.id("projects"),
    actorId: v.id("users"),
    taskId: v.union(v.id("tasks"), v.null()),
    kind: activityKindValidator,
    summary: v.string(),
  }).index("by_projectId", ["projectId"]),

  /** Captured auth emails when EMAIL_TRANSPORT=outbox (local and automated test environments only). */
  emailOutbox: defineTable({
    to: v.string(),
    kind: emailKindValidator,
    subject: v.string(),
    url: v.string(),
  }).index("by_to", ["to"]),

  /** Single-row readiness probe used to verify a real backend write and read. */
  healthProbes: defineTable({
    key: v.literal("readiness"),
    count: v.number(),
    checkedAt: v.number(),
  }).index("by_key", ["key"]),
});
