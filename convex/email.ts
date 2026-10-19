import { AwsClient } from "aws4fetch";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { renderAuthEmail } from "./model/emailContent";
import { emailKindValidator } from "./schema";

/**
 * Entry point for Better Auth emails. In `outbox` mode (local and automated test
 * environments) the message is stored so tests can follow the link. Otherwise delivery is
 * scheduled as an action, because mutations cannot perform network IO.
 */
export const queue = internalMutation({
  args: { to: v.string(), kind: emailKindValidator, url: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const transport = env.EMAIL_TRANSPORT ?? "outbox";
    if (transport === "disabled") {
      // Demo deployments without an email provider: accounts are seeded already verified.
      console.warn(JSON.stringify({ msg: "auth email dropped: EMAIL_TRANSPORT=disabled", kind: args.kind }));
      return null;
    }
    if (transport === "outbox") {
      if (env.APP_ENVIRONMENT === "production") {
        throw new Error("EMAIL_TRANSPORT=outbox is not allowed in production.");
      }
      const { subject } = renderAuthEmail(args.kind, args.url);
      await ctx.db.insert("emailOutbox", {
        to: args.to.toLowerCase(),
        kind: args.kind,
        subject,
        url: args.url,
      });
      return null;
    }
    await ctx.scheduler.runAfter(0, internal.email.deliver, args);
    return null;
  },
});

export const deliver = internalAction({
  args: { to: v.string(), kind: emailKindValidator, url: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const from = env.EMAIL_FROM;
    if (!from) throw new Error("EMAIL_FROM must be set for real email delivery.");
    const email = renderAuthEmail(args.kind, args.url);

    if (env.EMAIL_TRANSPORT === "resend") {
      if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set.");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [args.to], ...email }),
      });
      if (!response.ok) {
        throw new Error(`Resend rejected the email with HTTP ${response.status}.`);
      }
      return null;
    }

    if (env.EMAIL_TRANSPORT === "ses") {
      const region = env.SES_REGION;
      if (!region || !env.SES_ACCESS_KEY_ID || !env.SES_SECRET_ACCESS_KEY) {
        throw new Error("SES_REGION, SES_ACCESS_KEY_ID and SES_SECRET_ACCESS_KEY must be set.");
      }
      const aws = new AwsClient({
        accessKeyId: env.SES_ACCESS_KEY_ID,
        secretAccessKey: env.SES_SECRET_ACCESS_KEY,
        sessionToken: env.SES_SESSION_TOKEN,
        region,
        service: "ses",
      });
      const response = await aws.fetch(
        `https://email.${region}.amazonaws.com/v2/email/outbound-emails`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            FromEmailAddress: from,
            Destination: { ToAddresses: [args.to] },
            Content: {
              Simple: {
                Subject: { Data: email.subject },
                Body: { Text: { Data: email.text }, Html: { Data: email.html } },
              },
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`SES rejected the email with HTTP ${response.status}.`);
      }
      return null;
    }

    throw new Error("Unsupported EMAIL_TRANSPORT for delivery.");
  },
});

export const latestOutboxMessage = internalQuery({
  args: { to: v.string(), kind: emailKindValidator },
  returns: v.union(
    v.null(),
    v.object({ subject: v.string(), url: v.string(), createdAt: v.number() }),
  ),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("emailOutbox")
      .withIndex("by_to", (q) => q.eq("to", args.to.toLowerCase()))
      .order("desc")
      .take(20);
    const latest = messages.find((message) => message.kind === args.kind);
    if (latest === undefined) return null;
    return { subject: latest.subject, url: latest.url, createdAt: latest._creationTime };
  },
});
