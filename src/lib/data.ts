import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AccountRole, Alumnus, Application, Company, DashboardData, Drive, Notification, SessionUser, Student } from "./types";

const PAGE_SIZE = 1000;

// PostgREST caps responses (1000 rows by default), so page through large tables.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function loadSessionUser(supabase: SupabaseClient, user: User): Promise<SessionUser | null> {
  const { data, error } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single<{ role: AccountRole; full_name: string; email: string }>();
  if (error || !data) return null;
  return { id: user.id, email: data.email, fullName: data.full_name, role: data.role };
}

export async function loadDashboardData(supabase: SupabaseClient): Promise<DashboardData> {
  const [students, alumni, companies, drives, applications, notifications] = await Promise.all([
    fetchAll<Student>((from, to) => supabase.from("students").select("*, profiles(full_name, email)").order("updated_at", { ascending: false }).range(from, to)),
    fetchAll<Alumnus>((from, to) => supabase.from("alumni").select("*, profiles(full_name, email)").order("batch_year", { ascending: false }).range(from, to)),
    fetchAll<Company>((from, to) => supabase.from("companies").select("*").order("name").range(from, to)),
    fetchAll<Drive>((from, to) => supabase.from("drives").select("*, companies(name)").order("drive_date").range(from, to)),
    fetchAll<Application>((from, to) => supabase.from("applications").select("id, student_id, drive_id, status, applied_at").range(from, to)),
    fetchAll<Notification>((from, to) => supabase.from("notifications").select("*").order("created_at", { ascending: false }).range(from, to)),
  ]);
  return { students, alumni, companies, drives, applications, notifications };
}

export function throwIfError<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}

/** Calls an admin-only API route with the signed-in user's access token. */
export async function adminRequest<T>(supabase: SupabaseClient, path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}
