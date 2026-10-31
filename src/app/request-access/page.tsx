import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RequestAccessForm } from "./RequestAccessForm";

export const metadata: Metadata = { title: "Request alumni access | CampusTrack" };

export default async function RequestAccessPage() {
  const supabase = await createSupabaseServerClient();
  const { data: departments } = await supabase.from("departments").select("id, name").eq("is_active", true).order("name");

  return (
    <AuthLayout>
      <p className="eyebrow">ALUMNI</p>
      <h2>Request an alumni account</h2>
      <p className="login-subtitle">Use a personal email you&apos;ll keep. The Training &amp; Placement Office verifies every request before sending an invite.</p>
      <RequestAccessForm departments={departments ?? []} />
      <p className="login-help">Already have an account? <Link href="/login?tab=alumni">Sign in</Link></p>
    </AuthLayout>
  );
}
