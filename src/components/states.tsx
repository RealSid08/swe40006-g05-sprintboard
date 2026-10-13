import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { FileQuestion, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage, isNotFound } from "~/lib/errors";

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">{icon}</div>
      <h2 className="text-base font-semibold">{title}</h2>
      {children ? <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function NotFoundState() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <EmptyState
        icon={<FileQuestion className="size-6" />}
        title="We could not find that page"
        action={
          <Link to="/projects" className="btn-primary">
            Back to projects
          </Link>
        }
      >
        It may have been deleted, or you may not have access to it.
      </EmptyState>
    </div>
  );
}

export function ErrorState({ error, reset }: ErrorComponentProps) {
  if (isNotFound(error)) return <NotFoundState />;
  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <EmptyState
        icon={<TriangleAlert className="size-6" />}
        title="Something went wrong"
        action={
          <button type="button" className="btn-secondary" onClick={reset}>
            Try again
          </button>
        }
      >
        {errorMessage(error)}
      </EmptyState>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading board">
      {[0, 1, 2, 3].map((column) => (
        <div key={column} className="space-y-3 rounded-2xl bg-sunken/70 p-3">
          <div className="h-4 w-24 animate-pulse rounded bg-line" />
          {[0, 1].map((card) => (
            <div key={card} className="h-24 animate-pulse rounded-xl bg-surface/80" />
          ))}
        </div>
      ))}
    </div>
  );
}
