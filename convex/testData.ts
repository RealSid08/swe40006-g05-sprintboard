import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { createAuth } from "./auth";
import { unassignMemberTasks } from "./model/membership";

/**
 * Operator-only cleanup of synthetic acceptance-test data on non-production deployments.
 *
 * The automated suites register accounts named `qa-<run id>-...@example.test`. After a run the
 * operator (deployment admin key, never a public route) removes that run's accounts, sessions,
 * projects, memberships and test mailbox messages:
 *
 *   pnpm test:cleanup --prefix qa-<run id>
 *
 * Guard rails: refused when APP_ENVIRONMENT=production, only `qa-` prefixed `@example.test`
 * addresses are eligible, so seeded demo accounts (demo.*) can never match.
 */
export const QA_PREFIX = "qa-";
const QA_DOMAIN = "@example.test";
const BATCH = 25;

export function assertCleanupAllowed(prefix: string, environment: string | undefined) {
  if (environment === "production") throw new Error("Test data cleanup is disabled in production.");
  if (!prefix.startsWith(QA_PREFIX) || !/^[a-z0-9-]+$/.test(prefix)) {
    throw new Error(`prefix must start with "${QA_PREFIX}" and contain only lowercase letters, digits and dashes.`);
  }
}

export function isEligibleEmail(email: string, prefix: string): boolean {
  return email.startsWith(prefix) && email.startsWith(QA_PREFIX) && email.endsWith(QA_DOMAIN);
}

export const findRunUsers = internalQuery({
  args: { prefix: v.string() },
  returns: v.array(v.object({ _id: v.id("users"), authId: v.string(), email: v.string() })),
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.gte("email", args.prefix).lt("email", `${args.prefix}\uffff`))
      .take(BATCH);
    return users
      .filter((user) => isEligibleEmail(user.email, args.prefix))
      .map((user) => ({ _id: user._id, authId: user.authId, email: user.email }));
  },
});

/** Removes one synthetic user's app data. Owned projects go through the normal bounded purge. */
export const purgeUserData = internalMutation({
  args: { userId: v.id("users"), prefix: v.string() },
  returns: v.object({ projects: v.number(), memberships: v.number(), emails: v.number() }),
  handler: async (ctx, args) => {
    assertCleanupAllowed(args.prefix, env.APP_ENVIRONMENT);
    const user = await ctx.db.get("users", args.userId);
    if (user === null || !isEligibleEmail(user.email, args.prefix)) {
      return { projects: 0, memberships: 0, emails: 0 };
    }
    let projects = 0;
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(200);
    for (const membership of memberships) {
      const projectId: Id<"projects"> = membership.projectId;
      if (membership.role === "owner") {
        const project = await ctx.db.get("projects", projectId);
        if (project !== null && project.state === "active") {
          await ctx.db.patch("projects", projectId, { state: "deleting" });
          await ctx.scheduler.runAfter(0, internal.projects.purgeDeleted, { projectId });
          projects += 1;
        }
      } else {
        await ctx.db.delete("projectMembers", membership._id);
        await unassignMemberTasks(ctx, projectId, user._id);
      }
    }
    const emails = await ctx.db
      .query("emailOutbox")
      .withIndex("by_to", (q) => q.eq("to", user.email))
      .take(200);
    for (const message of emails) await ctx.db.delete("emailOutbox", message._id);
    await ctx.db.delete("users", user._id);
    return { projects, memberships: memberships.length, emails: emails.length };
  },
});

export const purgeRun = internalAction({
  args: { prefix: v.string() },
  returns: v.object({ users: v.number(), projects: v.number(), memberships: v.number(), emails: v.number() }),
  handler: async (ctx, args) => {
    const prefix = args.prefix.trim().toLowerCase();
    assertCleanupAllowed(prefix, env.APP_ENVIRONMENT);
    const auth = createAuth(ctx);
    const adapter = (await auth.$context).internalAdapter;
    const totals = { users: 0, projects: 0, memberships: 0, emails: 0 };
    for (;;) {
      const users = await ctx.runQuery(internal.testData.findRunUsers, { prefix });
      if (users.length === 0) break;
      for (const user of users) {
        await adapter.deleteUserSessions(user.authId);
        await adapter.deleteAccounts(user.authId);
        await adapter.deleteUser(user.authId);
        const removed = await ctx.runMutation(internal.testData.purgeUserData, { userId: user._id, prefix });
        totals.users += 1;
        totals.projects += removed.projects;
        totals.memberships += removed.memberships;
        totals.emails += removed.emails;
      }
    }
    return totals;
  },
});
