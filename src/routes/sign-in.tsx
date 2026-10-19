import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthLayout } from "~/components/AuthLayout";
import { useEmailDelivery } from "~/components/DemoNotice";
import { Field, FormError, Spinner } from "~/components/ui";
import { authClient } from "~/lib/auth-client";
import { safeRedirect } from "~/lib/redirect";

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
    notice: z.enum(["password-reset", "verified"]).optional().catch(undefined),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.isAuthenticated) throw redirect({ href: safeRedirect(search.redirect) });
  },
  head: () => ({ meta: [{ title: "Sign in | SprintBoard" }] }),
  component: SignIn,
});

const NOTICES = {
  "password-reset": "Your password was changed. Sign in with the new password.",
  verified: "Email verified. Sign in to continue.",
} as const;

function SignIn() {
  const search = Route.useSearch();
  const emailDelivery = useEmailDelivery();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setUnverified(false);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    if (signInError) {
      setPending(false);
      if (signInError.code === "EMAIL_NOT_VERIFIED") {
        if (emailDelivery) {
          setUnverified(true);
          setError("Verify your email before signing in. We just sent you a fresh link.");
        } else {
          setError("This account is not verified, and this demo cannot send verification emails. Use a provided demo account.");
        }
      } else {
        setError(signInError.message ?? "Incorrect email or password.");
      }
      return;
    }
    // Full navigation so the server render picks up the new session cookie.
    window.location.assign(safeRedirect(search.redirect));
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see your projects and boards."
      footer={
        emailDelivery ? (
          <>
            New to SprintBoard?{" "}
            <Link to="/sign-up" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        ) : undefined
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {search.notice ? (
          <div role="status" className="rounded-lg border border-accent/20 bg-accent-soft px-3 py-2.5 text-sm text-accent-strong">
            {NOTICES[search.notice]}
          </div>
        ) : null}
        <FormError message={error} />
        {unverified ? (
          <p className="text-sm">
            <Link to="/verify-email" search={{ email }} className="font-medium text-accent hover:underline">
              Open verification help
            </Link>
          </p>
        ) : null}
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
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {emailDelivery ? (
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-[13px] font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
        ) : null}
        <button type="submit" className="btn-primary h-10 w-full" disabled={pending || !email || !password}>
          {pending ? <Spinner /> : null}
          Sign in
        </button>
      </form>
    </AuthLayout>
  );
}
