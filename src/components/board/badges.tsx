import clsx from "clsx";
import { ChevronsUp, ChevronUp, Equal, ChevronDown } from "lucide-react";
import { PRIORITY_LABELS, STATUS_LABELS, type TaskPriority, type TaskStatus } from "../../../convex/model/domain";

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-status-todo",
  in_progress: "bg-status-progress",
  review: "bg-status-review",
  done: "bg-status-done",
};

export function StatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  return <span className={clsx("inline-block size-2 rounded-full", STATUS_DOT[status], className)} aria-hidden="true" />;
}

export function StatusLabel({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot status={status} />
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<TaskPriority, { className: string; Icon: typeof ChevronUp }> = {
  urgent: { className: "bg-[#fdecea] text-[#b42318]", Icon: ChevronsUp },
  high: { className: "bg-[#fff1e6] text-[#b54708]", Icon: ChevronUp },
  medium: { className: "bg-[#e8f0fe] text-[#1d4ed8]", Icon: Equal },
  low: { className: "bg-sunken text-ink-soft", Icon: ChevronDown },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { className, Icon } = PRIORITY_STYLE[priority];
  return (
    <span className={clsx("chip", className)} data-priority={priority}>
      <Icon className="size-3" aria-hidden="true" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
