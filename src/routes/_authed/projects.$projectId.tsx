import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Plus, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuthedQuery } from "~/lib/convex";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { STATUS_LABELS, type TaskStatus } from "../../../convex/model/domain";
import { AppShell } from "~/components/AppShell";
import { ActivityFeed } from "~/components/board/ActivityFeed";
import { BoardColumn } from "~/components/board/BoardColumn";
import { FilterBar } from "~/components/board/FilterBar";
import { MembersPanel } from "~/components/board/MembersPanel";
import { ProjectSettingsDialog } from "~/components/board/ProjectSettingsDialog";
import { TaskDialog, type TaskFormValues } from "~/components/board/TaskDialog";
import { BoardSkeleton } from "~/components/states";
import { applyFilterPatch, boardSearchSchema, groupByStatus, moveTaskInList, toQueryFilters, visibleColumns, type Task } from "~/lib/board";
import { errorMessage } from "~/lib/errors";
import { todayIso } from "~/lib/format";

export const Route = createFileRoute("/_authed/projects/$projectId")({
  validateSearch: boardSearchSchema,
  head: () => ({ meta: [{ title: "Board | SprintBoard" }] }),
  component: Board,
});

type Editor = { mode: "closed" } | { mode: "create"; status: TaskStatus } | { mode: "edit"; taskId: Id<"tasks"> };

