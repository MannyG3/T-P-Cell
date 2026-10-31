"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { REMEMBER_COOKIE, rememberCookieOptions } from "@/lib/auth/remember";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homeForRole, isAccountRole, isLoginTab, loginTabLabel, roleLabel, safeNext, tabForRole, tabRoles } from "@/lib/roles";

export type AuthFormState = { error?: string; info?: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const tab = formData.get("tab");
  const email = text(formData.get("email")).toLowerCase();
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";
  const remember = formData.get("remember") === "on";
  const next = safeNext(text(formData.get("next")));

  if (!isLoginTab(tab)) return { error: "Choose how you're signing in." };
  if (!EMAIL.test(email) || !password) return { error: "Enter your email and password to continue." };

  // Record the choice first so the auth cookies written below get the right lifetime.
  (await cookies()).set(REMEMBER_COOKIE, remember ? "1" : "0", rememberCookieOptions(remember));
  const supabase = await createSupabaseServerClient({ persistent: remember });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.message === "Invalid login credentials") return { error: "Incorrect email or password." };
    if (error?.message === "Email not confirmed") return { error: "Your account isn't activated yet. Open the invite link we emailed you." };
    return { error: error?.message ?? "Could not sign in. Try again." };
  }

  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", data.user.id).single<{ role: string; status: string }>();
  const fail = async (message: string): Promise<AuthFormState> => {
    await supabase.auth.signOut();
    return { error: message };
  };
  if (!profile || !isAccountRole(profile.role)) return fail("Your account has no CampusTrack profile yet. Contact your Training & Placement Office.");
  if (profile.status === "disabled") return fail("This account has been disabled. Contact your Training & Placement Office.");
  if (!tabRoles[tab].includes(profile.role)) {
    return fail(`This is a ${roleLabel[profile.role]} account. Switch to the ${loginTabLabel[tabForRole(profile.role)]} tab to sign in.`);
  }

  redirect(next ?? homeForRole(profile.role));
}

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData.get("email")).toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter your email address first, then choose “Forgot password?”." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password` });
  if (error?.status === 429) return { error: "Too many reset requests. Wait a few minutes and try again." };
  if (error) console.error("resetPasswordForEmail failed:", error.message);
  // Same message whether or not the account exists, so emails can't be probed.
  return { info: `If ${email} has a CampusTrack account, a password reset link is on its way. Check your inbox and spam folder.` };
}
