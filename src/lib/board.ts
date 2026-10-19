import { z } from "zod";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskStatus } from "../../convex/model/domain";

export type Task = Doc<"tasks">;

/** Board filters live in the URL so a filtered view can be shared and reloaded. */
export const boardSearchSchema = z.object({
  status: z.enum(TASK_STATUSES).optional().catch(undefined),
  priority: z.enum(TASK_PRIORITIES).optional().catch(undefined),
  assignee: z.string().min(1).optional().catch(undefined),
});
export type BoardSearch = z.infer<typeof boardSearchSchema>;

export function hasFilters(search: BoardSearch): boolean {
  return search.status !== undefined || search.priority !== undefined || search.assignee !== undefined;
}

/** Converts URL filters into query arguments, ignoring assignees who are not members. */
export function toQueryFilters(
  search: BoardSearch,
  memberIds: ReadonlySet<string>,
): {
  status?: TaskStatus;
  priority?: (typeof TASK_PRIORITIES)[number];
  assignee?: Id<"users"> | "unassigned";
} {
  const assignee =
    search.assignee === "unassigned"
      ? ("unassigned" as const)
      : search.assignee !== undefined && memberIds.has(search.assignee)
        ? (search.assignee as Id<"users">)
        : undefined;
  return {
    ...(search.status ? { status: search.status } : {}),
    ...(search.priority ? { priority: search.priority } : {}),
    ...(assignee ? { assignee } : {}),
  };
}

export function groupByStatus(tasks: readonly Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], review: [], done: [] };
  for (const task of tasks) groups[task.status].push(task);
  return groups;
}

export function visibleColumns(search: BoardSearch): readonly TaskStatus[] {
  return search.status ? [search.status] : TASK_STATUSES;
}

/** Optimistic view of a status change for one cached board query (respecting its status filter). */
export function moveTaskInList(
  tasks: readonly Task[],
  taskId: Id<"tasks">,
  status: TaskStatus,
  statusFilter: TaskStatus | undefined,
): Task[] {
  const moved = tasks.map((task) => (task._id === taskId ? { ...task, status } : task));
  return statusFilter === undefined ? moved : moved.filter((task) => task.status === statusFilter);
}

/** Applies a filter change to the current URL search, dropping cleared keys. */
export function applyFilterPatch(current: BoardSearch, patch: Partial<BoardSearch> | null): BoardSearch {
  if (patch === null) return {};
  const next: BoardSearch = { ...current, ...patch };
  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) as BoardSearch;
}
