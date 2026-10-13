import { expect, type Page, type TestInfo } from "@playwright/test";
import { createVerifiedSession, type TestAccount } from "../support/accounts";
import { readTargetEnv } from "../support/env";

export const target = readTargetEnv();

/** Fresh verified synthetic account, created through the deployed auth API and test mailbox. */
export async function verifiedAccount(label: string): Promise<TestAccount> {
  const { email, password, name } = await createVerifiedSession(target, label);
  return { email, password, name };
}

export async function signInThroughUi(page: Page, account: TestAccount) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByTestId("current-user")).toHaveText(account.name);
}

export async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}
