import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { getCurrentProfile } from "@/lib/supabase/server";
import { homeForRole, isLoginTab, safeNext } from "@/lib/roles";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in | CampusTrack" };

const MESSAGES: Record<string, string> = {
  "no-profile": "Your account has no CampusTrack profile yet. Contact your Training & Placement Office.",
  disabled: "This account has been disabled. Contact your Training & Placement Office.",
  "link-expired": "That link has expired or was already used. Request a new one with “Forgot password?”.",
};
const NOTICES: Record<string, string> = {
  "password-updated": "Password updated. Sign in with your new password.",
  "signed-out": "You've been signed out.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const next = safeNext(one("next")) ?? "";

  // Already signed in with a usable profile: skip the form.
  const profile = await getCurrentProfile();
  if (profile && profile.status === "active" && !one("error")) redirect(next || homeForRole(profile.role));

  const tab = one("tab");
  return (
    <AuthLayout>
      <LoginForm
        initialTab={isLoginTab(tab) ? tab : "staff"}
        next={next}
        initialError={MESSAGES[one("error") ?? ""]}
        initialInfo={NOTICES[one("notice") ?? ""]}
      />
    </AuthLayout>
  );
}
