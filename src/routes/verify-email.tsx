import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AuthLayout } from "~/components/AuthLayout";
import { FormError, Spinner } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({
    email: z.string().optional().catch(undefined),
    error: z.string().optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Verify your email | SprintBoard" }] }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { email, error: linkError } = Route.useSearch();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(
    linkError ? "That verification link is invalid or has expired. Send a new one below." : null,
  );

  async function resend() {
    if (!email) return;
    setState("sending");
    setError(null);
    const { error: sendError } = await authClient.sendVerificationEmail({ email, callbackURL: "/projects" });
    if (sendError) {
      setState("idle");
      setError(sendError.message ?? "We could not send the email. Try again shortly.");
      return;
    }
    setState("sent");
  }

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle={
        email ? (
          <>
            We sent a verification link to <strong className="text-ink">{email}</strong>.
          </>
        ) : (
          "We sent a verification link to the address you registered with."
        )
      }
      footer={
        <Link to="/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <FormError message={error} />
        <div className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink-soft">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
          <p>Open the link in the email to activate your account. You will be signed in automatically.</p>
        </div>
        {email ? (
          <button type="button" className="btn-secondary h-10 w-full" onClick={resend} disabled={state !== "idle"}>
            {state === "sending" ? <Spinner /> : null}
            {state === "sent" ? "Verification email sent" : "Resend verification email"}
          </button>
        ) : null}
      </div>
    </AuthLayout>
  );
}
