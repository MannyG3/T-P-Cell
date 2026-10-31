import { errorResponse, HttpError, serviceClient } from "@/lib/supabase-admin";

/**
 * Called daily by Vercel Cron (see vercel.json). A real query keeps a free-tier
 * Supabase project from pausing after 7 days without activity.
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set.
 */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new HttpError(500, "CRON_SECRET is not configured.");
    if (request.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorized.");

    const { count, error } = await serviceClient().from("profiles").select("id", { count: "exact", head: true });
    if (error) throw new HttpError(502, `Supabase query failed: ${error.message}`);
    return Response.json({ ok: true, profiles: count, at: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}
