import clsx from "clsx";
import { Plus } from "lucide-react";
import { useState } from "react";
import { STATUS_LABELS, type TaskStatus } from "../../../convex/model/domain";
import type { Task } from "~/lib/board";
import { StatusDot } from "./badges";
import { TASK_DRAG_TYPE, TaskCard } from "./TaskCard";
import type { Member } from "./types";

export function BoardColumn({
  status,
  tasks,
  membersById,
  today,
  onOpenTask,
  onMoveTask,
  onAddTask,
}: {
  status: TaskStatus;
  tasks: Task[];
  membersById: ReadonlyMap<string, Member>;
  today: string;
  onOpenTask: (task: Task) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const headingId = `column-${status}`;
  return (
    <section
      aria-labelledby={headingId}
      data-testid={`column-${status}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(TASK_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE);
        if (taskId) onMoveTask(taskId, status);
      }}
      className={clsx(
        "flex min-h-48 flex-col rounded-2xl bg-sunken/70 p-2.5 ring-2 ring-transparent transition-colors",
        dragOver && "bg-accent-soft/70 ring-accent/40",
      )}
    >
      <header className="flex items-center justify-between px-1.5 pt-1 pb-2.5">
        <h2 id={headingId} className="flex items-center gap-2 text-[13px] font-semibold">
          <StatusDot status={status} />
          {STATUS_LABELS[status]}
          <span className="rounded-full bg-surface px-1.5 text-[11px] font-medium text-ink-soft tabular-nums">
            {tasks.length}
          </span>
        </h2>
        <button
          type="button"
          className="icon-btn size-7"
          onClick={() => onAddTask(status)}
          aria-label={`Add task to ${STATUS_LABELS[status]}`}
        >
          <Plus className="size-4" />
        </button>
      </header>
      {tasks.length === 0 ? (
        <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line-strong/70 px-3 py-8 text-center text-xs text-ink-faint">
          Drop tasks here
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              assignee={task.assigneeId ? membersById.get(task.assigneeId) : undefined}
              today={today}
              onOpen={onOpenTask}
              onMove={(moved, next) => onMoveTask(moved._id, next)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
