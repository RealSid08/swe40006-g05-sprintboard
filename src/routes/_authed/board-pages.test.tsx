import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexState, mutationMock, resetConvex } from "~/test/convex-mock";
import { makeTask, member, owner } from "~/test/fixtures";
import { resetRouter, routerState } from "~/test/router-mock";

vi.mock("@tanstack/react-router", () => import("~/test/router-mock"));
vi.mock("convex/react", () => import("~/test/convex-mock"));
vi.mock("~/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

type RouteLike = { options: { component: ComponentType } };
const Board = ((await import("./projects.$projectId")) as { Route: RouteLike }).Route.options.component;
const Projects = ((await import("./projects.index")) as { Route: RouteLike }).Route.options.component;
const { TASK_DRAG_TYPE } = await import("~/components/board/TaskCard");

const todo = makeTask({ title: "Plan sprint", status: "todo", priority: "high", assigneeId: member.userId });
const review = makeTask({ title: "Review PR", status: "review", priority: "low" });

function setBoard(role: "owner" | "member" = "owner") {
  routerState.params = { projectId: "p_1" };
  convexState.results.set("projects:get", {
    _id: "p_1",
    name: "Capstone",
    description: "Semester project",
    role,
    currentUserId: role === "owner" ? owner.userId : member.userId,
    members: [owner, member],
  });
  convexState.results.set("tasks:list", [todo, review]);
  convexState.results.set("activity:list", []);
}

beforeEach(() => {
  resetRouter();
  resetConvex();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("board page", () => {
  it("shows a skeleton while loading", () => {
    routerState.params = { projectId: "p_1" };
    render(<Board />);
    expect(screen.getAllByLabelText("Loading board").length).toBeGreaterThan(0);
  });

  it("renders four columns, members and owner controls", () => {
    setBoard();
    render(<Board />);
    expect(screen.getByTestId("project-name")).toHaveTextContent("Capstone");
    for (const name of ["To do", "In progress", "Review", "Done"]) {
      expect(screen.getByRole("region", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    expect(within(screen.getByTestId("column-todo")).getByText("Plan sprint")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
  });

  it("passes URL filters to the task query and updates them functionally", async () => {
    setBoard();
    routerState.search = { status: "review", assignee: member.userId };
    render(<Board />);
    expect(convexState.queryArgs.get("tasks:list")).toEqual({ projectId: "p_1", status: "review", assignee: member.userId });
    expect(within(screen.getByTestId("board")).getAllByRole("region")).toHaveLength(1);
    await userEvent.selectOptions(screen.getByLabelText("Filter by priority"), "low");
    const call = routerState.navigate.mock.calls.at(-1) as unknown as [{ search: (prev: object) => object; replace: boolean }];
    expect(call[0].replace).toBe(true);
    expect(call[0].search({ status: "review" })).toEqual({ status: "review", priority: "low" });
  });

  it("moves tasks by drag and drop and by the status control", async () => {
    setBoard();
    const setStatus = mutationMock("tasks:setStatus");
    render(<Board />);
    const transfer = { types: [TASK_DRAG_TYPE], getData: () => todo._id, dropEffect: "none" };
    fireEvent.drop(screen.getByTestId("column-in_progress"), { dataTransfer: transfer });
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith({ taskId: todo._id, status: "in_progress" }));
    expect(toast.success).toHaveBeenCalledWith("Moved to In progress");

    fireEvent.drop(screen.getByTestId("column-todo"), { dataTransfer: transfer });
    expect(setStatus).toHaveBeenCalledTimes(1);

    setStatus.mockRejectedValueOnce(new Error("Not allowed"));
    await userEvent.selectOptions(screen.getByLabelText("Status of Review PR"), "done");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not allowed"));
  });

  it("creates and edits tasks through the dialog", async () => {
    setBoard();
    const create = mutationMock("tasks:create");
    const update = mutationMock("tasks:update");
    const setStatus = mutationMock("tasks:setStatus");
    const remove = mutationMock("tasks:remove");
    render(<Board />);

    await userEvent.click(screen.getByRole("button", { name: "Add task to Review" }));
    await userEvent.type(screen.getByLabelText("Title"), "New one");
    await userEvent.click(screen.getByRole("button", { name: "Create task" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ projectId: "p_1", title: "New one", status: "review" })),
    );

    await userEvent.click(screen.getByRole("button", { name: "Open task Plan sprint" }));
    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Plan sprint 2");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "done");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ taskId: todo._id, title: "Plan sprint 2" })));
    expect(update.mock.calls[0]?.[0]).not.toHaveProperty("status");
    expect(setStatus).toHaveBeenCalledWith({ taskId: todo._id, status: "done" });

    await userEvent.click(screen.getByRole("button", { name: "Open task Review PR" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete task" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ taskId: review._id }));
    expect(toast.success).toHaveBeenCalledWith("Task deleted");
  });

  it("manages members and project settings", async () => {
    setBoard();
    const add = mutationMock("members:add");
    const removeMember = mutationMock("members:remove");
    const update = mutationMock("projects:update");
    const removeProject = mutationMock("projects:remove");
    render(<Board />);

    await userEvent.type(screen.getByLabelText("Teammate email"), "new@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(add).toHaveBeenCalledWith({ projectId: "p_1", email: "new@example.test" }));
    await userEvent.click(screen.getByRole("button", { name: `Remove ${member.name}` }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith({ projectId: "p_1", userId: member.userId }));

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ projectId: "p_1", name: "Capstone", description: "Semester project" }));

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    await userEvent.type(screen.getByLabelText("Type the project name to confirm deletion"), "Capstone");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(removeProject).toHaveBeenCalledWith({ projectId: "p_1", confirmName: "Capstone" }));
    expect(routerState.navigate).toHaveBeenCalledWith({ to: "/projects" });
  });

  it("lets a member leave, and recovers when leaving fails", async () => {
    setBoard("member");
    const leave = mutationMock("members:leave");
    leave.mockRejectedValueOnce(new Error("Network error"));
    render(<Board />);
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Leave project" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Network error"));
    expect(screen.getByTestId("project-name")).toHaveTextContent("Capstone");
    await userEvent.click(screen.getByRole("button", { name: "Leave project" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(routerState.navigate).toHaveBeenCalledWith({ to: "/projects" }));
    expect(toast.success).toHaveBeenCalledWith("You left the project");
  });
});

describe("projects page", () => {
  it("shows loading, empty and populated lists", () => {
    const { rerender } = render(<Projects />);
    expect(document.querySelector("[aria-busy=true]")).toBeTruthy();
    convexState.results.set("projects:list", []);
    rerender(<Projects />);
    expect(screen.getByRole("heading", { name: "No projects yet" })).toBeInTheDocument();
    convexState.results.set("projects:list", [
      { _id: "p1", name: "Capstone", description: "", role: "owner", ownerName: "Olivia", createdAt: 1 },
    ]);
    rerender(<Projects />);
    expect(screen.getByRole("link", { name: /Capstone/ })).toBeInTheDocument();
  });

  it("creates a project and opens its board", async () => {
    convexState.results.set("projects:list", []);
    const create = mutationMock("projects:create");
    create.mockResolvedValueOnce("p_new");
    render(<Projects />);
    await userEvent.click(screen.getByRole("button", { name: "Create your first project" }));
    await userEvent.type(screen.getByLabelText("Project name"), "Capstone");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: "Capstone", description: "" }));
    expect(routerState.navigate).toHaveBeenCalledWith({ to: "/projects/$projectId", params: { projectId: "p_new" } });
  });
});
