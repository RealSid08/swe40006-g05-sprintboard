import { expect, test } from "@playwright/test";

test("landing page shows the product and the running release", async ({ page, request }) => {
  const health = await (await request.get("/api/health")).json();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Plan every sprint together");
  await expect(page.getByTestId("release")).toContainText(`release ${health.release}`);
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
});

test("anonymous visitors are redirected from protected pages to sign in", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/sign-in\?redirect=/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("wrong credentials are rejected with a clear message", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});

test("health and readiness endpoints answer without caching", async ({ request }) => {
  const ready = await request.get("/api/ready");
  expect(ready.status()).toBe(200);
  expect(ready.headers()["cache-control"]).toContain("no-store");
  expect((await ready.json()).backend.mode).toBe("read");
});
