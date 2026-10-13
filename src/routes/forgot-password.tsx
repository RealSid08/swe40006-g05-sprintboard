import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "~/components/AuthLayout";
import { Field, FormError, Spinner } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password | SprintBoard" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    const { error: requestError } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });
    if (requestError) {
      setState("idle");
      setError(requestError.message ?? "We could not send a reset link. Try again shortly.");
      return;
    }
    setState("sent");
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email and we will send you a reset link."
      footer={
        <Link to="/sign-in" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {state === "sent" ? (
        <div role="status" className="rounded-xl border border-accent/20 bg-accent-soft p-4 text-sm text-accent-strong">
          If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. The link expires in
          one hour.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormError message={error} />
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <button type="submit" className="btn-primary h-10 w-full" disabled={state === "sending" || !email.trim()}>
            {state === "sending" ? <Spinner /> : null}
            Send reset link
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
