import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { env, query } from "./_generated/server";
import authConfig from "./auth.config";
import { getCurrentUser } from "./model/access";

const authFunctions: AuthFunctions = internal.auth;

function displayName(name: string, email: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : (email.split("@")[0] ?? email);
}

/**
 * Better Auth component client. Triggers keep the app `users` profile in sync with the
 * component's user record in the same transaction as the auth write.
 */
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        await ctx.db.insert("users", {
          authId: authUser._id,
          email: authUser.email.toLowerCase(),
          name: displayName(authUser.name, authUser.email),
        });
      },
      onUpdate: async (ctx, newUser) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", newUser._id))
          .unique();
        if (user === null) return;
        await ctx.db.patch("users", user._id, {
          email: newUser.email.toLowerCase(),
          name: displayName(newUser.name, newUser.email),
        });
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    baseURL: env.SITE_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await requireRunMutationCtx(ctx).runMutation(internal.email.queue, {
          to: user.email,
          kind: "reset_password",
          url,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await requireRunMutationCtx(ctx).runMutation(internal.email.queue, {
          to: user.email,
          kind: "verify_email",
          url,
        });
      },
    },
    plugins: [convex({ authConfig })],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx));

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ _id: v.id("users"), email: v.string(), name: v.string() }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return null;
    return { _id: user._id, email: user.email, name: user.name };
  },
});

