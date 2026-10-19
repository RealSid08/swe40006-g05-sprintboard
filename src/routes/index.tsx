import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Activity, Filter, ShieldCheck, Users } from "lucide-react";
import { ReleaseBadge } from "~/components/AppShell";
import { DemoNotice, useEmailDelivery } from "~/components/DemoNotice";
import { Logo } from "~/components/ui";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (context.isAuthenticated) throw redirect({ to: "/projects" });
  },
  component: Landing,
});

function features(emailDelivery: boolean) {
  return [
    { icon: Users, title: "Shared projects", body: "Owners add teammates by email. Only members can see or change a project." },
    { icon: Filter, title: "Focused boards", body: "Filter by status, priority, or assignee and share the exact view by link." },
    { icon: Activity, title: "Live activity", body: "Every change is timestamped with who made it and shows up live for every member." },
    {
      icon: ShieldCheck,
      title: "Verified accounts",
      body: emailDelivery
        ? "Email verification, secure sessions and self-service password recovery."
        : "Only verified accounts can sign in, and every session is secure.",
    },
  ];
}

function Landing() {
  const emailDelivery = useEmailDelivery();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo className="text-lg" />
        <nav className="flex items-center gap-2">
          {emailDelivery ? (
            <>
              <Link to="/sign-in" className="btn-ghost">
                Sign in
              </Link>
              <Link to="/sign-up" className="btn-primary">
                Get started
              </Link>
            </>
          ) : (
            <Link to="/sign-in" className="btn-primary">
              Sign in
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pt-16 pb-20">
        <DemoNotice className="mb-8 max-w-2xl" />
        <div className="max-w-2xl animate-rise">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-strong">
            Built for small student teams
          </p>
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Keep your team on track, one sprint at a time.
          </h1>
          <p className="mt-5 text-lg text-ink-soft">
            SprintBoard gives your team one shared task board with clear owners, priorities, due dates and a live
            activity trail.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {emailDelivery ? (
              <>
                <Link to="/sign-up" className="btn-primary h-11 px-5 text-[15px]">
                  Create a free account
                </Link>
                <Link to="/sign-in" className="btn-secondary h-11 px-5 text-[15px]">
                  I already have an account
                </Link>
              </>
            ) : (
              <Link to="/sign-in" className="btn-primary h-11 px-5 text-[15px]">
                Sign in with a demo account
              </Link>
            )}
          </div>
        </div>
        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Features">
          {features(emailDelivery).map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-5">
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon className="size-[18px]" aria-hidden="true" />
              </div>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="mx-auto flex w-full max-w-6xl justify-between px-6 py-6">
        <span className="text-xs text-ink-faint">SWE40006 Group G05</span>
        <ReleaseBadge />
      </footer>
    </div>
  );
}
