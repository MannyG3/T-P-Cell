"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/app/login/actions";

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";
  const confirm = typeof formData.get("confirm") === "string" ? (formData.get("confirm") as string) : "";
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The passwords don't match." };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one from the sign-in page." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Sign out everywhere so the new password is required from now on.
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?notice=password-updated");
}
