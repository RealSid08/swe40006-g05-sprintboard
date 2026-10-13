import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation } from "./_generated/server";
import { createAuth } from "./auth";
import { recordActivity } from "./model/activity";
import { normalizeEmail } from "./model/validation";

/**
 * Operator-only: creates (or repairs) a synthetic account whose email is already verified.
 * Internal functions are callable only with the deployment admin key, for example:
 *   pnpm seed:account -- --email demo.owner@example.test --name "Demo Owner"
 * The password is read from SEED_ACCOUNT_PASSWORD; if empty, a random one is generated
 * and returned once.
 */
export const createVerifiedAccount = internalAction({
  args: { email: v.string(), name: v.string(), password: v.optional(v.string()) },
  returns: v.object({
    email: v.string(),
    created: v.boolean(),
    generatedPassword: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const name = args.name.trim();
    if (name.length === 0) throw new Error("name is required");
    let generatedPassword: string | null = null;
    let password = args.password ?? "";
    if (password.length === 0) {
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      password = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "x");
      generatedPassword = password;
    }
    if (password.length < 8) throw new Error("password must be at least 8 characters");

    const auth = createAuth(ctx);
    const authContext = await auth.$context;
    const existing = await authContext.internalAdapter.findUserByEmail(email, { includeAccounts: true });
    let created = false;
    if (existing === null) {
      await auth.api.signUpEmail({ body: { email, name, password } });
      created = true;
    } else {
      const hash = await authContext.password.hash(password);
      const hasCredential = existing.accounts.some((account) => account.providerId === "credential");
      if (hasCredential) {
        await authContext.internalAdapter.updatePassword(existing.user.id, hash);
      } else {
        await authContext.internalAdapter.linkAccount({
          userId: existing.user.id,
          providerId: "credential",
          accountId: existing.user.id,
          password: hash,
        });
      }
    }
    await authContext.internalAdapter.updateUserByEmail(email, { emailVerified: true, name });
    // Discard the verification email queued by sign-up; the account is verified directly.
    await ctx.runMutation(internal.seed.discardOutbox, { email });
    return { email, created, generatedPassword };
  },
});

export const discardOutbox = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("emailOutbox")
      .withIndex("by_to", (q) => q.eq("to", args.email))
      .take(50);
    for (const message of messages) await ctx.db.delete("emailOutbox", message._id);
    return null;
  },
});

const DEMO_TASKS = [
  { title: "Agree release checklist", status: "done", priority: "high", assignee: 0 },
  { title: "Write staging acceptance tests", status: "review", priority: "high", assignee: 1 },
  { title: "Configure Grafana dashboard", status: "in_progress", priority: "medium", assignee: 1 },
  { title: "Rehearse rollback", status: "todo", priority: "urgent", assignee: 0 },
  { title: "Draft presentation slides", status: "todo", priority: "medium", assignee: null },
] as const;

/**
 * Operator-only: creates a sample project owned by an existing account, adds existing
 * accounts as members, and adds a few tasks. Idempotent by project name.
 */
export const demoProject = internalMutation({
  args: { ownerEmail: v.string(), memberEmails: v.array(v.string()), name: v.optional(v.string()) },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const findUser = async (email: string) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
        .unique();
      if (user === null) throw new Error(`No account for ${email}; run createVerifiedAccount first.`);
      return user;
    };
    const owner = await findUser(args.ownerEmail);
    const members = [];
    for (const email of args.memberEmails) members.push(await findUser(email));
    const name = args.name ?? "G05 Release Sprint";

    const ownedMemberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", owner._id))
      .take(100);
    for (const membership of ownedMemberships) {
      const project = await ctx.db.get("projects", membership.projectId);
      if (project?.name === name && project.state === "active") return project._id;
    }

    const projectId = await ctx.db.insert("projects", {
      name,
      description: "Sample board created by the operator seed for demonstrations.",
      ownerId: owner._id,
      state: "active",
    });
    await ctx.db.insert("projectMembers", { projectId, userId: owner._id, role: "owner" });
    await recordActivity(ctx, { projectId, actorId: owner._id, kind: "project_created", summary: `created the project "${name}"` });
    for (const member of members) {
      if (member._id === owner._id) continue;
      await ctx.db.insert("projectMembers", { projectId, userId: member._id, role: "member" });
    }
    const people: Id<"users">[] = [owner._id, ...members.map((m) => m._id)];
    for (const task of DEMO_TASKS) {
      const assigneeId = task.assignee === null ? null : (people[task.assignee] ?? null);
      const taskId = await ctx.db.insert("tasks", {
        projectId,
        title: task.title,
        description: "",
        status: task.status,
        priority: task.priority,
        dueDate: null,
        assigneeId,
        createdBy: owner._id,
        updatedAt: Date.now(),
      });
      await recordActivity(ctx, { projectId, actorId: owner._id, taskId, kind: "task_created", summary: `created "${task.title}"` });
    }
    return projectId;
  },
});
