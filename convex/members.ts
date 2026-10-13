import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { getMembership, requireProjectMember, requireProjectOwner } from "./model/access";
import { recordActivity } from "./model/activity";
import { appError } from "./model/errors";
import { unassignMemberTasks } from "./model/membership";
import { normalizeEmail } from "./model/validation";

/** Owner adds an existing, registered SprintBoard user by email. */
export const add = mutation({
  args: { projectId: v.id("projects"), email: v.string() },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwner(ctx, args.projectId);
    const email = normalizeEmail(args.email);
    const invitee = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (invitee === null) {
      throw appError(
        "NOT_FOUND",
        "No SprintBoard account uses that email. Ask them to sign up first.",
      );
    }
    if ((await getMembership(ctx, project._id, invitee._id)) !== null) {
      throw appError("CONFLICT", `${invitee.name} is already a member of this project.`);
    }
    await ctx.db.insert("projectMembers", {
      projectId: project._id,
      userId: invitee._id,
      role: "member",
    });
    await recordActivity(ctx, {
      projectId: project._id,
      actorId: user._id,
      kind: "member_added",
      summary: `added ${invitee.name} to the project`,
    });
    return invitee._id;
  },
});

/** Owner removes a member. Their assignments are cleared; tasks and history remain. */
export const remove = mutation({
  args: { projectId: v.id("projects"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, project } = await requireProjectOwner(ctx, args.projectId);
    const membership = await getMembership(ctx, project._id, args.userId);
    if (membership === null) throw appError("NOT_FOUND", "That person is not a member.");
    if (membership.role === "owner") {
      throw appError("FORBIDDEN", "The project owner cannot be removed.");
    }
    const removed = await ctx.db.get("users", args.userId);
    await ctx.db.delete("projectMembers", membership._id);
    await unassignMemberTasks(ctx, project._id, args.userId);
    await recordActivity(ctx, {
      projectId: project._id,
      actorId: user._id,
      kind: "member_removed",
      summary: `removed ${removed?.name ?? "a member"} from the project`,
    });
    return null;
  },
});

/** A member leaves a project. Owners must delete the project instead. */
export const leave = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, project, membership } = await requireProjectMember(ctx, args.projectId);
    if (membership.role === "owner") {
      throw appError("FORBIDDEN", "Owners cannot leave their own project. Delete it instead.");
    }
    await ctx.db.delete("projectMembers", membership._id);
    await unassignMemberTasks(ctx, project._id, user._id);
    await recordActivity(ctx, {
      projectId: project._id,
      actorId: user._id,
      kind: "member_left",
      summary: "left the project",
    });
    return null;
  },
});

export const continueUnassign = internalMutation({
  args: { projectId: v.id("projects"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Skip if the person rejoined in the meantime; their assignments are valid again.
    if ((await getMembership(ctx, args.projectId, args.userId)) !== null) return null;
    await unassignMemberTasks(ctx, args.projectId, args.userId);
    return null;
  },
});
