import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const accounts = {
  tpo: { email: process.env.E2E_TPO_EMAIL ?? "tpo@institute.edu", password: process.env.E2E_TPO_PASSWORD ?? "demo1234" },
  student: { email: process.env.E2E_STUDENT_EMAIL ?? "vedant.kadam@institute.edu", password: process.env.E2E_STUDENT_PASSWORD ?? "demo1234" },
  alumni: { email: process.env.E2E_ALUMNI_EMAIL ?? "snehal.kale@alumni.institute.edu", password: process.env.E2E_ALUMNI_PASSWORD ?? "demo1234" },
};

export async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByPlaceholder("Enter your password").fill(account.password);
  await page.getByRole("button", { name: /sign in/i }).click();
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
