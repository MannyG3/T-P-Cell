import { expect, test } from "@playwright/test";
import { accounts, fillLogin, signIn } from "./helpers";

test("protected routes redirect to /login and come back after sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await fillLogin(page, accounts.tpo);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/login");
  await fillLogin(page, { ...accounts.tpo, password: "definitely-wrong-password" });
  await expect(page.locator(".login-error")).toHaveText(/incorrect email or password/i);
});

test("rejects a role/tab mismatch with a clear message", async ({ page }) => {
  await page.goto("/login");
  await fillLogin(page, { ...accounts.student, tab: "staff" });
  await expect(page.locator(".login-error")).toHaveText(/this is a student account.*student tab/i);
  await expect(page).toHaveURL(/\/login/);
});

test("login page: ARIA tabs, per-role footer, autocomplete, no open TPO signup", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("tablist")).toBeVisible();
  await expect(page.getByRole("tab", { name: "TPO Admin" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('input[name="email"]')).toHaveAttribute("autocomplete", "email");
  await expect(page.locator('input[name="password"]')).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByText(/need a tpo account/i)).toHaveCount(0);

  await page.getByRole("tab", { name: "Student" }).click();
  await expect(page.getByText(/staff access/i)).toHaveCount(0);
  await page.getByRole("tab", { name: "Alumni" }).click();
  await expect(page.getByText("Personal email")).toBeVisible();
  await expect(page.getByRole("link", { name: "Request access" })).toBeVisible();
  await expect(page.locator(".login-art-footer")).toContainText(/Academic year \d{4}–\d{2}/);
});

test("forgot password shows a neutral confirmation", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill("nobody.here@example.com");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  const info = page.getByRole("status");
  await expect(info).toContainText(/reset link is on its way/i);
  await expect(info).toHaveClass(/login-info/);
});

test("refresh keeps the session; sign-out locks protected routes", async ({ page }) => {
  await signIn(page, accounts.tpo);
  await page.reload();
  await expect(page.locator(".metrics-grid")).toBeVisible({ timeout: 20_000 });

  await page.locator(".top-avatar").click();
  await page.locator(".account-popover").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("'Remember me' unticked issues session-only auth cookies", async ({ page, context }) => {
  await signIn(page, accounts.tpo, { remember: false });
  const authCookies = (await context.cookies()).filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  expect(authCookies.length).toBeGreaterThan(0);
  for (const cookie of authCookies) expect(cookie.expires).toBe(-1); // -1 = session cookie
});

test("'Remember me' ticked issues persistent auth cookies", async ({ page, context }) => {
  await signIn(page, accounts.tpo, { remember: true });
  const authCookies = (await context.cookies()).filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  expect(authCookies.length).toBeGreaterThan(0);
  for (const cookie of authCookies) expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 86_400);
});
