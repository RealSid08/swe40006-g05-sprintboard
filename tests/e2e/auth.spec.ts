import { expect, test } from "@playwright/test";
import { latestEmailLink, newAccount } from "../support/accounts";
import { target, verifiedAccount } from "./fixtures";

test("a new user signs up, verifies by email link and lands on an empty project list", async ({ page }) => {
  const account = newAccount("signup");
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();

  // Signing in before verification is refused.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Verify your email");

  const link = await latestEmailLink(target, account.email, "verify_email");
  expect(new URL(link).origin).toBe(new URL(target.siteUrl).origin);
  await page.goto(link);
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByTestId("current-user")).toHaveText(account.name);
  await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/sign-in\?redirect=/);
});

test("forgotten password can be reset from the emailed link", async ({ page }) => {
  const account = await verifiedAccount("forgot");
  const requestedAt = Date.now() - 1000;
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(account.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  const link = await latestEmailLink(target, account.email, "reset_password", { after: requestedAt });
  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  const newPassword = `${account.password}-reset`;
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/sign-in\?notice=password-reset/);

  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/projects$/);
});
