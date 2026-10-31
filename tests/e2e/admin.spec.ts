import { expect, test } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { accounts, expectToast, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, accounts.tpo);
});

test("overview shows live metrics", async ({ page }) => {
  await expect(page.locator(".metric-card")).toHaveCount(4);
  await expect(page.locator(".metric-card strong").first()).toHaveText(/\d/);
  await expect(page.getByRole("heading", { name: "Placement pulse" })).toBeVisible();
});

test("students can be searched and filtered", async ({ page }) => {
  await page.locator(".nav-item", { hasText: "Students" }).click();
  await page.getByLabel("Filter by status").selectOption("placed");
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  for (const badge of await page.locator("tbody .badge").allInnerTexts()) expect(badge).toBe("Placed");
});

test("create a drive with a deadline, then delete it", async ({ page }) => {
  const name = `E2E Corp ${Date.now()}`;
  await page.locator(".nav-item", { hasText: "Placement drives" }).click();
  await page.getByRole("button", { name: /create drive/i }).click();
  const modal = page.locator(".modal");
  await modal.getByLabel("Company", { exact: true }).fill(name);
  await modal.getByLabel("Role").fill("Test Engineer");
  await modal.getByLabel("Drive date").fill("2030-12-15");
  await modal.getByLabel("Applications close").fill("2030-12-10");
  await modal.getByRole("button", { name: "Create drive" }).click();
  await expectToast(page, `${name} drive created`);
  await expect(modal.locator(".modal-head h2")).toHaveText(name);
  await expect(modal.locator(".modal-head p")).toContainText("Applications close");

  await modal.getByRole("button", { name: "Delete drive" }).click();
  await modal.getByRole("button", { name: /delete drive/i }).last().click();
  await expectToast(page, "Drive deleted");
});

test("CSV import creates valid rows, reports bad ones, and the student can be deleted", async ({ page }) => {
  const stamp = Date.now();
  const file = path.join(os.tmpdir(), `e2e-import-${stamp}.csv`);
  fs.writeFileSync(file, `Full Name,Email,Roll No,Department,Batch Year,CGPA\nE2E Student,e2e.${stamp}@institute.edu,E2E-${stamp},Computer Engineering,2025,7.5\nBad Row,not-an-email,E2E-X${stamp},Computer Engineering,2025,7\n`);

  await page.locator(".nav-item", { hasText: "Import data" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(file);
  await expect(page.locator(".modal-head h2")).toHaveText("Import 2 students?");
  await page.locator(".modal-foot").getByRole("button", { name: "Import" }).click();
  await expect(page.locator(".import-result")).toContainText("1 students created · 1 skipped");
  await expect(page.locator(".import-result")).toContainText("Invalid or missing email");

  await page.locator(".nav-item", { hasText: "Students" }).click();
  await page.getByPlaceholder(/search name/i).fill(`E2E-${stamp}`);
  await page.locator("tbody tr").first().click();
  await page.locator(".modal-foot").getByRole("button", { name: "Delete student" }).click();
  await page.locator(".modal-foot").getByRole("button", { name: "Delete permanently" }).click();
  await expectToast(page, "deleted");
  fs.rmSync(file, { force: true });
});
