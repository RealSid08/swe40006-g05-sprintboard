import { Link, useRouteContext } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuthedQuery } from "~/lib/convex";
import { api } from "../../convex/_generated/api";
import { authClient } from "~/lib/auth-client";
import { Avatar, Logo, Spinner } from "./ui";

export function ReleaseBadge() {
  const { config } = useRouteContext({ from: "__root__" });
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-faint" data-testid="release">
      <span className="size-1.5 rounded-full bg-accent/70" aria-hidden="true" />
      {config.environment} · release {config.release}
    </span>
  );
}

function UserMenu() {
  const me = useAuthedQuery(api.auth.me);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    // Reload so the Convex client and server render both drop the old session.
    window.location.assign("/sign-in");
  }

  return (
    <div className="flex items-center gap-3">
      {me ? (
        <div className="hidden items-center gap-2.5 sm:flex">
          <Avatar name={me.name} seed={me._id} size="md" />
          <div className="leading-tight">
            <div className="text-sm font-medium" data-testid="current-user">
              {me.name}
            </div>
            <div className="text-xs text-ink-faint">{me.email}</div>
          </div>
        </div>
      ) : null}
      <button type="button" className="btn-ghost btn-sm" onClick={signOut} disabled={signingOut}>
        {signingOut ? <Spinner /> : <LogOut className="size-4" aria-hidden="true" />}
        Sign out
      </button>
    </div>
  );
}

export function AppShell({ breadcrumb, children }: { breadcrumb?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/projects" aria-label="SprintBoard home">
              <Logo />
            </Link>
            {breadcrumb ? (
              <>
                <span className="text-line-strong" aria-hidden="true">
                  /
                </span>
                <div className="min-w-0 truncate text-sm font-medium">{breadcrumb}</div>
              </>
            ) : null}
          </div>
          <UserMenu />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-4 py-5 sm:px-6">
        <span className="text-xs text-ink-faint">SprintBoard, SWE40006 G05</span>
        <ReleaseBadge />
      </footer>
    </div>
  );
}
