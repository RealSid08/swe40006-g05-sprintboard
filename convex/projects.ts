import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireProjectMember, requireProjectOwner, requireUser } from "./model/access";
import { recordActivity } from "./model/activity";
import { LIMITS, memberRoleValidator } from "./model/domain";
import { appError } from "./model/errors";
import { validateProjectDescription, validateProjectName } from "./model/validation";

const projectSummary = v.object({
  _id: v.id("projects"),
  name: v.string(),
  description: v.string(),
  role: memberRoleValidator,
  ownerName: v.string(),
  createdAt: v.number(),
});

export const list = query({
  args: {},
  returns: v.array(projectSummary),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(LIMITS.projectsPerUser);
    const summaries = [];
    for (const membership of memberships) {
      const project = await ctx.db.get("projects", membership.projectId);
      if (project === null || project.state !== "active") continue;
      const owner = await ctx.db.get("users", project.ownerId);
      summaries.push({
        _id: project._id,
        name: project.name,
        description: project.description,
        role: membership.role,
        ownerName: owner?.name ?? "Unknown",
        createdAt: project._creationTime,
      });
    }
    return summaries.sort((a, b) => b.createdAt - a.createdAt);
  },
});

const memberView = v.object({
  userId: v.id("users"),
  name: v.string(),
  email: v.string(),
  role: memberRoleValidator,
});

export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.object({
    _id: v.id("projects"),
    name: v.string(),
    description: v.string(),
    role: memberRoleValidator,
    currentUserId: v.id("users"),
    members: v.array(memberView),
  }),
  handler: async (ctx, args) => {
    const { user, project, membership } = await requireProjectMember(ctx, args.projectId);
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_and_user", (q) => q.eq("projectId", project._id))
      .take(LIMITS.membersPerProject);
    const members = [];
    for (const m of memberships) {
      const memberUser: Doc<"users"> | null = await ctx.db.get("users", m.userId);
      if (memberUser === null) continue;
      members.push({ userId: m.userId, name: memberUser.name, email: memberUser.email, role: m.role });
    }
    members.sort((a, b) =>
      a.role === b.role ? a.name.localeCompare(b.name) : a.role === "owner" ? -1 : 1,
    );
    return {
      _id: project._id,
      name: project.name,
      description: project.description,
      role: membership.role,
      currentUserId: user._id,
      members,
    };
  },
});

export const create = mutation({
  args: { name: v.string(), description: v.string() },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const name = validateProjectName(args.name);
    const description = validateProjectDescription(args.description);
    const projectId = await ctx.db.insert("projects", {
      name,
      description,
      ownerId: user._id,
      state: "active",
    });
    await ctx.db.insert("projectMembers", { projectId, userId: user._id, role: "owner" });
    await recordActivity(ctx, {
      projectId,
      actorId: user._id,
      kind: "project_created",
      summary: `created the project "${name}"`,
    });
    return projectId;
  },
});

export const update = mutation({
  args: { projectId: v.id("projects"), name: v.string(), description: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwner(ctx, args.projectId);
    const name = validateProjectName(args.name);
    const description = validateProjectDescription(args.description);
    if (name === project.name && description === project.description) return null;
    await ctx.db.patch("projects", project._id, { name, description });
    await recordActivity(ctx, {
      projectId: project._id,
      actorId: user._id,
      kind: "project_updated",
      summary: name === project.name ? "updated the project description" : `renamed the project to "${name}"`,
    });
    return null;
  },
});

/** Owner-only. The caller must type the exact project name to confirm. */
export const remove = mutation({
  args: { projectId: v.id("projects"), confirmName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectOwner(ctx, args.projectId);
    if (args.confirmName.trim() !== project.name) {
      throw appError("INVALID_INPUT", "Type the project name exactly to confirm deletion.");
    }
    // Hide immediately; the bounded cleanup removes dependent rows in batches.
    await ctx.db.patch("projects", project._id, { state: "deleting" });
    await ctx.scheduler.runAfter(0, internal.projects.purgeDeleted, { projectId: project._id });
    return null;
  },
});

export const purgeDeleted = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get("projects", args.projectId);
    if (project === null || project.state !== "deleting") return null;
    const batch = LIMITS.cleanupBatch;

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project_and_status", (q) => q.eq("projectId", args.projectId))
      .take(batch);
    for (const task of tasks) await ctx.db.delete("tasks", task._id);

    const activity = await ctx.db
      .query("activity")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(batch);
    for (const entry of activity) await ctx.db.delete("activity", entry._id);

    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_and_user", (q) => q.eq("projectId", args.projectId))
      .take(batch);
    for (const member of members) await ctx.db.delete("projectMembers", member._id);

    if (tasks.length === batch || activity.length === batch || members.length === batch) {
      await ctx.scheduler.runAfter(0, internal.projects.purgeDeleted, args);
    } else {
      await ctx.db.delete("projects", args.projectId);
    }
    return null;
  },
});
