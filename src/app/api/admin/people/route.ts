import { randomBytes } from "node:crypto";
import { errorResponse, HttpError, publicClient, requireAdmin } from "@/lib/supabase-admin";

// Each row is a few sequential Auth API calls; the client sends imports in chunks
// (see IMPORT_CHUNK_SIZE in Import.tsx) so a chunk finishes well within this limit.
export const maxDuration = 60;

type Kind = "students" | "alumni";
type RowResult = { row: number; email: string; ok: boolean; error?: string };

const MAX_ROWS = 200;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEMENT = new Set(["placed", "unplaced", "higher-studies"]);

const text = (value: unknown) => (typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim());
const numberOrNull = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};
const yes = (value: unknown) => ["yes", "y", "true", "1"].includes(text(value).toLowerCase());

/**
 * Creates student or alumni accounts (one or many rows, e.g. from a CSV import).
 * Body: { kind: "students" | "alumni", rows: Record<string, string>[], rowOffset?: number, sendInvites?: boolean }
 * With sendInvites, each new account is emailed a link to set its password (needs SMTP configured in Supabase).
 */
export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = (await request.json().catch(() => null)) as { kind?: Kind; rows?: Record<string, unknown>[]; rowOffset?: number; sendInvites?: boolean } | null;
    const kind = body?.kind;
    const rows = body?.rows;
    const rowOffset = Number.isInteger(body?.rowOffset) ? Number(body?.rowOffset) : 0;
    const mailer = body?.sendInvites ? publicClient() : null;
    const redirectTo = request.headers.get("origin") ?? undefined;
    if (kind !== "students" && kind !== "alumni") throw new HttpError(400, "kind must be 'students' or 'alumni'.");
    if (!Array.isArray(rows) || rows.length === 0) throw new HttpError(400, "No rows to import.");
    if (rows.length > MAX_ROWS) throw new HttpError(400, `Send at most ${MAX_ROWS} rows per request.`);

    const existingRolls = new Set<string>();
    if (kind === "students") {
      const { data } = await admin.from("students").select("roll_no");
      for (const r of data ?? []) existingRolls.add(String(r.roll_no).toLowerCase());
    }
    const seenEmails = new Set<string>();
    const results: RowResult[] = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = rowOffset + index + 2; // header is row 1 in the spreadsheet
      const email = text(row.email).toLowerCase();
      const fail = (error: string) => results.push({ row: rowNumber, email, ok: false, error });

      const fullName = text(row.full_name);
      const department = text(row.department);
      const batchYear = numberOrNull(row.batch_year);
      if (!EMAIL.test(email)) { fail("Invalid or missing email."); continue; }
      if (seenEmails.has(email)) { fail("Duplicate email in this file."); continue; }
      seenEmails.add(email);
      if (!fullName) { fail("Missing full_name."); continue; }
      if (!department) { fail("Missing department."); continue; }
      if (batchYear === null || !Number.isInteger(batchYear) || batchYear < 1950 || batchYear > 2100) { fail("batch_year must be a 4-digit year."); continue; }

      const rollNo = text(row.roll_no);
      const extra: Record<string, unknown> = {};
      if (kind === "students") {
        if (!rollNo) { fail("Missing roll_no."); continue; }
        if (existingRolls.has(rollNo.toLowerCase())) { fail(`Roll number ${rollNo} already exists.`); continue; }
        const cgpa = numberOrNull(row.cgpa);
        const percentage = numberOrNull(row.percentage);
        const backlogs = numberOrNull(row.backlog_count ?? row.backlogs);
        const placedPackage = numberOrNull(row.placed_package);
        const status = text(row.placement_status).toLowerCase().replace(/\s+/g, "-") || "unplaced";
        if (Number.isNaN(cgpa) || (cgpa !== null && (cgpa < 0 || cgpa > 10))) { fail("cgpa must be between 0 and 10."); continue; }
        if (Number.isNaN(percentage) || (percentage !== null && (percentage < 0 || percentage > 100))) { fail("percentage must be between 0 and 100."); continue; }
        if (Number.isNaN(backlogs) || (backlogs !== null && (!Number.isInteger(backlogs) || backlogs < 0))) { fail("backlog_count must be a whole number."); continue; }
        if (Number.isNaN(placedPackage)) { fail("placed_package must be a number (LPA)."); continue; }
        if (!PLACEMENT.has(status)) { fail("placement_status must be placed, unplaced or higher-studies."); continue; }
        Object.assign(extra, {
          cgpa,
          percentage,
          backlog_count: backlogs ?? 0,
          division: text(row.division) || null,
          contact: text(row.contact) || null,
          skills: text(row.skills) ? text(row.skills).split(/[;|]/).map((s) => s.trim()).filter(Boolean) : [],
          placement_status: status,
          placed_company: text(row.placed_company) || null,
          placed_package: placedPackage,
        });
      } else {
        Object.assign(extra, {
          location: text(row.location) || null,
          linkedin_url: text(row.linkedin_url) || null,
          contact: text(row.contact) || null,
          willing_to_refer: yes(row.willing_to_refer),
          willing_to_mentor: yes(row.willing_to_mentor),
        });
      }

      // The on_auth_user_created trigger creates the profile + student/alumni row from this metadata.
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: randomBytes(18).toString("base64url"),
        email_confirm: true,
        // Only the service role can set app_metadata; the sign-up trigger requires this flag.
        app_metadata: { provisioned: true },
        user_metadata: {
          role: kind === "students" ? "student" : "alumni",
          full_name: fullName,
          department,
          batch_year: batchYear,
          roll_no: kind === "students" ? rollNo : undefined,
          current_company: kind === "alumni" ? text(row.current_company) || undefined : undefined,
          designation: kind === "alumni" ? text(row.designation) || undefined : undefined,
        },
      });
      if (error || !data.user) {
        fail(error?.message.includes("already been registered") ? "An account with this email already exists." : error?.message ?? "Could not create account.");
        continue;
      }
      if (kind === "students") existingRolls.add(rollNo.toLowerCase());

      const warnings: string[] = [];
      const { error: updateError } = await admin.from(kind).update(extra).eq("id", data.user.id);
      if (updateError) warnings.push(`some details were not saved (${updateError.message})`);
      if (mailer) {
        const { error: mailError } = await mailer.auth.resetPasswordForEmail(email, { redirectTo });
        if (mailError) warnings.push(`password-setup email not sent (${mailError.message})`);
      }
      results.push(warnings.length
        ? { row: rowNumber, email, ok: true, error: `Account created, but ${warnings.join("; ")}.` }
        : { row: rowNumber, email, ok: true });
    }

    const created = results.filter((r) => r.ok).length;
    return Response.json({ created, failed: results.length - created, results });
  } catch (error) {
    return errorResponse(error);
  }
}
