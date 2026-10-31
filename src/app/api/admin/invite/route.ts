import { errorResponse, HttpError, requireAdmin } from "@/lib/supabase-admin";
import { isAccountRole } from "@/lib/roles";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Invites a user by email (TPO Admin only). The emailed link lands on /auth/confirm and
 * then /reset-password, where they choose a password. The role is set here, server-side;
 * the on_auth_user_created trigger turns the invite metadata into a profile.
 * Body: { email, full_name, role, department_id?, roll_no?, batch_year? }
 */
export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const email = str(body?.email).toLowerCase();
    const fullName = str(body?.full_name, 120);
    const role = body?.role;
    const departmentId = Number(body?.department_id) || null;
    const rollNo = str(body?.roll_no, 40);
    const batchYear = Number(body?.batch_year) || null;

    if (!EMAIL.test(email)) throw new HttpError(400, "Enter a valid email address.");
    if (fullName.length < 2) throw new HttpError(400, "Enter the person's full name.");
    if (!isAccountRole(role)) throw new HttpError(400, "Choose a role.");
    if ((role === "dept_coordinator" || role === "student") && !departmentId) throw new HttpError(400, "Choose a department.");
    if (role === "student") {
      if (!rollNo) throw new HttpError(400, "Students need a roll number.");
      if (!batchYear || batchYear < 1950 || batchYear > 2100) throw new HttpError(400, "Students need a valid batch year.");
      const { data: clash } = await admin.from("students").select("id").eq("roll_no", rollNo).maybeSingle();
      if (clash) throw new HttpError(409, `Roll number ${rollNo} already belongs to another student.`);
    }
    if (departmentId) {
      const { data: dept } = await admin.from("departments").select("id").eq("id", departmentId).maybeSingle();
      if (!dept) throw new HttpError(400, "That department doesn't exist.");
    }

    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/reset-password`,
      data: {
        role,
        full_name: fullName,
        department_id: departmentId ?? undefined,
        roll_no: role === "student" ? rollNo : undefined,
        batch_year: batchYear ?? undefined,
      },
    });
    if (error) {
      if (/already been registered/i.test(error.message)) throw new HttpError(409, "An account with this email already exists.");
      if (/sending/i.test(error.message)) throw new HttpError(502, "Supabase couldn't send the invite email. Configure custom SMTP in Supabase → Authentication → Emails.");
      throw new HttpError(500, error.message);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
