import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { FolderKanban, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthedQuery } from "~/lib/convex";
import { api } from "../../../convex/_generated/api";
import { AppShell } from "~/components/AppShell";
import { ProjectCard } from "~/components/projects/ProjectCard";
import { ProjectFormDialog } from "~/components/projects/ProjectForm";
import { EmptyState } from "~/components/states";

export const Route = createFileRoute("/_authed/projects/")({
  head: () => ({ meta: [{ title: "Projects | SprintBoard" }] }),
  component: Projects,
});

function Projects() {
  const projects = useAuthedQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your projects</h1>
            <p className="mt-1 text-sm text-ink-soft">Projects you own or have been added to.</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New project
          </button>
        </div>

        {projects === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-36 animate-pulse bg-surface/70" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="size-6" />}
            title="No projects yet"
            action={
              <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Create your first project
              </button>
            }
          >
            Create a project to get a board, then add your teammates by email.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project._id} project={project} />
            ))}
          </div>
        )}
      </main>
      <ProjectFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New project"
        submitLabel="Create project"
        onSubmit={async (input) => {
          const projectId = await createProject(input);
          setCreating(false);
          toast.success("Project created");
          await navigate({ to: "/projects/$projectId", params: { projectId } });
        }}
      />
    </AppShell>
  );
}
