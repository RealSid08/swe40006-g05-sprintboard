import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "../../../convex/model/domain";
import type { Task } from "~/lib/board";
import { dueState, formatDue } from "~/lib/format";
import { Avatar } from "../ui";
import { PriorityBadge } from "./badges";
import type { Member } from "./types";

export const TASK_DRAG_TYPE = "text/sprintboard-task";

const DUE_STYLE = {
  overdue: "text-danger font-medium",
  today: "text-[#b54708] font-medium",
  soon: "text-ink-soft",
  later: "text-ink-faint",
} as const;

export function TaskCard({
  task,
  assignee,
  today,
  onOpen,
  onMove,
}: {
  task: Task;
  assignee: Member | undefined;
  today: string;
  onOpen: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => void;
}) {
  const due = task.dueDate !== null && task.status !== "done" ? dueState(task.dueDate, today) : null;
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(TASK_DRAG_TYPE, task._id);
        event.dataTransfer.effectAllowed = "move";
      }}
      data-testid="task-card"
      data-task-title={task.title}
      data-status={task.status}
      className={clsx(
        "group cursor-grab rounded-xl border border-line bg-surface shadow-card transition-all",
        "hover:-translate-y-px hover:border-line-strong hover:shadow-lift active:cursor-grabbing",
        task.status === "done" && "opacity-80",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        aria-label={`Open task ${task.title}`}
        className="block w-full rounded-t-xl px-3 pt-3 pb-2 text-left"
      >
        <h3
          className={clsx(
            "text-sm leading-snug font-medium text-ink",
            task.status === "done" && "text-ink-soft line-through decoration-ink-faint/60",
          )}
        >
          {task.title}
        </h3>
        {task.description ? <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{task.description}</p> : null}
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
          <PriorityBadge priority={task.priority} />
          {task.dueDate !== null ? (
            <span
              className={clsx("inline-flex items-center gap-1 truncate text-[11px]", due ? DUE_STYLE[due] : "text-ink-faint")}
              data-testid="task-due"
            >
              <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
              {formatDue(task.dueDate, today)}
            </span>
          ) : null}
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-line/70 px-3 py-1.5">
        <select
          aria-label={`Status of ${task.title}`}
          className="-ml-1 h-7 cursor-pointer rounded-md bg-transparent px-1 text-[11px] font-medium text-ink-soft hover:bg-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          value={task.status}
          onChange={(event) => onMove(task, event.target.value as TaskStatus)}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        {assignee ? (
          <Avatar name={assignee.name} seed={assignee.userId} size="sm" />
        ) : (
          <span
            className="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-line-strong text-[10px] text-ink-faint"
            title="Unassigned"
            aria-label="Unassigned"
            role="img"
          >
            ?
          </span>
        )}
      </div>
    </li>
  );
}
