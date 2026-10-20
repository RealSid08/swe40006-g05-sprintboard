import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthLayout } from "~/components/AuthLayout";
import { useEmailDelivery } from "~/components/DemoNotice";
import { Field, FormError, Spinner } from "~/components/ui";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/sign-up")({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/projects" });
  },
  head: () => ({ meta: [{ title: "Create account | SprintBoard" }] }),
  component: SignUp,
});

const MIN_PASSWORD = 8;

function SignUp() {
  const navigate = useNavigate();
  const emailDelivery = useEmailDelivery();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;

  // New accounts must verify by email, so sign-up cannot work while delivery is off.
  if (!emailDelivery) {
    return (
      <AuthLayout title="Sign-up is closed" subtitle="New accounts cannot be verified in this demo.">
        <Link to="/sign-in" className="btn-primary h-10 w-full">
          Go to sign in
        </Link>
      </AuthLayout>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) return;
    setPending(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: "/projects",
    });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? "We could not create that account.");
      return;
    }
    await navigate({ to: "/verify-email", search: { email: email.trim() } });
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start a project board and invite your team."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Full name" htmlFor="name">
          <input
            id="name"
            autoComplete="name"
            required
            maxLength={80}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
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
        <Field
          label="Password"
          htmlFor="password"
          hint={`At least ${MIN_PASSWORD} characters.`}
          error={passwordTooShort ? `Use at least ${MIN_PASSWORD} characters.` : null}
        >
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={passwordTooShort}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button
          type="submit"
          className="btn-primary h-10 w-full"
          disabled={pending || !name.trim() || !email.trim() || password.length < MIN_PASSWORD}
        >
          {pending ? <Spinner /> : null}
          Create account
        </button>
        <p className="text-center text-xs text-ink-faint">We will email you a link to verify your address.</p>
      </form>
    </AuthLayout>
  );
}
