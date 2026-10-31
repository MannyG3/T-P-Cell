import { expect, test } from "@playwright/test";
import { accounts, anonClient, expectToast, signIn } from "./helpers";

test("student can apply to an open drive and withdraw again", async ({ page }) => {
  await signIn(page, accounts.student);
  await expect(page.getByRole("heading", { name: /hello/i })).toBeVisible();
  const rows = page.locator(".drives-panel .drive-row");

  // Round-trip from whichever state the shared demo data is in.
  const applyRow = rows.filter({ has: page.getByRole("button", { name: "Apply" }) }).first();
  const withdrawRow = rows.filter({ has: page.getByRole("button", { name: "Withdraw" }) }).first();
  if (await applyRow.count()) {
    const company = await applyRow.locator(".drive-info strong").innerText();
    await applyRow.getByRole("button", { name: "Apply" }).click();
    await expectToast(page, "Application submitted");
    const row = rows.filter({ hasText: company });
    await row.getByRole("button", { name: "Withdraw" }).click();
    await expectToast(page, "Application withdrawn");
    await expect(row.getByRole("button", { name: "Apply" })).toBeVisible();
  } else {
    test.skip(!(await withdrawRow.count()), "No drive available to apply to or withdraw from for this student.");
    const company = await withdrawRow.locator(".drive-info strong").innerText();
    await withdrawRow.getByRole("button", { name: "Withdraw" }).click();
    await expectToast(page, "Application withdrawn");
    const row = rows.filter({ hasText: company });
    await row.getByRole("button", { name: "Apply" }).click();
    await expectToast(page, "Application submitted");
  }
});

test("alumni see opportunities and their profile settings", async ({ page }) => {
  await signIn(page, accounts.alumni);
  await expect(page.getByRole("heading", { name: /hello/i })).toBeVisible();
  await page.locator(".nav-item", { hasText: "My account" }).click();
  await expect(page.getByRole("heading", { name: "Alumni profile" })).toBeVisible();
});

test.describe("database rules", () => {
  test("public sign-up is rejected", async () => {
    const { error } = await anonClient().auth.signUp({ email: `intruder.${Date.now()}@example.com`, password: "password123", options: { data: { role: "student", full_name: "Intruder" } } });
    expect(error?.message ?? "").toMatch(/database error|sign-up is disabled/i);
  });

  test("a student cannot change their own CGPA or placement status", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signInWithPassword(accounts.student);
    expect(error).toBeNull();
    const id = data.user!.id;
    const before = (await client.from("students").select("cgpa, placement_status").eq("id", id).single()).data!;
    await client.from("students").update({ cgpa: 9.99, placement_status: "placed" }).eq("id", id);
    const after = (await client.from("students").select("cgpa, placement_status").eq("id", id).single()).data!;
    expect(after).toEqual(before);
  });
});
