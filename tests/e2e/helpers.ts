import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { LoginTab } from "../../src/lib/roles.ts";

const demoPassword = process.env.DEMO_USER_PASSWORD ?? "";

/** Credentials come from env (.env.local); nothing is hard-coded. */
export const accounts = {
  tpo: { tab: "staff" as LoginTab, email: process.env.E2E_TPO_EMAIL ?? process.env.DEMO_TPO_EMAIL ?? "", password: process.env.E2E_TPO_PASSWORD ?? process.env.DEMO_TPO_PASSWORD ?? "" },
  student: { tab: "student" as LoginTab, email: process.env.E2E_STUDENT_EMAIL ?? "vedant.kadam@institute.edu", password: process.env.E2E_STUDENT_PASSWORD ?? demoPassword },
  alumni: { tab: "alumni" as LoginTab, email: process.env.E2E_ALUMNI_EMAIL ?? "snehal.kale@alumni.institute.edu", password: process.env.E2E_ALUMNI_PASSWORD ?? demoPassword },
};

const tabName: Record<LoginTab, string> = { staff: "TPO Admin", student: "Student", alumni: "Alumni" };

export async function fillLogin(page: Page, account: { tab: LoginTab; email: string; password: string }, options: { remember?: boolean } = {}) {
  if (!account.email || !account.password) throw new Error("Set DEMO_TPO_EMAIL/DEMO_TPO_PASSWORD and DEMO_USER_PASSWORD (or E2E_* overrides) for e2e tests.");
  await page.getByRole("tab", { name: tabName[account.tab] }).click();
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  const remember = page.getByLabel("Remember me");
  if (options.remember === false) await remember.uncheck(); else await remember.check();
  await page.getByRole("button", { name: /continue as/i }).click();
}

export async function signIn(page: Page, account: { tab: LoginTab; email: string; password: string }, options: { remember?: boolean } = {}) {
  await page.goto("/login");
  await fillLogin(page, account, options);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.locator(".app-shell")).toBeVisible({ timeout: 20_000 });
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator(".toast").filter({ hasText: text })).toBeVisible({ timeout: 15_000 });
}

export function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for e2e tests.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
