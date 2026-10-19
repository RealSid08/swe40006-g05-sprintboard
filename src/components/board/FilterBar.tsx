import { SlidersHorizontal, X } from "lucide-react";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "../../../convex/model/domain";
import { hasFilters, type BoardSearch } from "~/lib/board";
import type { Member } from "./types";

export function FilterBar({
  search,
  members,
  taskCount,
  onChange,
}: {
  search: BoardSearch;
  members: readonly Member[];
  taskCount: number | undefined;
  /** A partial update merged into the current URL filters, or null to clear them all. */
  onChange: (patch: Partial<BoardSearch> | null) => void;
}) {
  const active = hasFilters(search);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Board filters">
      <span className="mr-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filter
      </span>
      <select
        aria-label="Filter by status"
        className="input h-8 w-auto min-w-32 text-[13px]"
        value={search.status ?? ""}
        onChange={(e) => onChange({ status: (e.target.value || undefined) as BoardSearch["status"] })}
      >
        <option value="">All statuses</option>
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by priority"
        className="input h-8 w-auto min-w-32 text-[13px]"
        value={search.priority ?? ""}
        onChange={(e) =>
          onChange({ priority: (e.target.value || undefined) as BoardSearch["priority"] })
        }
      >
        <option value="">All priorities</option>
        {TASK_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by assignee"
        className="input h-8 w-auto min-w-36 text-[13px]"
        value={search.assignee ?? ""}
        onChange={(e) => onChange({ assignee: e.target.value || undefined })}
      >
        <option value="">Everyone</option>
        <option value="unassigned">Unassigned</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </select>
      {active ? (
        <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)}>
          <X className="size-3.5" aria-hidden="true" />
          Clear
        </button>
      ) : null}
      {taskCount !== undefined ? (
        <span className="ml-auto text-[13px] text-ink-faint tabular-nums" aria-live="polite">
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
          {active ? " match" : ""}
        </span>
      ) : null}
    </div>
  );
}