function Board() {
  const { projectId: rawProjectId } = Route.useParams();
  const projectId = rawProjectId as Id<"projects">;
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  // Set before leaving or deleting so the board stops subscribing to a project we can no longer read.
  const [departing, setDeparting] = useState(false);

  const project = useAuthedQuery(api.projects.get, departing ? "skip" : { projectId });
  const memberIds = useMemo(() => new Set(project?.members.map((m) => m.userId) ?? []), [project]);
  const filters = toQueryFilters(search, memberIds);
  const tasks = useAuthedQuery(api.tasks.list, departing || !project ? "skip" : { projectId, ...filters });
  const activity = useAuthedQuery(api.activity.list, departing ? "skip" : { projectId });

  const createTask = useMutation(api.tasks.create);
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const setStatus = useMutation(api.tasks.setStatus).withOptimisticUpdate((store, args) => {
    for (const { args: queryArgs, value } of store.getAllQueries(api.tasks.list)) {
      if (value !== undefined) store.setQuery(api.tasks.list, queryArgs, moveTaskInList(value, args.taskId, args.status, queryArgs.status));
    }
  });
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);
  const addMember = useMutation(api.members.add);
  const removeMember = useMutation(api.members.remove);
  const leaveProject = useMutation(api.members.leave);

  const [editor, setEditor] = useState<Editor>({ mode: "closed" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [today] = useState(() => todayIso(new Date()));

  const membersById = useMemo(() => new Map(project?.members.map((m) => [m.userId as string, m]) ?? []), [project]);
  const grouped = useMemo(() => groupByStatus(tasks ?? []), [tasks]);
  const editingTask = editor.mode === "edit" ? (tasks?.find((t) => t._id === editor.taskId) ?? null) : null;

  async function moveTask(taskId: string, status: TaskStatus) {
    const task = tasks?.find((t) => t._id === taskId);
    if (!task || task.status === status) return;
    try {
      await setStatus({ taskId: task._id, status });
      toast.success(`Moved to ${STATUS_LABELS[status]}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function saveTask(values: TaskFormValues) {
    if (editor.mode === "edit" && editingTask) {
      const { status, ...fields } = values;
      await updateTask({ taskId: editingTask._id, ...fields });
      if (status !== editingTask.status) await setStatus({ taskId: editingTask._id, status });
      toast.success("Task updated");
    } else {
      await createTask({ projectId, ...values });
      toast.success("Task created");
    }
    setEditor({ mode: "closed" });
  }

  async function depart(action: () => Promise<unknown>, message: string) {
    setDeparting(true);
    try {
      await action();
    } catch (error) {
      setDeparting(false);
      throw error;
    }
    toast.success(message);
    await navigate({ to: "/projects" });
  }

  if (departing || project === undefined) {
    return (
      <AppShell>
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
          <div className="mb-6 h-8 w-64 animate-pulse rounded bg-sunken" />
          <BoardSkeleton />
        </main>
      </AppShell>
    );
  }

  const isOwner = project.role === "owner";
  const columns = visibleColumns(search);

  return (
    <AppShell
      breadcrumb={
        <span className="flex items-center gap-2">
          <Link to="/projects" className="text-ink-soft hover:text-ink">
            Projects
          </Link>
          <span className="text-line-strong" aria-hidden="true">
            /
          </span>
          <span className="truncate">{project.name}</span>
        </span>
      }
    >
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="project-name">
              {project.name}
            </h1>
            {project.description ? <p className="mt-1 max-w-2xl text-sm text-ink-soft">{project.description}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <button type="button" className="btn-secondary" onClick={() => setSettingsOpen(true)}>
                <Settings className="size-4" aria-hidden="true" />
                Settings
              </button>
            ) : null}
            <button type="button" className="btn-primary" onClick={() => setEditor({ mode: "create", status: "todo" })}>
              <Plus className="size-4" aria-hidden="true" />
              New task
            </button>
          </div>
        </div>

        <div className="mb-4">
          <FilterBar
            search={search}
            members={project.members}
            taskCount={tasks?.length}
            onChange={(patch) => void navigate({ search: (prev) => applyFilterPatch(prev, patch), replace: true })}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          {tasks === undefined ? (
            <BoardSkeleton />
          ) : (
            <div
              className={columns.length === 1 ? "grid max-w-md gap-3" : "grid gap-3 md:grid-cols-2 xl:grid-cols-4"}
              data-testid="board"
            >
              {columns.map((status) => (
                <BoardColumn
                  key={status}
                  status={status}
                  tasks={grouped[status]}
                  membersById={membersById}
                  today={today}
                  onOpenTask={(task: Task) => setEditor({ mode: "edit", taskId: task._id })}
                  onMoveTask={(taskId, next) => void moveTask(taskId, next)}
                  onAddTask={(next) => setEditor({ mode: "create", status: next })}
                />
              ))}
            </div>
          )}
          <aside className="space-y-5">
            <MembersPanel
              members={project.members}
              currentUserId={project.currentUserId}
              isOwner={isOwner}
              onAdd={async (email) => {
                await addMember({ projectId, email });
                toast.success("Member added");
              }}
              onRemove={async (member) => {
                await removeMember({ projectId, userId: member.userId });
                toast.success(`${member.name} removed`);
              }}
              onLeave={() => depart(() => leaveProject({ projectId }), "You left the project")}
            />
            <ActivityFeed entries={activity} />
          </aside>
        </div>
      </main>

      <TaskDialog
        open={editor.mode === "create" || editingTask !== null}
        task={editingTask}
        defaultStatus={editor.mode === "create" ? editor.status : "todo"}
        members={project.members}
        onClose={() => setEditor({ mode: "closed" })}
        onSave={saveTask}
        onDelete={
          editingTask
            ? async () => {
                await removeTask({ taskId: editingTask._id });
                setEditor({ mode: "closed" });
                toast.success("Task deleted");
              }
            : undefined
        }
      />
      {isOwner ? (
        <ProjectSettingsDialog
          open={settingsOpen}
          project={{ name: project.name, description: project.description }}
          onClose={() => setSettingsOpen(false)}
          onSave={async (values) => {
            await updateProject({ projectId, ...values });
            setSettingsOpen(false);
            toast.success("Project updated");
          }}
          onDelete={(confirmName) => depart(() => removeProject({ projectId, confirmName }), "Project deleted")}
        />
      ) : null}
    </AppShell>
  );
}
