import { errorResponse, HttpError, requireAdmin } from "@/lib/supabase-admin";

type AlumniRequest = {
  id: number;
  full_name: string;
  personal_email: string;
  department_id: number | null;
  passing_year: number | null;
  current_company: string | null;
  status: string;
};

/**
 * Approve or reject an alumni access request (TPO Admin only).
 * Approving sends a Supabase invite to the alumnus's personal email.
 * Body: { id: number, action: "approve" | "reject" }
 */
export async function POST(request: Request) {
  try {
    const { admin, userId } = await requireAdmin(request);
    const body = (await request.json().catch(() => null)) as { id?: number; action?: string } | null;
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Missing request id.");
    if (body?.action !== "approve" && body?.action !== "reject") throw new HttpError(400, "action must be approve or reject.");

    const { data: req } = await admin.from("alumni_requests").select("*").eq("id", id).single<AlumniRequest>();
    if (!req) throw new HttpError(404, "Request not found.");
    if (req.status !== "pending") throw new HttpError(409, `This request was already ${req.status}.`);

    if (body.action === "approve") {
      const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const { error } = await admin.auth.admin.inviteUserByEmail(req.personal_email, {
        redirectTo: `${origin}/auth/confirm?next=/reset-password`,
        data: {
          role: "alumni",
          full_name: req.full_name,
          department_id: req.department_id ?? undefined,
          batch_year: req.passing_year ?? undefined,
          current_company: req.current_company ?? undefined,
        },
      });
      if (error) {
        if (/already been registered/i.test(error.message)) throw new HttpError(409, "An account with this email already exists. Reject this request instead.");
        if (/sending/i.test(error.message)) throw new HttpError(502, "Supabase couldn't send the invite email. Configure custom SMTP in Supabase → Authentication → Emails.");
        throw new HttpError(500, error.message);
      }
    }

    const { error: updateError } = await admin
      .from("alumni_requests")
      .update({ status: body.action === "approve" ? "approved" : "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) throw new HttpError(500, updateError.message);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
