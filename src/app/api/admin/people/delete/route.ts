import { errorResponse, HttpError, requireAdmin } from "@/lib/supabase-admin";

/** Permanently deletes a student or alumni account. Body: { id: string } */
export async function POST(request: Request) {
  try {
    const { admin, userId } = await requireAdmin(request);
    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    const id = body?.id;
    if (!id) throw new HttpError(400, "Missing id.");
    if (id === userId) throw new HttpError(400, "You cannot delete your own account.");

    const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single<{ role: string }>();
    if (!profile) throw new HttpError(404, "Account not found.");
    if (profile.role === "admin") throw new HttpError(400, "Admin accounts cannot be deleted from the dashboard.");

    // Cascades to profiles -> students/alumni -> applications.
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new HttpError(500, error.message);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
