import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type ProjectSummary = FunctionReturnType<typeof api.projects.list>[number];

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project._id }}
      className="group card flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold tracking-tight">{project.name}</h2>
        {project.role === "owner" ? (
          <span className="chip bg-accent-soft text-accent-strong">
            <Crown className="size-3" aria-hidden="true" />
            Owner
          </span>
        ) : (
          <span className="chip bg-sunken text-ink-soft">Member</span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 min-h-10 text-sm text-ink-soft">
        {project.description || "No description yet."}
      </p>
      <div className="mt-5 flex items-center justify-between text-xs text-ink-faint">
        <span>Owned by {project.role === "owner" ? "you" : project.ownerName}</span>
        <span className="inline-flex items-center gap-1 font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
          Open board <ArrowRight className="size-3.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
