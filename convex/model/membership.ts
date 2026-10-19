import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { LIMITS } from "./domain";

/**
 * Clears a departing member's assignments without deleting any task or history.
 * Processes one bounded batch and schedules a continuation when more remain.
 */
export async function unassignMemberTasks(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  userId: Id<"users">,
): Promise<number> {
  const assigned = await ctx.db
    .query("tasks")
    .withIndex("by_project_and_assigneeId", (q) =>
      q.eq("projectId", projectId).eq("assigneeId", userId),
    )
    .take(LIMITS.cleanupBatch);
  const now = Date.now();
  for (const task of assigned) {
    await ctx.db.patch("tasks", task._id, { assigneeId: null, updatedAt: now });
  }
  if (assigned.length === LIMITS.cleanupBatch) {
    await ctx.scheduler.runAfter(0, internal.members.continueUnassign, { projectId, userId });
  }
  return assigned.length;
}
