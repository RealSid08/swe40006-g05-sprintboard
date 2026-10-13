import betterAuth from "@convex-dev/better-auth/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    SITE_URL: v.optional(v.string()),
    BETTER_AUTH_SECRET: v.optional(v.string()),
    APP_ENVIRONMENT: v.optional(
      v.union(v.literal("local"), v.literal("test"), v.literal("staging"), v.literal("production")),
    ),
    APP_RELEASE: v.optional(v.string()),
    EMAIL_TRANSPORT: v.optional(
      v.union(v.literal("outbox"), v.literal("resend"), v.literal("ses"), v.literal("disabled")),
    ),
    EMAIL_FROM: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
    SES_REGION: v.optional(v.string()),
    SES_ACCESS_KEY_ID: v.optional(v.string()),
    SES_SECRET_ACCESS_KEY: v.optional(v.string()),
    SES_SESSION_TOKEN: v.optional(v.string()),
    TEST_OUTBOX_TOKEN: v.optional(v.string()),
    READINESS_TOKEN: v.optional(v.string()),
  },
});
app.use(betterAuth);

export default app;
