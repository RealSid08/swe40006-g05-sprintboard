import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/** Writes the readiness row so a probe proves the database accepts writes. */
export const touch = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("healthProbes")
      .withIndex("by_key", (q) => q.eq("key", "readiness"))
      .unique();
    const checkedAt = Date.now();
    if (existing === null) {
      await ctx.db.insert("healthProbes", { key: "readiness", count: 1, checkedAt });
      return 1;
    }
    const count = existing.count + 1;
    await ctx.db.patch("healthProbes", existing._id, { count, checkedAt });
    return count;
  },
});

export const read = internalQuery({
  args: {},
  returns: v.union(v.null(), v.object({ count: v.number(), checkedAt: v.number() })),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("healthProbes")
      .withIndex("by_key", (q) => q.eq("key", "readiness"))
      .unique();
    return row === null ? null : { count: row.count, checkedAt: row.checkedAt };
  },
});
