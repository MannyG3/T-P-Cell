"use client";

import { useRouter } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SessionUser } from "@/lib/types";

export function DashboardApp({ user }: { user: SessionUser }) {
  const router = useRouter();
  // signOut() has already cleared the session cookies, so the server-rendered /login sees a signed-out visitor.
  return <Dashboard supabase={getSupabaseBrowserClient()} user={user} onSignOut={() => { router.replace("/login?notice=signed-out"); router.refresh(); }} />;
}
