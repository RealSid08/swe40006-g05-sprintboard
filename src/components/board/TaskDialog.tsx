import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  LIMITS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "../../../convex/model/domain";
import type { Task } from "~/lib/board";
import { errorMessage } from "~/lib/errors";
import { Field, FormError, Modal, Spinner } from "../ui";
import type { Member } from "./types";

export type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: Id<"users"> | null;
};

type Props = {
  open: boolean;
  task: Task | null;
  defaultStatus: TaskStatus;
  members: readonly Member[];
  onClose: () => void;
  onSave: (values: TaskFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function TaskDialog(props: Props) {
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.task ? "Edit task" : "New task"}
      size="lg"
    >
      {props.open ? <TaskForm key={props.task?._id ?? "new"} {...props} /> : null}
    </Modal>
  );
}

function initialValues(task: Task | null, defaultStatus: TaskStatus): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? "medium",
    dueDate: task?.dueDate ?? null,
    assigneeId: task?.assigneeId ?? null,
  };
}

function TaskForm({ task, defaultStatus, members, onClose, onSave, onDelete }: Props) {
  const [values, setValues] = useState(() => initialValues(task, defaultStatus));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleMissing = values.title.trim().length === 0;

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function run(kind: "save" | "delete", action: () => Promise<void>) {
    setPending(kind);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(errorMessage(actionError));
      setPending(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (titleMissing) return;
    void run("save", () => onSave(values));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      <Field label="Title" htmlFor="task-title">
        <input
          id="task-title"
          className="input"
          maxLength={LIMITS.taskTitle}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          autoFocus
          required
        />
      </Field>
      <Field label="Description" htmlFor="task-description">
        <textarea
          id="task-description"
          className="input"
          rows={4}
          maxLength={LIMITS.taskDescription}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Add details, acceptance criteria or links"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="task-status">
          <select
            id="task-status"
            className="input"
            value={values.status}
            onChange={(e) => set("status", e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <select
            id="task-priority"
            className="input"
            value={values.priority}
            onChange={(e) => set("priority", e.target.value as TaskPriority)}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assignee" htmlFor="task-assignee">
          <select
            id="task-assignee"
            className="input"
            value={values.assigneeId ?? ""}
            onChange={(e) => set("assigneeId", e.target.value ? (e.target.value as Id<"users">) : null)}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date" htmlFor="task-due">
          <input
            id="task-due"
            type="date"
            className="input"
            value={values.dueDate ?? ""}
            onChange={(e) => set("dueDate", e.target.value || null)}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
        <div>
          {onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-soft">Delete this task?</span>
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  disabled={pending !== null}
                  onClick={() => void run("delete", onDelete)}
                >
                  {pending === "delete" ? <Spinner /> : null}
                  Delete
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Delete task
              </button>
            )
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending !== null || titleMissing}>
            {pending === "save" ? <Spinner /> : null}
            {task ? "Save changes" : "Create task"}
          </button>
        </div>
      </div>
    </form>
  );
}
