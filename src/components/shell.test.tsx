import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { convexState, resetConvex } from "~/test/convex-mock";
import { resetRouter, routerState } from "~/test/router-mock";

vi.mock("@tanstack/react-router", () => import("~/test/router-mock"));
vi.mock("convex/react", () => import("~/test/convex-mock"));
const signOut = vi.fn(async () => ({}));
vi.mock("~/lib/auth-client", () => ({ authClient: { signOut: () => signOut() } }));

const { AppShell } = await import("./AppShell");
const { AuthLayout } = await import("./AuthLayout");
const { DemoNotice } = await import("./DemoNotice");
const { BoardSkeleton, EmptyState, ErrorState, NotFoundState } = await import("./states");
const { ProjectCard } = await import("./projects/ProjectCard");
const { ProjectFormDialog } = await import("./projects/ProjectForm");
const { ConvexError } = await import("convex/values");

beforeEach(() => {
  resetRouter();
  resetConvex();
});

describe("AppShell", () => {
  it("shows the signed-in user, breadcrumb and running release, and signs out", async () => {
    convexState.results.set("auth:me", { _id: "u1", name: "Olivia Owner", email: "olivia@example.test" });
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { assign }, configurable: true });
    render(
      <AppShell breadcrumb={<span>Board</span>}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByTestId("current-user")).toHaveTextContent("Olivia Owner");
    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByTestId("release")).toHaveTextContent("test · release abc123");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("/sign-in");
  });

  it("does not query the profile before the session is applied", () => {
    convexState.authenticated = false;
    convexState.results.set("auth:me", { _id: "u1", name: "Hidden", email: "h@example.test" });
    render(<AppShell>x</AppShell>);
    expect(screen.queryByTestId("current-user")).not.toBeInTheDocument();
  });
});

describe("demo notice", () => {
  it("is hidden when email delivery works and explains that email is disabled otherwise", () => {
    const { rerender } = render(<DemoNotice />);
    expect(screen.queryByTestId("demo-notice")).not.toBeInTheDocument();
    routerState.context.config.emailDelivery = false;
    rerender(<DemoNotice />);
    expect(screen.getByTestId("demo-notice")).toHaveTextContent(
      "Email delivery is disabled, so verification and password reset emails are not sent.",
    );
    expect(screen.getByTestId("demo-notice")).toHaveTextContent("Sign in with a provided demo account.");
    expect(screen.getByTestId("demo-notice")).not.toHaveTextContent(/SES|Learner Lab/);
  });

  it("appears inside the auth layout", () => {
    routerState.context.config.emailDelivery = false;
    render(
      <AuthLayout title="Welcome" subtitle="Sub" footer={<span>foot</span>}>
        <p>form</p>
      </AuthLayout>,
    );
    expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByTestId("demo-notice")).toBeInTheDocument();
    expect(screen.getByText("foot")).toBeInTheDocument();
  });
});

describe("states", () => {
  it("renders empty, not-found, error and loading states", async () => {
    const reset = vi.fn();
    render(
      <>
        <EmptyState icon={<span />} title="Nothing" action={<button type="button">Act</button>}>
          Body
        </EmptyState>
        <ErrorState error={new Error("Boom")} reset={reset} info={undefined} />
        <BoardSkeleton />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Nothing" })).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalled();
    expect(screen.getByLabelText("Loading board")).toBeInTheDocument();
  });

  it("treats NOT_FOUND errors as a not-found page", () => {
    render(<ErrorState error={new ConvexError({ code: "NOT_FOUND", message: "x" })} reset={vi.fn()} info={undefined} />);
    expect(screen.getByRole("heading", { name: "We could not find that page" })).toBeInTheDocument();
    render(<NotFoundState />);
    expect(screen.getAllByRole("link", { name: "Back to projects" })).toHaveLength(2);
  });
});

describe("projects", () => {
  it("links each project card to its board and shows the role", () => {
    render(
      <>
        <ProjectCard project={{ _id: "p1" as never, name: "Mine", description: "", role: "owner", ownerName: "Me", createdAt: 1 }} />
        <ProjectCard project={{ _id: "p2" as never, name: "Theirs", description: "Desc", role: "member", ownerName: "Olivia", createdAt: 2 }} />
      </>,
    );
    expect(screen.getByRole("link", { name: /Mine/ })).toHaveAttribute("href", "/projects/p1");
    expect(screen.getByText("No description yet.")).toBeInTheDocument();
    expect(screen.getByText("Owned by Olivia")).toBeInTheDocument();
    expect(screen.getByText("Owned by you")).toBeInTheDocument();
  });

  it("submits the project form and shows errors", async () => {
    const onSubmit = vi
      .fn<(input: { name: string; description: string }) => Promise<void>>()
      .mockRejectedValueOnce(new Error("Project name cannot be blank."))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(<ProjectFormDialog open onClose={onClose} onSubmit={onSubmit} title="New project" submitLabel="Create project" />);
    await userEvent.type(screen.getByLabelText("Project name"), "Capstone");
    await userEvent.type(screen.getByLabelText("Description"), "Semester");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Project name cannot be blank.");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(onSubmit).toHaveBeenLastCalledWith({ name: "Capstone", description: "Semester" });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
