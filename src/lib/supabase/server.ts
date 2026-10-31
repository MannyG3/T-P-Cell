import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { applyRemember, isPersistent, REMEMBER_COOKIE } from "@/lib/auth/remember";
import { isAccountRole, type AccountRole } from "@/lib/roles";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return { url, key };
}

/**
 * Cookie-session Supabase client for Server Components, Server Actions and Route Handlers.
 * Pass `persistent` when the caller has just decided it (the sign-in action); otherwise the
 * choice stored in REMEMBER_COOKIE is used.
 */
export async function createSupabaseServerClient(options: { persistent?: boolean } = {}) {
  const { url, key } = env();
  const store = await cookies();
  const persistent = options.persistent ?? isPersistent(store.get(REMEMBER_COOKIE)?.value);

  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options: cookieOptions } of toSet) store.set(name, value, applyRemember(cookieOptions, persistent));
        } catch {
          // Server Components cannot set cookies. That's fine: the proxy refreshes sessions.
        }
      },
    },
  });
}

export type ServerProfile = {
  id: string;
  email: string;
  fullName: string;
  role: AccountRole;
  departmentId: number | null;
  status: "active" | "disabled";
};

/** The signed-in user's profile, verified server-side, or null when signed out / no usable profile. */
export async function getCurrentProfile(): Promise<ServerProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, department_id, status")
    .eq("id", user.id)
    .single<{ id: string; email: string; full_name: string; role: string; department_id: number | null; status: "active" | "disabled" }>();
  if (!data || !isAccountRole(data.role)) return null;
  return { id: data.id, email: data.email, fullName: data.full_name, role: data.role, departmentId: data.department_id, status: data.status };
}
