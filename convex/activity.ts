import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireProjectMember } from "./model/access";
import { LIMITS } from "./model/domain";
import { activityKindValidator } from "./schema";

export const list = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("activity"),
      createdAt: v.number(),
      actorName: v.string(),
      kind: activityKindValidator,
      summary: v.string(),
      taskId: v.union(v.id("tasks"), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const { project } = await requireProjectMember(ctx, args.projectId);
    const entries = await ctx.db
      .query("activity")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .order("desc")
      .take(LIMITS.activityItems);
    const names = new Map<string, string>();
    const result = [];
    for (const entry of entries) {
      let actorName = names.get(entry.actorId);
      if (actorName === undefined) {
        actorName = (await ctx.db.get("users", entry.actorId))?.name ?? "Former user";
        names.set(entry.actorId, actorName);
      }
      result.push({
        _id: entry._id,
        createdAt: entry._creationTime,
        actorName,
        kind: entry.kind,
        summary: entry.summary,
        taskId: entry.taskId,
      });
    }
    return result;
  },
});
