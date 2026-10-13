import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { makeTask, member, owner } from "~/test/fixtures";
import { MembersPanel } from "./MembersPanel";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
import { TaskDialog } from "./TaskDialog";

describe("TaskDialog", () => {
  it("creates a task with every field", async () => {
    const onSave = vi.fn(async () => undefined);
    render(<TaskDialog open task={null} defaultStatus="review" members={[owner, member]} onClose={vi.fn()} onSave={onSave} />);
    expect(screen.getByRole("heading", { name: "New task" })).toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Create task" });
    expect(create).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Title"), "Write tests");
    await userEvent.type(screen.getByLabelText("Description"), "Cover the board");
    await userEvent.selectOptions(screen.getByLabelText("Priority"), "urgent");
    await userEvent.selectOptions(screen.getByLabelText("Assignee"), member.name);
    await userEvent.type(screen.getByLabelText("Due date"), "2026-10-22");
    await userEvent.click(create);
    expect(onSave).toHaveBeenCalledWith({
      title: "Write tests",
      description: "Cover the board",
      status: "review",
      priority: "urgent",
      dueDate: "2026-10-22",
      assigneeId: member.userId,
    });
  });

  it("edits an existing task, shows save errors and confirms deletion", async () => {
    const task = makeTask({ title: "Existing", status: "todo", assigneeId: member.userId, dueDate: "2026-10-30" });
    const onSave = vi.fn(async () => {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Due date must be a real date." });
    });
    const onDelete = vi.fn(async () => undefined);
    render(<TaskDialog open task={task} defaultStatus="todo" members={[owner, member]} onClose={vi.fn()} onSave={onSave} onDelete={onDelete} />);
    await userEvent.selectOptions(screen.getByLabelText("Status"), "done");
    await userEvent.selectOptions(screen.getByLabelText("Assignee"), "");
    await userEvent.clear(screen.getByLabelText("Due date"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Due date must be a real date.");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status: "done", assigneeId: null, dueDate: null }));

    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("closes from the cancel button", async () => {
    const onClose = vi.fn();
    render(<TaskDialog open task={null} defaultStatus="todo" members={[]} onClose={onClose} onSave={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("MembersPanel", () => {
  it("lets the owner add and remove members", async () => {
    const onAdd = vi.fn(async () => undefined);
    const onRemove = vi.fn(async () => undefined);
    render(<MembersPanel members={[owner, member]} currentUserId={owner.userId} isOwner onAdd={onAdd} onRemove={onRemove} onLeave={vi.fn()} />);
    expect(screen.getAllByTestId("member-row")).toHaveLength(2);
    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Remove ${owner.name}` })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Teammate email"), "new@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("new@example.test");
    await waitFor(() => expect(screen.getByLabelText("Teammate email")).toHaveValue(""));

    await userEvent.click(screen.getByRole("button", { name: `Remove ${member.name}` }));
    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    await userEvent.click(screen.getByRole("button", { name: `Remove ${member.name}` }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith(member);
  });

  it("shows add failures", async () => {
    const onAdd = vi.fn(async () => {
      throw new ConvexError({ code: "NOT_FOUND", message: "No SprintBoard account uses that email." });
    });
    render(<MembersPanel members={[owner]} currentUserId={owner.userId} isOwner onAdd={onAdd} onRemove={vi.fn()} onLeave={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Teammate email"), "ghost@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No SprintBoard account");
  });

  it("lets a member leave after confirming", async () => {
    const onLeave = vi.fn(async () => undefined);
    render(<MembersPanel members={[owner, member]} currentUserId={member.userId} isOwner={false} onAdd={vi.fn()} onRemove={vi.fn()} onLeave={onLeave} />);
    expect(screen.queryByLabelText("Teammate email")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Leave project" }));
    await userEvent.click(screen.getByRole("button", { name: "Stay" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave project" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onLeave).toHaveBeenCalled();
  });
});

describe("ProjectSettingsDialog", () => {
  it("saves renamed settings", async () => {
    const onSave = vi.fn(async () => undefined);
    render(<ProjectSettingsDialog open project={{ name: "Capstone", description: "Old" }} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} />);
    const name = screen.getByLabelText("Project name");
    await userEvent.clear(name);
    await userEvent.type(name, "Capstone 2");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(onSave).toHaveBeenCalledWith({ name: "Capstone 2", description: "Old" });
  });

  it("deletes only after the exact project name is typed", async () => {
    const onDelete = vi.fn(async () => undefined);
    render(<ProjectSettingsDialog open project={{ name: "Capstone", description: "" }} onClose={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />);
    const remove = screen.getByRole("button", { name: "Delete" });
    expect(remove).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Type the project name to confirm deletion"), "Capston");
    expect(remove).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Type the project name to confirm deletion"), "e");
    await userEvent.click(remove);
    expect(onDelete).toHaveBeenCalledWith("Capstone");
  });

  it("reports failures and cancels", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn(async () => {
      throw new Error("Only the owner can do that.");
    });
    render(<ProjectSettingsDialog open project={{ name: "P", description: "" }} onClose={onClose} onSave={onSave} onDelete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the owner can do that.");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
