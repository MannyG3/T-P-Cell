import { errorResponse, HttpError, publicClient, requireAdmin } from "@/lib/supabase-admin";

/**
 * Emails a password-setup link to an existing user (TPO Admin only). Sent from the server
 * with a non-PKCE client so the link works in whichever browser the recipient opens it.
 * Body: { id: string }
 */
export async function POST(request: Request) {
  try {
    const { admin } = await requireAdmin(request);
    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    if (!body?.id) throw new HttpError(400, "Missing id.");
    const { data: profile } = await admin.from("profiles").select("email").eq("id", body.id).single<{ email: string }>();
    if (!profile) throw new HttpError(404, "Account not found.");

    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const { error } = await publicClient().auth.resetPasswordForEmail(profile.email, { redirectTo: `${origin}/auth/confirm?next=/reset-password` });
    if (error?.status === 429) throw new HttpError(429, "Email rate limit reached. Try again in a few minutes.");
    if (error) throw new HttpError(502, `Couldn't send the email: ${error.message}`);
    return Response.json({ ok: true, email: profile.email });
  } catch (error) {
    return errorResponse(error);
  }
}
