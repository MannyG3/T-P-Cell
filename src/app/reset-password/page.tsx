import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Set your password | CampusTrack" };

export default async function ResetPasswordPage() {
  // The session here comes from the emailed link, verified on /auth/confirm.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <AuthLayout>
      <p className="eyebrow">ACCOUNT SECURITY</p>
      <h2>{user ? "Choose a new password" : "Link expired"}</h2>
      {user ? (
        <>
          <p className="login-subtitle">For {user.email}. You&apos;ll use it to sign in from now on.</p>
          <ResetPasswordForm email={user.email ?? ""} />
        </>
      ) : (
        <>
          <p className="login-subtitle">This page only works from a password or invite link, and each link can be used once.</p>
          <Link className="login-submit" href="/login"><span>Back to sign in</span> <span>&rarr;</span></Link>
          <p className="login-help">Use “Forgot password?” on the sign-in page to get a new link.</p>
        </>
      )}
    </AuthLayout>
  );
}
