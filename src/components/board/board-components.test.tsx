import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeTask, member, owner } from "~/test/fixtures";
import { ActivityFeed } from "./ActivityFeed";
import { BoardColumn } from "./BoardColumn";
import { FilterBar } from "./FilterBar";
import { TASK_DRAG_TYPE, TaskCard } from "./TaskCard";

const members = new Map([
  [owner.userId as string, owner],
  [member.userId as string, member],
]);

function dataTransfer(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    types: Object.keys(store),
    setData: vi.fn((type: string, value: string) => {
      store[type] = value;
    }),
    getData: (type: string) => store[type] ?? "",
    dropEffect: "none",
    effectAllowed: "all",
  };
}

describe("TaskCard", () => {
  it("shows priority, due date and assignee, and opens on click", async () => {
    const task = makeTask({ title: "Ship it", description: "Details", priority: "urgent", dueDate: "2026-10-19", assigneeId: member.userId });
    const onOpen = vi.fn();
    render(
      <ul>
        <TaskCard task={task} assignee={member} today="2026-10-20" onOpen={onOpen} onMove={vi.fn()} />
      </ul>,
    );
    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByTestId("task-due")).toHaveTextContent("Overdue");
    expect(screen.getByRole("img", { name: member.name })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open task Ship it" }));
    expect(onOpen).toHaveBeenCalledWith(task);
  });

  it("changes status from the accessible select and starts a drag with the task id", async () => {
    const task = makeTask({ title: "Move me" });
    const onMove = vi.fn();
    render(
      <ul>
        <TaskCard task={task} assignee={undefined} today="2026-10-20" onOpen={vi.fn()} onMove={onMove} />
      </ul>,
    );
    expect(screen.getByRole("img", { name: "Unassigned" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Status of Move me"), "review");
    expect(onMove).toHaveBeenCalledWith(task, "review");
    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByTestId("task-card"), { dataTransfer: transfer });
    expect(transfer.setData).toHaveBeenCalledWith(TASK_DRAG_TYPE, task._id);
  });

  it("does not flag done tasks as overdue", () => {
    const task = makeTask({ status: "done", dueDate: "2026-01-01" });
    render(
      <ul>
        <TaskCard task={task} assignee={undefined} today="2026-10-20" onOpen={vi.fn()} onMove={vi.fn()} />
      </ul>,
    );
    expect(screen.getByTestId("task-due").className).toContain("text-ink-faint");
  });
});

describe("BoardColumn", () => {
  it("lists tasks, adds to the column and accepts dropped tasks", async () => {
    const onMoveTask = vi.fn();
    const onAddTask = vi.fn();
    const task = makeTask({ title: "In column", status: "in_progress" });
    render(
      <BoardColumn
        status="in_progress"
        tasks={[task]}
        membersById={members}
        today="2026-10-20"
        onOpenTask={vi.fn()}
        onMoveTask={onMoveTask}
        onAddTask={onAddTask}
      />,
    );
    const column = screen.getByRole("region", { name: /In progress/ });
    expect(within(column).getByText("1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add task to In progress" }));
    expect(onAddTask).toHaveBeenCalledWith("in_progress");

    const transfer = dataTransfer({ [TASK_DRAG_TYPE]: "t_dragged" });
    fireEvent.dragOver(column, { dataTransfer: transfer });
    expect(column.className).toContain("ring-accent");
    fireEvent.dragLeave(column, { dataTransfer: transfer, relatedTarget: document.body });
    expect(column.className).not.toContain("ring-accent/40");
    fireEvent.drop(column, { dataTransfer: transfer });
    expect(onMoveTask).toHaveBeenCalledWith("t_dragged", "in_progress");

    await userEvent.selectOptions(screen.getByLabelText("Status of In column"), "done");
    expect(onMoveTask).toHaveBeenCalledWith(task._id, "done");
  });

  it("ignores unrelated drags and shows an empty drop zone", () => {
    const onMoveTask = vi.fn();
    render(
      <BoardColumn status="done" tasks={[]} membersById={members} today="2026-10-20" onOpenTask={vi.fn()} onMoveTask={onMoveTask} onAddTask={vi.fn()} />,
    );
    const column = screen.getByRole("region", { name: /Done/ });
    expect(screen.getByText("Drop tasks here")).toBeInTheDocument();
    fireEvent.dragOver(column, { dataTransfer: dataTransfer({ "text/plain": "x" }) });
    expect(column.className).not.toContain("ring-accent/40");
    fireEvent.drop(column, { dataTransfer: dataTransfer({ "text/plain": "x" }) });
    expect(onMoveTask).not.toHaveBeenCalled();
  });
});

describe("FilterBar", () => {
  it("emits partial filter changes and clears", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<FilterBar search={{}} members={[owner, member]} taskCount={1} onChange={onChange} />);
    expect(screen.getByText("1 task")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "review");
    expect(onChange).toHaveBeenLastCalledWith({ status: "review" });
    await userEvent.selectOptions(screen.getByLabelText("Filter by priority"), "high");
    expect(onChange).toHaveBeenLastCalledWith({ priority: "high" });
    await userEvent.selectOptions(screen.getByLabelText("Filter by assignee"), member.name);
    expect(onChange).toHaveBeenLastCalledWith({ assignee: member.userId });

    rerender(<FilterBar search={{ status: "review", priority: "high" }} members={[owner, member]} taskCount={3} onChange={onChange} />);
    expect(screen.getByText("3 tasks match")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Filter by priority"), "");
    expect(onChange).toHaveBeenLastCalledWith({ priority: undefined });
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe("ActivityFeed", () => {
  it("renders loading, empty and populated states", () => {
    const { rerender } = render(<ActivityFeed entries={undefined} />);
    expect(screen.getByRole("heading", { name: "Activity" }).closest("section")?.querySelector("[aria-busy]")).toBeTruthy();
    rerender(<ActivityFeed entries={[]} />);
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
    rerender(
      <ActivityFeed
        entries={[
          { _id: "a1" as never, createdAt: Date.now(), actorName: "Olivia Owner", kind: "task_moved", summary: 'moved "X" from To do to Done', taskId: null },
        ]}
      />,
    );
    expect(screen.getByTestId("activity-feed")).toHaveTextContent('Olivia Owner moved "X" from To do to Done');
    expect(screen.getByText("just now")).toBeInTheDocument();
  });
});
