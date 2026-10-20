import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRouter, routerState } from "~/test/router-mock";

vi.mock("@tanstack/react-router", () => import("~/test/router-mock"));
const auth = {
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  sendVerificationEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
};
vi.mock("~/lib/auth-client", () => ({ authClient: auth }));

type RouteLike = { options: { component: ComponentType; beforeLoad?: (opts: unknown) => unknown } };
const page = async (path: string) => ((await import(path)) as { Route: RouteLike }).Route;
const SignIn = await page("./sign-in");
const SignUp = await page("./sign-up");
const Verify = await page("./verify-email");
const Forgot = await page("./forgot-password");
const Reset = await page("./reset-password");
const Landing = await page("./index");
const Authed = await page("./_authed");

const assign = vi.fn();
Object.defineProperty(window, "location", { value: { assign }, configurable: true });

function renderPage(route: RouteLike) {
  const Component = route.options.component;
  return render(<Component />);
}

beforeEach(() => {
  resetRouter();
  assign.mockReset();
  for (const fn of [auth.signIn.email, auth.signUp.email, auth.sendVerificationEmail, auth.requestPasswordReset, auth.resetPassword]) {
    fn.mockReset();
    fn.mockResolvedValue({ error: null });
  }
});

describe("route guards", () => {
  it("redirects signed-in users away from auth pages and anonymous users to sign in", () => {
    expect(() => SignIn.options.beforeLoad?.({ context: { isAuthenticated: true }, search: { redirect: "/projects/p1" } })).toThrow();
    expect(SignIn.options.beforeLoad?.({ context: { isAuthenticated: false }, search: {} })).toBeUndefined();
    expect(() => SignUp.options.beforeLoad?.({ context: { isAuthenticated: true } })).toThrow();
    expect(() => Landing.options.beforeLoad?.({ context: { isAuthenticated: true } })).toThrow();
    let thrown: unknown;
    try {
      Authed.options.beforeLoad?.({ context: { isAuthenticated: false }, location: { href: "/projects/p1" } });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toEqual({ isRedirect: true, options: { to: "/sign-in", search: { redirect: "/projects/p1" } } });
    expect(Authed.options.beforeLoad?.({ context: { isAuthenticated: true }, location: { href: "/" } })).toBeUndefined();
  });
});

const signUpLinks = () => screen.queryAllByRole("link").filter((link) => link.getAttribute("href") === "/sign-up");

describe("landing", () => {
  it("offers sign-up when email delivery works", () => {
    renderPage(Landing);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Plan the sprint");
    expect(screen.queryByTestId("demo-notice")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/sign-up");
  });

  it("sends visitors to sign in instead of sign-up when email is disabled", () => {
    routerState.context.config.emailDelivery = false;
    renderPage(Landing);
    expect(screen.getByTestId("demo-notice")).toBeInTheDocument();
    expect(signUpLinks()).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Sign in with a demo account" })).toHaveAttribute("href", "/sign-in");
  });
});

describe("without email delivery", () => {
  beforeEach(() => {
    routerState.context.config.emailDelivery = false;
  });

  it("closes sign-up and points to sign in", () => {
    renderPage(SignUp);
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("hides sign-up and recovery links on sign in and still rejects unverified accounts", async () => {
    auth.signIn.email.mockResolvedValueOnce({ error: { code: "EMAIL_NOT_VERIFIED", message: "x" } });
    renderPage(SignIn);
    expect(signUpLinks()).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Forgot password?" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), "a@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not verified");
    expect(screen.queryByRole("link", { name: "Open verification help" })).not.toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not offer to send reset or verification emails", () => {
    const { unmount } = renderPage(Forgot);
    expect(screen.queryByRole("button", { name: "Send reset link" })).not.toBeInTheDocument();
    unmount();
    routerState.search = { email: "ada@example.test" };
    renderPage(Verify);
    expect(screen.queryByRole("button", { name: "Resend verification email" })).not.toBeInTheDocument();
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
    expect(auth.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("sign in", () => {
  it("signs in and follows a safe redirect", async () => {
    routerState.search = { redirect: "/projects/p1", notice: "verified" };
    renderPage(SignIn);
    expect(screen.getByRole("status")).toHaveTextContent("Email verified");
    await userEvent.type(screen.getByLabelText("Email"), "a@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.signIn.email).toHaveBeenCalledWith({ email: "a@example.test", password: "password123" });
    expect(assign).toHaveBeenCalledWith("/projects/p1");
  });

  it("explains unverified accounts and wrong passwords", async () => {
    auth.signIn.email.mockResolvedValueOnce({ error: { code: "EMAIL_NOT_VERIFIED", message: "x" } });
    renderPage(SignIn);
    await userEvent.type(screen.getByLabelText("Email"), "a@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Verify your email");
    expect(screen.getByRole("link", { name: "Open verification help" })).toHaveAttribute("href", "/verify-email?email=a%40example.test");

    auth.signIn.email.mockResolvedValueOnce({ error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" } });
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("sign up", () => {
  it("creates an account and sends the user to verification", async () => {
    renderPage(SignUp);
    await userEvent.type(screen.getByLabelText("Full name"), " Ada ");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Password"), "-enough");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(auth.signUp.email).toHaveBeenCalledWith({ name: "Ada", email: "ada@example.test", password: "short-enough", callbackURL: "/projects" });
    expect(routerState.navigate).toHaveBeenCalledWith({ to: "/verify-email", search: { email: "ada@example.test" } });
  });

  it("shows sign-up errors", async () => {
    auth.signUp.email.mockResolvedValueOnce({ error: { message: "User already exists" } });
    renderPage(SignUp);
    await userEvent.type(screen.getByLabelText("Full name"), "Ada");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("User already exists");
  });
});

describe("verify email", () => {
  it("resends the verification link", async () => {
    routerState.search = { email: "ada@example.test" };
    renderPage(Verify);
    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    expect(auth.sendVerificationEmail).toHaveBeenCalledWith({ email: "ada@example.test", callbackURL: "/projects" });
    expect(await screen.findByRole("button", { name: "Verification email sent" })).toBeDisabled();
  });

  it("explains expired links and send failures", async () => {
    routerState.search = { email: "ada@example.test", error: "TOKEN_EXPIRED" };
    auth.sendVerificationEmail.mockResolvedValueOnce({ error: { message: "Too many requests" } });
    renderPage(Verify);
    expect(screen.getByRole("alert")).toHaveTextContent("invalid or has expired");
    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
  });
});

describe("password reset", () => {
  it("requests a reset link", async () => {
    renderPage(Forgot);
    await userEvent.type(screen.getByLabelText("Email"), " ada@example.test ");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(auth.requestPasswordReset).toHaveBeenCalledWith({ email: "ada@example.test", redirectTo: "/reset-password" });
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("shows request failures", async () => {
    auth.requestPasswordReset.mockResolvedValueOnce({ error: { message: "Rate limited" } });
    renderPage(Forgot);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Rate limited");
  });

  it("sets a new password from a valid link", async () => {
    routerState.search = { token: "tok" };
    renderPage(Reset);
    await userEvent.type(screen.getByLabelText("New password"), "new-password");
    await userEvent.type(screen.getByLabelText("Confirm password"), "new-passwor");
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Confirm password"), "d");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(auth.resetPassword).toHaveBeenCalledWith({ newPassword: "new-password", token: "tok" });
    expect(assign).toHaveBeenCalledWith("/sign-in?notice=password-reset");
  });

  it("handles rejected and missing tokens", async () => {
    routerState.search = { token: "used" };
    auth.resetPassword.mockResolvedValueOnce({ error: { message: "Invalid token" } });
    const { unmount } = renderPage(Reset);
    await userEvent.type(screen.getByLabelText("New password"), "new-password");
    await userEvent.type(screen.getByLabelText("Confirm password"), "new-password");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid token");
    unmount();
    routerState.search = { error: "INVALID_TOKEN" };
    renderPage(Reset);
    expect(screen.getByRole("heading", { name: "Link expired" })).toBeInTheDocument();
  });
});
