import { expect, test } from "@playwright/test";
import { accounts, signIn } from "./helpers";

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email address").fill(accounts.tpo.email);
  await page.getByPlaceholder("Enter your password").fill("definitely-wrong");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("alert")).toHaveText(/incorrect email or password/i);
});

test("does not offer public sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/create one here/i)).toHaveCount(0);
  await expect(page.getByText(/Training & Placement Office creates your account/i)).toBeVisible();
});

test("TPO session survives a reload and signs out cleanly", async ({ page }) => {
  await signIn(page, accounts.tpo);
  await expect(page.locator(".metrics-grid")).toBeVisible();
  await page.reload();
  await expect(page.locator(".metrics-grid")).toBeVisible({ timeout: 20_000 });

  // Opening notifications first must not block the account menu.
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.locator(".top-avatar").click();
  await page.locator(".account-popover").getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: /sign in to your workspace/i })).toBeVisible();
});
