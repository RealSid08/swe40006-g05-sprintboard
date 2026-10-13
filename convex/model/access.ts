import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError, projectNotFound } from "./errors";

type ReadCtx = QueryCtx | MutationCtx;

/** Resolves the signed-in app user. Identity always comes from the verified JWT, never from arguments. */
export async function getCurrentUser(ctx: ReadCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .unique();
}

export async function requireUser(ctx: ReadCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    throw appError("UNAUTHENTICATED", "Sign in to continue.");
  }
  return user;
}

export async function getMembership(
  ctx: ReadCtx,
  projectId: Id<"projects">,
  userId: Id<"users">,
): Promise<Doc<"projectMembers"> | null> {
  return await ctx.db
    .query("projectMembers")
    .withIndex("by_project_and_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
    .unique();
}

export type ProjectAccess = {
  user: Doc<"users">;
  project: Doc<"projects">;
  membership: Doc<"projectMembers">;
};

/** Every protected project operation passes through here: active project + caller membership. */
export async function requireProjectMember(
  ctx: ReadCtx,
  projectId: Id<"projects">,
): Promise<ProjectAccess> {
  const user = await requireUser(ctx);
  const project = await ctx.db.get("projects", projectId);
  if (project === null || project.state !== "active") throw projectNotFound();
  const membership = await getMembership(ctx, projectId, user._id);
  if (membership === null) throw projectNotFound();
  return { user, project, membership };
}

export async function requireProjectOwner(
  ctx: ReadCtx,
  projectId: Id<"projects">,
): Promise<ProjectAccess> {
  const access = await requireProjectMember(ctx, projectId);
  if (access.membership.role !== "owner") {
    throw appError("FORBIDDEN", "Only the project owner can do that.");
  }
  return access;
}

export async function requireTaskAccess(
  ctx: ReadCtx,
  taskId: Id<"tasks">,
): Promise<ProjectAccess & { task: Doc<"tasks"> }> {
  const task = await ctx.db.get("tasks", taskId);
  if (task === null) throw appError("NOT_FOUND", "Task not found or you do not have access to it.");
  const access = await requireProjectMember(ctx, task.projectId).catch(() => {
    throw appError("NOT_FOUND", "Task not found or you do not have access to it.");
  });
  return { ...access, task };
}
