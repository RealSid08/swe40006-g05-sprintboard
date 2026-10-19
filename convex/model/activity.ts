import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { activityKindValidator } from "../schema";

export async function recordActivity(
  ctx: MutationCtx,
  entry: {
    projectId: Id<"projects">;
    actorId: Id<"users">;
    taskId?: Id<"tasks"> | null;
    kind: Infer<typeof activityKindValidator>;
    summary: string;
  },
): Promise<void> {
  await ctx.db.insert("activity", {
    projectId: entry.projectId,
    actorId: entry.actorId,
    taskId: entry.taskId ?? null,
    kind: entry.kind,
    summary: entry.summary,
  });
}
