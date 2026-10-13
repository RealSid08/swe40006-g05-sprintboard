import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthLayout } from "~/components/AuthLayout";
import { Field, FormError, Spinner } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({
    token: z.string().optional().catch(undefined),
    error: z.string().optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Choose a new password | SprintBoard" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token, error: linkError } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;

  if (!token || linkError) {
    return (
      <AuthLayout title="Link expired" subtitle="This password reset link is invalid or has already been used.">
        <Link to="/forgot-password" className="btn-primary h-10 w-full">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || mismatch || !token) return;
    setPending(true);
    setError(null);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    if (resetError) {
      setPending(false);
      setError(resetError.message ?? "We could not reset your password. Request a new link.");
      return;
    }
    window.location.assign("/sign-in?notice=password-reset");
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Signing in again will be required on your other devices.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="New password" htmlFor="password" hint="At least 8 characters.">
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={mismatch ? "Passwords do not match." : null}>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={mismatch}
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <button
          type="submit"
          className="btn-primary h-10 w-full"
          disabled={pending || password.length < 8 || confirm !== password}
        >
          {pending ? <Spinner /> : null}
          Update password
        </button>
      </form>
    </AuthLayout>
  );
}
