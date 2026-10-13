import { expect, test, type Page } from "@playwright/test";
import { capture, signInThroughUi, verifiedAccount } from "./fixtures";

function card(page: Page, title: string) {
  return page.getByTestId("task-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

test("owner and member collaborate on a shared board", async ({ browser, page }, testInfo) => {
  const [owner, member, outsider] = await Promise.all([
    verifiedAccount("owner"),
    verifiedAccount("member"),
    verifiedAccount("outsider"),
  ]);
  const projectName = `Acceptance ${testInfo.retry}-${Date.now().toString(36)}`;

  await test.step("owner creates a project", async () => {
    await signInThroughUi(page, owner);
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByLabel("Description").fill("Created by the Playwright acceptance suite");
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/);
    await expect(page.getByTestId("project-name")).toHaveText(projectName);
    for (const column of ["To do", "In progress", "Review", "Done"]) {
      await expect(page.getByRole("region", { name: new RegExp(`^${column}`) })).toBeVisible();
    }
  });
  const boardUrl = page.url();

  await test.step("owner adds a registered member and unknown emails are rejected", async () => {
    const panel = page.getByTestId("members-panel");
    await panel.getByLabel("Teammate email").fill("not-registered@example.test");
    await panel.getByRole("button", { name: "Add" }).click();
    await expect(panel.getByRole("alert")).toContainText("No SprintBoard account");
    await panel.getByLabel("Teammate email").fill(member.email);
    await panel.getByRole("button", { name: "Add" }).click();
    await expect(panel.getByTestId("member-row")).toHaveCount(2);
    await expect(panel).toContainText(member.name);
  });

  await test.step("owner creates a task with priority, due date and assignee", async () => {
    await page.getByRole("button", { name: "New task" }).click();
    const dialog = page.getByRole("dialog", { name: "New task" });
    await dialog.getByLabel("Title").fill("Prepare staging release");
    await dialog.getByLabel("Description").fill("Check the release checklist");
    await dialog.getByLabel("Priority").selectOption("high");
    await dialog.getByLabel("Assignee").selectOption({ label: member.name });
    await dialog.getByLabel("Due date").fill("2030-01-15");
    await dialog.getByRole("button", { name: "Create task" }).click();
    await expect(dialog).toBeHidden();
    const created = card(page, "Prepare staging release");
    await expect(created).toHaveAttribute("data-status", "todo");
    await expect(created.locator("[data-priority=high]")).toBeVisible();
    await expect(created.getByRole("img", { name: member.name })).toBeVisible();
    await expect(created.getByTestId("task-due")).toContainText("15 Jan");

    await page.getByRole("button", { name: "Add task to Review" }).click();
    const second = page.getByRole("dialog", { name: "New task" });
    await second.getByLabel("Title").fill("Low priority tidy-up");
    await second.getByLabel("Priority").selectOption("low");
    await second.getByRole("button", { name: "Create task" }).click();
    await expect(card(page, "Low priority tidy-up")).toHaveAttribute("data-status", "review");
  });

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await test.step("member sees the board and receives live updates", async () => {
    await signInThroughUi(memberPage, member);
    await expect(memberPage.getByRole("link", { name: new RegExp(projectName) })).toBeVisible();
    await memberPage.goto(boardUrl);
    await expect(card(memberPage, "Prepare staging release")).toBeVisible();
    await expect(memberPage.getByRole("button", { name: "Settings" })).toHaveCount(0);
  });

  await test.step("drag and drop moves a task between columns for everyone", async () => {
    await card(page, "Prepare staging release").dragTo(page.getByTestId("column-in_progress"));
    await expect(card(page, "Prepare staging release")).toHaveAttribute("data-status", "in_progress");
    await expect(card(memberPage, "Prepare staging release")).toHaveAttribute("data-status", "in_progress");
  });

  await test.step("member changes status with the keyboard-accessible control", async () => {
    await memberPage.getByLabel("Status of Prepare staging release").selectOption("done");
    await expect(card(memberPage, "Prepare staging release")).toHaveAttribute("data-status", "done");
    await expect(card(page, "Prepare staging release")).toHaveAttribute("data-status", "done");
  });

  await test.step("filters narrow the board and live in the URL", async () => {
    await page.getByLabel("Filter by priority").selectOption("low");
    await expect(page).toHaveURL(/priority=low/);
    await expect(page.getByTestId("task-card")).toHaveCount(1);
    await expect(card(page, "Low priority tidy-up")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("task-card")).toHaveCount(1);
    await page.getByLabel("Filter by assignee").selectOption({ label: member.name });
    await expect(page.getByTestId("task-card")).toHaveCount(0);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByRole("button", { name: "Clear" })).toBeHidden();
    await page.getByLabel("Filter by status").selectOption("done");
    await expect(page.getByTestId("task-card")).toHaveCount(1);
    await expect(page.getByTestId("board").getByRole("region")).toHaveCount(1);
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByTestId("task-card")).toHaveCount(2);
  });

  await test.step("activity records who changed what", async () => {
    const feed = page.getByTestId("activity-feed");
    await expect(feed).toContainText(`added ${member.name} to the project`);
    await expect(feed).toContainText('moved "Prepare staging release" from To do to In progress');
    await expect(feed).toContainText(`${member.name} moved "Prepare staging release" from In progress to Done`);
    await capture(page, testInfo, "board-owner");
  });

  await test.step("owner edits and deletes a task", async () => {
    await page.getByRole("button", { name: "Open task Low priority tidy-up" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit task" });
    await dialog.getByLabel("Title").fill("Tidy-up renamed");
    await dialog.getByLabel("Priority").selectOption("urgent");
    await dialog.getByLabel("Status").selectOption("in_progress");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(card(page, "Tidy-up renamed")).toHaveAttribute("data-status", "in_progress");
    await expect(card(memberPage, "Tidy-up renamed").locator("[data-priority=urgent]")).toBeVisible();

    await page.getByRole("button", { name: "Open task Tidy-up renamed" }).click();
    const edit = page.getByRole("dialog", { name: "Edit task" });
    await edit.getByRole("button", { name: "Delete task" }).click();
    await edit.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(card(page, "Tidy-up renamed")).toHaveCount(0);
    await expect(card(memberPage, "Tidy-up renamed")).toHaveCount(0);
  });

  await test.step("non-members cannot open the board", async () => {
    const outsiderContext = await browser.newContext();
    const outsiderPage = await outsiderContext.newPage();
    await signInThroughUi(outsiderPage, outsider);
    await outsiderPage.goto(boardUrl);
    await expect(outsiderPage.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
    await outsiderContext.close();
  });

  await test.step("owner renames the project in settings", async () => {
    await page.getByRole("button", { name: "Settings" }).click();
    const settings = page.getByRole("dialog", { name: "Project settings" });
    await settings.getByLabel("Project name", { exact: true }).fill(`${projectName} renamed`);
    await settings.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByTestId("project-name")).toHaveText(`${projectName} renamed`);
    await expect(memberPage.getByTestId("project-name")).toHaveText(`${projectName} renamed`);
  });

  await test.step("owner removes the member, who loses access", async () => {
    await page.getByRole("button", { name: `Remove ${member.name}` }).click();
    await page.getByTestId("members-panel").getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByTestId("member-row")).toHaveCount(1);
    await expect(card(page, "Prepare staging release").getByRole("img", { name: "Unassigned" })).toBeVisible();
    await memberPage.goto("/projects");
    await expect(memberPage.getByRole("heading", { name: "No projects yet" })).toBeVisible();
    await memberContext.close();
  });

  await test.step("owner deletes the project after typing its name", async () => {
    await page.getByRole("button", { name: "Settings" }).click();
    const settings = page.getByRole("dialog", { name: "Project settings" });
    const confirm = settings.getByLabel("Type the project name to confirm deletion");
    const remove = settings.getByRole("button", { name: "Delete", exact: true });
    await confirm.fill("wrong name");
    await expect(remove).toBeDisabled();
    await confirm.fill(`${projectName} renamed`);
    await remove.click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  });
});

test("a member can leave a project", async ({ browser, page }) => {
  const [owner, member] = await Promise.all([verifiedAccount("leave-owner"), verifiedAccount("leave-member")]);
  await signInThroughUi(page, owner);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Leave test");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByTestId("members-panel").getByLabel("Teammate email").fill(member.email);
  await page.getByTestId("members-panel").getByRole("button", { name: "Add" }).click();
  await expect(page.getByTestId("member-row")).toHaveCount(2);

  const context = await browser.newContext();
  const memberPage = await context.newPage();
  await signInThroughUi(memberPage, member);
  await memberPage.getByRole("link", { name: /Leave test/ }).click();
  await memberPage.getByRole("button", { name: "Leave project" }).click();
  await memberPage.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(memberPage).toHaveURL(/\/projects$/);
  await expect(memberPage.getByRole("heading", { name: "No projects yet" })).toBeVisible();
  await expect(page.getByTestId("member-row")).toHaveCount(1);
  await expect(page.getByTestId("activity-feed")).toContainText("left the project");
  await context.close();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Type the project name to confirm deletion").fill("Leave test");
  await page.getByRole("dialog", { name: "Project settings" }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
});
