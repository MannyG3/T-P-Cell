// Server-only: uses the service-role key, which bypasses Row Level Security.
// Never import this module from a client component.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, "Server is missing SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Anon-key client for public Auth endpoints (e.g. sending password-setup emails). */
export function publicClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new HttpError(500, "Server is missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export { serviceClient };

/** Verifies the request's bearer token belongs to an admin and returns a service-role client. */
export async function requireAdmin(request: Request): Promise<{ admin: SupabaseClient; userId: string }> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Not signed in.");
  const admin = serviceClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) throw new HttpError(401, "Your session has expired. Sign in again.");
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (profile?.role !== "admin") throw new HttpError(403, "Only TPO admins can do this.");
  return { admin, userId: user.id };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
}
